import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Settings, Search, X, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';
import { Tag, Alert } from '@OpsiMate/shared';
import {
	DndContext,
	closestCenter,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	DragEndEvent,
} from '@dnd-kit/core';
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	horizontalListSortingStrategy,
	useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface Service {
	id: string;
	name: string;
	serviceIP?: string;
	serviceStatus: 'running' | 'stopped' | 'error' | 'unknown';
	serviceType: 'MANUAL' | 'DOCKER' | 'SYSTEMD';
	createdAt: string;
	provider: {
		id: number;
		name: string;
		providerIP: string;
		username: string;
		privateKeyFilename: string;
		SSHPort: number;
		createdAt: number;
		providerType: string;
	};
	containerDetails?: {
		id?: string;
		image?: string;
		created?: string;
		namespace?: string;
	};
	tags?: Tag[];
	alertsCount?: number;
	serviceAlerts?: Alert[];
	customFields?: Record<number, string>;
}

type SortField =
	| 'name'
	| 'serviceIP'
	| 'serviceStatus'
	| 'provider'
	| 'providerType'
	| 'containerDetails'
	| 'tags'
	| 'alerts'
	| 'createdAt';
type SortDirection = 'asc' | 'desc';

interface SortableHeaderProps {
	children: React.ReactNode;
	field: SortField;
	currentSort: { field: SortField; direction: SortDirection } | null;
	onSort: (field: SortField) => void;
	className?: string;
	id: string;
	isDragging?: boolean;
}

interface DraggableHeaderProps {
	id: string;
	children: React.ReactNode;
	field: SortField;
	currentSort: { field: SortField; direction: SortDirection } | null;
	onSort: (field: SortField) => void;
	className?: string;
}

const DraggableHeader = ({ id, children, field, currentSort, onSort, className }: DraggableHeaderProps) => {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id,
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	const isActive = currentSort?.field === field;
	const isAsc = isActive && currentSort.direction === 'asc';
	const isDesc = isActive && currentSort.direction === 'desc';

	return (
		<TableHead
			ref={setNodeRef}
			style={style}
			className={cn(
				'font-medium cursor-pointer hover:bg-muted/50 transition-colors select-none relative h-8 py-1 px-2 text-xs',
				isDragging && 'opacity-50 z-50',
				className
			)}
		>
			<div className="flex items-center gap-1">
				<div
					{...attributes}
					{...listeners}
					className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
				>
					<GripVertical className="h-3 w-3 text-muted-foreground" />
				</div>
				<div className="flex items-center gap-1 flex-1" onClick={() => onSort(field)}>
					{children}
					<div className="flex flex-col">
						<ChevronUp
							className={cn(
								'h-3 w-3 transition-colors',
								isAsc ? 'text-foreground' : 'text-muted-foreground/50'
							)}
						/>
						<ChevronDown
							className={cn(
								'h-3 w-3 transition-colors -mt-1',
								isDesc ? 'text-foreground' : 'text-muted-foreground/50'
							)}
						/>
					</div>
				</div>
			</div>
		</TableHead>
	);
};

const SortableHeader = ({ children, field, currentSort, onSort, className }: SortableHeaderProps) => {
	const isActive = currentSort?.field === field;
	const isAsc = isActive && currentSort.direction === 'asc';
	const isDesc = isActive && currentSort.direction === 'desc';

	return (
		<TableHead
			className={cn('font-medium cursor-pointer hover:bg-muted/50 transition-colors select-none', className)}
			onClick={() => onSort(field)}
		>
			<div className="flex items-center gap-1">
				{children}
				<div className="flex flex-col">
					<ChevronUp
						className={cn(
							'h-3 w-3 transition-colors',
							isAsc ? 'text-foreground' : 'text-muted-foreground/50'
						)}
					/>
					<ChevronDown
						className={cn(
							'h-3 w-3 transition-colors -mt-1',
							isDesc ? 'text-foreground' : 'text-muted-foreground/50'
						)}
					/>
				</div>
			</div>
		</TableHead>
	);
};

