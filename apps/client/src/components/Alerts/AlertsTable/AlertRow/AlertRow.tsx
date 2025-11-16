import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { formatDate } from '../AlertsTable.utils';
import { RowActions } from '../RowActions';
import { TypeAvatarStack } from '../TypeAvatarStack';

export interface AlertRowProps {
	alert: Alert;
	isSelected: boolean;
	orderedColumns: string[];
	onSelectAlert: (alert: Alert) => void;
	onAlertClick?: (alert: Alert) => void;
	onDismissAlert?: (alertId: string) => void;
	onUndismissAlert?: (alertId: string) => void;
	onSelectAlerts?: (alerts: Alert[]) => void;
}

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

export const AlertRow = ({
	alert,
	isSelected,
	orderedColumns,
	onSelectAlert,
	onAlertClick,
	onDismissAlert,
	onUndismissAlert,
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
				<TableCell className="py-1 px-2" onClick={(e) => e.stopPropagation()}>
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
						return (
							<TableCell key={column} className="py-1 px-2">
								<TypeAvatarStack alert={alert} />
							</TableCell>
						);
					case 'alertName':
						return (
							<TableCell key={column} className="py-1 px-2">
								<span className="text-sm font-medium truncate block max-w-xs" title={alert.alertName}>
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
								<Badge variant="outline" className="text-xs px-1.5 py-0.5">
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
								<span className="text-sm text-muted-foreground">{formatDate(alert.startsAt)}</span>
							</TableCell>
						);
					case 'actions':
						return (
							<TableCell key={column} className="py-1 px-2" onClick={(e) => e.stopPropagation()}>
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
};
