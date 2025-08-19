import {Config, NodeSSH} from 'node-ssh';
import path from 'path';
import fs from 'fs';

import {DiscoveredService, Provider, Logger} from "@OpsiMate/shared";
import {getSecurityConfig} from '../config/config';
import {decryptPassword} from "../utils/encryption";

const logger = new Logger('dal/sshClient');

function getPrivateKeysDir(): string {
    const securityConfig = getSecurityConfig();
    const privateKeysPath = path.isAbsolute(securityConfig.private_keys_path)
        ? securityConfig.private_keys_path
        : path.resolve(__dirname, securityConfig.private_keys_path);

    // Ensure the directory exists
    if (!fs.existsSync(privateKeysPath)) {
        logger.info(`Creating private keys directory: ${privateKeysPath}`);
        fs.mkdirSync(privateKeysPath, {recursive: true});
    }

    return privateKeysPath;
}

export function initializePrivateKeysDir(): void {
    // This function ensures the private keys directory is created during server startup
    getPrivateKeysDir();
    logger.info('Private keys directory initialized');
}

function getKeyPath(filename: string) {
    const privateKeysDir = getPrivateKeysDir();
    const filePath = path.join(privateKeysDir, filename);
    if (!fs.existsSync(filePath)) {
        throw new Error(`Key not found: ${filePath}`);
    }
    return filePath;
}

function getSshConfig(provider: Provider) {
    const {providerIP, username, privateKeyFilename, password, SSHPort} = provider;

    // Ensure at least one authentication method is provided
    if (!privateKeyFilename && !password) {
        throw new Error('Either privateKeyFilename or password must be provided for SSH authentication');
    }

    const baseConfig = {
        host: providerIP,
        username: username,
    };
    
    // Use private key authentication if available, otherwise use password
    if (privateKeyFilename) {
        const encryptedKey = fs.readFileSync(getKeyPath(privateKeyFilename), 'utf-8');
        const decryptedKey = decryptPassword(encryptedKey);

        return {
            ...baseConfig,
            privateKey: decryptedKey,
            port: SSHPort,
        };
    } else {
        return {
            ...baseConfig,
            password: password,
        };
    }
}

export async function connectAndListContainers(provider: Provider): Promise<DiscoveredService[]> {

    const ssh = new NodeSSH();
    const sshConfig = getSshConfig(provider);

    await timeoutPromise(ssh.connect(sshConfig), 5 * 1000, 'SSH connection timed out');

    // Check if docker is available
    const dockerCheck = await ssh.execCommand('docker --version');
    if (dockerCheck.code !== 0) {
        ssh.dispose();
        throw new Error('Docker is not installed or not accessible');
    }

    const result = await ssh.execCommand('sudo docker ps -a --format "{{.Names}}\t{{.Status}}\t{{.Image}}"');
    ssh.dispose();

    return result.stdout
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
            const [name, status, image] = line.split('\t');
            return {
                name: name,
                serviceStatus: status.toLowerCase().includes('up') ? 'running' : 'stopped',
                serviceIP: provider.providerIP || '',
                image: image
            };
        });
}

export async function startService(
    provider: Provider,
    serviceName: string
): Promise<void> {
    const ssh = new NodeSSH();
    try {
        const sshConfig = getSshConfig(provider);
        await ssh.connect(sshConfig);

        const result = await ssh.execCommand(`sudo docker start ${serviceName}`);
        if (result.code !== 0) {
            throw new Error(`Failed to start ${serviceName}: ${result.stderr}`);
        }
    } finally {
        ssh.dispose();
    }
}

export async function stopService(
    provider: Provider,
    serviceName: string
): Promise<void> {
    const ssh = new NodeSSH();
    try {
        const sshConfig = getSshConfig(provider);
        await ssh.connect(sshConfig);

        const result = await ssh.execCommand(`sudo docker stop ${serviceName}`);
        if (result.code !== 0) {
            throw new Error(`Failed to stop ${serviceName}: ${result.stderr}`);
        }
    } finally {
        ssh.dispose();
    }
}

export async function getServiceLogs(provider: Provider, serviceName: string): Promise<string[]> {
    const ssh = new NodeSSH();

    try {
        const sshConfig = getSshConfig(provider);
        await ssh.connect(sshConfig);

        const cmd = `sudo docker logs --since 1h ${serviceName} 2>&1 | grep -i err | tail -n 10`

        const result = await ssh.execCommand(cmd);

        if (result.code !== 0) {
            throw new Error(result.stderr || 'Failed to retrieve service logs');
        }

        // Split logs into an array, filter out empty lines
        const logs = result.stdout
            .split('\n')
            .filter(line => line.trim().length > 0);

        return logs.length > 0 ? logs : ['No error logs found in the last 24 hours'];

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        throw new Error(`Failed to get logs for service ${serviceName}: ${errorMessage}`);
    } finally {
        ssh.dispose();
    }
}

/**
 * Discovers system services running on the provider
 */
