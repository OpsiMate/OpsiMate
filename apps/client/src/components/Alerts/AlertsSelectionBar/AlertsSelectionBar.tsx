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
import { Archive, Trash2 } from 'lucide-react';
import { useState } from 'react';

export interface AlertsSelectionBarProps {
	selectedAlerts: Alert[];
	onClearSelection: () => void;
	onDismissAll: () => void;
	onAssignOwnerAll?: (ownerId: string | null) => void;
	onArchiveAll?: () => void;
	onDeleteAll?: () => void;
}

export const AlertsSelectionBar = ({
	selectedAlerts,
	onClearSelection,
	onDismissAll,
	onAssignOwnerAll,
	onArchiveAll,
	onDeleteAll,
}: AlertsSelectionBarProps) => {
	const { data: users = [] } = useUsers();
	const [confirmDelete, setConfirmDelete] = useState(false);

	if (selectedAlerts.length === 0) {
		return null;
	}

	const allNotDismissed = selectedAlerts.every((alert) => !alert.isDismissed);

	const handleAssignOwner = (ownerId: string | null) => {
		if (onAssignOwnerAll) {
			onAssignOwnerAll(ownerId);
		}
	};

	return (
		<div className="mt-4 p-3 bg-muted rounded-lg flex items-center justify-between">
			<span className="text-sm font-medium">
				{selectedAlerts.length} Alert{selectedAlerts.length !== 1 ? 's' : ''} selected
			</span>
			<div className="flex items-center gap-2">
				{onAssignOwnerAll && (
					<PersonPicker
						selectedUserId={null}
						users={users}
						onSelect={handleAssignOwner}
						placeholder="Assign Owner"
						className="h-8 px-3 text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md"
					/>
				)}
				{allNotDismissed && (
					<Button variant="outline" size="sm" onClick={onDismissAll}>
						Dismiss all
					</Button>
				)}
				{onArchiveAll && (
					<Button variant="outline" size="sm" onClick={onArchiveAll} className="gap-1.5">
						<Archive className="h-3.5 w-3.5" />
						Archive
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

			<AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Delete {selectedAlerts.length} alert{selectedAlerts.length !== 1 ? 's' : ''}?
						</AlertDialogTitle>
						<AlertDialogDescription>
							This permanently deletes the selected alert{selectedAlerts.length !== 1 ? 's' : ''} — they
							will not appear in the archive. This cannot be undone.
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
