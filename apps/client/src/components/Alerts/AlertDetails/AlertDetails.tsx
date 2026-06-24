import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { AlertDetailsBody } from './AlertDetailsBody';
import { AlertDetailsHeader } from './AlertDetailsHeader';
import { useAlertHistory } from './hooks';

interface AlertDetailsProps {
	isActive: boolean;
	alert: Alert | null;
	onClose: () => void;
	onDismiss?: (alertId: string) => void;
	onUndismiss?: (alertId: string) => void;
	onDelete?: (alertId: string) => void;
	className?: string;
}

export const AlertDetails = ({
	isActive,
	alert,
	onClose,
	onDismiss,
	onUndismiss,
	onDelete,
	className,
}: AlertDetailsProps) => {
	const historyData = useAlertHistory(alert?.id);

	if (!alert) return null;

	return (
		<div className={cn('h-full flex flex-col bg-background border-l', className)}>
			<AlertDetailsHeader onClose={onClose} />

			<ScrollArea className="flex-1">
				<AlertDetailsBody
					alert={alert}
					isActive={isActive}
					historyData={historyData}
					onDismiss={onDismiss}
					onUndismiss={onUndismiss}
					onDelete={onDelete}
				/>
			</ScrollArea>
		</div>
	);
};
