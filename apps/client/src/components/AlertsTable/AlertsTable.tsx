import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import {
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	Bell,
	ExternalLink,
	MoreVertical,
	RotateCcw,
	Search,
	Settings,
	X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

export type AlertSortField = 'alertName' | 'status' | 'tag' | 'startsAt' | 'summary' | 'type';

interface AlertsTableProps {
	alerts: Alert[];
	services: Array<{ id: string | number; name: string }>;
	onDismissAlert?: (alertId: string) => void;
	onUndismissAlert?: (alertId: string) => void;
	onSelectAlerts?: (alerts: Alert[]) => void;
	selectedAlerts?: Alert[];
	isLoading?: boolean;
	className?: string;
	onTableSettingsClick?: () => void;
	visibleColumns?: string[];
	columnOrder?: string[];
	onAlertClick?: (alert: Alert) => void;
}

const defaultVisibleColumns = ['type', 'alertName', 'status', 'tag', 'summary', 'startsAt', 'actions'];
const defaultColumnOrder = ['type', 'alertName', 'status', 'tag', 'summary', 'startsAt', 'actions'];

const columnLabels: Record<string, string> = {
	type: 'Type',
	alertName: 'Alert Name',
	status: 'Status',
	tag: 'Tag',
	summary: 'Summary',
	startsAt: 'Started At',
	actions: '',
};

export const AlertsTable = ({
	alerts,
	services,
	onDismissAlert,
	onUndismissAlert,
	onSelectAlerts,
	selectedAlerts = [],
	isLoading = false,
	className,
	onTableSettingsClick,
	visibleColumns = defaultVisibleColumns,
	columnOrder = defaultColumnOrder,
	onAlertClick,
}: AlertsTableProps) => {
	const [searchTerm, setSearchTerm] = useState('');
	const [sortField, setSortField] = useState<AlertSortField | null>(null);
	const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

	// Create service name lookup map
	const serviceNameById = useMemo(() => {
		const map: Record<string | number, string> = {};
		services.forEach((s) => {
			map[s.id] = s.name;
		});
		return map;
	}, [services]);

	// Get alert type
	const getAlertType = (alert: Alert): string => {
		// Extract type from alert ID or tag
		if (alert.id.toLowerCase().includes('grafana')) return 'Grafana';
		if (alert.tag?.toLowerCase().includes('prometheus')) return 'Prometheus';
		if (alert.tag?.toLowerCase().includes('datadog')) return 'Datadog';
		return 'Custom';
	};

	// Get alert type icon
	const getAlertTypeIcon = (type: string) => {
		switch (type.toLowerCase()) {
			case 'grafana':
				return (
					<div className="w-4 h-4 flex items-center justify-center" title="Grafana">
						<svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-orange-500">
							<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
						</svg>
					</div>
				);
			case 'prometheus':
				return (
					<div className="w-4 h-4 flex items-center justify-center" title="Prometheus">
						<svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-red-500">
							<path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 22C6.486 22 2 17.514 2 12S6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/>
						</svg>
					</div>
				);
			case 'datadog':
				return (
					<div className="w-4 h-4 flex items-center justify-center" title="Datadog">
						<svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-purple-500">
							<path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
						</svg>
					</div>
				);
			default:
				return (
					<div className="w-4 h-4 flex items-center justify-center" title="Custom">
						<Bell className="w-4 h-4 text-muted-foreground" />
					</div>
				);
		}
	};

	// Filter alerts based on search term
	const filteredAlerts = useMemo(() => {
		if (!searchTerm.trim()) return alerts;
		const lower = searchTerm.toLowerCase();
		return alerts.filter((alert) => {
			const alertType = getAlertType(alert).toLowerCase();
			return (
				alert.alertName.toLowerCase().includes(lower) ||
				alert.status.toLowerCase().includes(lower) ||
				alert.tag.toLowerCase().includes(lower) ||
				(alert.summary && alert.summary.toLowerCase().includes(lower)) ||
				alertType.includes(lower)
			);
		});
	}, [alerts, searchTerm]);

	// Sort alerts
	const sortedAlerts = useMemo(() => {
		if (!sortField) return filteredAlerts;

		return [...filteredAlerts].sort((a, b) => {
			let aValue: any;
			let bValue: any;

			switch (sortField) {
				case 'alertName':
					aValue = a.alertName.toLowerCase();
					bValue = b.alertName.toLowerCase();
					break;
				case 'status':
					aValue = a.isDismissed ? 'dismissed' : 'firing';
					bValue = b.isDismissed ? 'dismissed' : 'firing';
					break;
				case 'tag':
					aValue = a.tag.toLowerCase();
					bValue = b.tag.toLowerCase();
					break;
				case 'summary':
					aValue = (a.summary || '').toLowerCase();
					bValue = (b.summary || '').toLowerCase();
					break;
				case 'startsAt':
					aValue = new Date(a.startsAt).getTime();
					bValue = new Date(b.startsAt).getTime();
					break;
				case 'type':
					aValue = getAlertType(a).toLowerCase();
					bValue = getAlertType(b).toLowerCase();
					break;
				default:
					return 0;
			}

			if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
			if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
			return 0;
		});
	}, [filteredAlerts, sortField, sortDirection]);

	// Handle sort
	const handleSort = (field: AlertSortField) => {
		if (sortField === field) {
			setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
		} else {
			setSortField(field);
			setSortDirection('asc');
		}
	};

	// Handle select all
	const handleSelectAll = () => {
		if (onSelectAlerts) {
			if (selectedAlerts.length === sortedAlerts.length) {
				onSelectAlerts([]);
			} else {
				onSelectAlerts(sortedAlerts);
			}
		}
	};

	// Handle select single alert
	const handleSelectAlert = (alert: Alert) => {
		if (onSelectAlerts) {
			const isSelected = selectedAlerts.some((a) => a.id === alert.id);
			if (isSelected) {
				onSelectAlerts(selectedAlerts.filter((a) => a.id !== alert.id));
			} else {
				onSelectAlerts([...selectedAlerts, alert]);
			}
		}
	};

	// Get status badge
	const getStatusBadge = (alert: Alert) => {
		if (alert.isDismissed) {
			return (
				<Badge variant="secondary" className="text-xs px-1.5 py-0.5">
					dismissed
				</Badge>
			);
		}
		return (
			<Badge variant="destructive" className="text-xs px-1.5 py-0.5">
				firing
			</Badge>
		);
	};

	// Get sort icon
	const getSortIcon = (field: AlertSortField) => {
		if (sortField !== field) {
			return <ArrowUpDown className="h-3 w-3 text-muted-foreground" />;
		}
		return sortDirection === 'asc' ? (
			<ArrowUp className="h-3 w-3" />
		) : (
			<ArrowDown className="h-3 w-3" />
		);
	};

	// Filter visible columns
	const orderedColumns = columnOrder.filter((col) => visibleColumns.includes(col));

	return (
		<div className={cn('flex flex-col gap-2', className)}>
			{/* Search and Settings Bar */}
			<div className="flex items-center gap-2">
				<div className="relative flex-1 max-w-sm">
					<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
					<Input
						placeholder="Search alerts..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="h-7 pl-7 pr-2 text-sm"
					/>
				</div>
				{onTableSettingsClick && (
					<Button
						variant="outline"
						size="icon"
						className="h-7 w-7"
						onClick={onTableSettingsClick}
						title="Table settings"
					>
						<Settings className="h-3 w-3" />
					</Button>
				)}
			</div>

			{/* Table */}
			<div className="border rounded-lg overflow-hidden">
				<Table>
					<TableHeader>
						<TableRow className="h-8">
							{onSelectAlerts && (
								<TableHead className="w-10 h-8 py-1 px-2">
									<Checkbox
										checked={
											sortedAlerts.length > 0 &&
											selectedAlerts.length === sortedAlerts.length
										}
										onCheckedChange={handleSelectAll}
										className="h-3 w-3 border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
									/>
								</TableHead>
							)}
							{orderedColumns.map((column) => {
								if (column === 'actions') {
									return (
										<TableHead key={column} className="w-24 h-8 py-1 px-2 text-xs">
											{columnLabels[column]}
										</TableHead>
									);
								}
								return (
									<TableHead
										key={column}
										className="h-8 py-1 px-2 text-xs cursor-pointer hover:bg-muted/50"
										onClick={() => handleSort(column as AlertSortField)}
									>
										<div className="flex items-center gap-1">
											{columnLabels[column]}
											{getSortIcon(column as AlertSortField)}
										</div>
									</TableHead>
								);
							})}
						</TableRow>
					</TableHeader>
					<TableBody>
						{isLoading ? (
							<TableRow>
								<TableCell
									colSpan={orderedColumns.length + (onSelectAlerts ? 1 : 0)}
									className="text-center py-8 text-sm text-muted-foreground"
								>
									Loading alerts...
								</TableCell>
							</TableRow>
						) : sortedAlerts.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={orderedColumns.length + (onSelectAlerts ? 1 : 0)}
									className="text-center py-8 text-sm text-muted-foreground"
								>
									{searchTerm ? 'No alerts found matching your search.' : 'No alerts found.'}
								</TableCell>
							</TableRow>
						) : (
							sortedAlerts.map((alert) => {
								const isSelected = selectedAlerts.some((a) => a.id === alert.id);
								return (
									<TableRow
										key={alert.id}
										className={cn(
											'h-8 cursor-pointer hover:bg-muted/50',
											isSelected && 'bg-muted/50'
										)}
										onClick={() => onAlertClick?.(alert)}
									>
										{onSelectAlerts && (
											<TableCell className="py-1 px-2">
												<Checkbox
													checked={isSelected}
													onCheckedChange={() => handleSelectAlert(alert)}
													className="h-3 w-3 border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
												/>
											</TableCell>
										)}
										{orderedColumns.map((column) => {
											switch (column) {
												case 'type':
													return (
														<TableCell key={column} className="py-1 px-2">
															<div className="flex items-center justify-center">
																{getAlertTypeIcon(getAlertType(alert))}
															</div>
														</TableCell>
													);
												case 'alertName':
													return (
														<TableCell key={column} className="py-1 px-2">
															<span className="text-sm font-medium">
																{alert.alertName}
															</span>
														</TableCell>
													);
												case 'status':
													return (
														<TableCell key={column} className="py-1 px-2">
															{getStatusBadge(alert)}
														</TableCell>
													);
												case 'tag':
													return (
														<TableCell key={column} className="py-1 px-2">
															<Badge
																variant="outline"
																className="text-xs px-1.5 py-0.5"
															>
																{alert.tag}
															</Badge>
														</TableCell>
													);
												case 'summary':
													return (
														<TableCell key={column} className="py-1 px-2">
															<span className="text-sm text-muted-foreground truncate max-w-xs block">
																{alert.summary || '-'}
															</span>
														</TableCell>
													);
												case 'startsAt':
													return (
														<TableCell key={column} className="py-1 px-2">
															<span className="text-sm text-muted-foreground">
																{new Date(alert.startsAt).toLocaleString()}
															</span>
														</TableCell>
													);
												case 'actions':
													return (
														<TableCell key={column} className="py-1 px-2">
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
																<DropdownMenuContent align="end">
																	{alert.runbookUrl && (
																		<DropdownMenuItem
																			onClick={() =>
																				window.open(
																					alert.runbookUrl,
																					'_blank',
																					'noopener,noreferrer'
																				)
																			}
																		>
																			<span className="mr-2">📖</span>
																			Open Runbook
																		</DropdownMenuItem>
																	)}
																	{alert.alertUrl && (
																		<DropdownMenuItem
																			onClick={() =>
																				window.open(
																					alert.alertUrl,
																					'_blank',
																					'noopener,noreferrer'
																				)
																			}
																		>
																			<ExternalLink className="mr-2 h-3 w-3" />
																			View in Grafana
																		</DropdownMenuItem>
																	)}
																	{alert.isDismissed
																		? onUndismissAlert && (
																				<DropdownMenuItem
																					onClick={() =>
																						onUndismissAlert(alert.id)
																					}
																				>
																					<RotateCcw className="mr-2 h-3 w-3" />
																					Undismiss Alert
																				</DropdownMenuItem>
																		  )
																		: onDismissAlert && (
																				<DropdownMenuItem
																					onClick={() =>
																						onDismissAlert(alert.id)
																					}
																				>
																					<X className="mr-2 h-3 w-3" />
																					Dismiss Alert
																				</DropdownMenuItem>
																		  )}
																</DropdownMenuContent>
															</DropdownMenu>
														</TableCell>
													);
												default:
													return null;
											}
										})}
									</TableRow>
								);
							})
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
};
