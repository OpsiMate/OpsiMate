import { describe, test, expect, beforeEach } from 'vitest';
import { Provider, ProviderType, ServiceType } from '@OpsiMate/shared';

/**
 * This test demonstrates the use of FAKES
 * Fake = A working implementation with a simpler behavior (e.g., in-memory instead of real SSH)
 */

// Fake SSH Client implementation
class FakeSSHClient {
	private connected = false;
	private containers: Map<string, { name: string; status: string; image: string }> = new Map();
	private systemdServices: Map<string, { name: string; status: 'active' | 'inactive' }> = new Map();

	constructor() {
		// Pre-populate with fake data
		this.containers.set('nginx', { name: 'nginx', status: 'Up 2 hours', image: 'nginx:latest' });
		this.containers.set('redis', { name: 'redis', status: 'Exited (0) 1 hour ago', image: 'redis:alpine' });
		this.systemdServices.set('postgresql', { name: 'postgresql', status: 'active' });
		this.systemdServices.set('nginx', { name: 'nginx', status: 'inactive' });
	}

	async connect(config: any): Promise<void> {
		if (!config.host || !config.username) {
			throw new Error('Invalid SSH configuration');
		}
		this.connected = true;
	}

	async execCommand(command: string): Promise<{ code: number; stdout: string; stderr: string }> {
		if (!this.connected) {
			throw new Error('SSH client not connected');
		}

		// Simulate docker ps command
		if (command.includes('docker ps')) {
			const output = Array.from(this.containers.values())
				.map((c) => `${c.name}\t${c.status}\t${c.image}`)
				.join('\n');
			return { code: 0, stdout: output, stderr: '' };
		}

		// Simulate docker start command
		if (command.startsWith('docker start')) {
			const containerName = command.split(' ')[2];
			const container = this.containers.get(containerName);
			if (container) {
				container.status = 'Up 1 second';
				return { code: 0, stdout: containerName, stderr: '' };
			}
			return { code: 1, stdout: '', stderr: 'Container not found' };
		}

		// Simulate docker stop command
		if (command.startsWith('docker stop')) {
			const containerName = command.split(' ')[2];
			const container = this.containers.get(containerName);
			if (container) {
				container.status = 'Exited (0) 1 second ago';
				return { code: 0, stdout: containerName, stderr: '' };
			}
			return { code: 1, stdout: '', stderr: 'Container not found' };
		}

		// Simulate systemctl commands
		if (command.includes('systemctl is-active')) {
			const serviceName = command.split(' ').pop()!;
			const service = this.systemdServices.get(serviceName);
			if (service) {
				return { code: 0, stdout: service.status, stderr: '' };
			}
			return { code: 3, stdout: 'inactive', stderr: '' };
		}

		if (command.includes('systemctl start')) {
			const serviceName = command.split(' ').pop()!;
			const service = this.systemdServices.get(serviceName);
			if (service) {
				service.status = 'active';
				return { code: 0, stdout: '', stderr: '' };
			}
			return { code: 1, stdout: '', stderr: 'Service not found' };
		}

		if (command.includes('systemctl stop')) {
			const serviceName = command.split(' ').pop()!;
			const service = this.systemdServices.get(serviceName);
			if (service) {
				service.status = 'inactive';
				return { code: 0, stdout: '', stderr: '' };
			}
			return { code: 1, stdout: '', stderr: 'Service not found' };
		}

		return { code: 127, stdout: '', stderr: 'Command not found' };
	}

	dispose(): void {
		this.connected = false;
	}
}

// Fake SSH service using the fake client
class FakeSSHService {
	private fakeClient = new FakeSSHClient();

	async listContainers(provider: Provider) {
		await this.fakeClient.connect({
			host: provider.providerIP,
			username: provider.username,
		});

		const result = await this.fakeClient.execCommand('docker ps -a --format "{{.Names}}\t{{.Status}}\t{{.Image}}"');
		this.fakeClient.dispose();

		return result.stdout
			.split('\n')
			.filter((line) => line.trim())
			.map((line) => {
				const [name, status, image] = line.split('\t');
				return {
					name,
					serviceStatus: status.toLowerCase().includes('up') ? 'running' : 'stopped',
					image,
				};
			});
	}

