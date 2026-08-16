import { PersonPicker } from '@/components/PersonPicker';
import { TableCell } from '@/components/ui/table';
import { useSetAlertOwner, useSetResolvedAlertOwner } from '@/hooks/queries/alerts';
import { useUsers } from '@/hooks/queries/users';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';

export interface AlertOwnerColumnProps {
	alert: Alert;
	className?: string;
	// Inline width from the table\'s shared column-width map; wins over any width class.
	style?: React.CSSProperties;
	isResolved?: boolean;
}

export const AlertOwnerColumn = ({ alert, className, style, isResolved = false }: AlertOwnerColumnProps) => {
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
		<TableCell style={style} className={cn('py-1 px-2 overflow-hidden', className)}>
			{/* PersonPicker's trigger button carries its own font-normal, which blocks the
			    unread row's inherited font-black — re-apply it so the WHOLE line reads bold. */}
			<div onClick={(e) => e.stopPropagation()} className={cn(alert.isRead === false && '[&_button]:font-black')}>
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
