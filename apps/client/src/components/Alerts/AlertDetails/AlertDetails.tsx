import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { AlertDetailsTab } from './AlertDetailsTab';
import { AlertDetailsHeader } from './AlertDetailsHeader';
import { AlertFooterActions } from './AlertFooterActions';
import { SectionsExpandControls, useSectionsExpandBroadcast } from './CollapsibleSection';

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
	const { signal, broadcast } = useSectionsExpandBroadcast();

	if (!alert) return null;

	return (
		<div className={cn('h-full flex flex-col bg-background border-l', className)}>
			<AlertDetailsHeader onClose={onClose} actions={<SectionsExpandControls onBroadcast={broadcast} />} />

			<AlertDetailsTab alert={alert} isResolved={!isActive} signal={signal} />

			{/* Primary actions pinned at the bottom, outside the scroll area. */}
			<div className="border-t p-3 shrink-0">
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
