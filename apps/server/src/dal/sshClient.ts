import { NodeSSH } from 'node-ssh';
import path from 'path';
import fs from 'fs';
import {Provider} from "@service-peek/shared";
import NodeCache from "node-cache";

const sshConnectionCache = new NodeCache({ stdTTL: 10 * 60, checkperiod: 60});

const PRIVATE_KEYS_DIR = path.join(__dirname, '../../data/private-keys');

function getKeyPath(filename: string): string {
  const filePath = path.join(PRIVATE_KEYS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Key not found: ${filePath}`);
  }
  return filePath;
}

async function getCachedSSHConnection(provider: Provider): Promise<NodeSSH> {
  const privateKeyPath = getKeyPath(provider.privateKeyFilename);
  const cacheKey = `${provider.providerIP}_${provider.username}_${privateKeyPath}`;

  const cachedSSH = sshConnectionCache.get<NodeSSH>(cacheKey);
  if (cachedSSH) {
    try {
      const test = await cachedSSH.execCommand('echo "ping"');
      if (test.code === 0 && test.stdout.trim() === 'ping') {
        return cachedSSH;
      } else {
        console.warn(`SSH session for ${cacheKey} failed liveness check. Reconnecting...`);
        cachedSSH.dispose();
        sshConnectionCache.del(cacheKey);
      }
    } catch (err) {
      console.warn(`SSH session for ${cacheKey} is invalid. Reconnecting...`, err);
      cachedSSH.dispose();
      sshConnectionCache.del(cacheKey);
    }
  }

  const ssh = new NodeSSH();
  await ssh.connect({
    host: provider.providerIP,
    username: provider.username,
    privateKeyPath: privateKeyPath,
    port: provider.SSHPort,
  });

  sshConnectionCache.set(cacheKey, ssh);
  return ssh;
}

export async function discoverServices(provider: Provider) {
  const ssh = await getCachedSSHConnection(provider);

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
        serviceIP: provider.providerIP,
        image: image
      };
    });
}

export async function startService(
    provider: Provider,
    serviceName: string
): Promise<void> {
  const ssh = await getCachedSSHConnection(provider);
  try {
    await ssh.connect({
      host: provider.providerIP,
      username: provider.username,
      privateKeyPath: getKeyPath(provider.privateKeyFilename),
      port: provider.SSHPort,
    });

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
  const ssh = await getCachedSSHConnection(provider);
  try {
    await ssh.connect({
      host: provider.providerIP,
      username: provider.username,
      privateKeyPath: getKeyPath(provider.privateKeyFilename),
      port: provider.SSHPort,
    });

    const result = await ssh.execCommand(`sudo docker stop ${serviceName}`);
    if (result.code !== 0) {
      throw new Error(`Failed to stop ${serviceName}: ${result.stderr}`);
    }
  } finally {
    ssh.dispose();
  }
}

export async function getServiceLogs(provider: Provider, serviceName: string): Promise<string[]> {
  const ssh = await getCachedSSHConnection(provider);

  try {
    await ssh.connect({
      host: provider.providerIP,
      username: provider.username,
      privateKeyPath: getKeyPath(provider.privateKeyFilename),
      port: provider.SSHPort,
    });

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

export async function testConnection(provider: Provider): Promise<boolean> {
  const ssh = new NodeSSH();

  try {
    const sshConfig = {
      host: provider.providerIP,
      username: provider.username,
      privateKeyPath: getKeyPath(provider.privateKeyFilename),
      port: provider.SSHPort,
    }

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
    console.error(`Connection test failed for provider ${provider.providerIP}:`, error);
    return false;
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