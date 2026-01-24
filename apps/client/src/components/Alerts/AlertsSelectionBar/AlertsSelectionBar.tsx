import { PersonPicker } from '@/components/PersonPicker';
import { Button } from '@/components/ui/button';
import { useUsers } from '@/hooks/queries/users';
import { Alert } from '@OpsiMate/shared';

export interface AlertsSelectionBarProps {
	selectedAlerts: Alert[];
	onClearSelection: () => void;
	onDismissAll: () => void;
	onAssignOwnerAll?: (ownerId: string | null) => void;
}

export const AlertsSelectionBar = ({
	selectedAlerts,
	onClearSelection,
	onDismissAll,
	onAssignOwnerAll,
}: AlertsSelectionBarProps) => {
	const { data: users = [] } = useUsers();

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
				<Button variant="outline" size="sm" onClick={onClearSelection}>
					Clear selection
				</Button>
			</div>
		</div>
	);
};
