import { ProviderType } from '@OpsiMate/shared';
import { Provider } from './Providers.types';

export const mockProviderInstances: Provider[] = [
	{
		id: 1,
		name: 'Production API Server',
		providerIP: '192.168.1.100',
		username: 'admin',
		privateKeyFilename: 'id_rsa',
		SSHPort: 22,
		providerType: ProviderType.VM,
		createdAt: '2025-06-01T08:00:00Z',
		services: [],
	},
	{
		id: 2,
		name: 'Database Server',
		providerIP: '192.168.1.101',
		username: 'dbadmin',
		privateKeyFilename: 'id_rsa_db',
		SSHPort: 22,
		providerType: ProviderType.VM,
		createdAt: '2025-06-02T14:30:00Z',
		services: [],
	},
	{
		id: 3,
		name: 'Development Cluster',
		providerIP: '192.168.1.102',
		username: 'devuser',
		privateKeyFilename: 'id_rsa_k8s',
		SSHPort: 22,
		providerType: ProviderType.K8S,
		createdAt: '2025-06-05T09:20:00Z',
		services: [],
	},
];
