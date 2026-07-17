import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { UserInfo } from '@/hooks/queries/users/useUsers';
import { OncallTeam } from '@OpsiMate/shared';
import {
	closestCenter,
	DndContext,
	DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from '@dnd-kit/core';
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Phone, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export interface OncallTeamDraft {
	name: string;
	rotationIntervalDays: number | null;
	// Ordered: index 0 is call priority 1.
	userIds: string[];
}

interface OncallTeamFormDialogProps {
	open: boolean;
	// null = create a new team.
	team: OncallTeam | null;
	users: UserInfo[];
	saving: boolean;
	onClose: () => void;
	onSave: (draft: OncallTeamDraft) => void;
}

interface SortableMemberRowProps {
	userId: string;
	index: number;
	user: UserInfo | undefined;
	disabled: boolean;
	onRemove: () => void;
}

// One member row in the call-order list, reorderable by dragging its grip (or the row itself).
const SortableMemberRow = ({ userId, index, user, disabled, onRemove }: SortableMemberRowProps) => {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: userId,
		disabled,
	});

	return (
		<li
			ref={setNodeRef}
			style={{ transform: CSS.Transform.toString(transform), transition }}
			className={
				'flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1.5' +
				(isDragging ? ' z-10 opacity-80 shadow-md' : '')
			}
		>
			<span
				{...attributes}
				{...listeners}
				className={
					disabled ? 'text-muted-foreground/40' : 'cursor-grab text-muted-foreground hover:text-foreground'
				}
				title="Drag to reorder"
			>
				<GripVertical className="h-4 w-4" />
			</span>
			<Badge variant={index === 0 ? 'default' : 'secondary'} className="w-7 justify-center">
				{index + 1}
			</Badge>
			<span className="flex-1 truncate text-sm">
				{user?.fullName ?? `user #${userId}`}
				{user?.phoneNumber && (
					<span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
						<Phone className="h-3 w-3" />
						{user.phoneNumber}
					</span>
				)}
			</span>
			<Button
				variant="ghost"
				size="icon"
				className="h-6 w-6 text-destructive hover:text-destructive"
				disabled={disabled}
				onClick={onRemove}
				title="Remove"
			>
				<X className="h-3.5 w-3.5" />
			</Button>
		</li>
	);
};

// Create/edit an on-call team: name, rotation cadence, and the ordered member list
// (the order is the call order — first member is on call first; drag rows to reorder).
export const OncallTeamFormDialog = ({ open, team, users, saving, onClose, onSave }: OncallTeamFormDialogProps) => {
	const [name, setName] = useState('');
	const [rotationDays, setRotationDays] = useState('');
	const [userIds, setUserIds] = useState<string[]>([]);
	const [addOpen, setAddOpen] = useState(false);

	// Reset the draft each time the dialog opens; editing starts from the team's CURRENT
	// call order (priority), so what the admin sees is what saving will keep.
	useEffect(() => {
		if (!open) return;
		setName(team?.name ?? '');
		setRotationDays(team?.rotationIntervalDays ? String(team.rotationIntervalDays) : '');
		setUserIds(team ? [...team.members].sort((a, b) => a.priority - b.priority).map((m) => m.userId) : []);
	}, [open, team]);

	const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
	const availableUsers = useMemo(() => users.filter((u) => !userIds.includes(u.id)), [users, userIds]);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	);

	const handleDragEnd = ({ active, over }: DragEndEvent) => {
		if (!over || active.id === over.id) return;
		setUserIds((ids) => arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
	};

	const canSave = name.trim().length > 0 && userIds.length > 0 && !saving;

	return (
		<Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>{team ? 'Edit team' : 'New on-call team'}</DialogTitle>
					<DialogDescription>
						Members are called in the order below — the first one is on call now. Saving the member list
						restarts the rotation clock from today.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div>
						<label className="text-sm font-semibold text-muted-foreground">Team name</label>
						<Input
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="backend"
							className="mt-1"
							disabled={saving}
						/>
					</div>

					<div>
						<label className="text-sm font-semibold text-muted-foreground">Rotate every (days)</label>
						<Input
							type="number"
							min={0}
							max={365}
							value={rotationDays}
							onChange={(e) => setRotationDays(e.target.value)}
							placeholder="e.g. 3 — leave empty for a fixed order"
							className="mt-1"
							disabled={saving}
						/>
						<p className="mt-1 text-xs text-muted-foreground">
							Every interval the on-call duty moves one place down the list, wrapping around.
						</p>
					</div>

					<div>
						<label className="text-sm font-semibold text-muted-foreground">Members (call order)</label>
						<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
							<SortableContext items={userIds} strategy={verticalListSortingStrategy}>
								{/* Capped height: big teams scroll here instead of growing the dialog
								    past the viewport (which pushed the Save button off-screen). */}
								<ul className="mt-2 max-h-60 space-y-1.5 overflow-y-auto pr-1">
									{userIds.map((userId, index) => (
										<SortableMemberRow
											key={userId}
											userId={userId}
											index={index}
											user={usersById.get(userId)}
											disabled={saving}
											onRemove={() => setUserIds(userIds.filter((id) => id !== userId))}
										/>
									))}
								</ul>
							</SortableContext>
						</DndContext>

						{availableUsers.length > 0 ? (
							<Popover open={addOpen} onOpenChange={setAddOpen}>
								<PopoverTrigger asChild>
									<Button
										variant="outline"
										className="mt-2 w-full justify-start gap-2 font-normal text-muted-foreground"
										disabled={saving}
									>
										<Plus className="h-3.5 w-3.5" />
										Add a member
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
									<Command>
										<CommandInput placeholder="Search users..." />
										<CommandList>
											<CommandEmpty>No users found</CommandEmpty>
											<CommandGroup>
												{availableUsers.map((user) => (
													<CommandItem
														key={user.id}
														value={`${user.fullName} ${user.email}`}
														onSelect={() => {
															setUserIds((ids) => [...ids, user.id]);
															setAddOpen(false);
														}}
													>
														{user.fullName}
														<span className="ml-1.5 truncate text-xs text-muted-foreground">
															{user.email}
														</span>
													</CommandItem>
												))}
											</CommandGroup>
										</CommandList>
									</Command>
								</PopoverContent>
							</Popover>
						) : (
							<p className="mt-2 text-xs text-muted-foreground">All users are already in this team.</p>
						)}
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={onClose} disabled={saving}>
						Cancel
					</Button>
					<Button
						onClick={() =>
							onSave({
								name: name.trim(),
								// Clamp: the number input hints min 0 but doesn't stop manual "-3".
								rotationIntervalDays: rotationDays
									? Math.max(0, parseInt(rotationDays, 10)) || null
									: null,
								userIds,
							})
						}
						disabled={!canSave}
					>
						{saving ? 'Saving...' : 'Save team'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
