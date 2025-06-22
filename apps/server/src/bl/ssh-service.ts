import { NodeSSH } from 'node-ssh';
import path from 'path';
import fs from 'fs';
import { Provider } from '@service-peek/shared';

// Private keys directory
const PRIVATE_KEYS_DIR = path.join(__dirname, '../../data/private-keys');

// Ensure private keys directory exists
if (!fs.existsSync(PRIVATE_KEYS_DIR)) {
    fs.mkdirSync(PRIVATE_KEYS_DIR, { recursive: true });
}

export interface ContainerInfo {
    service_name: string;
    service_status: 'running' | 'stopped';
    service_ip: string;
    image: string;
}

export class SSHService {
    static async getDockerContainers(provider: Provider): Promise<ContainerInfo[]> {
        const ssh = new NodeSSH();
        
        // Construct the full path to the private key file
        const privateKeyPath = path.join(PRIVATE_KEYS_DIR, provider.private_key_filename);

        // Check if private key file exists
        if (!fs.existsSync(privateKeyPath)) {
            throw new Error(`Private key file '${provider.private_key_filename}' not found in ${PRIVATE_KEYS_DIR}`);
        }

        try {
            await ssh.connect({
                host: provider.provider_ip,
                username: provider.username,
                privateKeyPath: privateKeyPath,
                port: provider.ssh_port,
            });

            // First check if docker is available
            const dockerCheck = await ssh.execCommand('docker --version');
            if (dockerCheck.code !== 0) {
                throw new Error('Docker is not installed or not accessible');
            }

            const result = await ssh.execCommand('sudo docker ps -a --format "{{.Names}}\t{{.Status}}\t{{.Image}}"');
            
            const containers = result.stdout
                .split('\n')
                .filter(line => line.trim())
                .map(line => {
                    const [name, status, image] = line.split('\t');
                    return {
                        service_name: name,
                        service_status: status.toLowerCase().includes('up') ? 'running' as const : 'stopped' as const,
                        service_ip: provider.provider_ip,
                        image: image
                    };
                });

            return containers;
        } finally {
            ssh.dispose();
        }
    }
}