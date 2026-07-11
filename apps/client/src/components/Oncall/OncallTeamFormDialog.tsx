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
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserInfo } from '@/hooks/queries/users/useUsers';
import { OncallTeam } from '@OpsiMate/shared';
import { ArrowDown, ArrowUp, Phone, Plus, X } from 'lucide-react';
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

// Create/edit an on-call team: name, rotation cadence, and the ordered member list
// (the order is the call order — first member is on call first).
export const OncallTeamFormDialog = ({ open, team, users, saving, onClose, onSave }: OncallTeamFormDialogProps) => {
	const [name, setName] = useState('');
	const [rotationDays, setRotationDays] = useState('');
	const [userIds, setUserIds] = useState<string[]>([]);

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

	const move = (index: number, delta: number) => {
		const target = index + delta;
		if (target < 0 || target >= userIds.length) return;
		const next = [...userIds];
		[next[index], next[target]] = [next[target], next[index]];
		setUserIds(next);
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
						<ul className="mt-2 space-y-1.5">
							{userIds.map((userId, index) => {
								const user = usersById.get(userId);
								return (
									<li
										key={userId}
										className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1.5"
									>
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
											className="h-6 w-6"
											disabled={saving || index === 0}
											onClick={() => move(index, -1)}
											title="Move up"
										>
											<ArrowUp className="h-3.5 w-3.5" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											className="h-6 w-6"
											disabled={saving || index === userIds.length - 1}
											onClick={() => move(index, 1)}
											title="Move down"
										>
											<ArrowDown className="h-3.5 w-3.5" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											className="h-6 w-6 text-destructive hover:text-destructive"
											disabled={saving}
											onClick={() => setUserIds(userIds.filter((id) => id !== userId))}
											title="Remove"
										>
											<X className="h-3.5 w-3.5" />
										</Button>
									</li>
								);
							})}
						</ul>

						{availableUsers.length > 0 ? (
							<Select value="" onValueChange={(userId) => setUserIds([...userIds, userId])}>
								<SelectTrigger className="mt-2" disabled={saving}>
									<span className="flex items-center gap-2 text-muted-foreground">
										<Plus className="h-3.5 w-3.5" />
										<SelectValue placeholder="Add a member" />
									</span>
								</SelectTrigger>
								<SelectContent>
									{availableUsers.map((user) => (
										<SelectItem key={user.id} value={user.id}>
											{user.fullName} ({user.email})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
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
								rotationIntervalDays: rotationDays ? parseInt(rotationDays, 10) || null : null,
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
