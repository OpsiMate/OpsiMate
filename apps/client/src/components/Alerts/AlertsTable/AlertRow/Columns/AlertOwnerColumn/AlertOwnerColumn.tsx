import { PersonPicker } from '@/components/PersonPicker';
import { TableCell } from '@/components/ui/table';
import { useSetAlertOwner, useSetResolvedAlertOwner } from '@/hooks/queries/alerts';
import { useUsers } from '@/hooks/queries/users';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';

export interface AlertOwnerColumnProps {
	alert: Alert;
	className?: string;
	isResolved?: boolean;
}

export const AlertOwnerColumn = ({ alert, className, isResolved = false }: AlertOwnerColumnProps) => {
	const { data: users = [] } = useUsers();
	const setOwnerMutation = useSetAlertOwner();
	const setResolvedOwnerMutation = useSetResolvedAlertOwner();

	// Prefer the per-row transient flag (set in the combined "All" view) over the table-level prop.
	const rowIsResolved = isResolved || Boolean(alert.isResolved);
	const mutation = rowIsResolved ? setResolvedOwnerMutation : setOwnerMutation;

	const handleOwnerChange = (userId: string | null) => {
		mutation.mutate({ alertId: alert.id, ownerId: userId });
	};

	return (
		<TableCell className={cn('py-1 px-2 overflow-hidden', className)}>
			<div onClick={(e) => e.stopPropagation()}>
				<PersonPicker
					selectedUserId={alert.ownerId}
					users={users}
					onSelect={handleOwnerChange}
					disabled={mutation.isPending}
				/>
			</div>
		</TableCell>
	);
};
