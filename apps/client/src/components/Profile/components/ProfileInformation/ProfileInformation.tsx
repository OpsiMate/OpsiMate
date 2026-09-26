import { User } from 'lucide-react';
import { formatDate } from '../../utils/profile.utils';

interface ProfileInformationProps {
	email: string;
	role: string;
	createdAt: string;
	phoneNumber?: string | null;
}

export const ProfileInformation = ({ email, role, createdAt, phoneNumber }: ProfileInformationProps) => {
	return (
		<div className="space-y-4">
			<div className="flex items-center gap-3">
				<User className="h-5 w-5 text-muted-foreground" />
				<h3 className="font-semibold">Profile Information</h3>
			</div>

			<dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<dt className="text-sm font-semibold text-muted-foreground">Email</dt>
					<dd className="mt-1 text-sm text-foreground">{email}</dd>
				</div>
				<div>
					<dt className="text-sm font-semibold text-muted-foreground">Role</dt>
					<dd className="mt-1 text-sm text-foreground capitalize">{role}</dd>
				</div>
				<div>
					<dt className="text-sm font-semibold text-muted-foreground">Member Since</dt>
					<dd className="mt-1 text-sm text-foreground">{formatDate(createdAt)}</dd>
				</div>
				<div>
					<dt className="text-sm font-semibold text-muted-foreground">Phone Number</dt>
					<dd className="mt-1 text-sm text-foreground">{phoneNumber || '—'}</dd>
				</div>
			</dl>
		</div>
	);
};
