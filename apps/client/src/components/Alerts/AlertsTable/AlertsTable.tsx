import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useMemo, useState } from 'react';
import { AlertRow } from './AlertRow';
import { COLUMN_LABELS, DEFAULT_COLUMN_ORDER, DEFAULT_VISIBLE_COLUMNS } from './AlertsTable.constants';
import { AlertSortField, AlertsTableProps } from './AlertsTable.types';
import { createServiceNameLookup, filterAlerts, sortAlerts } from './AlertsTable.utils';
import { SearchBar } from './SearchBar';
import { SortableHeader } from './SortableHeader';

export const AlertsTable = ({
	alerts,
	services,
	onDismissAlert,
	onUndismissAlert,
	onDeleteAlert,
	onSelectAlerts,
	selectedAlerts = [],
	isLoading = false,
	className,
	onTableSettingsClick,
	visibleColumns = DEFAULT_VISIBLE_COLUMNS,
	columnOrder = DEFAULT_COLUMN_ORDER,
	onAlertClick,
}: AlertsTableProps) => {
	const [searchTerm, setSearchTerm] = useState('');
	const [sortField, setSortField] = useState<AlertSortField>('startsAt');
	const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

	const serviceNameById = useMemo(() => createServiceNameLookup(services), [services]);

	const filteredAlerts = useMemo(() => filterAlerts(alerts, searchTerm), [alerts, searchTerm]);

	const sortedAlerts = useMemo(() => {
		if (!sortField) return filteredAlerts;
		return sortAlerts(filteredAlerts, sortField, sortDirection);
	}, [filteredAlerts, sortField, sortDirection]);

	const handleSort = (field: AlertSortField) => {
		if (sortField === field) {
			setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
		} else {
			setSortField(field);
			setSortDirection(field === 'startsAt' ? 'desc' : 'asc');
		}
	};

	const handleSelectAll = () => {
		if (onSelectAlerts) {
			if (selectedAlerts.length === sortedAlerts.length) {
				onSelectAlerts([]);
			} else {
				onSelectAlerts(sortedAlerts);
			}
		}
	};

	const handleSelectAlert = (alert: typeof alerts[0]) => {
		if (onSelectAlerts) {
			const isSelected = selectedAlerts.some((a) => a.id === alert.id);
			if (isSelected) {
				onSelectAlerts(selectedAlerts.filter((a) => a.id !== alert.id));
			} else {
				onSelectAlerts([...selectedAlerts, alert]);
			}
		}
	};

	const orderedColumns = columnOrder.filter((col) => visibleColumns.includes(col));

	return (
		<div className={cn('flex flex-col gap-2', className)}>
			<SearchBar
				searchTerm={searchTerm}
				onSearchChange={setSearchTerm}
				onTableSettingsClick={onTableSettingsClick}
			/>

			<div className="border rounded-lg overflow-hidden">
				<Table>
					<TableHeader>
						<TableRow className="h-8">
							{onSelectAlerts && (
								<TableHead className="w-10 h-8 py-1 px-2">
									<Checkbox
										checked={sortedAlerts.length > 0 && selectedAlerts.length === sortedAlerts.length}
										onCheckedChange={handleSelectAll}
										className="h-3 w-3 border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
									/>
								</TableHead>
							)}
							{orderedColumns.map((column) => {
								if (column === 'actions') {
									return (
										<TableHead key={column} className="w-24 h-8 py-1 px-2 text-xs">
											{COLUMN_LABELS[column]}
										</TableHead>
									);
								}
								return (
									<SortableHeader
										key={column}
										column={column}
										label={COLUMN_LABELS[column]}
										sortField={sortField}
										sortDirection={sortDirection}
										onSort={handleSort}
									/>
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
									<AlertRow
										key={alert.id}
										alert={alert}
										isSelected={isSelected}
										orderedColumns={orderedColumns}
										onSelectAlert={handleSelectAlert}
										onAlertClick={onAlertClick}
										onDismissAlert={onDismissAlert}
										onUndismissAlert={onUndismissAlert}
										onDeleteAlert={onDeleteAlert}
										onSelectAlerts={onSelectAlerts}
									/>
								);
							})
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
};
