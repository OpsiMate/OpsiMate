import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { AlertDetailsBody } from './AlertDetailsBody';
import { AlertDetailsHeader } from './AlertDetailsHeader';
import { AlertFooterActions } from './AlertFooterActions';
import { SectionsExpandContext, SectionsExpandControls, useSectionsExpandBroadcast } from './CollapsibleSection';
import { useAlertHistory } from './hooks';

interface AlertDetailsProps {
	isActive: boolean;
	alert: Alert | null;
	onClose: () => void;
	onSilence?: (alertId: string) => void;
	onUnsilence?: (alertId: string) => void;
	onDelete?: (alertId: string) => void;
	className?: string;
}

export const AlertDetails = ({
	isActive,
	alert,
	onClose,
	onSilence,
	onUnsilence,
	onDelete,
	className,
}: AlertDetailsProps) => {
	const historyData = useAlertHistory(alert?.id);
	const { signal, broadcast } = useSectionsExpandBroadcast();

	if (!alert) return null;

	return (
		<div className={cn('h-full flex flex-col bg-background border-l', className)}>
			<AlertDetailsHeader onClose={onClose} actions={<SectionsExpandControls onBroadcast={broadcast} />} />

			<ScrollArea className="flex-1">
				<SectionsExpandContext.Provider value={signal}>
					<AlertDetailsBody alert={alert} historyData={historyData} />
				</SectionsExpandContext.Provider>
			</ScrollArea>

			{/* Primary actions pinned at the bottom, outside the scroll area. */}
			<div className="border-t p-3 flex-shrink-0">
				<AlertFooterActions
					alert={alert}
					isActive={isActive}
					onSilence={onSilence}
					onUnsilence={onUnsilence}
					onDelete={onDelete}
				/>
			</div>
		</div>
	);
};
