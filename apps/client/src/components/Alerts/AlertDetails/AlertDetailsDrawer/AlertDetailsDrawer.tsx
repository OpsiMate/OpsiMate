import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { Info, MessageSquare, X } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { AlertActionsSection } from '../AlertActionsSection';
import { AlertHistorySection } from '../AlertHistorySection';
import { AlertInfoSection } from '../AlertInfoSection';
import { AlertLinksSection } from '../AlertLinksSection';
import { AlertSummarySection } from '../AlertSummarySection';
import { AlertTimestampsSection } from '../AlertTimestampsSection';
import { CommentsWall } from '../CommentsWall';
import { useAlertHistory } from '../hooks';
import { DRAWER_WIDTH } from './AlertDetailsDrawer.constants';

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
	const [isClosing, setIsClosing] = useState(false);

	useEffect(() => {
		if (alert) {
			setRenderedAlert(alert);
		}
	}, [alert]);

	const historyData = useAlertHistory(renderedAlert?.id);

	// Handle close with animation
	const handleClose = useCallback(() => {
		setIsClosing(true);
		setTimeout(() => {
			onClose();
			setIsClosing(false);
		}, 300); // Match animation duration
	}, [onClose]);

	// Handle escape key to close drawer
	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				handleClose();
			}
		},
		[handleClose]
	);

	useEffect(() => {
		if (open) {
			document.addEventListener('keydown', handleKeyDown);
			return () => document.removeEventListener('keydown', handleKeyDown);
		}
	}, [open, handleKeyDown]);

	if (!open && !isClosing) return null;

	return (
		<div
			role="complementary"
			aria-label="Alert details panel"
			className={cn(
				'fixed top-0 right-0 h-full bg-background border-l shadow-xl z-40 flex flex-col',
				DRAWER_WIDTH,
				open && !isClosing && 'animate-in slide-in-from-right duration-300',
				isClosing && 'animate-out slide-out-to-right duration-300'
			)}
		>
			<div className="px-6 py-4 border-b flex-shrink-0 flex items-center justify-between">
				<h2 className="text-lg font-semibold text-foreground">Alert Details</h2>
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 text-foreground"
					onClick={handleClose}
					aria-label="Close alert details panel"
				>
					<X className="h-4 w-4" />
				</Button>
			</div>

			<Tabs defaultValue="details" className="flex-1 flex flex-col min-h-0">
				<TabsList className="mx-4 mt-4 grid w-auto grid-cols-2">
					<TabsTrigger value="details" className="gap-1.5">
						<Info className="h-4 w-4" />
						Details
					</TabsTrigger>
					<TabsTrigger value="comments" className="gap-1.5">
						<MessageSquare className="h-4 w-4" />
						Comments
					</TabsTrigger>
				</TabsList>

				<TabsContent value="details" className="flex-1 min-h-0 mt-0">
					<ScrollArea className="h-full">
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
				</TabsContent>

				<TabsContent value="comments" className="flex-1 min-h-0 mt-0">
					{renderedAlert && <CommentsWall alertId={renderedAlert.id} />}
				</TabsContent>
			</Tabs>
		</div>
	);
};