interface ServiceTableProps {
	services: Service[];
	selectedServices: Service[];
	onServicesSelect: (services: Service[]) => void;
	onSettingsClick: () => void;
	visibleColumns: Record<string, boolean>;
	searchTerm?: string;
	onSearchChange?: (searchTerm: string) => void;
	loading?: boolean;
	columnOrder?: string[];
	onColumnOrderChange?: (newOrder: string[]) => void;
	customFields?: Array<{ id: number; name: string }>;
}

export const ServiceTable = ({
	services,
	selectedServices,
	onServicesSelect,
	onSettingsClick,
	visibleColumns,
	searchTerm: externalSearchTerm,
	onSearchChange,
	loading,
	columnOrder: externalColumnOrder,
	onColumnOrderChange,
	customFields = [],
}: ServiceTableProps) => {
	const [internalSearchTerm, setInternalSearchTerm] = useState('');
	const [sortConfig, setSortConfig] = useState<{
		field: SortField;
		direction: SortDirection;
	} | null>(null);
	const searchTerm = externalSearchTerm !== undefined ? externalSearchTerm : internalSearchTerm;

	// Default column order
	const defaultColumnOrder = [
		'name',
		'serviceIP',
		'serviceStatus',
		'provider',
		'providerType',
		'containerDetails',
		'alerts',
	];
	const [internalColumnOrder, setInternalColumnOrder] = useState<string[]>(defaultColumnOrder);
	const columnOrder = externalColumnOrder || internalColumnOrder;

	// Drag and drop sensors
	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	const getStatusColor = (status: Service['serviceStatus']) => {
		switch (status.toLowerCase()) {
			case 'running':
				return 'bg-green-100 text-green-800 border-green-200';
			case 'stopped':
				return 'bg-gray-100 text-gray-800 border-gray-200';
			case 'error':
				return 'bg-red-100 text-red-800 border-red-200';
			case 'unknown':
				return 'bg-gray-100 text-gray-800 border-gray-200';
			default:
				return 'bg-gray-100 text-gray-800 border-gray-200';
		}
	};

	const handleSort = (field: SortField) => {
		setSortConfig((current) => {
			if (current?.field === field) {
				// If clicking the same field, toggle direction
				return {
					field,
					direction: current.direction === 'asc' ? 'desc' : 'asc',
				};
			} else {
				// If clicking a new field, set to ascending
				return { field, direction: 'asc' };
			}
		});
	};

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;

		if (over && active.id !== over.id) {
			const oldIndex = columnOrder.indexOf(active.id as string);
			const newIndex = columnOrder.indexOf(over.id as string);

			const newOrder = arrayMove(columnOrder, oldIndex, newIndex);

			if (onColumnOrderChange) {
				onColumnOrderChange(newOrder);
			} else {
				setInternalColumnOrder(newOrder);
			}
		}
	};

	// Filter and sort services
	const filteredAndSortedServices = useMemo(() => {
		let filtered = services;

		// Apply search filter
		if (searchTerm.trim()) {
			const searchLower = searchTerm.toLowerCase();
			filtered = services.filter((service) => {
				return (
					service.name.toLowerCase().includes(searchLower) ||
					service.serviceIP?.toLowerCase().includes(searchLower) ||
					service.serviceStatus.toLowerCase().includes(searchLower) ||
					service.provider.name.toLowerCase().includes(searchLower) ||
					service.provider.providerIP.toLowerCase().includes(searchLower) ||
					(service.containerDetails?.image &&
						service.containerDetails.image.toLowerCase().includes(searchLower))
				);
			});
		}

		// Apply sorting
		if (sortConfig) {
			filtered = [...filtered].sort((a, b) => {
				let aValue: string | number;
				let bValue: string | number;

				switch (sortConfig.field) {
					case 'name':
						aValue = a.name.toLowerCase();
						bValue = b.name.toLowerCase();
						break;
					case 'serviceIP':
						aValue = (a.serviceType === 'SYSTEMD' ? a.provider.providerIP : a.serviceIP) || '';
						bValue = (b.serviceType === 'SYSTEMD' ? b.provider.providerIP : b.serviceIP) || '';
						break;
					case 'serviceStatus':
						aValue = a.serviceStatus.toLowerCase();
						bValue = b.serviceStatus.toLowerCase();
						break;
					case 'provider':
						aValue = a.provider.name.toLowerCase();
						bValue = b.provider.name.toLowerCase();
						break;
					case 'providerType':
						aValue = a.provider.providerType.toLowerCase();
						bValue = b.provider.providerType.toLowerCase();
						break;
					case 'containerDetails':
						aValue = a.serviceType === 'DOCKER' ? a.containerDetails?.image || '' : a.serviceType;
						bValue = b.serviceType === 'DOCKER' ? b.containerDetails?.image || '' : b.serviceType;
						break;
					case 'tags':
						aValue = a.tags && a.tags.length > 0 ? a.tags[0].name.toLowerCase() : '';
						bValue = b.tags && b.tags.length > 0 ? b.tags[0].name.toLowerCase() : '';
						break;
					case 'alerts':
						aValue = a.alertsCount || 0;
						bValue = b.alertsCount || 0;
						break;
					case 'createdAt':
						aValue = new Date(a.createdAt).getTime();
						bValue = new Date(b.createdAt).getTime();
						break;
					default:
						return 0;
				}

				if (aValue < bValue) {
					return sortConfig.direction === 'asc' ? -1 : 1;
				}
				if (aValue > bValue) {
					return sortConfig.direction === 'asc' ? 1 : -1;
				}
				return 0;
			});
		}

		return filtered;
	}, [services, searchTerm, sortConfig]);

	const clearSearch = () => {
		if (onSearchChange) {
			onSearchChange('');
		} else {
			setInternalSearchTerm('');
		}
	};

	const handleRowClick = (service: Service) => {
		const isSelected = selectedServices.some((s) => s.id === service.id);
		if (isSelected) {
			onServicesSelect(selectedServices.filter((s) => s.id !== service.id));
		} else {
			onServicesSelect([...selectedServices, service]);
		}
	};

	if (loading) {
		return (
			<div className="flex-1 flex flex-col bg-card border border-border rounded-lg overflow-hidden">
				<div className="p-2 border-b border-border space-y-2 flex-shrink-0">
					<div className="flex items-center justify-between">
						<div>
							<h3 className="text-sm font-semibold text-foreground">Services</h3>
							<p className="text-xs text-muted-foreground">Loading...</p>
						</div>
						<Button variant="outline" size="icon" onClick={onSettingsClick} className="h-7 w-7 rounded-md">
							<Settings className="h-3 w-3" />
							<span className="sr-only">Table Settings</span>
						</Button>
					</div>
				</div>
				<div className="flex-1 relative min-h-[200px]">
					<Table className="relative">
						<TableHeader className="sticky top-0 bg-card z-10">
							<TableRow className="hover:bg-transparent">
								<TableHead className="w-10">
									<div className="flex items-center justify-center">
										<Checkbox
											checked={false}
											onCheckedChange={() => {}}
											aria-label="Select all services"
										/>
									</div>
								</TableHead>
								{visibleColumns.name && <TableHead className="font-medium">Name</TableHead>}
								{visibleColumns.serviceIP && <TableHead className="font-medium">Service IP</TableHead>}
								{visibleColumns.serviceStatus && <TableHead className="font-medium">Status</TableHead>}
								{visibleColumns.provider && <TableHead className="font-medium">Provider</TableHead>}
								{visibleColumns.containerDetails && (
									<TableHead className="font-medium">Container Details</TableHead>
								)}
							</TableRow>
						</TableHeader>
						<TableBody>
							<TableRow>
								<TableCell
									colSpan={Object.values(visibleColumns).filter(Boolean).length + 1}
									className="text-center py-12 h-[200px]"
								>
									<div className="text-muted-foreground">Loading...</div>
								</TableCell>
							</TableRow>
						</TableBody>
					</Table>
				</div>
			</div>
		);
	}

	return (
		<div className="flex-1 flex flex-col bg-card border border-border rounded-lg overflow-hidden">
			<div className="p-2 border-b border-border space-y-2 flex-shrink-0">
				{/* Header with title and settings */}
				<div className="flex items-center justify-between">
					<div>
						<h3 className="text-sm font-semibold text-foreground">Services</h3>
						<p className="text-xs text-muted-foreground">
							{filteredAndSortedServices.length} of {services.length} services
							{searchTerm && ` matching "${searchTerm}"`}
							{sortConfig && (
								<span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded">
									{sortConfig.field} ({sortConfig.direction})
								</span>
							)}
						</p>
					</div>
					<Button variant="outline" size="icon" onClick={onSettingsClick} className="h-7 w-7 rounded-md">
						<Settings className="h-3 w-3" />
						<span className="sr-only">Table Settings</span>
					</Button>
				</div>

				{/* Search filter */}
				<div className="relative">
					<Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
					<Input
						placeholder="Search services..."
						value={searchTerm}
						onChange={(e) => {
							const newValue = e.target.value;
							if (onSearchChange) {
								onSearchChange(newValue);
							} else {
								setInternalSearchTerm(newValue);
							}
						}}
						className="pl-8 pr-8 h-7 text-sm"
					/>
					{searchTerm && (
						<Button
							variant="ghost"
							size="sm"
							onClick={clearSearch}
							className="absolute right-1 top-1/2 transform -translate-y-1/2 h-5 w-5 p-0"
						>
							<X className="h-3 w-3" />
						</Button>
					)}
				</div>
			</div>

			<div className="flex-1 relative min-h-[200px]">
				<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
					<Table className="relative">
						<TableHeader className="sticky top-0 bg-card z-10">
							<TableRow className="hover:bg-transparent">
								<TableHead className="w-10 h-8 py-1 px-1">
									<div className="flex items-center justify-center">
										<Checkbox
											checked={
												filteredAndSortedServices.length > 0 &&
												selectedServices.length === filteredAndSortedServices.length
											}
											onCheckedChange={(checked) => {
												if (checked) {
													onServicesSelect(filteredAndSortedServices);
												} else {
													onServicesSelect([]);
												}
											}}
											aria-label="Select all services"
										/>
									</div>
								</TableHead>
								<SortableContext
									items={columnOrder.filter((col) => visibleColumns[col])}
									strategy={horizontalListSortingStrategy}
								>
									{columnOrder.map((columnId) => {
										if (!visibleColumns[columnId]) return null;

										const columnLabels: Record<string, string> = {
											name: 'Name',
											serviceIP: 'Service IP',
											serviceStatus: 'Status',
											provider: 'Provider',
											providerType: 'Provider Type',
											containerDetails: 'Container Details',
											tags: 'Tags',
											alerts: 'Alerts',
											// Add custom fields to labels
											...customFields.reduce(
												(acc, field) => {
													acc[`custom-${field.id}`] = field.name;
													return acc;
												},
												{} as Record<string, string>
											),
										};

										return (
											<DraggableHeader
												key={columnId}
												id={columnId}
												field={columnId as SortField}
												currentSort={sortConfig}
												onSort={handleSort}
											>
												{columnLabels[columnId]}
											</DraggableHeader>
										);
									})}
								</SortableContext>
							</TableRow>
						</TableHeader>
						<TableBody>
							{filteredAndSortedServices.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={Object.values(visibleColumns).filter(Boolean).length + 1}
										className="text-center py-12 h-[200px]"
									>
										<div className="text-muted-foreground">
											{searchTerm
												? `No services found matching "${searchTerm}"`
												: 'No services available'}
										</div>
									</TableCell>
								</TableRow>
							) : (
								filteredAndSortedServices.map((service) => (
									<TableRow
										key={service.id}
										className={cn(
											'hover:bg-muted/50 transition-colors cursor-pointer h-8',
											selectedServices.some((s) => s.id === service.id) && 'bg-muted'
										)}
										onClick={() => handleRowClick(service)}
									>
										<TableCell className="w-10 p-1" onClick={(e) => e.stopPropagation()}>
											<div className="flex items-center justify-center h-full">
												<Checkbox
													checked={selectedServices.some((s) => s.id === service.id)}
													onCheckedChange={(checked) => {
														if (checked) {
															onServicesSelect([...selectedServices, service]);
														} else {
															onServicesSelect(
																selectedServices.filter((s) => s.id !== service.id)
															);
														}
													}}
													aria-label={`Select ${service.name}`}
												/>
											</div>
										</TableCell>
										{columnOrder.map((columnId) => {
											if (!visibleColumns[columnId]) return null;

											switch (columnId) {
												case 'name':
													return (
														<TableCell
															key={columnId}
															className="font-medium py-1 px-2 text-sm"
														>
															{service.name}
														</TableCell>
													);
												case 'serviceIP':
													return (
														<TableCell key={columnId} className="py-1 px-2 text-sm">
															{service.serviceType === 'SYSTEMD'
																? service.provider.providerIP
																: service.serviceIP || '-'}
														</TableCell>
													);
												case 'serviceStatus':
													return (
														<TableCell key={columnId} className="text-center py-1 px-2">
															<Badge
																className={cn(
																	getStatusColor(service.serviceStatus),
																	'font-medium text-xs px-1.5 py-0.5'
																)}
															>
																{service.serviceStatus.toLowerCase()}
															</Badge>
														</TableCell>
													);
												case 'provider':
													return (
														<TableCell key={columnId} className="py-1 px-2 text-sm">
															{service.provider.name}
														</TableCell>
													);
												case 'providerType':
													return (
														<TableCell key={columnId} className="py-1 px-2 text-sm">
															{service.provider.providerType}
														</TableCell>
													);
												case 'containerDetails':
													return (
														<TableCell key={columnId} className="py-1 px-2 text-sm">
															{service.serviceType === 'DOCKER' ? (
																service.containerDetails?.image || '-'
															) : service.serviceType === 'SYSTEMD' ? (
																<span className="text-green-600 font-medium text-xs">
																	Systemd Service
																</span>
															) : (
																'-'
															)}
														</TableCell>
													);
												case 'tags':
													return (
														<TableCell key={columnId} className="py-1 px-2">
															{service.tags && service.tags.length > 0 ? (
																<div className="flex flex-wrap gap-1">
																	{service.tags.slice(0, 3).map((tag, index) => (
																		<Badge
																			key={index}
																			variant="secondary"
																			className="text-xs px-1.5 py-0.5"
																		>
																			{tag.name}
																		</Badge>
																	))}
																	{service.tags.length > 3 && (
																		<span className="text-xs text-muted-foreground">
																			+{service.tags.length - 3}
																		</span>
																	)}
																</div>
															) : (
																<span className="text-muted-foreground text-xs">-</span>
															)}
														</TableCell>
													);
												case 'alerts':
													return (
														<TableCell key={columnId} className="text-center py-1 px-2">
															{service.alertsCount && service.alertsCount > 0 ? (
																<Badge
																	variant="destructive"
																	className="font-medium text-xs px-1.5 py-0.5"
																>
																	{service.alertsCount}
																</Badge>
															) : (
																<span className="text-muted-foreground text-xs">0</span>
															)}
														</TableCell>
													);
												default:
													// Handle custom fields
													if (columnId.startsWith('custom-')) {
														const fieldId = parseInt(columnId.replace('custom-', ''));
														const fieldValue = service.customFields?.[fieldId] || '';
														return (
															<TableCell key={columnId} className="py-1 px-2 text-sm">
																{fieldValue || (
																	<span className="text-muted-foreground">-</span>
																)}
															</TableCell>
														);
													}
													return null;
											}
										})}
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</DndContext>
			</div>
		</div>
	);
};
