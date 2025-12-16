import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { User, UserX } from 'lucide-react';
import { useState } from 'react';
import { PersonPickerProps } from './PersonPicker.types';

const getInitials = (fullName: string): string => {
	return fullName
		.split(' ')
		.map((n) => n[0])
		.join('')
		.toUpperCase()
		.slice(0, 2);
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

	const handleSelect = (userId: number | null) => {
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
							<div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-medium">
								{getInitials(selectedUser.fullName)}
							</div>
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
									<div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-medium">
										{getInitials(user.fullName)}
									</div>
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
