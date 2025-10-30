import * as k8s from '@kubernetes/client-node';
import { DiscoveredPod, DiscoveredService, Provider, Service } from '@OpsiMate/shared';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { getSecurityConfig } from '../config/config';
import { decryptPassword } from '../utils/encryption';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

const createClient = (_provider: Provider): k8s.AppsV1Api => {
	if (!_provider.privateKeyFilename) {
		throw new Error('Provider must have a private key filename');
	}
	const encryptedKubeConfig = fs.readFileSync(getKeyPath(_provider.privateKeyFilename), 'utf-8');
	const decryptedKubeConfig = decryptPassword(encryptedKubeConfig);

	const kc: k8s.KubeConfig = new k8s.KubeConfig();
	kc.loadFromString(decryptedKubeConfig ?? '');

	return kc.makeApiClient(k8s.AppsV1Api);
};

export const getK8SDeployments = async (_provider: Provider): Promise<DiscoveredService[]> => {
	const k8sApi: k8s.AppsV1Api = createClient(_provider);
	const deploymentsList = await k8sApi.listDeploymentForAllNamespaces({});
	const deployments = deploymentsList.items ?? [];
	const nonSystemDeployments = deployments.filter(deployment => deployment.metadata?.namespace !== 'kube-system')

	return nonSystemDeployments.map(deployment => {
		return {
			name: deployment.metadata?.name || 'unknown',
			serviceStatus: 'unknown',
			serviceIP: 'unknown',
			namespace: deployment.metadata?.namespace || 'default',
			serviceType: 'unknown',
		}
	})

};
