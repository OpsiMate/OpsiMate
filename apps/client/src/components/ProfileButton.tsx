import { Button } from '@/components/ui/button';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { getCurrentUser } from '@/lib/auth';
import { useCurrentUser } from '@/hooks/queries/users';

interface ProfileButtonProps {
	collapsed: boolean;
}

const getInitials = (name: string) => {
	return name
		.split(' ')
		.map((word) => word.charAt(0))
		.join('')
		.toUpperCase()
		.slice(0, 2);
};

export const ProfileButton = ({ collapsed }: ProfileButtonProps) => {
	const location = useLocation();
	const isActive = location.pathname === '/profile';
	const jwtUser = getCurrentUser();
	const { data: userProfile } = useCurrentUser();

	const displayName = userProfile?.fullName || jwtUser?.email.split('@')[0] || 'User';
	const userInitials = getInitials(displayName);
	const avatarUrl = userProfile?.avatarUrl;

	return (
		<Button
			variant={isActive ? 'default' : 'ghost'}
			className={cn(
				'gap-3 h-10 items-center group text-foreground',
				collapsed ? 'w-10 justify-center p-0' : 'w-full justify-start px-3',
				isActive && 'text-primary-foreground'
			)}
			asChild
		>
			<Link to="/profile">
				<div
					className={cn(
						'flex items-center justify-center rounded-full border transition-colors duration-200 overflow-hidden',
						collapsed ? 'w-6 h-6' : 'w-5 h-5',
						isActive ? 'bg-background border-border' : 'bg-muted border-border group-hover:bg-background'
					)}
				>
					{avatarUrl ? (
						<img src={avatarUrl} alt={`${displayName}'s avatar`} className="w-full h-full object-cover" />
					) : (
						<span
							className={cn(
								'font-semibold transition-colors duration-200',
								collapsed ? 'text-xs' : 'text-xs',
								isActive ? 'text-foreground' : 'text-foreground group-hover:text-foreground'
							)}
						>
							{userInitials}
						</span>
					)}
				</div>
				<span className={cn('font-medium', collapsed && 'sr-only')}>Profile</span>
			</Link>
		</Button>
	);
};
