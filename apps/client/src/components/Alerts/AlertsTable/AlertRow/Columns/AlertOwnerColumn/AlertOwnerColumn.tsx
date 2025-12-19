import { PersonPicker } from '@/components/PersonPicker';
import { TableCell } from '@/components/ui/table';
import { useSetAlertOwner } from '@/hooks/queries/alerts';
import { useUsers } from '@/hooks/queries/users';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';

export interface AlertOwnerColumnProps {
	alert: Alert;
	className?: string;
}

export const AlertOwnerColumn = ({ alert, className }: AlertOwnerColumnProps) => {
	const { data: users = [] } = useUsers();
	const setOwnerMutation = useSetAlertOwner();

	const handleOwnerChange = (userId: string | null) => {
		setOwnerMutation.mutate({ alertId: alert.id, ownerId: userId });
	};

	return (
		<TableCell className={cn('py-1 px-2', className)} onClick={(e) => e.stopPropagation()}>
			<PersonPicker
				selectedUserId={alert.ownerId}
				users={users}
				onSelect={handleOwnerChange}
				disabled={setOwnerMutation.isPending}
			/>
		</TableCell>
	);
};
