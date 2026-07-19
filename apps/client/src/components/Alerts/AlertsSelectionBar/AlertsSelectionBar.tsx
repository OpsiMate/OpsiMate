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
import { CheckCircle2, Trash2 } from 'lucide-react';
import { useState } from 'react';

export interface AlertsSelectionBarProps {
	selectedAlerts: Alert[];
	onClearSelection: () => void;
	onSilenceAll: () => void;
	onAssignOwnerAll?: (ownerId: string | null) => void;
	onResolveAll?: () => void;
	onDeleteAll?: () => void;
}

export const AlertsSelectionBar = ({
	selectedAlerts,
	onClearSelection,
	onSilenceAll,
	onAssignOwnerAll,
	onResolveAll,
	onDeleteAll,
}: AlertsSelectionBarProps) => {
	const { data: users = [] } = useUsers();
	const [confirmDelete, setConfirmDelete] = useState(false);

	if (selectedAlerts.length === 0) {
		return null;
	}

	const allNotSilenced = selectedAlerts.every((alert) => !alert.isSilenced);

	const handleAssignOwner = (ownerId: string | null) => {
		if (onAssignOwnerAll) {
			onAssignOwnerAll(ownerId);
		}
	};

	return (
		// Everything left-aligned: the checkboxes are the leftmost column, so the cursor is
		// already there when selecting — actions next to the count keep the travel short.
		<div className="mt-4 p-3 bg-muted rounded-lg flex items-center gap-4">
			<span className="text-sm font-medium whitespace-nowrap">
				{selectedAlerts.length} Alert{selectedAlerts.length !== 1 ? 's' : ''} selected
			</span>
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
				{onResolveAll && (
					<Button variant="outline" size="sm" onClick={onResolveAll} className="gap-1.5">
						<CheckCircle2 className="h-3.5 w-3.5" />
						Resolve
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
