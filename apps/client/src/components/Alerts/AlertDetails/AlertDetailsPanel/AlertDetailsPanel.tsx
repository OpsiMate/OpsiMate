import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert } from '@OpsiMate/shared';
import { Info, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { TimeRange } from '../../AlertsTable/TimeFilter/TimeFilter.types';
import { AlertDetailsBody } from '../AlertDetailsBody';
import { AlertDetailsHeader } from '../AlertDetailsHeader';
import { SectionsExpandContext, SectionsExpandControls, useSectionsExpandBroadcast } from '../CollapsibleSection';
import { CommentsWall } from '../CommentsWall';
import { useAlertHistory } from '../hooks';
import { PanelResizeHandle } from './PanelResizeHandle';
import { useResizablePanelWidth } from './useResizablePanelWidth';

const PanelTabsList = () => (
	<TabsList className="mx-4 mt-3 grid w-auto grid-cols-2">
		<TabsTrigger value="details" className="gap-1.5">
			<Info className="h-4 w-4" />
			Details
		</TabsTrigger>
		<TabsTrigger value="comments" className="gap-1.5">
			<MessageSquare className="h-4 w-4" />
			Comments
		</TabsTrigger>
	</TabsList>
);

interface AlertDetailsPanelProps {
	alert: Alert;
	isActive: boolean;
	onClose: () => void;
	// Active time-range filter (the "All time" button), used to filter the History timeline.
	timeRange?: TimeRange | null;
	onDismiss?: (alertId: string) => void;
	onUndismiss?: (alertId: string) => void;
	onDelete?: (alertId: string) => void;
}

export const AlertDetailsPanel = ({
	alert,
	isActive,
	onClose,
	timeRange,
	onDismiss,
	onUndismiss,
	onDelete,
}: AlertDetailsPanelProps) => {
	const historyData = useAlertHistory(alert.id);
	const [tab, setTab] = useState('details');
	const { width, panelRef, startResizing, resetWidth } = useResizablePanelWidth();
	const { signal, broadcast } = useSectionsExpandBroadcast();

	return (
		<div
			ref={panelRef}
			style={{ width }}
			className="relative flex-shrink-0 border-l bg-background flex flex-col h-full overflow-hidden"
		>
			<PanelResizeHandle onPointerDown={startResizing} onDoubleClick={resetWidth} />

			<AlertDetailsHeader
				onClose={onClose}
				className="px-4 py-3 flex-shrink-0"
				actions={tab === 'details' && <SectionsExpandControls onBroadcast={broadcast} />}
			/>

			<Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
				<PanelTabsList />

				<TabsContent value="details" className="flex-1 min-h-0 mt-0">
					<ScrollArea className="h-full">
						<SectionsExpandContext.Provider value={signal}>
							<AlertDetailsBody
								alert={alert}
								isActive={isActive}
								historyData={historyData}
								timeRange={timeRange}
								onDismiss={onDismiss}
								onUndismiss={onUndismiss}
								onDelete={onDelete}
								onViewAllComments={() => setTab('comments')}
							/>
						</SectionsExpandContext.Provider>
					</ScrollArea>
				</TabsContent>

				<TabsContent value="comments" className="flex-1 min-h-0 mt-0">
					<CommentsWall alertId={alert.id} />
				</TabsContent>
			</Tabs>
		</div>
	);
};