export async function discoverSystemServices(provider: Provider): Promise<DiscoveredService[]> {
    const ssh = new NodeSSH();
    try {
        const sshConfig = getSshConfig(provider);
        await ssh.connect(sshConfig);

        // List all system services (not just running ones)
        const result = await ssh.execCommand('systemctl list-units --type=service --all --no-legend');
        if (result.code !== 0) {
            throw new Error(`Failed to list system services: ${result.stderr}`);
        }

        // Parse the output
        const services: DiscoveredService[] = [];
        const lines = result.stdout.split('\n').filter(line => line.trim().length > 0);

        for (const line of lines) {
            // Format is typically: "service.service  loaded active running Description"
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 4) {
                const serviceName = parts[0].replace(/\.service$/, '');

                // Check both the load state (parts[1]) and active state (parts[2])
                // A service is running if it's both loaded and active
                const loadState = parts[1]; // loaded, not-found, etc.
                const activeState = parts[2]; // active, inactive, etc.

                // For a service to be considered running, it must be loaded and active
                const isRunning = loadState === 'loaded' && activeState === 'active';

                services.push({
                    name: serviceName,
                    serviceStatus: isRunning ? 'running' : 'stopped',
                    serviceIP: provider.providerIP || ''
                });
            }
        }

        return services;
    } catch (error) {
        logger.error('Error discovering system services:', error);
        throw error;
    } finally {
        ssh.dispose();
    }
}

/**
 * Starts a system service
 */
export async function startSystemService(
    provider: Provider,
    serviceName: string
): Promise<void> {
    const ssh = new NodeSSH();
    try {
        const sshConfig = getSshConfig(provider);
        await ssh.connect(sshConfig);

        const result = await ssh.execCommand(`sudo systemctl start ${serviceName}`);
        if (result.code !== 0) {
            throw new Error(`Failed to start ${serviceName}: ${result.stderr}`);
        }
    } finally {
        ssh.dispose();
    }
}

/**
 * Stops a system service
 */
export async function stopSystemService(
    provider: Provider,
    serviceName: string
): Promise<void> {
    const ssh = new NodeSSH();
    try {
        const sshConfig = getSshConfig(provider);
        await ssh.connect(sshConfig);

        const result = await ssh.execCommand(`sudo systemctl stop ${serviceName}`);
        if (result.code !== 0) {
            throw new Error(`Failed to stop ${serviceName}: ${result.stderr}`);
        }
    } finally {
        ssh.dispose();
    }
}

/**
 * Gets logs for a system service
 */
export async function getSystemServiceLogs(provider: Provider, serviceName: string): Promise<string[]> {
    const ssh = new NodeSSH();
    try {
        const sshConfig = getSshConfig(provider);
        await ssh.connect(sshConfig);

        // Get logs using journalctl
        const result = await ssh.execCommand(`sudo journalctl -u ${serviceName} --since "24 hours ago" --no-pager`);
        if (result.code !== 0) {
            throw new Error(`Failed to get logs for ${serviceName}: ${result.stderr}`);
        }

        // Split logs into an array, filter out empty lines
        const logs = result.stdout
            .split('\n')
            .filter(line => line.trim().length > 0);

        return logs.length > 0 ? logs : ['No logs found in the last 24 hours'];

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        throw new Error(`Failed to get logs for system service ${serviceName}: ${errorMessage}`);
    } finally {
        ssh.dispose();
    }
}

export async function testConnection(provider: Provider): Promise<boolean> {
    const ssh = new NodeSSH();

    try {
        const sshConfig = getSshConfig(provider);

        // Timeout for SSH connection (e.g., 10 seconds)
        await timeoutPromise(ssh.connect(sshConfig), 10000, 'SSH connection timed out');

        // Timeout for executing command (e.g., 5 seconds)
        const result = await timeoutPromise(
            ssh.execCommand('echo "Connection test"'),
            5000,
            'Command execution timed out'
        );

        return result.code === 0 && result.stdout.trim() === 'Connection test';
    } catch (error) {
        logger.error(`Connection test failed for provider ${provider.providerIP}:`, error);
        return false;
    } finally {
        ssh.dispose();
    }
}


/**
 * Checks if a systemd service is running
 */
export async function checkSystemServiceStatus(
    provider: Provider,
    serviceName: string
): Promise<'running' | 'stopped' | 'unknown'> {
    const ssh = new NodeSSH();
    try {
        const sshConfig = getSshConfig(provider);
        await ssh.connect(sshConfig);

        // Check service status using systemctl is-active (most reliable for running status)
        const isActiveResult = await ssh.execCommand(`sudo systemctl is-active ${serviceName}`);
        const isActive = isActiveResult.stdout.trim() === 'active';

        logger.info(`[DEBUG] Service ${serviceName} is-active result: '${isActiveResult.stdout.trim()}', code: ${isActiveResult.code}`);

        // If the service is active, it's running regardless of loaded state
        if (isActive) {
            return 'running';
        }

        // Double-check with systemctl status for more detailed information
        const statusResult = await ssh.execCommand(`sudo systemctl status ${serviceName} --no-pager -l`);
        const statusOutput = statusResult.stdout.toLowerCase();

        logger.info(`[DEBUG] Service ${serviceName} status: '${statusResult.stdout.split('\n')[2] || statusResult.stdout.split('\n')[1] || 'No status line found'}'`);

        // Check if the status output indicates the service is running
        if (statusOutput.includes('active (running)') || statusOutput.includes('active (exited)')) {
            return 'running';
        }

        return 'stopped';
    } catch (error) {
        logger.error(`Failed to check status for ${serviceName}:`, error);
        return 'unknown';
    } finally {
        ssh.dispose();
    }
}

// todo: add timeouts in this section when necessary
function timeoutPromise<T>(promise: Promise<T>, ms: number, errorMsg = 'Operation timed out'): Promise<T> {
    return Promise.race([
        promise,
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(errorMsg)), ms)
        ),
    ]);
}