import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { AlertActionsSection } from './AlertActionsSection';
import { AlertDetailsHeader } from './AlertDetailsHeader';
import { AlertHistorySection } from './AlertHistorySection';
import { AlertIdSection } from './AlertIdSection';
import { AlertInfoSection } from './AlertInfoSection';
import { AlertLinksSection } from './AlertLinksSection';
import { AlertSummarySection } from './AlertSummarySection';
import { AlertTimestampsSection } from './AlertTimestampsSection';
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
				<div className="p-4 space-y-4">
					<AlertInfoSection alert={alert} />

					{alert.summary && <AlertSummarySection summary={alert.summary} />}

					<AlertTimestampsSection alert={alert} />

					{historyData && <AlertHistorySection historyData={historyData} />}

					<AlertLinksSection alert={alert} />

					<AlertActionsSection
						alert={alert}
						isActive={isActive}
						onDismiss={onDismiss}
						onUndismiss={onUndismiss}
						onDelete={onDelete}
					/>

					<AlertIdSection alertId={alert.id} />
				</div>
			</ScrollArea>
		</div>
	);
};
