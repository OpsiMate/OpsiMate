import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ServiceConfig } from '@/components/AddServiceDialog';
import type { Service } from '@/components/ServiceTable';
import { canDelete, canManageProviders } from '@/lib/permissions';
import { ProviderType } from '@OpsiMate/shared';
import { Container, MoreVertical, Play, RefreshCw, Server, Square, Terminal, Trash } from 'lucide-react';
import { useState } from 'react';
import { ServiceDetailsDrawer } from '../ServiceDetailsDrawer';
import { getServiceStatusBadgeColor } from '../Providers.utils';
import { Provider } from '../Providers.types';

interface ServiceListProps {
	services: ServiceConfig[];
	provider: Provider;
	onServiceAction: (providerId: string, serviceId: string, action: 'start' | 'stop' | 'restart') => void;
	onDeleteService: (serviceId: string) => void;
}

export const ServiceList = ({ services, provider, onServiceAction, onDeleteService }: ServiceListProps) => {
	const [selectedService, setSelectedService] = useState<Service | null>(null);
	const [isServiceDrawerOpen, setIsServiceDrawerOpen] = useState(false);

	const mapToDetailService = (service: ServiceConfig, parentProvider: Provider | undefined): Service => {
		return {
			id: service.id,
			name: service.name,
			serviceStatus: service.status,
			serviceType: service.type as 'MANUAL' | 'DOCKER' | 'SYSTEMD',
			createdAt: new Date().toISOString(),
			provider: parentProvider
				? {
						id: parentProvider.id,
						name: parentProvider.name,
						providerIP: parentProvider.providerIP || '',
						username: parentProvider.username || '',
						privateKeyFilename: parentProvider.privateKeyFilename || '',
						SSHPort: parentProvider.SSHPort || 22,
						createdAt: 0,
						providerType: parentProvider.providerType,
					}
				: {
						id: -1,
						name: 'Unknown',
						providerIP: '',
						username: '',
						privateKeyFilename: '',
						SSHPort: 22,
						createdAt: 0,
						providerType: 'VM',
					},
			serviceIP: service.serviceIP || '',
			containerDetails: service.containerDetails || {},
			tags: [],
		};
	};

	const handleServiceDetails = (service: Service) => {
		setSelectedService(service);
		setIsServiceDrawerOpen(true);
	};

	return (
		<>
			<div className="space-y-3">
				{services.map((service) => (
					<div
						key={service.id}
						className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
					>
						<div className="flex items-center gap-3">
							<div className="flex-shrink-0">
								{service.type === 'DOCKER' ? (
									<Container className="h-4 w-4 text-blue-500" />
								) : (
									<Server className="h-4 w-4 text-purple-500" />
								)}
							</div>
							<div className="min-w-0 flex-1">
								<p className="font-medium text-sm truncate">{service.name}</p>
								<p className="text-xs text-muted-foreground truncate">
									{service.type === 'DOCKER'
										? `${provider.providerType === ProviderType.K8S ? 'Pod' : 'Container'}: ${service.containerDetails?.image || service.name}`
										: service.serviceIP
											? `IP: ${service.serviceIP}`
											: 'Manual service'}
								</p>
							</div>
						</div>
						<div className="flex items-center gap-2">
							<Badge className={`text-xs ${getServiceStatusBadgeColor(service.status)}`}>
								{service.status.toLowerCase()}
							</Badge>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="h-6 w-6"
										onClick={(e) => e.stopPropagation()}
									>
										<MoreVertical className="h-3 w-3" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuPortal>
									<DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
										<DropdownMenuItem
											onClick={() => {
												handleServiceDetails(mapToDetailService(service, provider));
											}}
										>
											<Terminal className="mr-2 h-3 w-3" /> Details
										</DropdownMenuItem>
										{canManageProviders() && service.status !== 'running' && (
											<DropdownMenuItem
												onClick={() =>
													onServiceAction(String(provider.id), service.id, 'start')
												}
											>
												<Play className="mr-2 h-3 w-3" /> Start
											</DropdownMenuItem>
										)}
										{canManageProviders() && service.status === 'running' && (
											<DropdownMenuItem
												onClick={() => onServiceAction(String(provider.id), service.id, 'stop')}
											>
												<Square className="mr-2 h-3 w-3" /> Stop
											</DropdownMenuItem>
										)}
										{canManageProviders() && (
											<DropdownMenuItem
												onClick={() =>
													onServiceAction(String(provider.id), service.id, 'restart')
												}
											>
												<RefreshCw className="mr-2 h-3 w-3" /> Restart
											</DropdownMenuItem>
										)}
										{canDelete() && (
											<DropdownMenuItem
												onClick={() => onDeleteService(service.id)}
												className="text-red-500 focus:text-red-500"
											>
												<Trash className="mr-2 h-3 w-3" /> Delete
											</DropdownMenuItem>
										)}
									</DropdownMenuContent>
								</DropdownMenuPortal>
							</DropdownMenu>
						</div>
					</div>
				))}
			</div>

			<ServiceDetailsDrawer
				open={isServiceDrawerOpen}
				service={selectedService}
				onClose={() => setIsServiceDrawerOpen(false)}
			/>
		</>
	);
};
