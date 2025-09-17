import * as k8s from '@kubernetes/client-node';
import {DiscoveredPod, DiscoveredService, Logger, Provider, Service} from "@OpsiMate/shared";
import path from "path";
import fs from "fs";
import {ObjectCoreV1Api} from "@kubernetes/client-node/dist/gen/types/ObjectParamAPI";
import {getSecurityConfig} from '../config/config';
import {decryptPassword} from "../utils/encryption";

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

const createClient = async (_provider: Provider): Promise<ObjectCoreV1Api> => {
    const k8s = await import('@kubernetes/client-node');
    const encryptedKubeConfig = fs.readFileSync(getKeyPath(_provider.privateKeyFilename!), 'utf-8');
    const decryptedKubeConfig = decryptPassword(encryptedKubeConfig);

    const kc: k8s.KubeConfig = new k8s.KubeConfig();

    kc.loadFromString(decryptedKubeConfig ?? '');

    return kc.makeApiClient(k8s.CoreV1Api);
}

const getK8RLogs = async (_provider: Provider, serviceName: string, namespace: string) => {
    const k8sApi = await createClient(_provider)
    return getServicePodLogs(k8sApi, serviceName, namespace)
}

async function getServicePodLogs(coreV1: ObjectCoreV1Api, serviceName: string, namespace: string): Promise<string> {
    // Get the Service
    const service = await coreV1.readNamespacedService({name: serviceName, namespace: namespace});

    const selector = service.spec?.selector;
    if (!selector || Object.keys(selector).length === 0) {
        return `Service "${serviceName}" in namespace "${namespace}" has no selector.`
    }

    // Convert selector to label query string
    const labelSelector = Object.entries(selector)
        .map(([key, val]) => `${key}=${val}`)
        .join(',');

    // Get the matching Pods
    const podsResp = await coreV1.listNamespacedPod({namespace, labelSelector}, {});
    const pods = podsResp.items;

    if (pods.length === 0) {
        return "No logs available for service.";
    }

    const logs: string[] = [];
    // Get logs for each Pod
    for (const pod of pods) {
        const podName = pod.metadata?.name;
        if (!podName) continue;

        logs.push(await coreV1.readNamespacedPodLog({name: podName, namespace}))
    }

    return logs.join("\n");
}

const restartK8RServicePods = async (provider: Provider, serviceName: string) => {
    const k8sApi = await createClient(provider)

    // Step 1: Get the service
    const serviceResp = await k8sApi.readNamespacedService({name: serviceName, namespace: 'default'});

    const selector = serviceResp.spec?.selector;
    if (!selector || Object.keys(selector).length === 0) {
        throw new Error(`Service "${serviceName}" has no selector.`);
    }

    const labelSelector = Object.entries(selector)
        .map(([key, val]) => `${key}=${val}`)
        .join(',');

    // Step 2: Get matching pods
    const podsResp = await k8sApi.listNamespacedPod({namespace: 'default', labelSelector: labelSelector});
    const pods = podsResp.items;

    // Step 3: Delete each pod (it will be restarted by controller)
    for (const pod of pods) {
        const podName = pod.metadata?.name;
        if (!podName) continue;

        await k8sApi.deleteNamespacedPod({name: podName, namespace: 'default'})
    }
}

const getK8RPods = async (_provider: Provider, service: Service): Promise<DiscoveredPod[]> => {
    const k8sApi = await createClient(_provider)
    // Get the Service
    const serviceResp = await k8sApi.readNamespacedService({
        name: service.name,
        namespace: service.containerDetails?.namespace || 'default'
    });

    const selector = serviceResp.spec?.selector;
    if (!selector || Object.keys(selector).length === 0) {
        return []; // No selector, no pods
    }

    // Build label selector string
    const labelSelector = Object.entries(selector)
        .map(([key, value]) => `${key}=${value}`)
        .join(',');

    // Query Pods using the selector
    const podsResp = await k8sApi.listNamespacedPod({
        labelSelector: labelSelector,
        namespace: service.containerDetails?.namespace || 'default',
    });
    const pods = podsResp.items;

    // Return list of { name } objects
    return pods
        .map(pod => pod.metadata?.name || 'No-Name')
        .filter(Boolean)
        .map(name => ({name}));
}

const deleteK8RPod = async (_provider: Provider, podName: string, namespace: string): Promise<void> => {
    const k8sApi = await createClient(_provider)

    return k8sApi.deleteNamespacedPod(
        {
            name: podName,
            namespace: namespace,
            pretty: 'true'
        }
    ).then(() => {
        logger.info(`Pod: ${podName} in namespace: ${namespace} deleted successfully`);
    }).catch(err => {
        logger.error(`Failed to delete pod: ${podName} in namespace:  ${namespace}, err`);

        throw err;
    })
}


const getK8SServices = async (_provider: Provider): Promise<DiscoveredService[]> => {
    const k8sApi = await createClient(_provider)
    const servicesResp = await k8sApi.listServiceForAllNamespaces();

    const allResponses = servicesResp.items
        .filter(service => service.metadata?.namespace !== "kube-system")
        .map(async (service) => {
            const name = service.metadata?.name || 'unknown';
            const namespace = service.metadata?.namespace || 'default';
            const serviceType = service.spec?.type || 'ClusterIP';
            const serviceIp = service.spec?.clusterIP;
            const selector = service.spec?.selector;
            let serviceStatus: string;

            if (!selector || Object.keys(selector).length === 0) {
                serviceStatus = "Unknown"
            } else {
                const labelSelector = Object.entries(selector)
                    .map(([key, value]) => `${key}=${value}`)
                    .join(',');

                // Query Pods using the selector
                const podsResp = await k8sApi.listNamespacedPod({
                    labelSelector: labelSelector,
                    namespace: namespace,
                });

                serviceStatus = [...new Set(podsResp.items.map(item => item.status?.phase || "Unknown"))].join(", ")
            }

            return {
                name,
                serviceStatus: serviceStatus,
                serviceIP: serviceIp || 'N/A',
                namespace,
                serviceType,
            };
        });

    return Promise.all(allResponses);
}

export {getK8SServices, getK8RLogs, deleteK8RPod, getK8RPods, restartK8RServicePods}