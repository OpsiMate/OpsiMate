import { User } from 'lucide-react';
import { formatDate } from '../../utils/profile.utils';

interface ProfileInformationProps {
	email: string;
	role: string;
	createdAt: string;
}

export const ProfileInformation = ({ email, role, createdAt }: ProfileInformationProps) => {
	return (
		<div className="space-y-4">
			<div className="flex items-center gap-3">
				<User className="h-5 w-5 text-gray-500" />
				<h3 className="font-semibold">Profile Information</h3>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label className="text-sm font-semibold text-muted-foreground">Email</label>
					<div className="mt-1 text-sm text-foreground">{email}</div>
				</div>
				<div>
					<label className="text-sm font-semibold text-muted-foreground">Role</label>
					<div className="mt-1 text-sm text-foreground capitalize">{role}</div>
				</div>
				<div>
					<label className="text-sm font-semibold text-muted-foreground">Member Since</label>
					<div className="mt-1 text-sm text-foreground">{formatDate(createdAt)}</div>
				</div>
			</div>
		</div>
	);
};
