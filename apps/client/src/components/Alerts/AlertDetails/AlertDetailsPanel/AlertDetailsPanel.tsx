import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert } from '@OpsiMate/shared';
import { Info, MessageSquare, X } from 'lucide-react';
import { useState } from 'react';
import { AlertDetailsBody } from '../AlertDetailsBody';
import { CommentsWall } from '../CommentsWall';
import { useAlertHistory } from '../hooks';

interface AlertDetailsPanelProps {
	alert: Alert;
	isActive: boolean;
	onClose: () => void;
	onDismiss?: (alertId: string) => void;
	onUndismiss?: (alertId: string) => void;
	onDelete?: (alertId: string) => void;
}

export const AlertDetailsPanel = ({
	alert,
	isActive,
	onClose,
	onDismiss,
	onUndismiss,
	onDelete,
}: AlertDetailsPanelProps) => {
	const historyData = useAlertHistory(alert.id);
	const [tab, setTab] = useState('details');

	return (
		<div className="w-[340px] flex-shrink-0 border-l bg-background flex flex-col h-full overflow-hidden">
			<div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0">
				<h2 className="text-lg font-semibold text-foreground">Alert Details</h2>
				<Button variant="ghost" size="icon" className="h-8 w-8 text-foreground" onClick={onClose}>
					<X className="h-4 w-4" />
				</Button>
			</div>

			<Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
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

				<TabsContent value="details" className="flex-1 min-h-0 mt-0">
					<ScrollArea className="h-full">
						<AlertDetailsBody
							alert={alert}
							isActive={isActive}
							historyData={historyData}
							onDismiss={onDismiss}
							onUndismiss={onUndismiss}
							onDelete={onDelete}
							onViewAllComments={() => setTab('comments')}
						/>
					</ScrollArea>
				</TabsContent>

				<TabsContent value="comments" className="flex-1 min-h-0 mt-0">
					<CommentsWall alertId={alert.id} />
				</TabsContent>
			</Tabs>
		</div>
	);
};
