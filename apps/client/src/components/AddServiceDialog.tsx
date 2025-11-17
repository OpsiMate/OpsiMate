import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { providerApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { DiscoveredService, Logger, ServiceWithProvider } from '@OpsiMate/shared';
import { AlertCircle, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

// Define service types
export interface ServiceConfig {
	id: string;
	name: string;
	type: string; // Updated to accept any string type from API ("MANUAL", "DOCKER", etc.)
	status: 'running' | 'stopped' | 'error' | 'unknown';
	serviceIP?: string;
	containerDetails?: {
		id?: string;
		image?: string;
		created?: string;
	};
}

// Logger instance
const logger = new Logger('AddServiceDialog');

// Container interface
interface Container {
	name: string;
	serviceStatus: string;
	serviceIP: string;
	image: string;
	namespace: string;
}

interface AddServiceDialogProps {
	serverId: string;
	serverName: string;
	providerType?: string;
	open: boolean;
	onClose: () => void;
	onServiceAdded: (service: ServiceConfig) => void;
}

export const AddServiceDialog = ({
	serverId,
	serverName,
	providerType,
	open,
	onClose,
	onServiceAdded,
}: AddServiceDialogProps) => {
	// Check if this is a Kubernetes provider by checking the provider type
	const isKubernetes = providerType === 'kubernetes' || providerType === 'K8S';
	const { toast } = useToast();

	// For Kubernetes providers, we only show the container tab (which shows pods)
	// For other providers, we default to container tab (removed manual)
	const [activeTab, setActiveTab] = useState<'container' | 'systemd'>(isKubernetes ? 'container' : 'container');

	const [serviceName, setServiceName] = useState('');
	const [loading, setLoading] = useState(false);
	const [containers, setContainers] = useState<
		Array<
			Container & {
				id: string;
				selected: boolean;
				name: string;
				created: string;
				alreadyAdded?: boolean; // Flag to mark containers that are already added as services
				existingServiceId?: number; // ID of existing service for removal
			}
		>
	>([]);
	const [loadingContainers, setLoadingContainers] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedContainer, setSelectedContainer] = useState<
		(Container & { id: string; selected: boolean; name: string; created: string }) | null
	>(null);
	const [existingServices, setExistingServices] = useState<ServiceWithProvider[]>([]);

	// Function to fetch existing services for this provider
	const fetchExistingServices = useCallback(async () => {
		try {
			// Use getAllServices instead and filter by providerId
			const response = await providerApi.getAllServices();

			if (response.success && response.data) {
				// Filter services to only include those from this provider
				const providerServices = response.data.filter((service) => service.providerId === parseInt(serverId));

				setExistingServices(providerServices);
				return providerServices;
			} else {
				logger.error('Failed to fetch existing services');
				return [];
			}
		} catch (err) {
			logger.error('Error fetching existing services:', err);
			return [];
		}
	}, [serverId]);

	// Function to fetch containers or pods from the API
	const fetchContainers = useCallback(async () => {
		setLoadingContainers(true);
		setError('');

		try {
			// First, fetch existing services to check for duplicates
			const existingServices = await fetchExistingServices();

			const response = await providerApi.getProviderInstances(parseInt(serverId));

			if (response.success && response.data) {
				// Transform API discovered service data to match our UI format
				const containerData = response.data.map((service: DiscoveredService, index) => {
					// Check if this container/pod is already added as a service by matching name
					// We need to compare the name with existing service names
					const isAlreadyAdded = existingServices.some(
						(existingService) =>
							existingService.serviceType === 'DOCKER' && existingService.name === service.name
					);

					return {
						serviceStatus: service.serviceStatus,
						serviceIP: service.serviceIP,
						image: '', // DiscoveredService doesn't have image info
						id: `container-${index}`, // Generate ID since DiscoveredService doesn't have id
						name: service.name,
						selected: isAlreadyAdded, // Pre-select already added services
						created: new Date().toISOString(),
						alreadyAdded: isAlreadyAdded, // Mark if already added
						namespace: service.namespace,
						existingServiceId: isAlreadyAdded
							? existingServices.find((es) => es.name === service.name)?.id
							: undefined, // Store existing service ID for removal
					};
				});

				setContainers(containerData);
			} else {
				setError('Failed to load containers');
				// Fall back to empty array
				setContainers([]);
			}
		} catch (err) {
			logger.error(`Error fetching ${isKubernetes ? 'pods' : 'containers'}:`, err);
			setError(`Error loading ${isKubernetes ? 'pods' : 'containers'}. Please try again.`);
			setContainers([]);
		} finally {
			setLoadingContainers(false);
		}
	}, [serverId, isKubernetes, fetchExistingServices]);

	// Load containers from the server using API when the dialog opens or tab changes
	useEffect(() => {
		if (open && (activeTab === 'container' || isKubernetes)) {
			fetchContainers();
		}
	}, [open, activeTab, serverId, isKubernetes, fetchContainers]);

	// Reset form when dialog closes
	useEffect(() => {
		if (!open) {
			setServiceName('');
			setSelectedContainer(null);
			setContainers((prevContainers) => prevContainers.map((container) => ({ ...container, selected: false })));
		}
	}, [open]);

	const handleAddSystemdService = async () => {
		if (!serviceName) {
			toast({
				title: 'Service name required',
				description: 'Please enter a name for the systemd service',
				variant: 'destructive',
			});
			return;
		}

		setLoading(true);
		try {
			const serverStatus = await providerApi.getProviderInstances(parseInt(serverId));
			if (!serverStatus.success || !serverStatus.data) {
				toast({
					title: `Service '${serviceName}' was not added`,
					description: `Unable to connect to server '${serverName}'. Please make sure this server is online.`,
					variant: 'destructive',
				});
				setLoading(false);

				//Closes dialog if failed
				onClose();
				return;
			}

			// Create service using the API
			const serviceData = {
				providerId: parseInt(serverId),
				name: serviceName,
				serviceType: 'SYSTEMD' as const,
				serviceStatus: 'unknown' as const,
			};
			logger.info('Creating systemd service with data:', { extraArgs: { serviceData } });

			const response = await providerApi.createService(serviceData);

			logger.info('Create systemd service response:', { extraArgs: { response } });

			if (response.success && response.data) {
				// Create UI service object from API response
				const newService: ServiceConfig = {
					id: response.data.id.toString(),
					name: response.data.name,
					type: 'SYSTEMD', // Match the API service_type
					status: response.data.serviceStatus as 'running' | 'stopped' | 'error' | 'unknown',
				};

				logger.info('Service status from server:', {
					extraArgs: { serviceStatus: response.data.serviceStatus },
				});

				onServiceAdded(newService);
				setServiceName('');
				onClose();

				toast({
					title: 'Systemd service added',
					description: `${serviceName} has been added to server ${serverName}`,
				});
			} else {
				toast({
					title: 'Failed to add systemd service',
					description: response.error || 'An error occurred while adding the systemd service',
					variant: 'destructive',
				});
			}
		} catch (err) {
			logger.error('Error adding systemd service:', err);
			toast({
				title: 'Error adding systemd service',
				description: 'An unexpected error occurred',
				variant: 'destructive',
			});
		} finally {
			setLoading(false);
		}
	};

	const removeService = async (
		container: Container & {
			id: string;
			selected: boolean;
			name: string;
			created: string;
			alreadyAdded?: boolean;
			existingServiceId?: number;
		},
		removedServices: string[],
		failedOperations: string[]
	) => {
		if (!container.existingServiceId) return;

		try {
			const response = await providerApi.deleteService(container.existingServiceId);
			if (response.success) {
				removedServices.push(container.name);
			} else {
				failedOperations.push(`Failed to remove ${container.name}`);
			}
		} catch (error) {
			logger.error(`Error removing service ${container.name}:`, error);
			failedOperations.push(`Failed to remove ${container.name}`);
		}
	};

	const handleAddContainersOrPods = async () => {
		const selectedContainers = containers.filter((container) => container.selected);
		const deselectedContainers = containers.filter((container) => !container.selected && container.alreadyAdded);

		if (selectedContainers.length === 0 && deselectedContainers.length === 0) {
			toast({
				title: 'No changes to apply',
				description: 'Please select or deselect services to add or remove them',
				variant: 'destructive',
			});
			return;
		}

		setLoading(true);

		try {
			const createdServices: ServiceConfig[] = [];
			const removedServices: string[] = [];
			const failedOperations: string[] = [];

			// Handle service removals (deselected previously added services)
			for (const container of deselectedContainers) {
				await removeService(container, removedServices, failedOperations);
			}

			// Handle service additions (selected new services)
			const newContainers = selectedContainers.filter((container) => !container.alreadyAdded);
			for (const container of newContainers) {
				const status =
					container.serviceStatus === 'running'
						? ('running' as const)
						: container.serviceStatus === 'stopped'
							? ('stopped' as const)
							: container.serviceStatus === 'error'
								? ('error' as const)
								: ('unknown' as const);

				try {
					const response = await providerApi.createService({
						providerId: parseInt(serverId),
						name: container.name,
						serviceType: 'DOCKER',
						serviceStatus: status,
						serviceIP: container.serviceIP,
						containerDetails: {
							id: container.id,
							image: container.image,
							created: container.created,
							namespace: container.namespace,
						},
					});

					if (response.success && response.data) {
						const newService: ServiceConfig = {
							id: response.data.id.toString(),
							name: response.data.name,
							type: 'DOCKER',
							status: response.data.serviceStatus as 'running' | 'stopped' | 'error' | 'unknown',
							serviceIP: response.data.serviceIP,
							containerDetails: response.data.containerDetails,
						};

						createdServices.push(newService);
					} else {
						failedOperations.push(`Failed to add ${container.name}`);
					}
				} catch (error) {
					logger.error(`Error creating service for container ${container.name}:`, error);
					failedOperations.push(`Failed to add ${container.name}`);
				}
			}

			// Update UI with successful operations
			createdServices.forEach((service) => onServiceAdded(service));

			// Show summary toast
			const totalOperations = createdServices.length + removedServices.length;
			if (totalOperations > 0) {
				let message = '';
				if (createdServices.length > 0) {
					message += `Added ${createdServices.length} service${createdServices.length > 1 ? 's' : ''}`;
				}
				if (removedServices.length > 0) {
					if (message) message += ', ';
					message += `Removed ${removedServices.length} service${removedServices.length > 1 ? 's' : ''}`;
				}

				toast({
					title: 'Services updated',
					description:
						message +
						(failedOperations.length > 0 ? `. ${failedOperations.length} operation(s) failed.` : ''),
				});

				// Refresh the container list to reflect changes
				await fetchContainers();
				setSelectedContainer(null);
				onClose();
			} else {
				toast({
					title: 'Operation failed',
					description: failedOperations.join(', ') || 'No operations completed successfully',
					variant: 'destructive',
				});
			}
		} catch (err) {
			logger.error('Error managing services:', err);
			toast({
				title: 'Error managing services',
				description: 'An unexpected error occurred',
				variant: 'destructive',
			});
		} finally {
			setLoading(false);
		}
	};

	// Toggle selection for a single container
	const toggleContainerSelection = (containerId: string) => {
		// Find the container being toggled
		const containerToToggle = containers.find((c) => c.id === containerId);

		const updatedContainers = containers.map((container) => {
			if (container.id === containerId) {
				// Toggle selection state for the clicked container
				const newSelected = !container.selected;
				return { ...container, selected: newSelected };
			}
			// Leave other containers unchanged to allow multi-select
			return container;
		});

		// Update containers state
		setContainers(updatedContainers);

		// Update selectedContainer state based on any selected container
		const anySelected = updatedContainers.some((c) => c.selected);
		if (anySelected) {
			// Just set selectedContainer to a non-null value to enable the Add button
			// We don't need specific container details since we're using multi-select
			setSelectedContainer({ id: 'multi-select', name: 'Multi-select' });
		} else {
			setSelectedContainer(null);
		}
	};

	// Toggle selection for all containers at once
	const toggleAllContainersSelection = () => {
		// Check if all containers are already selected
		const allSelected = containers.every((container) => container.selected);

		// Toggle all containers
		const updatedContainers = containers.map((container) => {
			// Set all to the opposite of current state
			return { ...container, selected: !allSelected };
		});

		// Update containers state
		setContainers(updatedContainers);

		// Update selectedContainer state
		if (!allSelected && containers.length > 0) {
			// If we're selecting all and there are containers, enable the Add button
			setSelectedContainer({ id: 'multi-select', name: 'Multi-select' });
		} else {
			// If we're deselecting all, disable the Add button
			setSelectedContainer(null);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Add Service to {serverName}</DialogTitle>
					<DialogDescription>
						Add a new service to monitor on this {isKubernetes ? 'Kubernetes cluster' : 'server'}.
					</DialogDescription>
				</DialogHeader>

				{isKubernetes ? (
					// For Kubernetes providers, only show the pods UI without tabs
					<div className="w-full">
						<h3 className="text-lg font-medium mb-4">Kubernetes Pods</h3>

						{/* Container/pods UI for Kubernetes */}
						<div className="flex items-center justify-between mb-4">
							<h4 className="text-sm font-medium">Available Pods</h4>
							<Button variant="outline" size="sm" onClick={fetchContainers} disabled={loadingContainers}>
								<RefreshCw className={`mr-2 h-4 w-4 ${loadingContainers ? 'animate-spin' : ''}`} />
								Refresh
							</Button>
						</div>

						<div className="space-y-4 mt-4">
							{loadingContainers ? (
								<div className="flex items-center justify-center py-8">
									<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
									<span className="ml-2 text-muted-foreground">Loading pods...</span>
								</div>
							) : error ? (
								<div className="text-center py-8">
									<p className="text-destructive">{error}</p>
									<Button variant="outline" onClick={fetchContainers} className="mt-4">
										<RefreshCw className="mr-2 h-4 w-4" />
										Try Again
									</Button>
								</div>
							) : containers.length === 0 ? (
								<div className="text-center py-8">
									<p className="text-muted-foreground">No pods found</p>
									<Button variant="outline" onClick={fetchContainers} className="mt-4">
										<RefreshCw className="mr-2 h-4 w-4" />
										Refresh
									</Button>
								</div>
							) : (
								<div className="space-y-4">
									<div className="flex items-center space-x-2 mb-4 p-2 border rounded bg-muted/20">
										<Checkbox
											id="select-all-containers"
											checked={containers.every((c) => c.selected)}
											onCheckedChange={toggleAllContainersSelection}
										/>
										<Label htmlFor="select-all-containers" className="font-medium cursor-pointer">
											Select/Deselect all pods
										</Label>
									</div>
									<div className="space-y-2 max-h-60 overflow-y-auto pr-1">
										{containers.map((container) => (
											<div
												key={container.id}
												className={cn(
													'flex items-center space-x-3 border rounded-lg p-4 transition-all duration-200 shadow-sm',
													container.selected && 'border-primary bg-primary/5 shadow-md',
													'hover:bg-slate-50 hover:border-slate-300 hover:shadow-md cursor-pointer dark:hover:bg-slate-800 dark:hover:border-slate-600'
												)}
												onClick={() => toggleContainerSelection(container.id)}
											>
												<Checkbox
													id={`container-${container.id}`}
													checked={container.selected}
													onCheckedChange={() => toggleContainerSelection(container.id)}
												/>
												<div className="flex-1">
													<div className="flex items-center gap-2">
														<div className="font-medium">{container.name}</div>
														{container.alreadyAdded && (
															<div className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded-full flex items-center gap-1">
																<AlertCircle className="h-3 w-3" />
																Currently monitored
															</div>
														)}
													</div>
													{container.image && (
														<div className="text-sm text-muted-foreground">
															{container.image}
														</div>
													)}
													<div className="text-xs mt-1">
														<span
															className={`inline-block px-2 py-1 rounded-full ${
																container.serviceStatus === 'running'
																	? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
																	: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
															}`}
														>
															{container.serviceStatus}
														</span>
													</div>
												</div>
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					</div>
				) : (
					// For other providers, show all tabs
					<Tabs
						value={activeTab}
						onValueChange={(value) => setActiveTab(value as 'container' | 'systemd')}
						className="w-full"
					>
						<TabsList className="grid w-full grid-cols-2 mb-4">
							<TabsTrigger value="container">Manage Docker Services</TabsTrigger>
							<TabsTrigger value="systemd">Systemd Services</TabsTrigger>
						</TabsList>

						<TabsContent value="container" className="space-y-4 py-4">
							{/* Container UI for non-Kubernetes providers */}
							<div className="flex items-center justify-between mb-4">
								<h4 className="text-sm font-medium">Manage Docker Services</h4>
								<Button
									variant="outline"
									size="sm"
									onClick={fetchContainers}
									disabled={loadingContainers}
								>
									<RefreshCw className={`mr-2 h-4 w-4 ${loadingContainers ? 'animate-spin' : ''}`} />
									Refresh
								</Button>
							</div>

							<div className="space-y-4 mt-4">
								{loadingContainers ? (
									<div className="flex items-center justify-center py-8">
										<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
										<span className="ml-2 text-muted-foreground">Loading containers...</span>
									</div>
								) : error ? (
									<div className="text-center py-8">
										<p className="text-destructive">{error}</p>
										<Button variant="outline" onClick={fetchContainers} className="mt-4">
											<RefreshCw className="mr-2 h-4 w-4" />
											Try Again
										</Button>
									</div>
								) : containers.length === 0 ? (
									<div className="text-center py-8">
										<p className="text-muted-foreground">No containers found</p>
										<Button variant="outline" onClick={fetchContainers} className="mt-4">
											<RefreshCw className="mr-2 h-4 w-4" />
											Refresh
										</Button>
									</div>
								) : (
									<div className="space-y-4">
										<div className="flex items-center space-x-2 mb-4 p-2 border rounded bg-muted/20">
											<Checkbox
												id="select-all-containers"
												checked={containers.every((c) => c.selected)}
												onCheckedChange={toggleAllContainersSelection}
											/>
											<Label
												htmlFor="select-all-containers"
												className="font-medium cursor-pointer"
											>
												Select/Deselect all containers
											</Label>
										</div>
										<div className="space-y-2 max-h-60 overflow-y-auto pr-1">
											{containers.map((container) => (
												<div
													key={container.id}
													className={cn(
														'flex items-center space-x-3 border rounded-lg p-4 transition-all duration-200 shadow-sm',
														container.selected && 'border-primary bg-primary/5 shadow-md',
														'hover:bg-slate-50 hover:border-slate-300 hover:shadow-md cursor-pointer dark:hover:bg-slate-800 dark:hover:border-slate-600'
													)}
													onClick={() => toggleContainerSelection(container.id)}
												>
													<Checkbox
														id={`container-${container.id}`}
														checked={container.selected}
														onCheckedChange={() => toggleContainerSelection(container.id)}
													/>
													<div className="flex-1">
														<div className="flex items-center gap-2">
															<div className="font-medium">{container.name}</div>
															{container.alreadyAdded && (
																<div className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded-full flex items-center gap-1">
																	<AlertCircle className="h-3 w-3" />
																	Currently monitored
																</div>
															)}
														</div>
														{container.image && (
															<div className="text-sm text-muted-foreground">
																{container.image}
															</div>
														)}
														<div className="text-xs mt-1">
															<span
																className={`inline-block px-2 py-1 rounded-full ${
																	container.serviceStatus === 'running'
																		? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
																		: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
																}`}
															>
																{container.serviceStatus}
															</span>
														</div>
													</div>
												</div>
											))}
										</div>
									</div>
								)}
							</div>
						</TabsContent>

						<TabsContent value="systemd" className="space-y-4 py-4">
							<div className="space-y-2">
								<Label htmlFor="systemdServiceName">Systemd Service Name</Label>
								<Input
									id="systemdServiceName"
									placeholder="Enter systemd service name (e.g. nginx.service)"
									value={serviceName}
									onChange={(e) => setServiceName(e.target.value)}
								/>
							</div>
							<div className="text-sm text-muted-foreground mt-2">
								<p>Enter the exact name of the systemd service as it appears in the system.</p>
								<p className="mt-1">Example: nginx.service, docker.service, etc.</p>
							</div>
							<div className="bg-amber-50 border border-amber-200 rounded-md p-3 mt-4">
								<div className="flex items-start">
									<AlertTriangle className="h-5 w-5 text-amber-500 mr-2 mt-0.5" />
									<div>
										<h4 className="font-medium text-amber-800">Manual Entry Only</h4>
										<p className="text-sm text-amber-700 mt-1">
											Systemd services must be added manually. Auto-discovery has been disabled
											for systemd services.
										</p>
									</div>
								</div>
							</div>
						</TabsContent>
					</Tabs>
				)}

				<DialogFooter>
					<Button variant="outline" onClick={onClose} disabled={loading}>
						Cancel
					</Button>
					{isKubernetes ? (
						<Button type="button" onClick={handleAddContainersOrPods} disabled={loading}>
							{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
							Apply Changes
						</Button>
					) : activeTab === 'container' ? (
						<Button type="button" onClick={handleAddContainersOrPods} disabled={loading}>
							{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
							Apply Changes
						</Button>
					) : (
						<Button type="button" onClick={handleAddSystemdService} disabled={loading}>
							{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
							Add Systemd Service
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
