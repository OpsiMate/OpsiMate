import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Alert } from '@OpsiMate/shared';
import { useEffect, useState } from 'react';
import { AlertActionsSection } from '../AlertActionsSection';
import { AlertHistorySection } from '../AlertHistorySection';
import { AlertInfoSection } from '../AlertInfoSection';
import { AlertLinksSection } from '../AlertLinksSection';
import { AlertSummarySection } from '../AlertSummarySection';
import { AlertTimestampsSection } from '../AlertTimestampsSection';
import { CommentsWall } from '../CommentsWall';
import { useAlertHistory } from '../hooks';
import { DRAWER_COMMENTS_WIDTH, DRAWER_DETAILS_WIDTH, DRAWER_WIDTH } from './AlertDetailsDrawer.constants';

interface AlertDetailsDrawerProps {
	open: boolean;
	alert: Alert | null;
	isActive: boolean;
	onClose: () => void;
	onDismiss?: (alertId: string) => void;
	onUndismiss?: (alertId: string) => void;
	onDelete?: (alertId: string) => void;
}

export const AlertDetailsDrawer = ({
	open,
	alert,
	isActive,
	onClose,
	onDismiss,
	onUndismiss,
	onDelete,
}: AlertDetailsDrawerProps) => {
	const [renderedAlert, setRenderedAlert] = useState<Alert | null>(alert);

	useEffect(() => {
		if (alert) {
			setRenderedAlert(alert);
		}
	}, [alert]);

	const historyData = useAlertHistory(renderedAlert?.id);

	return (
		<Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
			<SheetContent side="right" className={`${DRAWER_WIDTH} p-0 flex flex-col`}>
				<SheetHeader className="px-6 py-4 border-b flex-shrink-0">
					<SheetTitle className="text-lg">Alert Details</SheetTitle>
					<SheetDescription className="sr-only">View and manage alert details and comments</SheetDescription>
				</SheetHeader>

				<div className="flex-1 flex min-h-0">
					<div className={`${DRAWER_DETAILS_WIDTH} flex flex-col min-h-0`}>
						<ScrollArea className="flex-1">
							<div className="p-4 space-y-4">
								{renderedAlert && <AlertInfoSection alert={renderedAlert} />}

								{renderedAlert?.summary && <AlertSummarySection summary={renderedAlert.summary} />}

								{renderedAlert && <AlertTimestampsSection alert={renderedAlert} />}

								{historyData && <AlertHistorySection historyData={historyData} />}

								{renderedAlert && <AlertLinksSection alert={renderedAlert} />}

								{renderedAlert && (
									<AlertActionsSection
										alert={renderedAlert}
										isActive={isActive}
										onDismiss={onDismiss}
										onUndismiss={onUndismiss}
										onDelete={onDelete}
									/>
								)}
							</div>
						</ScrollArea>
					</div>

					<div className={DRAWER_COMMENTS_WIDTH}>
						{renderedAlert && <CommentsWall alertId={renderedAlert.id} />}
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
};
