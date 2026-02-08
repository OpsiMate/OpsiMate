import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Check, User, UserX } from 'lucide-react';
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
						'h-6 px-2 gap-1.5 text-xs font-normal justify-start text-foreground max-w-full overflow-hidden',
						className
					)}
					onClick={(e) => e.stopPropagation()}
					title={selectedUser?.fullName || placeholder}
				>
					{selectedUser ? (
						<>
							<div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-medium flex-shrink-0">
								{getInitials(selectedUser.fullName)}
							</div>
							<span className="truncate">{selectedUser.fullName}</span>
						</>
					) : (
						<>
							<User className="h-3.5 w-3.5 flex-shrink-0" />
							<span className="truncate">{placeholder}</span>
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
							<CommandItem
								onSelect={() => handleSelect(null)}
								className={cn(
									"flex items-center gap-2 cursor-pointer data-[selected='true']:bg-muted/50 data-[selected=true]:text-foreground",
									!selectedUserId && 'bg-muted'
								)}
							>
								<UserX className="h-4 w-4 text-foreground" />
								<span className="text-foreground flex-1">Unassigned</span>
								{!selectedUserId && <Check className="h-4 w-4 text-primary" />}
							</CommandItem>
							{users.map((user) => {
								const isSelected = user.id === selectedUserId;
								return (
									<CommandItem
										key={user.id}
										onSelect={() => handleSelect(user.id)}
										className={cn(
											"flex items-center gap-2 cursor-pointer data-[selected='true']:bg-muted/50 data-[selected=true]:text-foreground",
											isSelected && 'bg-muted'
										)}
									>
										<div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-medium">
											{getInitials(user.fullName)}
										</div>
										<div className="flex flex-col flex-1">
											<span className="text-sm text-foreground">{user.fullName}</span>
											<span className="text-xs text-foreground opacity-70">{user.email}</span>
										</div>
										{isSelected && <Check className="h-4 w-4 text-primary" />}
									</CommandItem>
								);
							})}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
};
