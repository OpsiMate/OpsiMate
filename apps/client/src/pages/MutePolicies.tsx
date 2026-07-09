import { DashboardLayout } from '@/components/DashboardLayout';
import { MutePolicyFormDialog } from '@/components/MutePolicies/MutePolicyFormDialog';
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
import { useToast } from '@/hooks/use-toast';
import { useDeleteMutePolicy, useMutePolicies } from '@/hooks/queries/mute-policies';
import { MutePolicy } from '@OpsiMate/shared';
import { BellOff, Calendar, CheckCircle2, Clock, Hourglass, Pencil, Plus, Repeat, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

type MutePolicyStatus = 'active' | 'scheduled' | 'expired';

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const isScheduleActiveNow = (schedule: NonNullable<MutePolicy['schedule']>, now: Date = new Date()): boolean => {
	if (!schedule.daysOfWeek?.includes(now.getDay())) return false;
	const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
	return current >= schedule.startTime && current < schedule.endTime;
};

const getStatus = (s: MutePolicy): MutePolicyStatus => {
	if (s.schedule) {
		return isScheduleActiveNow(s.schedule) ? 'active' : 'scheduled';
	}
	const now = Date.now();
	if (s.startsAt && now < new Date(s.startsAt).getTime()) return 'scheduled';
	if (s.endsAt && now >= new Date(s.endsAt).getTime()) return 'expired';
	return 'active';
};

const formatDaysOfWeek = (days: number[]): string => {
	const sorted = [...days].sort((a, b) => a - b);
	if (sorted.length === 7) return 'Every day';
	if (sorted.length === 5 && [1, 2, 3, 4, 5].every((d) => sorted.includes(d))) return 'Weekdays';
	if (sorted.length === 2 && sorted.includes(0) && sorted.includes(6)) return 'Weekends';
	return sorted.map((d) => DAY_SHORT[d]).join(', ');
};

const formatDateTime = (iso?: string | null): string => {
	if (!iso) return '—';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleString(undefined, {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
};

const relativeFromNow = (iso?: string | null): string => {
	if (!iso) return 'no end';
	const ts = new Date(iso).getTime();
	if (Number.isNaN(ts)) return iso;
	const diff = ts - Date.now();
	const future = diff > 0;
	const abs = Math.abs(diff);
	const minutes = Math.round(abs / 60000);
	if (minutes < 1) return future ? 'in <1m' : 'just now';
	if (minutes < 60) return future ? `in ${minutes}m` : `${minutes}m ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return future ? `in ${hours}h` : `${hours}h ago`;
	const days = Math.round(hours / 24);
	return future ? `in ${days}d` : `${days}d ago`;
};

const StatusBadge = ({ status }: { status: MutePolicyStatus }) => {
	if (status === 'active') {
		return (
			<Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
				<CheckCircle2 className="h-3 w-3 mr-1" /> Active
			</Badge>
		);
	}
	if (status === 'scheduled') {
		return (
			<Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/20">
				<Hourglass className="h-3 w-3 mr-1" /> Scheduled
			</Badge>
		);
	}
	return (
		<Badge variant="outline" className="text-muted-foreground">
			<Clock className="h-3 w-3 mr-1" /> Expired
		</Badge>
	);
};

const StatCard = ({
	label,
	value,
	icon: Icon,
	tone,
}: {
	label: string;
	value: number;
	icon: React.ComponentType<{ className?: string }>;
	tone: 'emerald' | 'blue' | 'slate';
}) => {
	const toneClass =
		tone === 'emerald'
			? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
			: tone === 'blue'
				? 'text-blue-600 dark:text-blue-400 bg-blue-500/10'
				: 'text-slate-600 dark:text-slate-400 bg-slate-500/10';
	return (
		<Card>
			<CardContent className="p-4 flex items-center gap-4">
				<div className={`h-10 w-10 rounded-lg flex items-center justify-center ${toneClass}`}>
					<Icon className="h-5 w-5" />
				</div>
				<div>
					<p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
					<p className="text-2xl font-semibold leading-tight">{value}</p>
				</div>
			</CardContent>
		</Card>
	);
};

const MutePolicies: React.FC = () => {
	const { data: mutePolicies = [], isLoading } = useMutePolicies();
	const deleteMutation = useDeleteMutePolicy();
	const { toast } = useToast();

	const [search, setSearch] = useState('');
	const [editing, setEditing] = useState<MutePolicy | null>(null);
	const [creating, setCreating] = useState(false);
	const [deleting, setDeleting] = useState<MutePolicy | null>(null);

	const stats = useMemo(() => {
		const active = mutePolicies.filter((s) => getStatus(s) === 'active').length;
		const scheduled = mutePolicies.filter((s) => getStatus(s) === 'scheduled').length;
		const expired = mutePolicies.filter((s) => getStatus(s) === 'expired').length;
		return { active, scheduled, expired };
	}, [mutePolicies]);

	const filtered = useMemo(() => {
		if (!search.trim()) return mutePolicies;
		const q = search.toLowerCase();
		return mutePolicies.filter((s) => {
			if (s.name.toLowerCase().includes(q)) return true;
			if (s.nameContains?.toLowerCase().includes(q)) return true;
			if (s.reason?.toLowerCase().includes(q)) return true;
			return s.labelMatchers?.some((m) => m.key.toLowerCase().includes(q) || m.value.toLowerCase().includes(q));
		});
	}, [mutePolicies, search]);

	const handleDelete = async () => {
		if (!deleting) return;
		try {
			await deleteMutation.mutateAsync(deleting.id);
			toast({ title: 'Mute policy deleted', description: deleting.name });
			setDeleting(null);
		} catch (err) {
			toast({
				title: 'Failed to delete mute policy',
				description: err instanceof Error ? err.message : 'Unknown error',
				variant: 'destructive',
			});
		}
	};

	return (
		<DashboardLayout>
			<div className="container max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
				<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
					<div>
						<div className="flex items-center gap-2">
							<BellOff className="h-6 w-6 text-muted-foreground" />
							<h1 className="text-2xl font-semibold tracking-tight">Mute Policies</h1>
						</div>
						<p className="text-sm text-muted-foreground mt-1">
							Suppress alerts during maintenance windows or known issues. Muted alerts are hidden from the
							alerts list while the mute policy is active.
						</p>
					</div>
					<Button onClick={() => setCreating(true)}>
						<Plus className="h-4 w-4 mr-1" /> New mute policy
					</Button>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<StatCard label="Active" value={stats.active} icon={CheckCircle2} tone="emerald" />
					<StatCard label="Scheduled" value={stats.scheduled} icon={Hourglass} tone="blue" />
					<StatCard label="Expired" value={stats.expired} icon={Clock} tone="slate" />
				</div>

				<Card>
					<CardContent className="p-0">
						<div className="flex items-center gap-2 p-4 border-b">
							<div className="relative flex-1 max-w-md">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									className="pl-9"
									placeholder="Search by name, label, or reason"
									value={search}
									onChange={(e) => setSearch(e.target.value)}
								/>
							</div>
							<div className="ml-auto text-xs text-muted-foreground">
								{filtered.length} of {mutePolicies.length}
							</div>
						</div>

						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Match</TableHead>
									<TableHead>Window</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{isLoading ? (
									<TableRow>
										<TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
											Loading mute policies…
										</TableCell>
									</TableRow>
								) : filtered.length === 0 ? (
									<TableRow>
										<TableCell colSpan={5} className="py-12">
											<div className="flex flex-col items-center gap-2 text-center">
												<div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
													<BellOff className="h-6 w-6 text-muted-foreground" />
												</div>
												<p className="font-medium">
													{mutePolicies.length === 0
														? 'No mute policies yet'
														: 'No mute policies match your search'}
												</p>
												<p className="text-sm text-muted-foreground max-w-sm">
													{mutePolicies.length === 0
														? 'Create a mute policy to suppress alerts during maintenance or known incidents.'
														: 'Try a different search term.'}
												</p>
												{mutePolicies.length === 0 && (
													<Button
														className="mt-2"
														onClick={() => setCreating(true)}
														size="sm"
													>
														<Plus className="h-4 w-4 mr-1" /> New mute policy
													</Button>
												)}
											</div>
										</TableCell>
									</TableRow>
								) : (
									filtered.map((s) => {
										const status = getStatus(s);
										return (
											<TableRow key={s.id} className="align-top">
												<TableCell className="max-w-[260px]">
													<div className="font-medium truncate">{s.name}</div>
													{s.reason && (
														<div className="text-xs text-muted-foreground line-clamp-2">
															{s.reason}
														</div>
													)}
												</TableCell>
												<TableCell>
													<StatusBadge status={status} />
												</TableCell>
												<TableCell className="max-w-[260px]">
													<div className="flex flex-wrap gap-1.5">
														{s.nameContains && (
															<Badge variant="secondary" className="font-mono text-xs">
																name ~ "{s.nameContains}"
															</Badge>
														)}
														{(s.labelMatchers ?? []).map((m, idx) => (
															<Badge
																key={idx}
																variant="outline"
																className="font-mono text-xs"
															>
																{m.key}={m.value}
															</Badge>
														))}
														{!s.nameContains && (s.labelMatchers ?? []).length === 0 && (
															<span className="text-xs text-muted-foreground italic">
																no matchers
															</span>
														)}
													</div>
												</TableCell>
												<TableCell className="whitespace-nowrap">
													{s.schedule ? (
														<>
															<div className="text-xs flex items-center gap-1.5 text-muted-foreground">
																<Repeat className="h-3 w-3" />
																{formatDaysOfWeek(s.schedule.daysOfWeek)} ·{' '}
																{s.schedule.startTime}–{s.schedule.endTime}
															</div>
															<div className="text-xs mt-0.5">
																{status === 'active' ? (
																	<span className="text-emerald-600 dark:text-emerald-400">
																		in window now
																	</span>
																) : (
																	<span className="text-blue-600 dark:text-blue-400">
																		next on schedule
																	</span>
																)}
															</div>
														</>
													) : (
														<>
															<div className="text-xs flex items-center gap-1.5 text-muted-foreground">
																<Calendar className="h-3 w-3" />
																{formatDateTime(s.startsAt) || 'now'} →{' '}
																{formatDateTime(s.endsAt)}
															</div>
															<div className="text-xs mt-0.5">
																{status === 'active' && s.endsAt && (
																	<span className="text-emerald-600 dark:text-emerald-400">
																		ends {relativeFromNow(s.endsAt)}
																	</span>
																)}
																{status === 'active' && !s.endsAt && (
																	<span className="text-emerald-600 dark:text-emerald-400">
																		indefinite
																	</span>
																)}
																{status === 'scheduled' && (
																	<span className="text-blue-600 dark:text-blue-400">
																		starts {relativeFromNow(s.startsAt)}
																	</span>
																)}
																{status === 'expired' && (
																	<span className="text-muted-foreground">
																		ended {relativeFromNow(s.endsAt)}
																	</span>
																)}
															</div>
														</>
													)}
												</TableCell>
												<TableCell className="text-right">
													<div className="flex items-center justify-end gap-1">
														<Button
															variant="ghost"
															size="icon"
															className="h-8 w-8"
															onClick={() => setEditing(s)}
															aria-label="Edit mute policy"
														>
															<Pencil className="h-4 w-4" />
														</Button>
														<Button
															variant="ghost"
															size="icon"
															className="h-8 w-8 text-destructive hover:text-destructive"
															onClick={() => setDeleting(s)}
															aria-label="Delete mute policy"
														>
															<Trash2 className="h-4 w-4" />
														</Button>
													</div>
												</TableCell>
											</TableRow>
										);
									})
								)}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			</div>

			<MutePolicyFormDialog open={creating} onOpenChange={setCreating} />
			<MutePolicyFormDialog
				open={!!editing}
				onOpenChange={(open) => {
					if (!open) setEditing(null);
				}}
				mutePolicy={editing}
			/>

			<AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete mute policy?</AlertDialogTitle>
						<AlertDialogDescription>
							This will remove "{deleting?.name}" and any muted alerts will become visible again
							immediately. This cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={(e) => {
								e.preventDefault();
								handleDelete();
							}}
							disabled={deleteMutation.isPending}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{deleteMutation.isPending ? 'Deleting…' : 'Delete'}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</DashboardLayout>
	);
};

export default MutePolicies;
