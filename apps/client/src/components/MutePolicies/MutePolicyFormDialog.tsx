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
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cleanMatcherGroups, MatcherGroupsEditor } from '@/components/shared/MatcherGroupsEditor';
import { useAlerts } from '@/hooks/queries/alerts';
import { useAlertTagKeys } from '@/components/Alerts/hooks';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useCreateMutePolicy, useUpdateMutePolicy } from '@/hooks/queries/mute-policies';
import { MutePolicyPayload } from '@/lib/api';
import { MutePolicy } from '@OpsiMate/shared';
import { BellOff, Tag } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type Matcher = { key: string; value: string };
type MutePolicyMode = 'one-time' | 'recurring';

const DAY_CHIPS: { label: string; value: number }[] = [
	{ label: 'Sun', value: 0 },
	{ label: 'Mon', value: 1 },
	{ label: 'Tue', value: 2 },
	{ label: 'Wed', value: 3 },
	{ label: 'Thu', value: 4 },
	{ label: 'Fri', value: 5 },
	{ label: 'Sat', value: 6 },
];

interface MutePolicyFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mutePolicy?: MutePolicy | null;
}

const toLocalInputValue = (iso?: string | null): string => {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fromLocalInputValue = (local: string): string | null => {
	if (!local) return null;
	const d = new Date(local);
	if (Number.isNaN(d.getTime())) return null;
	return d.toISOString();
};

const PRESETS: { label: string; minutes: number }[] = [
	{ label: '1h', minutes: 60 },
	{ label: '4h', minutes: 240 },
	{ label: '24h', minutes: 1440 },
	{ label: '7d', minutes: 10080 },
];

export const MutePolicyFormDialog = ({ open, onOpenChange, mutePolicy }: MutePolicyFormDialogProps) => {
	const isEdit = !!mutePolicy;
	const { toast } = useToast();
	const createMutation = useCreateMutePolicy();
	const updateMutation = useUpdateMutePolicy();

	const [name, setName] = useState('');
	const [nameContains, setNameContains] = useState('');
	const [matcherGroups, setMatcherGroups] = useState<Matcher[][]>([]);
	const [matchAll, setMatchAll] = useState(false);
	const { data: alerts = [] } = useAlerts();
	const matcherSuggestions = useAlertTagKeys(alerts);
	const [reason, setReason] = useState('');
	const [mode, setMode] = useState<MutePolicyMode>('one-time');
	const [hasStart, setHasStart] = useState(false);
	const [hasEnd, setHasEnd] = useState(true);
	const [startsAt, setStartsAt] = useState('');
	const [endsAt, setEndsAt] = useState('');
	const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
	const [recurStartTime, setRecurStartTime] = useState('09:00');
	const [recurEndTime, setRecurEndTime] = useState('17:00');

	useEffect(() => {
		if (!open) return;
		if (mutePolicy) {
			setName(mutePolicy.name);
			setNameContains(mutePolicy.nameContains ?? '');
			setMatcherGroups(
				mutePolicy.labelMatcherGroups?.length
					? mutePolicy.labelMatcherGroups.map((g) => g.map((m) => ({ ...m })))
					: (mutePolicy.labelMatchers ?? []).length
						? [(mutePolicy.labelMatchers ?? []).map((m) => ({ ...m }))]
						: []
			);
			setMatchAll(!!mutePolicy.matchAll);
			setReason(mutePolicy.reason ?? '');
			if (mutePolicy.schedule) {
				setMode('recurring');
				setDaysOfWeek([...mutePolicy.schedule.daysOfWeek].sort((a, b) => a - b));
				setRecurStartTime(mutePolicy.schedule.startTime);
				setRecurEndTime(mutePolicy.schedule.endTime);
				setHasStart(false);
				setStartsAt('');
				setHasEnd(true);
				setEndsAt('');
			} else {
				setMode('one-time');
				setHasStart(!!mutePolicy.startsAt);
				setStartsAt(toLocalInputValue(mutePolicy.startsAt));
				setHasEnd(!!mutePolicy.endsAt);
				setEndsAt(toLocalInputValue(mutePolicy.endsAt));
				setDaysOfWeek([]);
				setRecurStartTime('09:00');
				setRecurEndTime('17:00');
			}
		} else {
			setName('');
			setNameContains('');
			setMatcherGroups([]);
			setMatchAll(false);
			setReason('');
			setMode('one-time');
			setHasStart(false);
			setStartsAt('');
			setHasEnd(true);
			const inFourHours = new Date(Date.now() + 4 * 60 * 60 * 1000);
			setEndsAt(toLocalInputValue(inFourHours.toISOString()));
			setDaysOfWeek([]);
			setRecurStartTime('09:00');
			setRecurEndTime('17:00');
		}
	}, [open, mutePolicy]);

	const toggleDay = (day: number) => {
		setDaysOfWeek((prev) =>
			prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
		);
	};

	const isValid = useMemo(() => {
		if (!name.trim()) return false;
		const hasNameMatcher = nameContains.trim().length > 0;
		const hasLabelMatchers = matcherGroups.some((g) => g.some((m) => m.key.trim() && m.value.trim()));
		if (!matchAll && !hasNameMatcher && !hasLabelMatchers) return false;
		if (mode === 'recurring') {
			if (daysOfWeek.length === 0) return false;
			if (!recurStartTime || !recurEndTime) return false;
			if (recurEndTime <= recurStartTime) return false;
			return true;
		}
		if (hasStart && hasEnd && startsAt && endsAt) {
			if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) return false;
		}
		return true;
	}, [
		name,
		nameContains,
		matcherGroups,
		matchAll,
		mode,
		hasStart,
		hasEnd,
		startsAt,
		endsAt,
		daysOfWeek,
		recurStartTime,
		recurEndTime,
	]);

	const applyPreset = (minutes: number) => {
		const start = new Date();
		const end = new Date(start.getTime() + minutes * 60 * 1000);
		setHasEnd(true);
		setEndsAt(toLocalInputValue(end.toISOString()));
		if (hasStart) {
			setStartsAt(toLocalInputValue(start.toISOString()));
		}
	};

	const submit = async () => {
		const cleanedGroups = matchAll ? [] : cleanMatcherGroups(matcherGroups);

		const payload: MutePolicyPayload =
			mode === 'recurring'
				? {
						name: name.trim(),
						nameContains: matchAll ? null : nameContains.trim() || null,
						labelMatchers: cleanedGroups[0] ?? [],
						labelMatcherGroups: cleanedGroups,
						matchAll,
						startsAt: null,
						endsAt: null,
						schedule: {
							daysOfWeek: [...daysOfWeek].sort((a, b) => a - b),
							startTime: recurStartTime,
							endTime: recurEndTime,
						},
						reason: reason.trim() || null,
					}
				: {
						name: name.trim(),
						nameContains: matchAll ? null : nameContains.trim() || null,
						labelMatchers: cleanedGroups[0] ?? [],
						labelMatcherGroups: cleanedGroups,
						matchAll,
						startsAt: hasStart ? fromLocalInputValue(startsAt) : null,
						endsAt: hasEnd ? fromLocalInputValue(endsAt) : null,
						schedule: null,
						reason: reason.trim() || null,
					};

		try {
			if (isEdit && mutePolicy) {
				await updateMutation.mutateAsync({ id: mutePolicy.id, payload });
				toast({ title: 'Mute policy updated', description: payload.name });
			} else {
				await createMutation.mutateAsync(payload);
				toast({ title: 'Mute policy created', description: payload.name });
			}
			onOpenChange(false);
		} catch (err) {
			toast({
				title: isEdit ? 'Failed to update mute policy' : 'Failed to create mute policy',
				description: err instanceof Error ? err.message : 'Unknown error',
				variant: 'destructive',
			});
		}
	};

	const isPending = createMutation.isPending || updateMutation.isPending;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<BellOff className="h-5 w-5 text-muted-foreground" />
						{isEdit ? 'Edit mute policy' : 'New mute policy'}
					</DialogTitle>
					<DialogDescription>
						Suppress alerts that match the criteria below for the selected window. Leave the end time unset
						for an indefinite mute policy.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-5 py-2">
					<div className="space-y-2">
						<Label htmlFor="mute-policy-name">Name</Label>
						<Input
							id="mute-policy-name"
							placeholder="e.g. Weekly DB maintenance"
							value={name}
							onChange={(e) => setName(e.target.value)}
						/>
					</div>

					<div className="rounded-lg border bg-muted/30 p-4 space-y-4">
						<div className="flex items-center gap-2">
							<Tag className="h-4 w-4 text-muted-foreground" />
							<h4 className="text-sm font-semibold">Match criteria</h4>
						</div>
						<p className="text-xs text-muted-foreground -mt-2">
							An alert is muted when its name matches and ANY matcher group matches (all matchers within a
							group must match). At least one criterion — or match-all — is required.
						</p>

						<label className="flex items-center gap-2 cursor-pointer">
							<Checkbox checked={matchAll} onCheckedChange={(v) => setMatchAll(v === true)} />
							<span className="text-xs font-medium">
								Apply to all alerts (ignore name and label criteria)
							</span>
						</label>

						<div className={matchAll ? 'space-y-2 opacity-50 pointer-events-none' : 'space-y-2'}>
							<Label htmlFor="mute-policy-nameContains" className="text-xs">
								Alert name contains
							</Label>
							<Input
								id="mute-policy-nameContains"
								placeholder="e.g. HighCPU, prod-db, latency"
								value={nameContains}
								disabled={matchAll}
								onChange={(e) => setNameContains(e.target.value)}
							/>
						</div>

						<MatcherGroupsEditor
							groups={matcherGroups}
							onChange={setMatcherGroups}
							disabled={matchAll}
							suggestions={matcherSuggestions}
						/>
					</div>

					<div className="rounded-lg border bg-muted/30 p-4 space-y-4">
						<div className="flex items-center justify-between">
							<h4 className="text-sm font-semibold">Time window</h4>
							<div className="inline-flex rounded-md border bg-background p-0.5">
								<button
									type="button"
									onClick={() => setMode('one-time')}
									className={`px-3 py-1 text-xs rounded ${
										mode === 'one-time'
											? 'bg-primary text-primary-foreground'
											: 'text-muted-foreground hover:text-foreground'
									}`}
								>
									One-time
								</button>
								<button
									type="button"
									onClick={() => setMode('recurring')}
									className={`px-3 py-1 text-xs rounded ${
										mode === 'recurring'
											? 'bg-primary text-primary-foreground'
											: 'text-muted-foreground hover:text-foreground'
									}`}
								>
									Recurring
								</button>
							</div>
						</div>

						{mode === 'one-time' ? (
							<>
								<div className="flex flex-wrap gap-2">
									{PRESETS.map((p) => (
										<Button
											key={p.label}
											type="button"
											variant="secondary"
											size="sm"
											onClick={() => applyPreset(p.minutes)}
										>
											{p.label}
										</Button>
									))}
									<Badge variant="outline" className="ml-auto">
										Times are local
									</Badge>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div className="space-y-2">
										<div className="flex items-center justify-between">
											<Label htmlFor="mute-policy-startsAt" className="text-xs">
												Starts at
											</Label>
											<div className="flex items-center gap-2">
												<span className="text-xs text-muted-foreground">Custom start</span>
												<Switch checked={hasStart} onCheckedChange={setHasStart} />
											</div>
										</div>
										<Input
											id="mute-policy-startsAt"
											type="datetime-local"
											value={startsAt}
											onChange={(e) => setStartsAt(e.target.value)}
											disabled={!hasStart}
										/>
										{!hasStart && (
											<p className="text-xs text-muted-foreground">Active immediately on save.</p>
										)}
									</div>

									<div className="space-y-2">
										<div className="flex items-center justify-between">
											<Label htmlFor="mute-policy-endsAt" className="text-xs">
												Ends at
											</Label>
											<div className="flex items-center gap-2">
												<span className="text-xs text-muted-foreground">Set end</span>
												<Switch checked={hasEnd} onCheckedChange={setHasEnd} />
											</div>
										</div>
										<Input
											id="mute-policy-endsAt"
											type="datetime-local"
											value={endsAt}
											onChange={(e) => setEndsAt(e.target.value)}
											disabled={!hasEnd}
										/>
										{!hasEnd && (
											<p className="text-xs text-muted-foreground">
												Indefinite — mute policy until removed.
											</p>
										)}
									</div>
								</div>
							</>
						) : (
							<>
								<div className="flex items-center justify-between">
									<Label className="text-xs">Days of week</Label>
									<Badge variant="outline">Server local time</Badge>
								</div>
								<div className="flex flex-wrap gap-1.5">
									{DAY_CHIPS.map((d) => {
										const selected = daysOfWeek.includes(d.value);
										return (
											<button
												key={d.value}
												type="button"
												onClick={() => toggleDay(d.value)}
												className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
													selected
														? 'bg-primary text-primary-foreground border-primary'
														: 'bg-background hover:bg-muted text-foreground border-input'
												}`}
											>
												{d.label}
											</button>
										);
									})}
								</div>
								{daysOfWeek.length === 0 && (
									<p className="text-xs text-muted-foreground">Pick at least one day.</p>
								)}

								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label htmlFor="mute-policy-recur-start" className="text-xs">
											Start time
										</Label>
										<Input
											id="mute-policy-recur-start"
											type="time"
											value={recurStartTime}
											onChange={(e) => setRecurStartTime(e.target.value)}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="mute-policy-recur-end" className="text-xs">
											End time
										</Label>
										<Input
											id="mute-policy-recur-end"
											type="time"
											value={recurEndTime}
											onChange={(e) => setRecurEndTime(e.target.value)}
										/>
										{recurEndTime && recurStartTime && recurEndTime <= recurStartTime && (
											<p className="text-xs text-destructive">
												End time must be after start time.
											</p>
										)}
									</div>
								</div>
								<p className="text-xs text-muted-foreground">
									Mute policy is active on the selected days between start and end time. For overnight
									windows, create two mute policies.
								</p>
							</>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="mute-policy-reason">Reason / notes</Label>
						<Textarea
							id="mute-policy-reason"
							placeholder="Optional context, ticket link, or comment for teammates."
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							rows={3}
						/>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
						Cancel
					</Button>
					<Button onClick={submit} disabled={!isValid || isPending}>
						{isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create mute policy'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
