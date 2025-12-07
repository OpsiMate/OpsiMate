import { TableCell } from '@/components/ui/table';
import { Alert } from '@OpsiMate/shared';
import { TypeAvatarStack } from '../../TypeAvatarStack';

export interface AlertTypeColumnProps {
	alert: Alert;
}

export const AlertTypeColumn = ({ alert }: AlertTypeColumnProps) => {
	return (
		<TableCell className="py-1 px-2">
			<TypeAvatarStack alert={alert} />
		</TableCell>
	);
};
