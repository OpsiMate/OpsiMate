import { NodeSSH, SSHExecCommandResponse } from 'node-ssh';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import { DiscoveredService, Provider, Logger } from '@OpsiMate/shared';
import { getSecurityConfig, getVmConfig } from '../config/config';
import { decryptPassword } from '../utils/encryption';

const logger = new Logger('dal/sshClient');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getPrivateKeysDir(): string {
	const securityConfig = getSecurityConfig();
	const privateKeysPath = path.isAbsolute(securityConfig.private_keys_path)
		? securityConfig.private_keys_path
		: path.resolve(__dirname, securityConfig.private_keys_path);

	// Ensure the directory exists
	if (!fs.existsSync(privateKeysPath)) {
		logger.info(`Creating private keys directory: ${privateKeysPath}`);
		fs.mkdirSync(privateKeysPath, { recursive: true });
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
	const { providerIP, username, privateKeyFilename, password, SSHPort } = provider;

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

/**
 * Executes a command via SSH with automatic sudo retry on permission failures
 */
async function execCommandWithAutoSudo(ssh: NodeSSH, command: string): Promise<SSHExecCommandResponse> {
	// First try without sudo
	logger.debug(`Executing command: ${command}`);
	const result = await ssh.execCommand(command);

	// Check if the command failed due to permission issues and try_with_sudo is enabled
	if (result.code !== 0 && isPermissionError(result.stderr) && getVmConfig().try_with_sudo) {
		logger.debug(`Permission denied, retrying with sudo: ${command}`);
		const sudoCommand = `sudo ${command}`;
		const sudoResult = await ssh.execCommand(sudoCommand);

		if (sudoResult.code === 0) {
			logger.debug(`Command succeeded with sudo: ${sudoCommand}`);
		}

		return sudoResult;
	}

	return result;
}

/**
 * Checks if the error output indicates a permission issue
 */
function isPermissionError(stderr: string): boolean {
	const permissionKeywords = [
		'permission denied',
		'access denied',
		'operation not permitted',
		'must be root',
		'sudo required',
		'insufficient privileges',
		'authorization required',
		'not authorized',
	];

	const lowerStderr = stderr.toLowerCase();
	return permissionKeywords.some((keyword) => lowerStderr.includes(keyword));
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

	const result = await execCommandWithAutoSudo(ssh, 'docker ps -a --format "{{.Names}}\t{{.Status}}\t{{.Image}}"');
	if (result.code !== 0) {
		throw new Error(`Failed to list containers: ${result.stderr}`);
	}
	ssh.dispose();

	return result.stdout
		.split('\n')
		.filter((line) => line.trim())
		.map((line) => {
			const [name, status, image] = line.split('\t');
			return {
				name: name,
				serviceStatus: status.toLowerCase().includes('up') ? 'running' : 'stopped',
				serviceIP: provider.providerIP || '',
				image: image,
			};
		});
}

export async function startService(provider: Provider, serviceName: string): Promise<void> {
	const ssh = new NodeSSH();
	try {
		const sshConfig = getSshConfig(provider);
		await ssh.connect(sshConfig);

		const result = await execCommandWithAutoSudo(ssh, `docker start ${serviceName}`);
		if (result.code !== 0) {
			throw new Error(`Failed to start ${serviceName}: ${result.stderr}`);
		}
	} finally {
		ssh.dispose();
	}
}

export async function stopService(provider: Provider, serviceName: string): Promise<void> {
	const ssh = new NodeSSH();
	try {
		const sshConfig = getSshConfig(provider);
		await ssh.connect(sshConfig);

		const result = await execCommandWithAutoSudo(ssh, `docker stop ${serviceName}`);
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

		const cmd = `docker logs --since 1h ${serviceName} 2>&1 | grep -i err | tail -n 10`;

		const result = await execCommandWithAutoSudo(ssh, cmd);

		if (result.code !== 0) {
			throw new Error(result.stderr || 'Failed to retrieve service logs');
		}

		// Split logs into an array, filter out empty lines
		const logs = result.stdout.split('\n').filter((line) => line.trim().length > 0);

		return logs.length > 0 ? logs : ['No error logs found in the last 24 hours'];
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		throw new Error(`Failed to get logs for service ${serviceName}: ${errorMessage}`);
	} finally {
		ssh.dispose();
	}
}

/**
 * Starts a system service
 */
export async function startSystemService(provider: Provider, serviceName: string): Promise<void> {
	const ssh = new NodeSSH();
	try {
		const sshConfig = getSshConfig(provider);
		await ssh.connect(sshConfig);

		const result = await execCommandWithAutoSudo(ssh, `systemctl start ${serviceName}`);
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
export async function stopSystemService(provider: Provider, serviceName: string): Promise<void> {
	const ssh = new NodeSSH();
	try {
		const sshConfig = getSshConfig(provider);
		await ssh.connect(sshConfig);

		const result = await execCommandWithAutoSudo(ssh, `systemctl stop ${serviceName}`);
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
		const result = await execCommandWithAutoSudo(
			ssh,
			`journalctl -u ${serviceName} --since "24 hours ago" --no-pager`
		);
		if (result.code !== 0) {
			throw new Error(`Failed to get logs for ${serviceName}: ${result.stderr}`);
		}

		// Split logs into an array, filter out empty lines
		const logs = result.stdout.split('\n').filter((line) => line.trim().length > 0);

		return logs.length > 0 ? logs : ['No logs found in the last 24 hours'];
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		throw new Error(`Failed to get logs for system service ${serviceName}: ${errorMessage}`);
	} finally {
		ssh.dispose();
	}
}

export async function testConnection(provider: Provider): Promise<{ success: boolean; error?: string }> {
	const ssh = new NodeSSH();

	try {
		const sshConfig = getSshConfig(provider);

		// Timeout for SSH connection (e.g., 10 seconds)
		await timeoutPromise(ssh.connect(sshConfig), 10000, 'SSH connection timed out');

		// Timeout for executing command (e.g., 5 seconds)
		const result: SSHExecCommandResponse = await timeoutPromise(
			ssh.execCommand('echo "Connection test"'),
			5000,
			'Command execution timed out'
		);

		const success = result.code === 0 && result.stdout.trim() === 'Connection test';
		if (!success) {
			return { success: false, error: 'Command execution failed' };
		}
		return { success: true };
	} catch (error) {
		logger.error(`Connection test failed for provider ${provider.providerIP}:`, error);

		const errorMessage = error instanceof Error ? error.message : 'Unknown error';

		if (errorMessage.includes('timed out') || errorMessage.includes('timeout')) {
			return { success: false, error: 'Connection timeout - unable to reach the server' };
		} else if (
			errorMessage.includes('authentication') ||
			errorMessage.includes('auth') ||
			errorMessage.includes('password')
		) {
			return { success: false, error: 'Authentication failed - invalid credentials or SSH key' };
		} else if (errorMessage.includes('ECONNREFUSED')) {
			return { success: false, error: 'Connection refused - server may be down or SSH port is incorrect' };
		} else if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('EHOSTUNREACH')) {
			return { success: false, error: 'Host not found - check the IP address or hostname' };
		} else if (errorMessage.includes('Key not found')) {
			return { success: false, error: 'SSH key not found on server' };
		} else {
			return { success: false, error: errorMessage };
		}
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
		const isActiveResult = await execCommandWithAutoSudo(ssh, `systemctl is-active ${serviceName}`);
		if (isActiveResult.code !== 0) {
			throw new Error(`Failed check system service status ${serviceName}: ${isActiveResult.stderr}`);
		}
		const isActive = isActiveResult.stdout.trim() === 'active';

		logger.info(
			`[DEBUG] Service ${serviceName} is-active result: '${isActiveResult.stdout.trim()}', code: ${isActiveResult.code}`
		);

		// If the service is active, it's running regardless of loaded state
		if (isActive) {
			return 'running';
		}

		// Double-check with systemctl status for more detailed information
		const statusResult = await execCommandWithAutoSudo(ssh, `systemctl status ${serviceName} --no-pager -l`);
		if (statusResult.code !== 0) {
			throw new Error(`Failed check system service status ${serviceName}: ${statusResult.stderr}`);
		}
		const statusOutput = statusResult.stdout.toLowerCase();

		logger.info(
			`[DEBUG] Service ${serviceName} status: '${statusResult.stdout.split('\n')[2] || statusResult.stdout.split('\n')[1] || 'No status line found'}'`
		);

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

/**
 * Executes a bash script via SSH
 */
export async function executeBashScript(provider: Provider, script: string): Promise<SSHExecCommandResponse> {
	const ssh = new NodeSSH();
	try {
		const sshConfig = getSshConfig(provider);
		await ssh.connect(sshConfig);

		const result = await execCommandWithAutoSudo(ssh, script);
		if (result.code !== 0) {
			logger.error(`Failed to execute bash script: ${result.stderr}`);
			throw new Error(`Script execution failed with code ${result.code}: ${result.stderr}`);
		}

		return result;
	} finally {
		ssh.dispose();
	}
}

// todo: add timeouts in this section when necessary
function timeoutPromise<T>(promise: Promise<T>, ms: number, errorMsg = 'Operation timed out'): Promise<T> {
	return Promise.race([
		promise,
		new Promise<never>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms)),
	]);
}
