import { NodeSSH } from 'node-ssh';
import path from 'path';
import fs from 'fs';
import { CreateProviderSchema, BulkServiceSchema, Provider } from '@service-peek/shared';
import { insertProvider, getProviderById, getAllProviders, NewProviderInput } from '../dal/providerDal';
import { insertService, getServicesByProvider } from '../dal/serviceDal';

// Directory where private keys are stored
export const PRIVATE_KEYS_DIR = path.join(process.cwd(), 'data/private-keys');

// Ensure directory exists on start
if (!fs.existsSync(PRIVATE_KEYS_DIR)) {
  fs.mkdirSync(PRIVATE_KEYS_DIR, { recursive: true });
}

export const createProvider = async (input: unknown): Promise<Provider> => {
  // Validate input using zod
  const validated = CreateProviderSchema.parse(input);
  const provider = await insertProvider(validated as NewProviderInput);
  return provider;
};

export const listProviders = async () => {
  return getAllProviders();
};

export const fetchProviderById = async (id: number) => {
  return getProviderById(id);
};

export interface ContainerInfo {
  service_name: string;
  service_status: string;
  service_ip: string;
  image: string;
}

export const fetchProviderInstances = async (providerId: number): Promise<{ provider: Provider; containers: ContainerInfo[] }> => {
  const provider = await getProviderById(providerId);
  if (!provider) {
    throw new Error('Provider not found');
  }

  const ssh = new NodeSSH();
  const privateKeyPath = path.join(PRIVATE_KEYS_DIR, provider.private_key_filename);

  if (!fs.existsSync(privateKeyPath)) {
    throw new Error(`Private key file '${provider.private_key_filename}' not found in ${PRIVATE_KEYS_DIR}`);
  }

  try {
    await ssh.connect({
      host: provider.provider_ip,
      username: provider.username,
      privateKeyPath,
      port: provider.ssh_port,
    });

    // Ensure docker available
    const dockerCheck = await ssh.execCommand('docker --version');
    if (dockerCheck.code !== 0) {
      throw new Error('Docker is not installed or not accessible');
    }

    const result = await ssh.execCommand('sudo docker ps -a --format "{{.Names}}\t{{.Status}}\t{{.Image}}"');
    const containers: ContainerInfo[] = result.stdout
      .split('\n')
      .filter((line: string) => line.trim())
      .map((line: string) => {
        const [name, status, image] = line.split('\t');
        return {
          service_name: name,
          service_status: status.toLowerCase().includes('up') ? 'running' : 'stopped',
          service_ip: provider.provider_ip,
          image,
        } as ContainerInfo;
      });

    return { provider, containers };
  } finally {
    ssh.dispose();
  }
};

export const bulkInsertServices = async (providerId: number, body: unknown) => {
  const validated = BulkServiceSchema.parse(body);
  const provider = await getProviderById(providerId);
  if (!provider) {
    throw new Error('Provider not found');
  }

  const storedServices = [];
  for (const serviceName of validated.service_names) {
    const service = await insertService({
      provider_id: providerId,
      service_name: serviceName,
      service_ip: provider.provider_ip,
    });
    storedServices.push(service);
  }
  return storedServices;
};

export const listServicesByProvider = async (providerId: number) => {
  return getServicesByProvider(providerId);
};