	async startContainer(provider: Provider, containerName: string) {
		await this.fakeClient.connect({
			host: provider.providerIP,
			username: provider.username,
		});

		const result = await this.fakeClient.execCommand(`docker start ${containerName}`);
		this.fakeClient.dispose();

		if (result.code !== 0) {
			throw new Error(result.stderr);
		}
	}

	async stopContainer(provider: Provider, containerName: string) {
		await this.fakeClient.connect({
			host: provider.providerIP,
			username: provider.username,
		});

		const result = await this.fakeClient.execCommand(`docker stop ${containerName}`);
		this.fakeClient.dispose();

		if (result.code !== 0) {
			throw new Error(result.stderr);
		}
	}

	async checkSystemdServiceStatus(provider: Provider, serviceName: string): Promise<'active' | 'inactive'> {
		await this.fakeClient.connect({
			host: provider.providerIP,
			username: provider.username,
		});

		const result = await this.fakeClient.execCommand(`systemctl is-active ${serviceName}`);
		this.fakeClient.dispose();

		return result.stdout.trim() as 'active' | 'inactive';
	}
}

describe('SSH Client with FAKE implementation', () => {
	let fakeSSHService: FakeSSHService;
	let testProvider: Provider;

	beforeEach(() => {
		fakeSSHService = new FakeSSHService();
		testProvider = {
			id: 1,
			name: 'Test Provider',
			providerIP: '192.168.1.100',
			username: 'testuser',
			privateKeyFilename: 'test-key.pem',
			SSHPort: 22,
			providerType: ProviderType.VM,
			createdAt: new Date().toISOString(),
			password: null,
		};
	});

	test('should list docker containers using fake SSH', async () => {
		const containers = await fakeSSHService.listContainers(testProvider);

		expect(containers).toHaveLength(2);
		expect(containers[0].name).toBe('nginx');
		expect(containers[0].serviceStatus).toBe('running');
		expect(containers[1].name).toBe('redis');
		expect(containers[1].serviceStatus).toBe('stopped');
	});

	test('should start a stopped container using fake SSH', async () => {
		// First, verify redis is stopped
		let containers = await fakeSSHService.listContainers(testProvider);
		const redis = containers.find((c) => c.name === 'redis');
		expect(redis?.serviceStatus).toBe('stopped');

		// Start the container
		await fakeSSHService.startContainer(testProvider, 'redis');

		// Verify it's now running
		containers = await fakeSSHService.listContainers(testProvider);
		const redisAfter = containers.find((c) => c.name === 'redis');
		expect(redisAfter?.serviceStatus).toBe('running');
	});

	test('should stop a running container using fake SSH', async () => {
		// First, verify nginx is running
		let containers = await fakeSSHService.listContainers(testProvider);
		const nginx = containers.find((c) => c.name === 'nginx');
		expect(nginx?.serviceStatus).toBe('running');

		// Stop the container
		await fakeSSHService.stopContainer(testProvider, 'nginx');

		// Verify it's now stopped
		containers = await fakeSSHService.listContainers(testProvider);
		const nginxAfter = containers.find((c) => c.name === 'nginx');
		expect(nginxAfter?.serviceStatus).toBe('stopped');
	});

	test('should check systemd service status using fake SSH', async () => {
		const postgresqlStatus = await fakeSSHService.checkSystemdServiceStatus(testProvider, 'postgresql');
		expect(postgresqlStatus).toBe('active');

		const nginxStatus = await fakeSSHService.checkSystemdServiceStatus(testProvider, 'nginx');
		expect(nginxStatus).toBe('inactive');
	});

	test('should throw error when starting non-existent container', async () => {
		await expect(fakeSSHService.startContainer(testProvider, 'nonexistent')).rejects.toThrow(
			'Container not found'
		);
	});

	test('should handle invalid SSH configuration', async () => {
		const invalidProvider = {
			...testProvider,
			providerIP: '',
		};

		await expect(fakeSSHService.listContainers(invalidProvider)).rejects.toThrow('Invalid SSH configuration');
	});
});
