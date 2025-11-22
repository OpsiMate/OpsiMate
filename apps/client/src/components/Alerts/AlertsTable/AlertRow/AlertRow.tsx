import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { AlertActionsColumn } from './Columns/AlertActionsColumn';
import { AlertNameColumn } from './Columns/AlertNameColumn';
import { AlertStartsAtColumn } from './Columns/AlertStartsAtColumn';
import { AlertStatusColumn } from './Columns/AlertStatusColumn';
import { AlertSummaryColumn } from './Columns/AlertSummaryColumn';
import { AlertTagColumn } from './Columns/AlertTagColumn';
import { AlertTypeColumn } from './Columns/AlertTypeColumn';

export interface AlertRowProps {
	alert: Alert;
	isSelected: boolean;
	orderedColumns: string[];
	onSelectAlert: (alert: Alert) => void;
	onAlertClick?: (alert: Alert) => void;
	onDismissAlert?: (alertId: string) => void;
	onUndismissAlert?: (alertId: string) => void;
	onDeleteAlert?: (alertId: string) => void;
	onSelectAlerts?: (alerts: Alert[]) => void;
}

export const AlertRow = ({
	alert,
	isSelected,
	orderedColumns,
	onSelectAlert,
	onAlertClick,
	onDismissAlert,
	onUndismissAlert,
	onDeleteAlert,
	onSelectAlerts,
}: AlertRowProps) => {
	const handleRowClick = () => {
		if (onSelectAlerts) {
			onSelectAlert(alert);
		}
		onAlertClick?.(alert);
	};

	return (
		<TableRow
			className={cn('h-8 cursor-pointer hover:bg-muted/50', isSelected && 'bg-muted/50')}
			onClick={handleRowClick}
		>
			{onSelectAlerts && (
				<TableCell className="w-10 py-1 px-2" onClick={(e) => e.stopPropagation()}>
					<div className="flex items-center justify-center">
						<Checkbox
							checked={isSelected}
							onCheckedChange={() => onSelectAlert(alert)}
							className="h-3 w-3 border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
						/>
					</div>
				</TableCell>
			)}
			{orderedColumns.map((column) => {
				switch (column) {
					case 'type':
						return <AlertTypeColumn key={column} alert={alert} />;
					case 'alertName':
						return <AlertNameColumn key={column} alert={alert} />;
					case 'status':
						return <AlertStatusColumn key={column} alert={alert} />;
					case 'tag':
						return <AlertTagColumn key={column} alert={alert} />;
					case 'summary':
						return <AlertSummaryColumn key={column} alert={alert} />;
					case 'startsAt':
						return <AlertStartsAtColumn key={column} alert={alert} />;
					case 'actions':
						return (
							<AlertActionsColumn
								key={column}
								alert={alert}
								onDismissAlert={onDismissAlert}
								onUndismissAlert={onUndismissAlert}
								onDeleteAlert={onDeleteAlert}
							/>
						);
					default:
						return null;
				}
			})}
		</TableRow>
	);
};
