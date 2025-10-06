import * as k8s from '@kubernetes/client-node';
import { DiscoveredPod, DiscoveredService, Logger, Provider, Service } from "@OpsiMate/shared";
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { getSecurityConfig } from '../config/config';
import { decryptPassword } from "../utils/encryption";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getPrivateKeysDir(): string {
    const securityConfig = getSecurityConfig();
    return path.isAbsolute(securityConfig.private_keys_path)
        ? securityConfig.private_keys_path
        : path.resolve(__dirname, securityConfig.private_keys_path);
}

const logger = new Logger('kubeConnector.ts');

function getKeyPath(filename: string) {
    const privateKeysDir = getPrivateKeysDir();
    const filePath = path.join(privateKeysDir, filename);
    if (!fs.existsSync(filePath)) {
        throw new Error(`Key not found: ${filePath}`);
    }
    return filePath;
}

const createClient = (_provider: Provider): k8s.CoreV1Api => {
    const encryptedKubeConfig = fs.readFileSync(getKeyPath(_provider.privateKeyFilename!), 'utf-8');
    const decryptedKubeConfig = decryptPassword(encryptedKubeConfig);

    const kc: k8s.KubeConfig = new k8s.KubeConfig();
    kc.loadFromString(decryptedKubeConfig ?? '');

    return kc.makeApiClient(k8s.CoreV1Api);
}

const getK8RLogs = async (
    _provider: Provider, 
    serviceName: string, 
    namespace: string,
    filters?: {
        levels?: string[];
        searchText?: string;
        since?: string;
        until?: string;
        limit?: number;
        source?: string;
    }
) => {
    const k8sApi = createClient(_provider);
    return getServicePodLogs(k8sApi, serviceName, namespace, filters);
}

