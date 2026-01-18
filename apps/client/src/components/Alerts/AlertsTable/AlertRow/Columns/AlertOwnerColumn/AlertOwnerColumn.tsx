import { PersonPicker } from '@/components/PersonPicker';
import { TableCell } from '@/components/ui/table';
import { useSetAlertOwner, useSetArchivedAlertOwner } from '@/hooks/queries/alerts';
import { useUsers } from '@/hooks/queries/users';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';

export interface AlertOwnerColumnProps {
	alert: Alert;
	className?: string;
	isArchived?: boolean;
}

export const AlertOwnerColumn = ({ alert, className, isArchived = false }: AlertOwnerColumnProps) => {
	const { data: users = [] } = useUsers();
	const setOwnerMutation = useSetAlertOwner();
	const setArchivedOwnerMutation = useSetArchivedAlertOwner();

	const mutation = isArchived ? setArchivedOwnerMutation : setOwnerMutation;

	const handleOwnerChange = (userId: string | null) => {
		mutation.mutate({ alertId: alert.id, ownerId: userId });
	};

	return (
		<TableCell className={cn('py-1 px-2', className)}>
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
