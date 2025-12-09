import { TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { TypeAvatarStack } from '../../TypeAvatarStack';

export interface AlertTypeColumnProps {
	alert: Alert;
	className?: string;
}

export const AlertTypeColumn = ({ alert, className }: AlertTypeColumnProps) => {
	return (
		<TableCell className={cn('py-1 px-2', className)}>
			<TypeAvatarStack alert={alert} />
		</TableCell>
	);
};
