import * as k8s from '@kubernetes/client-node';
import {DiscoveredService, Logger, Provider} from "@service-peek/shared";
import path from "path";
import fs from "fs";
import {ObjectCoreV1Api} from "@kubernetes/client-node/dist/gen/types/ObjectParamAPI";

const PRIVATE_KEYS_DIR = path.join(__dirname, '../../data/private-keys');

const logger = new Logger('kubeConnector.ts');

function getKeyPath(filename: string) {
    const filePath = path.join(PRIVATE_KEYS_DIR, filename);
    if (!fs.existsSync(filePath)) {
        throw new Error(`Key not found: ${filePath}`);
    }
    return filePath;
}

const createClient = (_provider: Provider): ObjectCoreV1Api => {
    const kc: k8s.KubeConfig = new k8s.KubeConfig();
    const privateKeyPath = getKeyPath(_provider.privateKeyFilename);

    kc.loadFromFile(privateKeyPath);

    return kc.makeApiClient(k8s.CoreV1Api);
}

const getK8RLogs = async (_provider: Provider, serviceName: string, namespace: string) => {
    const k8sApi = createClient(_provider)
    return k8sApi.readNamespacedPodLog(
        {
            name: serviceName,
            namespace: namespace,
            pretty: 'true'
        })
}

const deleteK8RPod = async (_provider: Provider, podName: string, namespace: string): Promise<void> => {
    const k8sApi = createClient(_provider)

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
    const k8sApi = createClient(_provider)
    const servicesResp = await k8sApi.listPodForAllNamespaces();

    return servicesResp.items
        .filter(service => service.metadata?.namespace !== "kube-system")
        .map(svc => {
            const name = svc.metadata?.name || 'unknown';
            const serviceIP = svc.status?.hostIP
            const port = (svc.spec?.containers?.flatMap(i => i.ports?.map(i => i.containerPort)) || [])?.[0]

            return {
                name,
                serviceStatus: svc.status?.phase || 'unknown',
                serviceIP: serviceIP || ':' + port,
                namespace: svc.metadata?.namespace || 'default'
            };
        });
}

export {getK8SServices, getK8RLogs, deleteK8RPod}