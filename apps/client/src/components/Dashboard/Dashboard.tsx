import { AddServiceModal } from '@/components/AddServiceModal';
import { RightSidebarWithLogs as RightSidebar } from '@/components/RightSidebarWithLogs';
import { Service, ServiceTable } from '@/components/ServiceTable';
import { FilterSidebar } from '@/components/shared';
import { TableSettingsModal } from '@/components/TableSettingsModal';
import { useActiveView, useAlerts, useCustomFields, useDismissAlert, useServices, useViews } from '@/hooks/queries';
import { useToast } from '@/hooks/use-toast';
import { SavedView } from '@/types/SavedView';
import { Logger } from '@OpsiMate/shared';
import { useEffect, useState } from 'react';
import { DashboardLayout } from '../DashboardLayout';
import { ServiceWithAlerts } from './Dashboard.types';
import { DashboardHeader } from './DashboardHeader';
import { ServiceFilterPanel } from './FilterPanel';
import {
	useColumnManagement,
	useCustomActionExecution,
	useFilteredServices,
	useServiceActions,
	useServiceFilters,
	useServicesWithAlerts,
	useViewManagement,
} from './hooks';
import { ServiceActionBar } from './ServiceActionBar';

const logger = new Logger('Dashboard');

export const Dashboard = () => {
	const { toast } = useToast();

	const { data: services = [], isLoading: servicesLoading, error: servicesError } = useServices();
	const { data: alerts = [] } = useAlerts();
	const { data: savedViews = [], error: viewsError } = useViews();
	const { activeViewId, setActiveView } = useActiveView();
	const { data: customFields = [] } = useCustomFields();

	const dismissAlertMutation = useDismissAlert();

	const [selectedService, setSelectedService] = useState<ServiceWithAlerts | null>(null);
	const [selectedServices, setSelectedServices] = useState<Service[]>([]);
	const [showTableSettings, setShowTableSettings] = useState(false);
	const [showAddService, setShowAddService] = useState(false);
	const [filterPanelCollapsed, setFilterPanelCollapsed] = useState(false);
	const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);

	const { filters, searchTerm, handleFiltersChange, handleSearchTermChange, applyViewFilters } = useServiceFilters({
		activeViewId,
		savedViews,
		setActiveView,
	});

	const { visibleColumns, columnOrder, setVisibleColumns, setColumnOrder, handleColumnToggle } =
		useColumnManagement(customFields);

	const servicesWithAlerts = useServicesWithAlerts(services as unknown as Service[], alerts);
	const filteredServices = useFilteredServices(servicesWithAlerts, filters);

	const { handleStart, handleStop, handleRestart } = useServiceActions();
	const { handleRunAction, isRunning: isRunningAction } = useCustomActionExecution();

	const { handleSaveView, handleDeleteView, handleApplyView } = useViewManagement({
		activeViewId,
		setActiveView,
	});

	useEffect(() => {
		if (selectedService) {
			const updatedService = servicesWithAlerts.find((s) => s.id === selectedService.id);
			if (updatedService) {
				setSelectedService(updatedService);
			}
		}
	}, [servicesWithAlerts, selectedService]);

	useEffect(() => {
		if (servicesError) {
			toast({
				title: 'Error loading services',
				description: servicesError.message || 'Failed to load services',
				variant: 'destructive',
			});
		}
	}, [servicesError, toast]);

	useEffect(() => {
		if (viewsError) {
			toast({
				title: 'Error loading views',
				description: 'Failed to load saved views',
				variant: 'destructive',
			});
		}
	}, [viewsError, toast]);

	const handleServicesSelect = (services: Service[]) => {
		setSelectedServices(services);
		if (services.length === 1) {
			const serviceWithAlerts = servicesWithAlerts.find((s) => s.id === services[0].id);
			setSelectedService(serviceWithAlerts || null);
		} else {
			setSelectedService(null);
		}
	};

	const handleServiceUpdate = (updatedService: Service) => {
		if (selectedService && selectedService.id === updatedService.id) {
			const serviceWithAlerts = servicesWithAlerts.find((s) => s.id === updatedService.id);
			setSelectedService(serviceWithAlerts || (updatedService as ServiceWithAlerts));
		}
	};

	const handleAlertDismiss = async (alertId: string) => {
		try {
			await dismissAlertMutation.mutateAsync(alertId);
		} catch (error) {
			logger.error('Error dismissing alert:', error);
			toast({
				title: 'Error',
				description: 'Failed to dismiss alert',
				variant: 'destructive',
			});
		}
	};

	const handleAddService = (serviceData: { name: string }) => {
		toast({
			title: 'Service Added',
			description: `${serviceData.name} has been added successfully.`,
		});
	};

	const applyView = async (view: SavedView) => {
		await handleApplyView(view, applyViewFilters, setVisibleColumns, setActiveView);
	};

	return (
		<div className="flex flex-col h-screen">
			<DashboardLayout>
				<div className="flex flex-col h-full">
					<div className="flex flex-row h-full">
						<FilterSidebar
							collapsed={filterPanelCollapsed}
							onToggle={() => setFilterPanelCollapsed(!filterPanelCollapsed)}
						>
							<ServiceFilterPanel
								services={services as unknown as Service[]}
								filters={filters}
								onFilterChange={handleFiltersChange}
								collapsed={filterPanelCollapsed}
							/>
						</FilterSidebar>
						<div className="flex-1 flex flex-col">
							<div className="flex-1 p-2 flex flex-col overflow-auto">
								<DashboardHeader
									currentFilters={filters}
									currentVisibleColumns={visibleColumns}
									currentSearchTerm={searchTerm}
									savedViews={savedViews}
									onSaveView={handleSaveView}
									onDeleteView={handleDeleteView}
									onLoadView={applyView}
									activeViewId={activeViewId}
								/>
								<ServiceTable
									services={filteredServices}
									selectedServices={selectedServices}
									onServicesSelect={handleServicesSelect}
									onSettingsClick={() => setShowTableSettings(true)}
									visibleColumns={visibleColumns}
									searchTerm={searchTerm}
									onSearchChange={handleSearchTermChange}
									loading={servicesLoading}
									columnOrder={columnOrder}
									onColumnOrderChange={setColumnOrder}
									customFields={customFields}
								/>
							</div>
							<ServiceActionBar
								selectedService={selectedService}
								selectedServices={selectedServices}
								onStart={() => handleStart(selectedServices)}
								onStop={() => handleStop(selectedServices)}
								onRestart={() => handleRestart(selectedServices)}
								onRunAction={
									selectedService ? (action) => handleRunAction(action, selectedService) : undefined
								}
								isRunningAction={isRunningAction}
							/>
						</div>
						{selectedServices.length === 1 && selectedService && (
							<div className="w-80 border-l border-border">
								<RightSidebar
									service={selectedService}
									onClose={() => setSelectedService(null)}
									collapsed={rightSidebarCollapsed}
									onServiceUpdate={handleServiceUpdate}
									alerts={alerts}
									onAlertDismiss={handleAlertDismiss}
								/>
							</div>
						)}
					</div>
				</div>
			</DashboardLayout>

			<TableSettingsModal
				open={showTableSettings}
				onOpenChange={setShowTableSettings}
				visibleColumns={visibleColumns}
				onColumnToggle={handleColumnToggle}
				customFields={customFields}
			/>

			<AddServiceModal open={showAddService} onOpenChange={setShowAddService} onAddService={handleAddService} />
		</div>
	);
};
