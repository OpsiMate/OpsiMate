import * as k8s from '@kubernetes/client-node';
import { DiscoveredPod, DiscoveredService, Logger, Provider, Service } from "@OpsiMate/shared";
import path from "path";
import fs from "fs";
import { getSecurityConfig } from '../config/config';
import { decryptPassword } from "../utils/encryption";

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

const getK8RLogs = async (_provider: Provider, serviceName: string, namespace: string) => {
    const k8sApi = createClient(_provider);
    return getServicePodLogs(k8sApi, serviceName, namespace);
}

async function getServicePodLogs(coreV1: k8s.CoreV1Api, serviceName: string, namespace: string): Promise<string> {
    // Get the Service
    const serviceResp = await coreV1.readNamespacedService(serviceName, namespace);
    const service = serviceResp.body;

    const selector = service.spec?.selector;
    if (!selector || Object.keys(selector).length === 0) {
        return `Service "${serviceName}" in namespace "${namespace}" has no selector.`;
    }

    const labelSelector = Object.entries(selector)
        .map(([key, val]) => `${key}=${val}`)
        .join(',');

    // Get the matching Pods
    const podsResp = await coreV1.listNamespacedPod(namespace, undefined, undefined, undefined, undefined, labelSelector);
    const pods = podsResp.body.items;

    if (pods.length === 0) {
        return "No logs available for service.";
    }

    const logs: string[] = [];
    for (const pod of pods) {
        const podName = pod.metadata?.name;
        if (!podName) continue;

        const logResp = await coreV1.readNamespacedPodLog(podName, namespace);
        logs.push(logResp.body);
    }

    return logs.join("\n");
}

const restartK8RServicePods = async (provider: Provider, serviceName: string) => {
    const k8sApi = createClient(provider);

    const serviceResp = await k8sApi.readNamespacedService(serviceName, 'default');
    const selector = serviceResp.body.spec?.selector;

    if (!selector || Object.keys(selector).length === 0) {
        throw new Error(`Service "${serviceName}" has no selector.`);
    }

    const labelSelector = Object.entries(selector).map(([k, v]) => `${k}=${v}`).join(',');
    const podsResp = await k8sApi.listNamespacedPod('default', undefined, undefined, undefined, undefined, labelSelector);
    const pods = podsResp.body.items;

    for (const pod of pods) {
        const podName = pod.metadata?.name;
        if (!podName) continue;

        await k8sApi.deleteNamespacedPod(podName, 'default');
    }
}

const getK8RPods = async (_provider: Provider, service: Service): Promise<DiscoveredPod[]> => {
    const k8sApi = createClient(_provider);
    const ns = service.containerDetails?.namespace || 'default';

    const serviceResp = await k8sApi.readNamespacedService(service.name, ns);
    const selector = serviceResp.body.spec?.selector;

    if (!selector || Object.keys(selector).length === 0) {
        return [];
    }

    const labelSelector = Object.entries(selector).map(([k, v]) => `${k}=${v}`).join(',');
    const podsResp = await k8sApi.listNamespacedPod(ns, undefined, undefined, undefined, undefined, labelSelector);
    const pods = podsResp.body.items;

    return pods.map(p => ({ name: p.metadata?.name || "No-Name" }));
}

const deleteK8RPod = async (_provider: Provider, podName: string, namespace: string): Promise<void> => {
    const k8sApi = createClient(_provider);

    try {
        await k8sApi.deleteNamespacedPod(podName, namespace);
        logger.info(`Pod: ${podName} in namespace: ${namespace} deleted successfully`);
    } catch (err) {
        logger.error(`Failed to delete pod: ${podName} in namespace: ${namespace}`, err);
        throw err;
    }
}

const getK8SServices = async (_provider: Provider): Promise<DiscoveredService[]> => {
    const k8sApi = createClient(_provider);
    const servicesResp = await k8sApi.listServiceForAllNamespaces();
    const services = servicesResp.body.items;

    const allResponses = services
        .filter(s => s.metadata?.namespace !== "kube-system")
        .map(async (service) => {
            const name = service.metadata?.name || 'unknown';
            const namespace = service.metadata?.namespace || 'default';
            const serviceType = service.spec?.type || 'ClusterIP';
            const serviceIp = service.spec?.clusterIP;
            const selector = service.spec?.selector;

            let serviceStatus = "Unknown";
            if (selector && Object.keys(selector).length > 0) {
                const labelSelector = Object.entries(selector).map(([k, v]) => `${k}=${v}`).join(',');
                const podsResp = await k8sApi.listNamespacedPod(namespace, undefined, undefined, undefined, undefined, labelSelector);
                serviceStatus = [...new Set(podsResp.body.items.map(i => i.status?.phase || "Unknown"))].join(", ");
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
