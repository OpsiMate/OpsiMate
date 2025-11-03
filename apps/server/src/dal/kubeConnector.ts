import * as k8s from '@kubernetes/client-node';
import { DiscoveredPod, DiscoveredService, Logger, Provider, Service } from '@OpsiMate/shared';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { getSecurityConfig } from '../config/config';
import { decryptPassword } from '../utils/encryption';
import { V1Pod } from '@kubernetes/client-node';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const logger = new Logger('kubeConnector');

export const getK8SDeployments = async (_provider: Provider): Promise<DiscoveredService[]> => {
	const k8sApi: k8s.AppsV1Api = createClient(_provider);
	const coreV1Api: k8s.CoreV1Api = createCoreClient(_provider);
	const deploymentsList = await k8sApi.listDeploymentForAllNamespaces({});
	const deployments = deploymentsList.items ?? [];
	const nonSystemDeployments = deployments.filter((deployment) => deployment.metadata?.namespace !== 'kube-system');

	const results = await Promise.all(
		nonSystemDeployments.map(async (deployment) => {
			const pods = await getDeploymentPods(coreV1Api, deployment);
			const serviceIP = await getDeploymentServiceIP(coreV1Api, deployment);

			if (!deployment.metadata || !deployment.metadata.name || !deployment.metadata.namespace) {
				return null;
			}

			return {
				name: deployment.metadata.name,
				serviceStatus: getDeploymentStatus(pods),
				serviceIP,
				namespace: deployment.metadata.namespace,
				serviceType: 'Deployment',
			};
		})
	);

	return results.filter((result) => result != null) as DiscoveredService[];
};

export const restartK8SDeploymentPods = async (provider: Provider, service: Service) => {
	const k8sApi: k8s.AppsV1Api = createClient(provider);
	const coreV1Api: k8s.CoreV1Api = createCoreClient(provider);
	const namespace = service.containerDetails?.namespace || 'default';

	try {
		// Get the deployment
		const deployment = await k8sApi.readNamespacedDeployment({ name: service.name, namespace });

		if (!deployment || !deployment.metadata) {
			throw new Error(`Deployment "${service.name}" in namespace "${namespace}" not found.`);
		}

		// Get pods for this deployment
		const pods = await getDeploymentPods(coreV1Api, deployment);

		if (pods.length === 0) {
			throw new Error(`No pods found for deployment "${service.name}" in namespace "${namespace}".`);
		}

		// Delete each pod to trigger a restart
		for (const pod of pods) {
			const podName = pod.metadata?.name;
			if (!podName) continue;

			await coreV1Api.deleteNamespacedPod({ name: podName, namespace });
			logger.info(`Pod "${podName}" in namespace "${namespace}" deleted successfully.`);
		}
	} catch (error) {
		logger.error(`Error restarting pods for deployment "${service.name}":`, error);
		throw error;
	}
};

export const getK8SDeploymentPods = async (provider: Provider, service: Service): Promise<DiscoveredPod[]> => {
	const k8sApi: k8s.AppsV1Api = createClient(provider);
	const coreV1Api: k8s.CoreV1Api = createCoreClient(provider);
	const namespace = service.containerDetails?.namespace || 'default';

	try {
		// Get the deployment
		const deployment = await k8sApi.readNamespacedDeployment({ name: service.name, namespace });

		if (!deployment || !deployment.metadata) {
			throw new Error(`Deployment "${service.name}" in namespace "${namespace}" not found.`);
		}

		// Get pods for this deployment
		const pods = await getDeploymentPods(coreV1Api, deployment);

		// Map pods to DiscoveredPod format
		return pods.map((pod) => ({
			name: pod.metadata?.name || 'unknown',
		}));
	} catch (error) {
		logger.error(`Error getting pods for deployment "${service.name}":`, error);
		return [];
	}
};

