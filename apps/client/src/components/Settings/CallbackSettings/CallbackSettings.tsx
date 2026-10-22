import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useCallbacks, useDeleteCallback, useUpdateCallback } from '@/hooks/queries/callbacks';
import { formatRelativeTime, parseUTCDate } from '@/lib/datetime';
import { ALERT_CALLBACK_EVENT_LABELS, AlertCallback } from '@OpsiMate/shared';
import { CheckCircle2, Edit, Loader2, Plus, Trash2, Webhook, XCircle } from 'lucide-react';
import { useState } from 'react';
import { CallbackFormDialog } from './CallbackFormDialog';

interface LastDeliveryProps {
	callback: AlertCallback;
}

const LastDelivery = ({ callback }: LastDeliveryProps) => {
	if (!callback.lastStatus || !callback.lastSentAt) {
		return <span className="text-xs text-muted-foreground">Never sent</span>;
	}
	const when = formatRelativeTime(parseUTCDate(callback.lastSentAt));
	if (callback.lastStatus === 'success') {
		return (
			<span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
				<CheckCircle2 className="h-3.5 w-3.5" /> Delivered {when}
			</span>
		);
	}
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<span className="flex items-center gap-1.5 text-xs text-destructive cursor-help">
						<XCircle className="h-3.5 w-3.5" /> Failed {when}
					</span>
				</TooltipTrigger>
				<TooltipContent side="top" className="max-w-sm break-words">
					{callback.lastError ?? 'Delivery failed'}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
};

interface CallbackRowProps {
	callback: AlertCallback;
	onEdit: (callback: AlertCallback) => void;
	onDelete: (callback: AlertCallback) => void;
	onToggle: (callback: AlertCallback, enabled: boolean) => void;
	toggling: boolean;
}

const CallbackRow = ({ callback, onEdit, onDelete, onToggle, toggling }: CallbackRowProps) => (
	<TableRow>
		<TableCell>
			<div className="font-medium">{callback.name}</div>
			<div className="text-xs text-muted-foreground font-mono truncate max-w-xs" title={callback.url}>
				{callback.method} {callback.url}
			</div>
		</TableCell>
		<TableCell>
			<div className="flex flex-wrap gap-1">
				{callback.events.map((event) => (
					<Badge key={event} variant="outline" className="text-xs font-normal">
						{ALERT_CALLBACK_EVENT_LABELS[event]}
					</Badge>
				))}
			</div>
		</TableCell>
		<TableCell>
			<LastDelivery callback={callback} />
		</TableCell>
		<TableCell>
			<Switch
				checked={callback.enabled}
				onCheckedChange={(checked) => onToggle(callback, checked)}
				disabled={toggling}
				aria-label={`${callback.enabled ? 'Disable' : 'Enable'} ${callback.name}`}
			/>
		</TableCell>
		<TableCell className="text-right">
			<div className="flex justify-end gap-1">
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8"
					onClick={() => onEdit(callback)}
					aria-label={`Edit ${callback.name}`}
				>
					<Edit className="h-4 w-4" />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 text-destructive hover:text-destructive"
					onClick={() => onDelete(callback)}
					aria-label={`Delete ${callback.name}`}
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			</div>
		</TableCell>
	</TableRow>
);

// Settings > Callbacks: the outbound requests OpsiMate sends after a user changes an
// alert. Each row's switch is the only thing that makes a callback send anything —
// a new one starts off.
export const CallbackSettings = () => {
	const { toast } = useToast();
	const { data: callbacks = [], isLoading, error } = useCallbacks();
	const updateMutation = useUpdateCallback();
	const deleteMutation = useDeleteCallback();

	const [dialogOpen, setDialogOpen] = useState(false);
	const [editing, setEditing] = useState<AlertCallback | null>(null);
	const [pendingDelete, setPendingDelete] = useState<AlertCallback | null>(null);
	const [togglingId, setTogglingId] = useState<number | null>(null);

	const openCreate = () => {
		setEditing(null);
		setDialogOpen(true);
	};

	const openEdit = (callback: AlertCallback) => {
		setEditing(callback);
		setDialogOpen(true);
	};

	const toggle = async (callback: AlertCallback, enabled: boolean) => {
		setTogglingId(callback.id);
		try {
			await updateMutation.mutateAsync({ id: callback.id, payload: { enabled } });
			toast({ title: enabled ? `${callback.name} is on` : `${callback.name} is off` });
		} catch (err) {
			toast({
				title: 'Could not update callback',
				description: err instanceof Error ? err.message : undefined,
				variant: 'destructive',
			});
		} finally {
			setTogglingId(null);
		}
	};

	const confirmDelete = async () => {
		if (!pendingDelete) return;
		try {
			await deleteMutation.mutateAsync(pendingDelete.id);
			toast({ title: 'Callback deleted' });
		} catch (err) {
			toast({
				title: 'Could not delete callback',
				description: err instanceof Error ? err.message : undefined,
				variant: 'destructive',
			});
		} finally {
			setPendingDelete(null);
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-start gap-4">
				<div>
					<h2 className="text-2xl font-semibold text-foreground">Callbacks</h2>
					<p className="text-muted-foreground">
						Send an HTTP request to your own systems after someone silences, resolves, assigns or comments
						on an alert. The change is saved first; the callback never slows it down.
					</p>
				</div>
				<Button onClick={openCreate} className="gap-2 shrink-0">
					<Plus className="h-4 w-4" />
					New callback
				</Button>
			</div>

			<Card>
				<CardContent className="p-0">
					{isLoading ? (
						<div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
							<Loader2 className="h-4 w-4 animate-spin" /> Loading callbacks…
						</div>
					) : error ? (
						<div className="p-6 text-sm text-destructive">
							{error instanceof Error ? error.message : 'Could not load callbacks'}
						</div>
					) : callbacks.length === 0 ? (
						<div className="flex flex-col items-center gap-3 p-10 text-center">
							<Webhook className="h-8 w-8 text-muted-foreground" />
							<p className="text-sm text-muted-foreground max-w-md">
								No callbacks yet. Add one to get a signed JSON payload whenever an alert is changed by a
								user.
							</p>
							<Button variant="outline" onClick={openCreate} className="gap-2">
								<Plus className="h-4 w-4" />
								New callback
							</Button>
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Callback</TableHead>
									<TableHead>Events</TableHead>
									<TableHead>Last delivery</TableHead>
									<TableHead>Enabled</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{callbacks.map((callback) => (
									<CallbackRow
										key={callback.id}
										callback={callback}
										onEdit={openEdit}
										onDelete={setPendingDelete}
										onToggle={toggle}
										toggling={togglingId === callback.id}
									/>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			<CallbackFormDialog open={dialogOpen} onOpenChange={setDialogOpen} callback={editing} />

			<AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete {pendingDelete?.name}?</AlertDialogTitle>
						<AlertDialogDescription>
							Nothing more is sent to {pendingDelete?.url}. Alerts and their history are untouched.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={confirmDelete}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
};
