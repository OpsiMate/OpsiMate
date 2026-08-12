import { PersonPicker } from '@/components/PersonPicker';
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
import { Button } from '@/components/ui/button';
import { useUsers } from '@/hooks/queries/users';
import { Alert } from '@OpsiMate/shared';
import { BellRing, CheckCircle2, MessageSquarePlus, Trash2 } from 'lucide-react';
import { useState } from 'react';

export interface AlertsSelectionBarProps {
	selectedAlerts: Alert[];
	onClearSelection: () => void;
	onSilenceAll: () => void;
	// Shown instead of "Silence all" when EVERY selected alert is already silenced.
	onUnsilenceAll?: () => void;
	onAssignOwnerAll?: (ownerId: string | null) => void;
	onResolveAll?: () => void;
	// Adds the same comment to every selected alert (opens the comment dialog).
	onCommentAll?: () => void;
	onDeleteAll?: () => void;
	// True when the current view has matching alerts that are NOT loaded (the "N of M"
	// banner is showing). Bulk actions apply only to the loaded selection, so the scope
	// must be explicit — otherwise "Silence all" on a select-all reads as "silence every
	// matching alert" when it silences only the loaded page.
	hasUnloadedMatches?: boolean;
}

export const AlertsSelectionBar = ({
	selectedAlerts,
	onClearSelection,
	onSilenceAll,
	onUnsilenceAll,
	onAssignOwnerAll,
	onResolveAll,
	onCommentAll,
	onDeleteAll,
	hasUnloadedMatches,
}: AlertsSelectionBarProps) => {
	const { data: users = [] } = useUsers();
	const [confirmDelete, setConfirmDelete] = useState(false);

	if (selectedAlerts.length === 0) {
		return null;
	}

	// Silence/unsilence are offered only on uniform selections: all-active gets
	// "Silence all", all-silenced gets "Unsilence all", a mixed selection gets
	// neither — the outcome of a bulk action on a mix is too easy to misread.
	const allNotSilenced = selectedAlerts.every((alert) => !alert.isSilenced);
	const allSilenced = selectedAlerts.every((alert) => alert.isSilenced);

	const handleAssignOwner = (ownerId: string | null) => {
		if (onAssignOwnerAll) {
			onAssignOwnerAll(ownerId);
		}
	};

	return (
		// Actions on the left: the checkboxes are the leftmost column, so the cursor is
		// already there when selecting. The count is informational, not interactive, so it
		// sits out of the way on the right.
		<div className="mt-4 p-3 bg-muted rounded-lg flex items-center justify-between gap-4">
			<div className="flex flex-wrap items-center gap-2">
				{onAssignOwnerAll && (
					<PersonPicker
						selectedUserId={null}
						users={users}
						onSelect={handleAssignOwner}
						placeholder="Assign Owner"
						className="h-8 px-3 text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md"
					/>
				)}
				{allNotSilenced && (
					<Button variant="outline" size="sm" onClick={onSilenceAll}>
						Silence all
					</Button>
				)}
				{onUnsilenceAll && allSilenced && (
					<Button variant="outline" size="sm" onClick={onUnsilenceAll} className="gap-1.5">
						<BellRing className="h-3.5 w-3.5" />
						Unsilence all
					</Button>
				)}
				{onResolveAll && (
					<Button variant="outline" size="sm" onClick={onResolveAll} className="gap-1.5">
						<CheckCircle2 className="h-3.5 w-3.5" />
						Resolve
					</Button>
				)}
				{onCommentAll && (
					<Button variant="outline" size="sm" onClick={onCommentAll} className="gap-1.5">
						<MessageSquarePlus className="h-3.5 w-3.5" />
						Comment
					</Button>
				)}
				{onDeleteAll && (
					<Button
						variant="outline"
						size="sm"
						onClick={() => setConfirmDelete(true)}
						className="gap-1.5 text-destructive hover:text-destructive"
					>
						<Trash2 className="h-3.5 w-3.5" />
						Delete
					</Button>
				)}
				<Button variant="outline" size="sm" onClick={onClearSelection}>
					Clear selection
				</Button>
			</div>

			<span className="min-w-0 text-sm font-medium">
				<span className="whitespace-nowrap">
					{selectedAlerts.length} Alert{selectedAlerts.length !== 1 ? 's' : ''} selected
				</span>
				{hasUnloadedMatches && (
					<span className="ml-2 text-xs text-muted-foreground">
						— actions apply to the loaded alerts only; scroll to load more first
					</span>
				)}
			</span>

			<AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Delete {selectedAlerts.length} alert{selectedAlerts.length !== 1 ? 's' : ''}?
						</AlertDialogTitle>
						<AlertDialogDescription>
							This permanently deletes the selected alert{selectedAlerts.length !== 1 ? 's' : ''} — they
							will not appear in the resolved list. This cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								setConfirmDelete(false);
								onDeleteAll?.();
							}}
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
