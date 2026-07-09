import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import {
	useRetentionSettings,
	useRunRetention,
	useUpdateRetentionConfig,
	useUpdateRetentionPolicy,
} from '@/hooks/queries/retention/useRetention';
import { RetentionPolicy, RetentionResource } from '@OpsiMate/shared';
import { Loader2, Play, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

// Human-friendly labels + descriptions for each retention resource.
const RESOURCE_META: Record<RetentionResource, { title: string; description: string }> = {
	[RetentionResource.AuditLogs]: {
		title: 'Audit logs',
		description: 'Records of who changed what (providers, services, users, etc.).',
	},
	[RetentionResource.AlertHistoryEvents]: {
		title: 'Alert history events',
		description: 'Per-alert activity: ownership, dismissals, actions run, comments.',
	},
	[RetentionResource.AlertStatusHistory]: {
		title: 'Alert status history',
		description: 'Firing/resolved status transitions recorded for alerts.',
	},
	[RetentionResource.ActiveAlerts]: {
		title: 'Active alerts',
		description: 'Open alerts not updated for this long (clears stale alerts that never resolved).',
	},
	[RetentionResource.ResolvedAlerts]: {
		title: 'Resolved alerts',
		description: 'Resolved/resolved alerts kept for historical reference.',
	},
	[RetentionResource.AlertComments]: {
		title: 'Alert comments',
		description: 'Comments left on alerts by users.',
	},
};

const RESOURCE_ORDER: RetentionResource[] = [
	RetentionResource.ActiveAlerts,
	RetentionResource.ResolvedAlerts,
	RetentionResource.AlertStatusHistory,
	RetentionResource.AlertHistoryEvents,
	RetentionResource.AlertComments,
	RetentionResource.AuditLogs,
];

const PolicyRow = ({ policy }: { policy: RetentionPolicy }) => {
	const meta = RESOURCE_META[policy.resourceType];
	const { mutate: updatePolicy, isPending } = useUpdateRetentionPolicy();
	const { toast } = useToast();
	const [days, setDays] = useState(String(policy.retentionDays));

	// Keep the local input in sync if the server value changes elsewhere.
	useEffect(() => {
		setDays(String(policy.retentionDays));
	}, [policy.retentionDays]);

	const commitDays = () => {
		const parsed = parseInt(days, 10);
		if (!Number.isFinite(parsed) || parsed < 1 || parsed > 3650) {
			toast({ title: 'Invalid value', description: 'Days must be between 1 and 3650', variant: 'destructive' });
			setDays(String(policy.retentionDays));
			return;
		}
		if (parsed === policy.retentionDays) return;
		updatePolicy(
			{ resourceType: policy.resourceType, updates: { retentionDays: parsed } },
			{
				onError: (e) => {
					setDays(String(policy.retentionDays));
					toast({
						title: 'Failed to save',
						description: (e as Error).message,
						variant: 'destructive',
					});
				},
			}
		);
	};

	const toggleEnabled = (enabled: boolean) => {
		updatePolicy({ resourceType: policy.resourceType, updates: { enabled } });
	};

	return (
		<Card className="p-4 flex items-center justify-between gap-4">
			<div className="min-w-0">
				<div className="font-medium text-foreground">{meta.title}</div>
				<div className="text-sm text-muted-foreground">{meta.description}</div>
			</div>
			<div className="flex items-center gap-4 flex-shrink-0">
				<div className="flex items-center gap-2">
					<span className="text-sm text-muted-foreground">Delete after</span>
					<Input
						type="number"
						min={1}
						max={3650}
						value={days}
						disabled={!policy.enabled || isPending}
						onChange={(e) => setDays(e.target.value)}
						onBlur={commitDays}
						onKeyDown={(e) => {
							if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
						}}
						className="w-20 h-8 text-sm"
					/>
					<span className="text-sm text-muted-foreground">days</span>
				</div>
				<Switch
					checked={policy.enabled}
					disabled={isPending}
					onCheckedChange={toggleEnabled}
					aria-label={`Enable retention for ${meta.title}`}
				/>
			</div>
		</Card>
	);
};

export const RetentionSettings = () => {
	const { data, isLoading, error } = useRetentionSettings();
	const { mutate: updateConfig, isPending: savingConfig } = useUpdateRetentionConfig();
	const { mutate: runNow, isPending: running } = useRunRetention();
	const { toast } = useToast();
	const [intervalHours, setIntervalHours] = useState('');

	useEffect(() => {
		if (data?.config) setIntervalHours(String(data.config.cleanupIntervalHours));
	}, [data?.config]);

	if (isLoading) {
		return (
			<div className="flex items-center gap-2 text-muted-foreground">
				<Loader2 className="h-4 w-4 animate-spin" /> Loading retention settings…
			</div>
		);
	}
	if (error || !data) {
		return <div className="text-destructive">Failed to load retention settings.</div>;
	}

	const commitInterval = () => {
		const parsed = parseInt(intervalHours, 10);
		if (!Number.isFinite(parsed) || parsed < 1 || parsed > 720) {
			toast({ title: 'Invalid value', description: 'Interval must be 1–720 hours', variant: 'destructive' });
			setIntervalHours(String(data.config.cleanupIntervalHours));
			return;
		}
		if (parsed === data.config.cleanupIntervalHours) return;
		updateConfig(
			{ cleanupIntervalHours: parsed },
			{
				onSuccess: () => toast({ title: 'Saved', description: 'Cleanup interval updated' }),
				onError: (e) => {
					setIntervalHours(String(data.config.cleanupIntervalHours));
					toast({
						title: 'Failed to save',
						description: (e as Error).message,
						variant: 'destructive',
					});
				},
			}
		);
	};

	const toggleVacuum = (vacuumAfterCleanup: boolean) => {
		updateConfig({ vacuumAfterCleanup });
	};

	const handleRunNow = () => {
		runNow(undefined, {
			onSuccess: (result) => {
				const total = Object.values(result.deleted).reduce((a, b) => a + (b ?? 0), 0);
				toast({
					title: 'Cleanup complete',
					description:
						total > 0
							? `Deleted ${total} row(s).${result.vacuumed ? ' Disk space reclaimed.' : ''}`
							: 'Nothing to delete.',
				});
			},
			onError: (e) =>
				toast({ title: 'Cleanup failed', description: (e as Error).message, variant: 'destructive' }),
		});
	};

	const policiesByOrder = RESOURCE_ORDER.map((rt) => data.policies.find((p) => p.resourceType === rt)).filter(
		(p): p is RetentionPolicy => !!p
	);

	const lastRun = data.config.lastRunAt ? new Date(data.config.lastRunAt).toLocaleString() : 'never';

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-2xl font-semibold text-foreground">Data Retention</h2>
				<p className="text-muted-foreground">
					Automatically delete old data to keep the database small. Each category is{' '}
					<strong>off by default</strong> — enable it and set how long to keep data.
				</p>
			</div>

			{/* Schedule + run-now */}
			<Card className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div className="flex items-center gap-2">
					<span className="text-sm text-foreground">Cleanup runs every</span>
					<Input
						type="number"
						min={1}
						max={720}
						value={intervalHours}
						disabled={savingConfig}
						onChange={(e) => setIntervalHours(e.target.value)}
						onBlur={commitInterval}
						onKeyDown={(e) => {
							if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
						}}
						className="w-20 h-8 text-sm"
					/>
					<span className="text-sm text-foreground">hours</span>
					<span className="text-sm text-muted-foreground ml-2">· last run: {lastRun}</span>
				</div>
				<Button onClick={handleRunNow} disabled={running} variant="outline" className="gap-2">
					{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
					Run cleanup now
				</Button>
			</Card>

			{/* Reclaim disk (VACUUM) toggle */}
			<Card className="p-4 flex items-center justify-between gap-4">
				<div className="min-w-0">
					<div className="font-medium text-foreground">Reclaim disk space after cleanup</div>
					<div className="text-sm text-muted-foreground">
						Runs <code>VACUUM</code> to shrink the database file. Without it, deleting rows frees space
						inside the file for reuse but the file never gets smaller on disk.
					</div>
				</div>
				<Switch
					checked={data.config.vacuumAfterCleanup}
					disabled={savingConfig}
					onCheckedChange={toggleVacuum}
					aria-label="Reclaim disk space after cleanup"
				/>
			</Card>

			<div className="space-y-3">
				{policiesByOrder.map((policy) => (
					<PolicyRow key={policy.resourceType} policy={policy} />
				))}
			</div>

			<div className="flex items-start gap-2 text-xs text-muted-foreground">
				<Trash2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
				<p>
					Deletions are permanent. The scheduled job runs in the background worker; “Run cleanup now” triggers
					it immediately for all enabled categories.
				</p>
			</div>
		</div>
	);
};
