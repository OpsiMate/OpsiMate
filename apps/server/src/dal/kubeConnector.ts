import { DiscoveredPod, DiscoveredService, Logger, Provider, Service } from "@OpsiMate/shared";
import * as path from 'node:path';
import * as fs from 'node:fs';
import { getSecurityConfig } from '../config/config';
import { decryptPassword } from "../utils/encryption";
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const logger = new Logger('kubeConnector.ts');

function getPrivateKeysDir(): string {
    const securityConfig = getSecurityConfig();
    return path.isAbsolute(securityConfig.private_keys_path)
        ? securityConfig.private_keys_path
        : path.resolve(__dirname, securityConfig.private_keys_path);
}

function getKubeConfigPath(): string {
    // Use environment variable or default path
    return process.env.KUBECONFIG || path.join(process.env.HOME || '/root', '.kube', 'config');
}

// Stub implementation using kubectl commands
export async function getK8SServices(provider: Provider): Promise<DiscoveredService[]> {
    logger.info('Getting Kubernetes services using kubectl');
    try {
        const kubeConfigPath = getKubeConfigPath();
        const command = `kubectl --kubeconfig=${kubeConfigPath} get services -o json`;
        const { stdout } = await execAsync(command);
        const services = JSON.parse(stdout);
        
        return services.items.map((item: any) => ({
            id: item.metadata.uid,
            name: item.metadata.name,
            namespace: item.metadata.namespace,
            status: item.status?.phase || 'Unknown',
            providerId: provider.id,
            // Add other required fields as needed
        }));
    } catch (error) {
        logger.error('Error getting Kubernetes services:', error);
        return [];
    }
}

export async function getK8RPods(provider: Provider): Promise<DiscoveredPod[]> {
    logger.info('Getting Kubernetes pods using kubectl');
    try {
        const kubeConfigPath = getKubeConfigPath();
        const command = `kubectl --kubeconfig=${kubeConfigPath} get pods -o json`;
        const { stdout } = await execAsync(command);
        const pods = JSON.parse(stdout);
        
        return pods.items.map((item: any) => ({
            id: item.metadata.uid,
            name: item.metadata.name,
            namespace: item.metadata.namespace,
            status: item.status?.phase || 'Unknown',
            providerId: provider.id,
            // Add other required fields as needed
        }));
    } catch (error) {
        logger.error('Error getting Kubernetes pods:', error);
        return [];
    }
}

export async function getK8RLogs(provider: Provider, podName: string, namespace?: string): Promise<string> {
    logger.info(`Getting logs for pod ${podName} using kubectl`);
    try {
        const kubeConfigPath = getKubeConfigPath();
        const nsFlag = namespace ? `-n ${namespace}` : '';
        const command = `kubectl --kubeconfig=${kubeConfigPath} logs ${podName} ${nsFlag}`;
        const { stdout } = await execAsync(command);
        return stdout;
    } catch (error) {
        logger.error(`Error getting logs for pod ${podName}:`, error);
        return '';
    }
}

export async function deleteK8RPod(provider: Provider, podName: string, namespace?: string): Promise<boolean> {
    logger.info(`Deleting pod ${podName} using kubectl`);
    try {
        const kubeConfigPath = getKubeConfigPath();
        const nsFlag = namespace ? `-n ${namespace}` : '';
        const command = `kubectl --kubeconfig=${kubeConfigPath} delete pod ${podName} ${nsFlag}`;
        await execAsync(command);
        return true;
    } catch (error) {
        logger.error(`Error deleting pod ${podName}:`, error);
        return false;
    }
}

export async function restartK8RServicePods(provider: Provider, serviceName: string, namespace?: string): Promise<boolean> {
    logger.info(`Restarting service ${serviceName} using kubectl`);
    try {
        const kubeConfigPath = getKubeConfigPath();
        const nsFlag = namespace ? `-n ${namespace}` : '';
        const command = `kubectl --kubeconfig=${kubeConfigPath} rollout restart deployment ${serviceName} ${nsFlag}`;
        await execAsync(command);
        return true;
    } catch (error) {
        logger.error(`Error restarting service ${serviceName}:`, error);
        return false;
    }
}