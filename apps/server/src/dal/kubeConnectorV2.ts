import * as k8s from '@kubernetes/client-node';
import { DiscoveredPod, DiscoveredService, Provider, Service } from '@OpsiMate/shared';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { getSecurityConfig } from '../config/config';
import { decryptPassword } from '../utils/encryption';
import {V1Pod} from "@kubernetes/client-node";
import {getK8RPods} from "./kubeConnector.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


export const getK8SDeployments = async (_provider: Provider): Promise<DiscoveredService[]> => {
	const k8sApi: k8s.AppsV1Api = createClient(_provider);
	const coreV1Api: k8s.CoreV1Api = createCoreClient(_provider);
	const deploymentsList = await k8sApi.listDeploymentForAllNamespaces({});
	const deployments = deploymentsList.items ?? [];
	const nonSystemDeployments = deployments.filter(deployment => deployment.metadata?.namespace !== 'kube-system');

	const results = await Promise.all(nonSystemDeployments.map(async (deployment) => {
		const pods = await getDeploymentPods(coreV1Api, deployment);

		return {
			name: deployment.metadata?.name || 'unknown',
			serviceStatus: getDeploymentStatus(pods),
			serviceIP: 'unknown', // todo: we might want to fetch the deployment service and get its IP?
			namespace: deployment.metadata?.namespace || 'default',
			serviceType: 'Deployment',
		};
	}));

	return results;
};

export const restartK8RDeploymentPods = async (provider: Provider, serviceName: string) => {
	const k8sApi: k8s.AppsV1Api = createClient(provider);
	const coreV1Api: k8s.CoreV1Api = createCoreClient(provider);

}



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

// todo: change to enum
const getDeploymentStatus = (pods: V1Pod[]): string => {
	const runningPods = pods.filter(pod => pod.status?.phase === 'Running');

	if (runningPods.length == 0) {
		return 'stopped';
	}

	return runningPods.length == pods.length ? 'running' : 'partial';
}

