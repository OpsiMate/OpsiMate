import { AddServiceDialog, ServiceConfig } from '@/components/AddServiceDialog';
import { RightSidebarWithLogs } from '@/components/RightSidebarWithLogs';
import type { Service } from '@/components/ServiceTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { queryKeys } from '@/hooks/queries';
import { useToast } from '@/hooks/use-toast';
import { ClientProviderType, Logger, ProviderType, Provider as SharedProvider } from '@OpsiMate/shared';
import { useQueryClient } from '@tanstack/react-query';
import {
	Cloud,
	Container,
	Database,
	Edit,
	Globe,
	ListPlus,
	MoreVertical,
	Play,
	Plus,
	RefreshCw,
	Search,
	Server,
	Square,
	Terminal,
	Trash,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { ProviderSidebar } from '../components/ProviderSidebar';
import { providerApi } from '../lib/api';
import { canDelete, canManageProviders } from '../lib/permissions';

const logger = new Logger('MyProviders');

interface Provider extends SharedProvider {
	services?: ServiceConfig[];
	status?: 'online' | 'offline' | 'warning' | 'unknown';
}

import { EditProviderDialog } from '@/components/EditProviderDialog';

const mockProviderInstances = [
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
] as Provider[];

const getProviderIcon = (type: Provider['providerType']) => {
	switch (type) {
		case ProviderType.VM:
			return <Cloud className="h-5 w-5" />;
		case ProviderType.K8S:
			return <Container className="h-5 w-5" />;
		default:
			return <Server className="h-5 w-5" />;
	}
};

export const getProviderTypeName = (type: Provider['providerType']): string => {
	switch (type) {
		case ProviderType.VM:
			return 'VM';
		case ProviderType.K8S:
			return 'Kubernetes';
		default:
			return type;
	}
};

const getProviderCategory = (type: Provider['providerType']): string => {
	switch (type) {
		case ProviderType.VM:
			return 'server';
		case ProviderType.K8S:
			return 'kubernetes';
		default:
			return 'cloud';
	}
};

export const getStatusBadgeColor = (status?: Provider['status']) => {
	switch (status) {
		case 'online':
			return 'bg-green-500/20 text-green-700 hover:bg-green-500/30';
		case 'offline':
			return 'bg-red-500/20 text-red-700 hover:bg-red-500/30';
		case 'warning':
			return 'bg-yellow-500/20 text-yellow-700 hover:bg-yellow-500/30';
		case 'unknown':
		default:
			return 'bg-gray-500/20 text-gray-700 hover:bg-gray-500/30';
	}
};

const getServiceStatusBadgeColor = (status: ServiceConfig['status']) => {
	switch (status.toLowerCase()) {
		case 'running':
			return 'bg-green-500/20 text-green-700 hover:bg-green-500/30';
		case 'stopped':
			return 'bg-gray-500/20 text-gray-700 hover:bg-gray-500/30';
		case 'error':
			return 'bg-red-500/20 text-red-700 hover:bg-red-500/30';
		case 'unknown':
		default:
			return 'bg-gray-500/20 text-gray-700 hover:bg-gray-500/30';
	}
};

export const Providers = () => {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const [searchQuery, setSearchQuery] = useState('');
	const [activeTab, setActiveTab] = useState('all');
	const [providerInstances, setProviderInstances] = useState<Provider[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [isAddServiceDialogOpen, setIsAddServiceDialogOpen] = useState(false);
	const [selectedServerForService, setSelectedServerForService] = useState<Provider | null>(null);
	const [selectedService, setSelectedService] = useState<ServiceConfig | null>(null);
	const [loadingServices, setLoadingServices] = useState<Set<number>>(new Set());
	const [selectedServiceForDrawer, setSelectedServiceForDrawer] = useState<Service | null>(null);
	const [isServiceDrawerOpen, setIsServiceDrawerOpen] = useState(false);
	const [isAddProviderOpen, setIsAddProviderOpen] = useState(false);
	const [selectedProviderType, setSelectedProviderType] = useState<ClientProviderType | null>(null);

	const fetchProviders = useCallback(async () => {
		setIsLoading(true);
		try {
			const response = await providerApi.getProviders();

			if (response.success && response.data && response.data.providers) {
				const apiProviders: Provider[] = response.data.providers.map((provider) => {
					const mappedProvider: Provider = {
						id: Number(provider.id),
						name: provider.name || '',
						providerIP: provider.providerIP || '',
						username: provider.username || '',
						privateKeyFilename: provider.privateKeyFilename || '',
						SSHPort: provider.SSHPort || 22,
						providerType: (provider.providerType as ProviderType) || ProviderType.VM,
						createdAt: provider.createdAt
							? new Date(provider.createdAt).toISOString()
							: new Date().toISOString(),
					};

					return mappedProvider;
				});

				setProviderInstances(apiProviders);
			} else if (
				import.meta.env.DEV &&
				(!response.data || !response.data.providers || response.data.providers.length === 0)
			) {
				setProviderInstances(mockProviderInstances);
			}
		} catch (error) {
			logger.error('Error loading providers:', error);
			toast({
				title: 'Error loading providers',
				description: 'There was a problem loading your providers',
				variant: 'destructive',
			});

			if (import.meta.env.DEV) {
				setProviderInstances(mockProviderInstances);
			}
		} finally {
			setIsLoading(false);
		}
	}, [toast]);

	const loadAllProviderServices = useCallback(async () => {
		if (providerInstances.length === 0) return;

		try {
			const response = await providerApi.getAllServices();

			if (response.success && response.data) {
				const servicesByProvider = response.data.reduce(
					(acc, service) => {
						const providerId = service.providerId?.toString();
						if (providerId) {
							if (!acc[providerId]) {
								acc[providerId] = [];
							}
							acc[providerId].push({
								id: service.id.toString(),
								name: service.name,
								status: service.serviceStatus as 'running' | 'stopped' | 'error' | 'unknown',
								type: service.serviceType,
								serviceIP: service.serviceIP,
								containerDetails: service.containerDetails || undefined,
							});
						}
						return acc;
					},
					{} as Record<string, ServiceConfig[]>
				);

				setProviderInstances((prevProviders) =>
					prevProviders.map((provider) => ({
						...provider,
						services: servicesByProvider[provider.id] || [],
					}))
				);
			}
		} catch (error) {
			logger.error('Error loading all provider services:', error);
			toast({
				title: 'Error loading services',
				description: 'There was a problem loading services for your providers',
				variant: 'destructive',
			});
		}
	}, [providerInstances.length, toast]);

	useEffect(() => {
		fetchProviders();
	}, [fetchProviders, toast]);

	useEffect(() => {
		if (!isLoading && providerInstances.length > 0) {
			// Only load services if providers don't already have services loaded
			const hasServicesLoaded = providerInstances.some(
				(provider) => provider.services && provider.services.length > 0
			);
			if (!hasServicesLoaded) {
				loadAllProviderServices();
			}
		}
	}, [isLoading, providerInstances, loadAllProviderServices]);

	const filteredProviders = providerInstances.filter((provider) => {
		const name = provider?.name || '';
		const type = provider?.providerType || ProviderType.VM;
		const matchesSearch =
			name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			type.toLowerCase().includes(searchQuery.toLowerCase());

		const matchesTab = activeTab === 'all' || getProviderCategory(type) === activeTab;

		return matchesSearch && matchesTab;
	});

	useEffect(() => {
		logger.info('Provider instances:', { extraArgs: { providerInstances } });
	}, [providerInstances]);

	const handleRefreshProvider = async (id: string) => {
		toast({
			title: 'Refreshing provider',
			description: 'Connecting to server and discovering services...',
		});

		const newLoading = new Set(loadingServices);
		newLoading.add(parseInt(id));
		setLoadingServices(newLoading);

		try {
			const response = await providerApi.refreshProvider(parseInt(id));

			if (response.success && response.data) {
				const { provider: refreshedProvider, services } = response.data;

				const serviceConfigs: ServiceConfig[] = services.map((service) => ({
					id: service.id.toString(),
					name: service.name,
					status: service.serviceStatus as 'running' | 'stopped' | 'error' | 'unknown',
					type: service.serviceType,
					serviceIP: service.serviceIP,
					containerDetails: service.containerDetails || undefined,
				}));

				const updatedProvider: Provider = {
					id: parseInt(id),
					name: refreshedProvider.name,
					providerIP: refreshedProvider.providerIP || '',
					username: refreshedProvider.username || '',
					privateKeyFilename: refreshedProvider.privateKeyFilename,
					SSHPort: refreshedProvider.SSHPort || 22,
					providerType: refreshedProvider.providerType as Provider['providerType'],
					createdAt: refreshedProvider.createdAt || new Date().toISOString(),
					status: services.some((s) => s.serviceStatus === 'running') ? 'online' : 'offline',
					services: serviceConfigs,
				};

				const updatedProviders = providerInstances.map((provider) =>
					provider.id === Number(id) ? updatedProvider : provider
				);

				setProviderInstances(updatedProviders);

				toast({
					title: 'Provider refreshed',
					description: `Discovered ${services.length} services with real-time status`,
				});
			} else {
				throw new Error('Failed to refresh provider');
			}
		} catch (error) {
			logger.error('Error refreshing provider:', error);
			toast({
				title: 'Error refreshing',
				description: 'There was a problem updating the provider status',
				variant: 'destructive',
			});
		} finally {
			const newLoading = new Set(loadingServices);
			newLoading.delete(parseInt(id));
			setLoadingServices(newLoading);
		}
	};

	const refreshProviderServices = async (provider: Provider) => {
		const providerId = provider.id;
		const newLoading = new Set(loadingServices);
		newLoading.add(providerId);
		setLoadingServices(newLoading);

		try {
			const response = await providerApi.getAllServices();
			if (response.success && response.data) {
				const providerServices = response.data?.filter(
					(service) => service.providerId && service.providerId === provider.id
				);

				const serviceConfigs: ServiceConfig[] = providerServices.map((service) => ({
					id: service.id.toString(),
					name: service.name,
					status: service.serviceStatus as 'running' | 'stopped' | 'error' | 'unknown',
					type: service.serviceType,
					serviceIP: service.serviceIP,
					containerDetails: service.containerDetails || undefined,
				}));

				const updatedProvider = {
					...provider,
					services: serviceConfigs,
				};

				const updatedProviders = providerInstances.map((item) =>
					item.id === provider.id ? updatedProvider : item
				);

				setProviderInstances(updatedProviders);
			}
		} catch (error) {
			logger.error('Error fetching services for provider:', error);
			toast({
				title: 'Error loading services',
				description: 'There was a problem loading services for this provider',
				variant: 'destructive',
			});
		} finally {
			const newLoading = new Set(loadingServices);
			newLoading.delete(providerId);
			setLoadingServices(newLoading);
		}
	};

	const handleRowClick = async (provider: Provider, e?: React.MouseEvent) => {
		if (e && (e.target as HTMLElement).closest('[data-radix-popper-content-wrapper]')) {
			return;
		}

		const providerId = provider.id;

		if (!provider.services || provider.services.length === 0) {
			await refreshProviderServices(provider);
		}
	};

	const handleServiceClick = (service: ServiceConfig) => {
		setSelectedService(service);
	};

	const handleServiceAction = async (providerId: string, serviceId: string, action: 'start' | 'stop' | 'restart') => {
		try {
			const serviceIdNum = parseInt(serviceId);

			if (action === 'start') {
				const response = await providerApi.startService(serviceIdNum);
				if (!response.success) throw new Error(response.error || 'Failed to start service');
			} else if (action === 'stop') {
				const response = await providerApi.stopService(serviceIdNum);
				if (!response.success) throw new Error(response.error || 'Failed to stop service');
			} else if (action === 'restart') {
				await providerApi.stopService(serviceIdNum);
				setTimeout(async () => {
					await providerApi.startService(serviceIdNum);
				}, 1000);
			}

			toast({
				title: `Service ${action}ed`,
				description: `Service has been ${action}ed successfully`,
			});

			setTimeout(() => handleRowClick(providerInstances.find((i) => i.id === Number(providerId))!), 2000);
		} catch (error) {
			logger.error(`Error ${action}ing service:`, error);
			toast({
				title: `Error ${action}ing service`,
				description: error instanceof Error ? error.message : `Failed to ${action} service`,
				variant: 'destructive',
			});
		}
	};

	const updateUIAfterServiceAddition = (providerId: number, service: ServiceConfig) => {
		setProviderInstances((prevProviders) => {
			const updatedProviders = prevProviders.map((provider) => {
				if (provider.id === providerId) {
					return {
						...provider,
						services: [service, ...(provider.services ?? [])],
					};
				}
				return provider;
			});
			logger.info('Updated providers after service addition:', { extraArgs: { updatedProviders } });
			return updatedProviders;
		});
	};

	const handleAddService = async (providerId: number, service: ServiceConfig) => {
		try {
			setIsAddServiceDialogOpen(false);
			updateUIAfterServiceAddition(providerId, service);
			queryClient.invalidateQueries({ queryKey: queryKeys.services });
			toast({
				title: 'Service added',
				description: `${service.name} has been successfully added`,
			});
		} catch (error) {
			logger.error('Error adding service:', error);
			toast({
				title: 'Error adding service',
				description: 'There was a problem adding the service',
				variant: 'destructive',
			});
		}
	};

	const handleServiceStatusChange = async (
		providerId: string,
		serviceId: string,
		newStatus: 'running' | 'stopped' | 'error' | 'unknown'
	) => {
		try {
			const serviceIdNum = parseInt(serviceId);

			if (newStatus === 'running') {
				const response = await providerApi.startService(serviceIdNum);
				if (!response.success) {
					throw new Error(response.error || 'Failed to start service');
				}
			} else if (newStatus === 'stopped') {
				const response = await providerApi.stopService(serviceIdNum);
				if (!response.success) {
					throw new Error(response.error || 'Failed to stop service');
				}
			}

			const updatedProviders = providerInstances.map((provider) => {
				if (provider.id === Number(providerId) && provider.services) {
					return {
						...provider,
						services: provider.services.map((service) =>
							service.id === serviceId ? { ...service, status: newStatus } : service
						),
					};
				}
				return provider;
			});

			setProviderInstances(updatedProviders);

			if (selectedProvider && selectedProvider.id === Number(providerId) && selectedProvider.services) {
				const updatedSelectedProvider = {
					...selectedProvider,
					services: selectedProvider.services.map((service) =>
						service.id === serviceId ? { ...service, status: newStatus } : service
					),
				};
				setSelectedProvider(updatedSelectedProvider);
			}
		} catch (error) {
			logger.error('Error updating service status:', error);
			toast({
				title: 'Error updating service',
				description:
					typeof error === 'object' && error !== null && 'message' in error
						? (error as Error).message
						: 'There was a problem updating the service status',
				variant: 'destructive',
			});
		}
	};

	const updateUIAfterServiceDeletion = (serviceId: string) => {
		setProviderInstances((prevProviders) => {
			const updatedProviders = prevProviders.map((provider) => {
				if (provider.services) {
					const serviceExists = provider.services.some((service) => service.id === serviceId);
					if (serviceExists) {
						return {
							...provider,
							services: provider.services.filter((service) => service.id !== serviceId),
						};
					}
				}
				return provider;
			});
			logger.info('Updated providers after service deletion:', { extraArgs: { updatedProviders } });
			return updatedProviders;
		});
	};

	const handleDeleteService = async (serviceId: string) => {
		try {
			const serviceIdNum = parseInt(serviceId);

			const containingProvider = providerInstances.find((provider) =>
				provider.services?.some((service) => service.id === serviceId)
			);

			if (!containingProvider) {
				toast({
					title: 'Service not found',
					description: 'Could not find the service to delete',
					variant: 'destructive',
				});
				return;
			}

			const response = await providerApi.deleteService(serviceIdNum);

			if (response.success) {
				await fetchProviders();
				setTimeout(async () => {
					await loadAllProviderServices();
				}, 100);

				queryClient.invalidateQueries({ queryKey: queryKeys.services });

				toast({
					title: 'Service deleted',
					description: 'The service has been successfully deleted.',
				});
			} else {
				throw new Error(response.error || 'Failed to delete service');
			}
		} catch (error) {
			logger.error('Error deleting service:', error);
			toast({
				title: 'Error deleting service',
				description: error instanceof Error ? error.message : 'There was a problem deleting the service',
				variant: 'destructive',
			});
		}
	};

	const handleDeleteProvider = async () => {
		if (!selectedProvider) return;
		try {
			const response = await providerApi.deleteProvider(selectedProvider.id);

			if (response.success) {
				const updatedProviders = providerInstances.filter((provider) => provider.id !== selectedProvider.id);
				setProviderInstances(updatedProviders);

				queryClient.invalidateQueries({ queryKey: queryKeys.services });

				toast({
					title: 'Provider deleted',
					description: `${selectedProvider.name} has been successfully deleted.`,
				});
				setSelectedProvider(null);
				setIsDeleteDialogOpen(false);
			} else {
				throw new Error(response.error || 'Failed to delete provider');
			}
		} catch (error) {
			logger.error('Error deleting provider:', error);
			toast({
				title: 'Error deleting provider',
				description: 'There was a problem deleting your provider.',
				variant: 'destructive',
			});
		}
	};

	const handleUpdateProvider = async (
		providerId: string,
		updatedData: {
			name: string;
			providerIP: string;
			username: string;
			secretId?: number;
			password: string;
			SSHPort: number;
			providerType: string;
		}
	) => {
		try {
			const response = await providerApi.updateProvider(Number(providerId), updatedData);

			if (response.success && response.data) {
				const updatedProviders = providerInstances.map((provider) => {
					if (provider.id === Number(providerId)) {
						return {
							...provider,
							name: updatedData.name,
							providerIP: updatedData.providerIP,
							username: updatedData.username,
							SSHPort: updatedData.SSHPort,
							providerType: updatedData.providerType as Provider['providerType'],
						};
					}
					return provider;
				});

				setProviderInstances(updatedProviders);

				if (selectedProvider && selectedProvider.id === Number(providerId)) {
					const updatedProvider = updatedProviders.find((i) => i.id === Number(providerId));
					if (updatedProvider) {
						setSelectedProvider(updatedProvider);
					}
				}

				queryClient.invalidateQueries({ queryKey: queryKeys.services });

				toast({
					title: 'Provider updated',
					description: `${updatedData.name} has been successfully updated.`,
				});
			} else {
				throw new Error(response.error || 'Failed to update provider');
			}
		} catch (error) {
			logger.error('Error updating provider:', error);
			toast({
				title: 'Error updating provider',
				description: 'There was a problem updating your provider.',
				variant: 'destructive',
			});
			throw error;
		}
	};

	return (
		<DashboardLayout>
			<div className="flex flex-col h-full">
				<header className="bg-background border-b border-border p-4">
					<div className="flex items-center justify-between">
						<h1 className="text-2xl font-bold">Providers</h1>
						{canManageProviders() && (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button>
										<Plus className="mr-2 h-4 w-4" />
										Add Provider
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem
										onClick={() => {
											setSelectedProviderType('server');
											setIsAddProviderOpen(true);
										}}
									>
										<Server className="mr-2 h-4 w-4" />
										VM / Server
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={() => {
											setSelectedProviderType('kubernetes');
											setIsAddProviderOpen(true);
										}}
									>
										<Globe className="mr-2 h-4 w-4" />
										Kubernetes
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						)}
					</div>
					<div className="mt-4">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
							<Input
								placeholder="Search providers..."
								className="pl-10"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
							/>
						</div>
					</div>
				</header>

				<Tabs value={activeTab} onValueChange={setActiveTab} className="p-4 bg-background">
					<TabsList>
						<TabsTrigger value="all">All</TabsTrigger>
						<TabsTrigger value="server">Servers</TabsTrigger>
						<TabsTrigger value="kubernetes">Kubernetes</TabsTrigger>
						<TabsTrigger value="cloud">Cloud</TabsTrigger>
					</TabsList>
				</Tabs>

				<div className="flex-1 overflow-auto p-4">
					{isLoading ? (
						<div className="flex items-center justify-center h-full">
							<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
						</div>
					) : filteredProviders.length > 0 ? (
						<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
							{filteredProviders.map((provider) => {
								const hasServices = Array.isArray(provider.services) && provider.services.length > 0;
								const isLoading = loadingServices.has(provider.id);
								const servicesToShow = hasServices ? provider.services : [];
								const hasMoreServices = hasServices && provider.services!.length > 3;

								return (
									<Card
										key={provider.id}
										className="flex flex-col transition-all duration-300 hover:shadow-md"
									>
										<CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
											<div className="flex items-start gap-3">
												<div className="bg-primary/10 dark:bg-primary/20 text-primary p-2 rounded-lg flex-shrink-0">
													{getProviderIcon(provider.providerType)}
												</div>
												<div className="flex-1 min-w-0">
													<CardTitle className="text-lg font-semibold leading-snug truncate">
														{provider.name}
													</CardTitle>
													<p className="text-sm text-muted-foreground">
														{getProviderTypeName(provider.providerType)}
													</p>
												</div>
											</div>
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8"
														onClick={(e) => e.stopPropagation()}
													>
														<MoreVertical className="h-4 w-4" />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuPortal>
													<DropdownMenuContent
														align="end"
														onClick={(e) => e.stopPropagation()}
													>
														<DropdownMenuItem
															onClick={() => handleRefreshProvider(String(provider.id))}
														>
															<RefreshCw className="mr-2 h-4 w-4" />
															Refresh
														</DropdownMenuItem>
														{canManageProviders() && (
															<DropdownMenuItem
																onClick={() => {
																	setSelectedProvider(provider);
																	setIsEditDialogOpen(true);
																}}
															>
																<Edit className="mr-2 h-4 w-4" />
																Edit
															</DropdownMenuItem>
														)}
														{canManageProviders() &&
															(provider.providerType === ProviderType.VM ||
																provider.providerType === ProviderType.K8S) && (
																<DropdownMenuItem
																	onClick={() => {
																		setSelectedServerForService(provider);
																		setIsAddServiceDialogOpen(true);
																	}}
																>
																	<ListPlus className="mr-2 h-4 w-4" />
																	Add Service
																</DropdownMenuItem>
															)}
														{canDelete() && (
															<DropdownMenuItem
																onClick={() => {
																	setSelectedProvider(provider);
																	setIsDeleteDialogOpen(true);
																}}
																className="text-red-500 focus:text-red-500"
															>
																<Trash className="mr-2 h-4 w-4" />
																Delete
															</DropdownMenuItem>
														)}
													</DropdownMenuContent>
												</DropdownMenuPortal>
											</DropdownMenu>
										</CardHeader>

										<CardContent className="flex-grow pt-2 px-6 pb-4 h-full">
											<div className="min-h-[320px] h-full flex flex-col justify-start">
												<div className="relative h-full">
													<div className="overflow-y-scroll pr-2 max-h-[304px] h-full services-scrollbar">
														{hasServices ? (
															<div className="space-y-3">
																{servicesToShow.map((service) => (
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
																				<p className="font-medium text-sm truncate">
																					{service.name}
																				</p>
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
																			<Badge
																				className={`text-xs ${getServiceStatusBadgeColor(service.status)}`}
																			>
																				{service.status.toLowerCase()}
																			</Badge>
																			<DropdownMenu>
																				<DropdownMenuTrigger asChild>
																					<Button
																						variant="ghost"
																						size="icon"
																						className="h-6 w-6"
																						onClick={(e) =>
																							e.stopPropagation()
																						}
																					>
																						<MoreVertical className="h-3 w-3" />
																					</Button>
																				</DropdownMenuTrigger>
																				<DropdownMenuPortal>
																					<DropdownMenuContent
																						align="end"
																						onClick={(e) =>
																							e.stopPropagation()
																						}
																					>
																						<DropdownMenuItem
																							onClick={() => {
																								const parentProvider =
																									providerInstances.find(
																										(p) =>
																											p.services &&
																											p.services.some(
																												(s) =>
																													s.id ===
																													service.id
																											)
																									);
																								const mappedService: Service =
																									{
																										id: service.id,
																										name: service.name,
																										serviceStatus:
																											service.status,
																										serviceType:
																											service.type as
																												| 'MANUAL'
																												| 'DOCKER'
																												| 'SYSTEMD',
																										createdAt:
																											new Date().toISOString(),
																										provider:
																											parentProvider
																												? {
																														id: parentProvider.id,
																														name: parentProvider.name,
																														providerIP:
																															parentProvider.providerIP ||
																															'',
																														username:
																															parentProvider.username ||
																															'',
																														privateKeyFilename:
																															parentProvider.privateKeyFilename ||
																															'',
																														SSHPort:
																															parentProvider.SSHPort ||
																															22,
																														createdAt: 0,
																														providerType:
																															parentProvider.providerType,
																													}
																												: {
																														id: -1,
																														name: 'Unknown',
																														providerIP:
																															'',
																														username:
																															'',
																														privateKeyFilename:
																															'',
																														SSHPort: 22,
																														createdAt: 0,
																														providerType:
																															'VM',
																													},
																										serviceIP:
																											service.serviceIP ||
																											'',
																										containerDetails:
																											service.containerDetails ||
																											{},
																										tags: [],
																									};
																								setSelectedServiceForDrawer(
																									mappedService
																								);
																								setIsServiceDrawerOpen(
																									true
																								);
																							}}
																						>
																							<Terminal className="mr-2 h-3 w-3" />{' '}
																							Details
																						</DropdownMenuItem>
																						{canManageProviders() &&
																							service.status !==
																								'running' && (
																								<DropdownMenuItem
																									onClick={() =>
																										handleServiceAction(
																											String(
																												provider.id
																											),
																											service.id,
																											'start'
																										)
																									}
																								>
																									<Play className="mr-2 h-3 w-3" />{' '}
																									Start
																								</DropdownMenuItem>
																							)}
																						{canManageProviders() &&
																							service.status ===
																								'running' && (
																								<DropdownMenuItem
																									onClick={() =>
																										handleServiceAction(
																											String(
																												provider.id
																											),
																											service.id,
																											'stop'
																										)
																									}
																								>
																									<Square className="mr-2 h-3 w-3" />{' '}
																									Stop
																								</DropdownMenuItem>
																							)}
																						{canManageProviders() && (
																							<DropdownMenuItem
																								onClick={() =>
																									handleServiceAction(
																										String(
																											provider.id
																										),
																										service.id,
																										'restart'
																									)
																								}
																							>
																								<RefreshCw className="mr-2 h-3 w-3" />{' '}
																								Restart
																							</DropdownMenuItem>
																						)}
																						{canDelete() && (
																							<DropdownMenuItem
																								onClick={() =>
																									handleDeleteService(
																										service.id
																									)
																								}
																								className="text-red-500 focus:text-red-500"
																							>
																								<Trash className="mr-2 h-3 w-3" />{' '}
																								Delete
																							</DropdownMenuItem>
																						)}
																					</DropdownMenuContent>
																				</DropdownMenuPortal>
																			</DropdownMenu>
																		</div>
																	</div>
																))}
															</div>
														) : (
															<div className="flex-1 h-full flex flex-col justify-center">
																<div
																	className="border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 text-center bg-gray-50 dark:bg-gray-800/50 flex flex-col items-center justify-center h-full"
																	style={{
																		alignItems: 'center',
																		justifyContent: 'center',
																	}}
																>
																	<Server className="h-8 w-8 text-muted-foreground mb-2" />
																	<h4 className="font-semibold text-sm text-foreground">
																		No Services Configured
																	</h4>
																	<p className="text-xs text-muted-foreground mt-1 mb-4">
																		Get started by adding a new service to this
																		provider.
																	</p>
																	{canManageProviders() &&
																		(provider.providerType === ProviderType.VM ||
																			provider.providerType ===
																				ProviderType.K8S) && (
																			<Button
																				variant="outline"
																				size="sm"
																				onClick={(e) => {
																					e.stopPropagation();
																					setSelectedServerForService(
																						provider
																					);
																					setIsAddServiceDialogOpen(true);
																				}}
																			>
																				<ListPlus className="mr-2 h-4 w-4" />
																				Add New Service
																			</Button>
																		)}
																</div>
															</div>
														)}
													</div>
												</div>
											</div>
										</CardContent>

										<CardFooter className="flex items-center justify-between text-xs text-muted-foreground"></CardFooter>
									</Card>
								);
							})}
						</div>
					) : (
						<div className="flex flex-col items-center justify-center h-full p-8 text-center">
							<div className="bg-muted/30 p-4 rounded-full mb-4">
								<Database className="h-10 w-10 text-muted-foreground" />
							</div>
							<h3 className="text-xl font-semibold mb-2">No providers found</h3>
							<p className="text-muted-foreground mb-4">
								{searchQuery
									? 'No providers match your search query.'
									: "You haven't added any providers yet."}
							</p>
							{canManageProviders() && (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button>
											<Plus className="mr-2 h-4 w-4" />
											Add Provider
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="center">
										<DropdownMenuItem
											onClick={() => {
												setSelectedProviderType('server');
												setIsAddProviderOpen(true);
											}}
										>
											<Server className="mr-2 h-4 w-4" />
											VM / Server
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={() => {
												setSelectedProviderType('kubernetes');
												setIsAddProviderOpen(true);
											}}
										>
											<Globe className="mr-2 h-4 w-4" />
											Kubernetes
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							)}
						</div>
					)}
				</div>
			</div>

			{selectedServerForService && (
				<AddServiceDialog
					serverId={String(selectedServerForService.id)}
					serverName={selectedServerForService.name}
					providerType={selectedServerForService.providerType}
					open={isAddServiceDialogOpen}
					onClose={() => setIsAddServiceDialogOpen(false)}
					onServiceAdded={(service) => handleAddService(selectedServerForService.id, service)}
				/>
			)}

			<Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Are you sure you want to delete this provider?</DialogTitle>
						<DialogDescription>
							This action cannot be undone. This will permanently delete the
							<span className="font-semibold"> {selectedProvider?.name} </span>
							provider.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={handleDeleteProvider}>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<EditProviderDialog
				provider={selectedProvider}
				open={isEditDialogOpen}
				onClose={() => setIsEditDialogOpen(false)}
				onSave={handleUpdateProvider}
			/>

			{isAddProviderOpen && selectedProviderType && (
				<ProviderSidebar
					provider={{
						id: selectedProviderType,
						type: selectedProviderType,
						name: selectedProviderType === 'server' ? 'VM / Server' : 'Kubernetes',
						description:
							selectedProviderType === 'server'
								? 'Connect to a virtual machine or physical server'
								: 'Connect to a Kubernetes cluster',
						icon:
							selectedProviderType === 'server' ? (
								<Server className="h-5 w-5" />
							) : (
								<Globe className="h-5 w-5" />
							),
					}}
					onClose={() => {
						setIsAddProviderOpen(false);
						setSelectedProviderType(null);
						// Refresh providers after adding
						fetchProviders();
					}}
				/>
			)}

			<Sheet open={isServiceDrawerOpen} onOpenChange={setIsServiceDrawerOpen}>
				<SheetContent side="right" className="w-[400px] p-0" closable={false}>
					{selectedServiceForDrawer && (
						<RightSidebarWithLogs
							service={selectedServiceForDrawer}
							onClose={() => setIsServiceDrawerOpen(false)}
							collapsed={false}
						/>
					)}
				</SheetContent>
			</Sheet>
		</DashboardLayout>
	);
};

export default Providers;
