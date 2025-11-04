import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getInitials } from '../../utils/profile.utils';

interface ProfileHeaderProps {
	fullName: string;
	email: string;
}

export const ProfileHeader = ({ fullName, email }: ProfileHeaderProps) => {
	return (
		<CardHeader>
			<div className="flex items-center gap-4">
				<div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 p-2">
					<span className="text-xl font-semibold text-primary">{getInitials(fullName)}</span>
				</div>
				<div>
					<CardTitle className="text-xl">{fullName}</CardTitle>
					<CardDescription>{email}</CardDescription>
				</div>
			</div>
		</CardHeader>
	);
};
