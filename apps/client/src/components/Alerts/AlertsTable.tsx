import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import {
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	ExternalLink,
	MoreVertical,
	RotateCcw,
	Search,
	Settings,
	X,
} from 'lucide-react';
import { MouseEvent, useMemo, useState } from 'react';
import { getIntegrationLabel, IntegrationAvatar, resolveAlertIntegration } from './IntegrationAvatar';

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
	const [sortField, setSortField] = useState<AlertSortField>('startsAt');
	const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

	// Create service name lookup map
	const serviceNameById = useMemo(() => {
		const map: Record<string | number, string> = {};
		services.forEach((s) => {
			map[s.id] = s.name;
		});
		return map;
	}, [services]);

	// Filter alerts based on search term
	const filteredAlerts = useMemo(() => {
		if (!searchTerm.trim()) return alerts;
		const lower = searchTerm.toLowerCase();
		return alerts.filter((alert) => {
			const integration = resolveAlertIntegration(alert);
			const integrationLabel = getIntegrationLabel(integration).toLowerCase();
			const tag = alert.tag?.toLowerCase() || '';
			return (
				alert.alertName.toLowerCase().includes(lower) ||
				alert.status.toLowerCase().includes(lower) ||
				tag.includes(lower) ||
				(alert.summary && alert.summary.toLowerCase().includes(lower)) ||
				integrationLabel.includes(lower)
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
					aValue = getIntegrationLabel(resolveAlertIntegration(a)).toLowerCase();
					bValue = getIntegrationLabel(resolveAlertIntegration(b)).toLowerCase();
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
			setSortDirection(field === 'startsAt' ? 'desc' : 'asc');
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
															<TypeAvatarStack alert={alert} />
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
															<RowActions
																alert={alert}
																onDismissAlert={onDismissAlert}
																onUndismissAlert={onUndismissAlert}
															/>
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

const TypeAvatarStack = ({ alert }: { alert: Alert }) => {
	const integration = resolveAlertIntegration(alert);
	const integrationLabel = getIntegrationLabel(integration);

	return (
		<div className="flex items-center gap-2">
			<div className="flex -space-x-1.5" aria-label={`${integrationLabel} alert type`}>
				<IntegrationAvatar
					integration={integration}
					size="sm"
					className="ring-2 ring-background shadow-sm"
				/>
				<StatusAvatar isDismissed={alert.isDismissed} />
			</div>
			<span className="text-xs font-medium text-muted-foreground">{integrationLabel}</span>
		</div>
	);
};

const StatusAvatar = ({ isDismissed }: { isDismissed: boolean }) => (
	<span
		className={cn(
			'h-6 w-6 rounded-full border flex items-center justify-center text-[10px] font-semibold uppercase tracking-tight ring-2 ring-background shadow-sm',
			isDismissed ? 'bg-slate-200 border-slate-300 text-slate-700' : 'bg-rose-100 border-rose-200 text-rose-700'
		)}
		title={isDismissed ? 'Dismissed alert' : 'Firing alert'}
	>
		{isDismissed ? 'D' : 'F'}
	</span>
);

interface RowActionsProps {
	alert: Alert;
	onDismissAlert?: (alertId: string) => void;
	onUndismissAlert?: (alertId: string) => void;
}

const RowActions = ({ alert, onDismissAlert, onUndismissAlert }: RowActionsProps) => {
	const { alertUrl, runbookUrl, isDismissed } = alert;
	const hasLinks = Boolean(alertUrl || runbookUrl);
	const canToggle = (!isDismissed && Boolean(onDismissAlert)) || (isDismissed && Boolean(onUndismissAlert));

	const handleToggle = (event: MouseEvent<HTMLButtonElement>) => {
		event.stopPropagation();
		if (isDismissed) {
			onUndismissAlert?.(alert.id);
		} else {
			onDismissAlert?.(alert.id);
		}
	};

	const handleOpenLink = (url: string) => {
		window.open(url, '_blank', 'noopener,noreferrer');
	};

	return (
		<div className="flex items-center justify-end gap-1.5">
			{hasLinks && (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6"
							onClick={(event) => event.stopPropagation()}
							title="More actions"
						>
							<MoreVertical className="h-3 w-3" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						{runbookUrl && (
							<DropdownMenuItem onClick={(event) => {
								event.stopPropagation();
								handleOpenLink(runbookUrl);
							}}>
								<span className="mr-2">📖</span>
								Runbook
							</DropdownMenuItem>
						)}
						{alertUrl && (
							<DropdownMenuItem
								onClick={(event) => {
									event.stopPropagation();
									handleOpenLink(alertUrl);
								}}
							>
								<ExternalLink className="mr-2 h-3 w-3" />
								Source
							</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			)}
			{canToggle && (
				<Button
					variant="outline"
					size="sm"
					className="h-7 px-2 text-xs gap-1"
					onClick={handleToggle}
				>
					{isDismissed ? (
						<>
							<RotateCcw className="h-3 w-3" />
							Undismiss
						</>
					) : (
						<>
							<X className="h-3 w-3" />
							Dismiss
						</>
					)}
				</Button>
			)}
		</div>
	);
};