async function getServicePodLogs(
    coreV1: k8s.CoreV1Api, 
    serviceName: string, 
    namespace: string,
    filters?: {
        levels?: string[];
        searchText?: string;
        since?: string;
        until?: string;
        limit?: number;
        source?: string;
    }
): Promise<string> {
    // Get the Service
    const service = await coreV1.readNamespacedService({ name: serviceName, namespace });

    const selector = service.spec?.selector;
    if (!selector || Object.keys(selector).length === 0) {
        return `Service "${serviceName}" in namespace "${namespace}" has no selector.`;
    }

    const labelSelector = Object.entries(selector)
        .map(([key, val]) => `${key}=${val}`)
        .join(',');

    // Get the matching Pods
    const podsList = await coreV1.listNamespacedPod({ namespace, labelSelector });
    const pods: k8s.V1Pod[] = podsList.items ?? [];

    if (pods.length === 0) {
        return "No logs available for service.";
    }

    // Filter pods by source if specified
    const filteredPods = filters?.source 
        ? pods.filter(pod => pod.metadata?.name === filters.source)
        : pods;

    const logs: string[] = [];
    for (const pod of filteredPods) {
        const podName = pod.metadata?.name;
        if (!podName) continue;

        try {
            // Build log request options
            const logOptions: any = {
                name: podName,
                namespace,
                timestamps: true,
            };

            // Add time range filters
            if (filters?.since) {
                // Convert relative time to seconds if needed
                const sinceSeconds = parseRelativeTime(filters.since);
                if (sinceSeconds) {
                    logOptions.sinceSeconds = sinceSeconds;
                }
            }

            // Limit the number of lines
            const limit = filters?.limit || 1000;
            logOptions.tailLines = limit;

            const logText = await coreV1.readNamespacedPodLog(logOptions);
            
            if (logText) {
                // Add pod name as source prefix to each log line
                const podLogs = logText
                    .split('\n')
                    .filter(line => line.trim())
                    .map(line => `[${podName}] ${line}`)
                    .join('\n');
                
                logs.push(podLogs);
            }
        } catch (error) {
            logs.push(`[${podName}] Error fetching logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    return logs.length > 0 ? logs.join("\n") : "No logs available for service.";
}

/**
 * Parse relative time strings like "1h", "24h" to seconds
 */
function parseRelativeTime(timeStr: string): number | null {
    const match = timeStr.match(/^(\d+)([smhdw])$/);
    if (!match) return null;

    const [, amount, unit] = match;
    const amountNum = parseInt(amount);

    switch (unit) {
        case 's': return amountNum;
        case 'm': return amountNum * 60;
        case 'h': return amountNum * 60 * 60;
        case 'd': return amountNum * 24 * 60 * 60;
        case 'w': return amountNum * 7 * 24 * 60 * 60;
        default: return null;
    }
}

const restartK8RServicePods = async (provider: Provider, serviceName: string) => {
    const k8sApi = createClient(provider);

    const service = await k8sApi.readNamespacedService({ name: serviceName, namespace: 'default' });
    const selector = service.spec?.selector;

    if (!selector || Object.keys(selector).length === 0) {
        throw new Error(`Service "${serviceName}" has no selector.`);
    }

    const labelSelector = Object.entries(selector).map(([k, v]) => `${k}=${v}`).join(',');
    const podsList = await k8sApi.listNamespacedPod({ namespace: 'default', labelSelector });
    const pods: k8s.V1Pod[] = podsList.items ?? [];

    for (const pod of pods) {
        const podName = pod.metadata?.name;
        if (!podName) continue;

        await k8sApi.deleteNamespacedPod({ name: podName, namespace: 'default' });
    }
}

const getK8RPods = async (_provider: Provider, service: Service): Promise<DiscoveredPod[]> => {
    const k8sApi = createClient(_provider);
    const ns = service.containerDetails?.namespace || 'default';

    const serviceResp = await k8sApi.readNamespacedService({ name: service.name, namespace: ns });
    const selector = serviceResp.spec?.selector;

    if (!selector || Object.keys(selector).length === 0) {
        return [];
    }

    const labelSelector = Object.entries(selector).map(([k, v]) => `${k}=${v}`).join(',');
    const podsList = await k8sApi.listNamespacedPod({ namespace: ns, labelSelector });
    const pods: k8s.V1Pod[] = podsList.items ?? [];

    return pods.map((p: k8s.V1Pod) => ({ name: p.metadata?.name || "No-Name" }));
}

const deleteK8RPod = async (_provider: Provider, podName: string, namespace: string): Promise<void> => {
    const k8sApi = createClient(_provider);

    try {
        await k8sApi.deleteNamespacedPod({ name: podName, namespace });
        logger.info(`Pod: ${podName} in namespace: ${namespace} deleted successfully`);
    } catch (err) {
        logger.error(`Failed to delete pod: ${podName} in namespace: ${namespace}`, err);
        throw err;
    }
}

const getK8SServices = async (_provider: Provider): Promise<DiscoveredService[]> => {
    const k8sApi = createClient(_provider);
    const servicesList = await k8sApi.listServiceForAllNamespaces({});
    const services: k8s.V1Service[] = servicesList.items ?? [];

    const allResponses = services
        .filter((s: k8s.V1Service) => s.metadata?.namespace !== "kube-system")
        .map(async (service: k8s.V1Service) => {
            const name = service.metadata?.name || 'unknown';
            const namespace = service.metadata?.namespace || 'default';
            const serviceType = service.spec?.type || 'ClusterIP';
            const serviceIp = service.spec?.clusterIP;
            const selector = service.spec?.selector;

            let serviceStatus = "Unknown";
            if (selector && Object.keys(selector).length > 0) {
                const labelSelector = Object.entries(selector).map(([k, v]) => `${k}=${v}`).join(',');
                const podsList = await k8sApi.listNamespacedPod({ namespace, labelSelector });
                const items: k8s.V1Pod[] = podsList.items ?? [];
                
                if (items.length === 0) {
                    serviceStatus = "stopped";
                } else {
                    serviceStatus = [...new Set(items.map((i: k8s.V1Pod) => i.status?.phase || "Unknown"))].join(", ");
                }
            }

            return {
                name,
                serviceStatus,
                serviceIP: serviceIp || 'N/A',
                namespace,
                serviceType,
            };
        });

    return Promise.all(allResponses);
}

export { getK8SServices, getK8RLogs, deleteK8RPod, getK8RPods, restartK8RServicePods };
