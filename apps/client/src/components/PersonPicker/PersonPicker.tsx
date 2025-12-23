import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { User, UserX } from 'lucide-react';
import { useState } from 'react';
import { PersonPickerProps, PersonPickerUser } from './PersonPicker.types';

const getInitials = (fullName: string): string => {
	return fullName
		.split(' ')
		.map((n) => n[0])
		.join('')
		.toUpperCase()
		.slice(0, 2);
};

/**
 * Avatar component that displays user's image or initials as fallback
 */
const UserAvatar = ({ user, size = 'sm' }: { user: PersonPickerUser; size?: 'sm' | 'md' }) => {
	const sizeClasses = size === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-6 h-6 text-xs';

	if (user.avatarUrl) {
		return (
			<img
				src={user.avatarUrl}
				alt={`${user.fullName}'s avatar`}
				className={cn('rounded-full object-cover', sizeClasses)}
			/>
		);
	}

	return (
		<div
			className={cn(
				'rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium',
				sizeClasses
			)}
		>
			{getInitials(user.fullName)}
		</div>
	);
};

export const PersonPicker = ({
	selectedUserId,
	users,
	onSelect,
	disabled = false,
	className,
	placeholder = 'Unassigned',
}: PersonPickerProps) => {
	const [open, setOpen] = useState(false);

	const selectedUser = users.find((u) => u.id === selectedUserId);

	const handleSelect = (userId: string | null) => {
		onSelect(userId);
		setOpen(false);
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					disabled={disabled}
					className={cn(
						'h-6 px-2 gap-1.5 text-xs font-normal justify-start',
						!selectedUser && 'text-muted-foreground',
						className
					)}
					onClick={(e) => e.stopPropagation()}
				>
					{selectedUser ? (
						<>
							<UserAvatar user={selectedUser} size="sm" />
							<span className="truncate max-w-[100px]">{selectedUser.fullName}</span>
						</>
					) : (
						<>
							<User className="h-3.5 w-3.5" />
							<span>{placeholder}</span>
						</>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[220px] p-0" align="start" onClick={(e) => e.stopPropagation()}>
				<Command>
					<CommandInput placeholder="Search users..." />
					<CommandList>
						<CommandEmpty>No users found</CommandEmpty>
						<CommandGroup>
							<CommandItem onSelect={() => handleSelect(null)} className="flex items-center gap-2">
								<UserX className="h-4 w-4 text-muted-foreground" />
								<span className="text-muted-foreground">Unassigned</span>
							</CommandItem>
							{users.map((user) => (
								<CommandItem
									key={user.id}
									onSelect={() => handleSelect(user.id)}
									className="flex items-center gap-2"
								>
									<UserAvatar user={user} size="sm" />
									<div className="flex flex-col">
										<span className="text-sm">{user.fullName}</span>
										<span className="text-xs text-muted-foreground">{user.email}</span>
									</div>
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
};
