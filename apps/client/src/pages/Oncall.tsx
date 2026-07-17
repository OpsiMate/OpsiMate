import { DashboardLayout } from '@/components/DashboardLayout';
import { OncallTeamDraft, OncallTeamFormDialog } from '@/components/Oncall/OncallTeamFormDialog';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useOncallTeamMutations, useOncallTeams } from '@/hooks/queries/oncall';
import { useUsers } from '@/hooks/queries/users';
import { useToast } from '@/hooks/use-toast';
import { isAdmin } from '@/lib/auth';
import { OncallTeam } from '@OpsiMate/shared';
import { Pencil, Phone, PhoneCall, Plus, Repeat, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

// Big teams: the table shows the first chips in call order and folds the rest into "+X".
const MAX_VISIBLE_MEMBERS = 5;

const formatDateTime = (iso: string | null): string => {
	if (!iso) return '—';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '—';
	return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// On-call schedule: one row per team, members shown in current call order (1 = the person
// the NOC phones now). Admins manage teams, members, and the rotation cadence.
const Oncall = () => {
	const { toast } = useToast();
	const admin = isAdmin();
	const { data: teams = [], isLoading } = useOncallTeams();
	const { data: users = [] } = useUsers();
	const { createTeam, updateTeam, deleteTeam, setTeamMembers } = useOncallTeamMutations();

	const [searchTerm, setSearchTerm] = useState('');
	const [formOpen, setFormOpen] = useState(false);
	const [editingTeam, setEditingTeam] = useState<OncallTeam | null>(null);
	const [teamToDelete, setTeamToDelete] = useState<OncallTeam | null>(null);
	const [saving, setSaving] = useState(false);

	// Match on team name or any member's name/email.
	const filteredTeams = useMemo(() => {
		const term = searchTerm.trim().toLowerCase();
		if (!term) return teams;
		return teams.filter(
			(team) =>
				team.name.toLowerCase().includes(term) ||
				team.members.some(
					(m) => m.fullName.toLowerCase().includes(term) || m.email.toLowerCase().includes(term)
				)
		);
	}, [teams, searchTerm]);

	const openCreate = () => {
		setEditingTeam(null);
		setFormOpen(true);
	};

	const openEdit = (team: OncallTeam) => {
		setEditingTeam(team);
		setFormOpen(true);
	};

	const handleSave = async (draft: OncallTeamDraft) => {
		setSaving(true);
		// Tracked so a failed member save can roll back a just-created team — otherwise
		// retrying the dialog would leave an empty duplicate behind.
		let createdTeamId: number | null = null;
		try {
			const payload = { name: draft.name, rotationIntervalDays: draft.rotationIntervalDays };
			let teamId: number;
			if (editingTeam) {
				teamId = (await updateTeam.mutateAsync({ teamId: editingTeam.id, payload })).id;
			} else {
				teamId = (await createTeam.mutateAsync(payload)).id;
				createdTeamId = teamId;
			}
			await setTeamMembers.mutateAsync({ teamId, userIds: draft.userIds });
			setFormOpen(false);
			toast({
				title: editingTeam ? 'Team updated' : 'Team created',
				description: `"${draft.name}" now has ${draft.userIds.length} member${draft.userIds.length !== 1 ? 's' : ''}.`,
			});
		} catch (err) {
			if (createdTeamId !== null) {
				await deleteTeam.mutateAsync(createdTeamId).catch(() => undefined);
			}
			toast({
				title: 'Failed to save team',
				description: err instanceof Error ? err.message : 'Unknown error',
				variant: 'destructive',
			});
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async () => {
		if (!teamToDelete) return;
		try {
			await deleteTeam.mutateAsync(teamToDelete.id);
			toast({ title: 'Team deleted', description: `"${teamToDelete.name}" was removed.` });
		} catch (err) {
			toast({
				title: 'Failed to delete team',
				description: err instanceof Error ? err.message : 'Unknown error',
				variant: 'destructive',
			});
		} finally {
			setTeamToDelete(null);
		}
	};

	return (
		<DashboardLayout>
			<div className="p-6 space-y-4">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-bold flex items-center gap-2">
							<PhoneCall className="h-6 w-6" />
							On-Call
						</h1>
						<p className="text-sm text-muted-foreground mt-1">
							Who to call when alerts fire — each team's members in call order, rotated automatically.
						</p>
					</div>
					{admin && (
						<Button onClick={openCreate} className="gap-2">
							<Plus className="h-4 w-4" />
							Add Team
						</Button>
					)}
				</div>

				<div className="relative max-w-sm">
					<Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						placeholder="Search teams or members..."
						className="pl-8"
					/>
				</div>

				<Card>
					<CardContent className="p-0">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-[180px]">Team</TableHead>
									<TableHead>Members (call order)</TableHead>
									<TableHead className="w-[160px]">Rotation</TableHead>
									<TableHead className="w-[160px]">Next rotation</TableHead>
									{admin && <TableHead className="w-[90px]" />}
								</TableRow>
							</TableHeader>
							<TableBody>
								{isLoading ? (
									<TableRow>
										<TableCell
											colSpan={admin ? 5 : 4}
											className="h-24 text-center text-muted-foreground"
										>
											Loading on-call teams...
										</TableCell>
									</TableRow>
								) : filteredTeams.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={admin ? 5 : 4}
											className="h-24 text-center text-muted-foreground"
										>
											{searchTerm
												? 'No teams match your search.'
												: `No on-call teams yet${admin ? ' — add the first one.' : '.'}`}
										</TableCell>
									</TableRow>
								) : (
									filteredTeams.map((team) => (
										<TableRow key={team.id}>
											<TableCell className="font-medium">{team.name}</TableCell>
											<TableCell>
												<div className="flex flex-wrap gap-1.5">
													{team.members.length === 0 && (
														<span className="text-sm text-muted-foreground">
															No members
														</span>
													)}
													{team.members.slice(0, MAX_VISIBLE_MEMBERS).map((member) => (
														<span
															key={member.userId}
															data-testid={
																member.priority === 1 ? 'oncall-now' : undefined
															}
															title={member.email}
															className={
																member.priority === 1
																	? 'inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary/10 px-2.5 py-0.5 text-xs font-semibold'
																	: 'inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs'
															}
														>
															<Badge
																variant={
																	member.priority === 1 ? 'default' : 'secondary'
																}
																className="h-4 min-w-4 justify-center rounded-full px-1 text-[10px]"
															>
																{member.priority}
															</Badge>
															{member.fullName}
															{member.phoneNumber && (
																<span className="inline-flex items-center gap-1 text-muted-foreground">
																	<Phone className="h-3 w-3" />
																	{member.phoneNumber}
																</span>
															)}
														</span>
													))}
													{team.members.length > MAX_VISIBLE_MEMBERS && (
														<span
															title={team.members
																.slice(MAX_VISIBLE_MEMBERS)
																.map((m) => `${m.priority}. ${m.fullName}`)
																.join('\n')}
															className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground"
														>
															+{team.members.length - MAX_VISIBLE_MEMBERS} more
														</span>
													)}
												</div>
											</TableCell>
											<TableCell>
												{team.rotationIntervalDays ? (
													<span className="inline-flex items-center gap-1.5 text-sm">
														<Repeat className="h-3.5 w-3.5 text-muted-foreground" />
														Every {team.rotationIntervalDays} day
														{team.rotationIntervalDays !== 1 ? 's' : ''}
													</span>
												) : (
													<span className="text-sm text-muted-foreground">Fixed order</span>
												)}
											</TableCell>
											<TableCell className="text-sm text-muted-foreground">
												{formatDateTime(team.nextRotationAt)}
											</TableCell>
											{admin && (
												<TableCell>
													<div className="flex items-center justify-end gap-1">
														<Button
															variant="ghost"
															size="icon"
															className="h-7 w-7"
															onClick={() => openEdit(team)}
															title="Edit team"
														>
															<Pencil className="h-3.5 w-3.5" />
														</Button>
														<Button
															variant="ghost"
															size="icon"
															className="h-7 w-7 text-destructive hover:text-destructive"
															onClick={() => setTeamToDelete(team)}
															title="Delete team"
														>
															<Trash2 className="h-3.5 w-3.5" />
														</Button>
													</div>
												</TableCell>
											)}
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			</div>

			<OncallTeamFormDialog
				open={formOpen}
				team={editingTeam}
				users={users}
				saving={saving}
				onClose={() => setFormOpen(false)}
				onSave={handleSave}
			/>

			<AlertDialog open={!!teamToDelete} onOpenChange={(open) => !open && setTeamToDelete(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete team "{teamToDelete?.name}"?</AlertDialogTitle>
						<AlertDialogDescription>
							The team and its on-call schedule will be removed. The users themselves are not affected.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</DashboardLayout>
	);
};

export default Oncall;