export const getK8SDeploymentLogs = async (provider: Provider, service: Service): Promise<string[]> => {
	const k8sApi: k8s.AppsV1Api = createClient(provider);
	const coreV1Api: k8s.CoreV1Api = createCoreClient(provider);
	const namespace = service.containerDetails?.namespace || 'default';

	try {
		// Get the deployment
		const deployment = await k8sApi.readNamespacedDeployment({ name: service.name, namespace });

		if (!deployment || !deployment.metadata) {
			throw new Error(`Deployment "${service.name}" in namespace "${namespace}" not found.`);
		}

		// Get pods for this deployment
		const pods = await getDeploymentPods(coreV1Api, deployment);

		if (pods.length === 0) {
			return [`No pods found for deployment "${service.name}" in namespace "${namespace}".`];
		}

		// Collect logs from each pod
		const logs: string[] = [];
		for (const pod of pods) {
			const podName = pod.metadata?.name;
			if (!podName) continue;

			try {
				const logText = await coreV1Api.readNamespacedPodLog({ name: podName, namespace });
				logs.push(`--- Logs from pod ${podName} ---\n${logText || 'No logs available'}`);
			} catch (error) {
				logger.error(`Error getting logs from pod ${podName}`, error);
			}
		}

		return logs;
	} catch (error) {
		logger.error(`Error getting logs for deployment "${service.name}":`, error);
		throw error;
	}
};

function getPrivateKeysDir(): string {
	const securityConfig = getSecurityConfig();
	return path.isAbsolute(securityConfig.private_keys_path)
		? securityConfig.private_keys_path
		: path.resolve(__dirname, securityConfig.private_keys_path);
}

function getKeyPath(filename: string) {
	const privateKeysDir = getPrivateKeysDir();
	const filePath = path.join(privateKeysDir, filename);
	if (!fs.existsSync(filePath)) {
		throw new Error(`Key not found: ${filePath}`);
	}
	return filePath;
}

const createKubeConfig = (_provider: Provider): k8s.KubeConfig => {
	if (!_provider.privateKeyFilename) {
		throw new Error('Provider must have a private key filename');
	}
	const encryptedKubeConfig = fs.readFileSync(getKeyPath(_provider.privateKeyFilename), 'utf-8');
	const decryptedKubeConfig = decryptPassword(encryptedKubeConfig);

	const kc: k8s.KubeConfig = new k8s.KubeConfig();
	kc.loadFromString(decryptedKubeConfig ?? '');

	return kc;
};

const createClient = (_provider: Provider): k8s.AppsV1Api => {
	const kc = createKubeConfig(_provider);
	return kc.makeApiClient(k8s.AppsV1Api);
};

const createCoreClient = (_provider: Provider): k8s.CoreV1Api => {
	const kc = createKubeConfig(_provider);
	return kc.makeApiClient(k8s.CoreV1Api);
};

const getDeploymentPods = async (coreV1Api: k8s.CoreV1Api, deployment: k8s.V1Deployment): Promise<k8s.V1Pod[]> => {
	const selector = deployment.spec?.selector?.matchLabels;
	const namespace = deployment.metadata?.namespace || 'default';

	if (!selector || Object.keys(selector).length === 0) {
		return [];
	}

	const labelSelector = Object.entries(selector)
		.map(([key, val]) => `${key}=${val}`)
		.join(',');

	const podsList = await coreV1Api.listNamespacedPod({ namespace, labelSelector });
	return podsList.items ?? [];
};

const getDeploymentServiceIP = async (coreV1Api: k8s.CoreV1Api, deployment: k8s.V1Deployment): Promise<string> => {
	const selector = deployment.spec?.selector?.matchLabels;
	const namespace = deployment.metadata?.namespace || 'default';
	const deploymentName = deployment.metadata?.name || 'unknown';

	if (!selector || Object.keys(selector).length === 0) {
		return 'unknown';
	}

	try {
		// First try to find a service with the same name as the deployment
		// This is a common pattern in Kubernetes
		try {
			const service = await coreV1Api.readNamespacedService({ name: deploymentName, namespace });
			if (service.spec?.clusterIP) {
				return service.spec.clusterIP;
			}
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
		} catch (error) {
			// Service with the same name doesn't exist, continue to search by labels
		}

		// If no service with the same name exists, try to find services that match the deployment's selector
		const labelSelector = Object.entries(selector)
			.map(([key, val]) => `${key}=${val}`)
			.join(',');

		const servicesList = await coreV1Api.listNamespacedService({ namespace, labelSelector });
		const services = servicesList.items ?? [];

		if (services.length > 0 && services[0].spec?.clusterIP) {
			return services[0].spec.clusterIP;
		}

		return 'unknown';
	} catch (error) {
		logger.error(`Error getting service IP for deployment "${deploymentName}":`, error);
		return 'unknown';
	}
};

// todo: change to enum
const getDeploymentStatus = (pods: V1Pod[]): string => {
	const runningPods = pods.filter((pod) => pod.status?.phase === 'Running');

	if (runningPods.length == 0) {
		return 'stopped';
	}

	return runningPods.length == pods.length ? 'running' : 'partial';
};
