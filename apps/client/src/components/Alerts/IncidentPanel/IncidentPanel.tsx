import { SeverityBadge } from '@/components/Alerts/SeverityBadge';
import { StatusBadge } from '@/components/Alerts/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { queryKeys } from '@/hooks/queries/queryKeys';
import { alertsApi } from '@/lib/api';
import { formatLongDateTime } from '@/lib/datetime';
import { Alert, AlertHistory, AlertHistoryData, IncidentSummary } from '@OpsiMate/shared';
import { useQueries } from '@tanstack/react-query';
import { Folder, History, Pencil, Ungroup, X } from 'lucide-react';
import { AlertHistoryTimeline } from '../AlertDetails/AlertHistoryTimeline';
import { CollapsibleSection } from '../AlertDetails/CollapsibleSection';

interface IncidentPanelProps {
	incident: IncidentSummary;
	// Loaded alerts (active + resolved as far as the current view fetched them), for
	// resolving member rows to real alert objects.
	alertsById: Map<string, Alert>;
	onClose: () => void;
	// Clicking a member switches the panel to that alert's details.
	onOpenAlert: (alert: Alert) => void;
	onEdit: (incidentId: number) => void;
	onUngroup: (incidentId: number) => void;
}

// The merged history of every member, one timeline, newest first. Merged and sorted
// inline on each render — a handful of member histories is a few hundred entries at
// worst, far below memoization territory (and useQueries hands back fresh array
// identities every render anyway, which defeats naive deps).
const useMergedIncidentHistory = (alertIds: string[]): AlertHistoryData[] => {
	const results = useQueries({
		queries: alertIds.map((alertId) => ({
			queryKey: queryKeys.alertHistory(alertId),
			queryFn: async (): Promise<AlertHistory | null> => {
				const response = await alertsApi.getAlertHistory(alertId);
				if (!response.success) throw new Error(response.error || 'Failed to fetch history');
				return response.data ?? null;
			},
		})),
	});
	const merged: AlertHistoryData[] = [];
	for (const result of results) {
		if (result.data) merged.push(...result.data.data);
	}
	return merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

// Right-side details panel for an incident: identity, roll-ups, the member list (each
// clickable through to its alert details), and the merged history of all members.
export const IncidentPanel = ({
	incident,
	alertsById,
	onClose,
	onOpenAlert,
	onEdit,
	onUngroup,
}: IncidentPanelProps) => {
	const members = incident.alertIds
		.map((id) => alertsById.get(id))
		.filter((alert): alert is Alert => alert !== undefined);
	const unloadedCount = incident.alertIds.length - members.length;
	const mergedHistory = useMergedIncidentHistory(incident.alertIds);

	return (
		<div className="relative shrink-0 border-l bg-background flex flex-col h-full overflow-hidden w-[400px]">
			<div className="px-4 py-3 shrink-0 flex items-center justify-between border-b">
				<h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
					<Folder className="h-4 w-4 text-primary" />
					Incident
				</h2>
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8"
					onClick={onClose}
					aria-label="Close incident panel"
				>
					<X className="h-4 w-4" />
				</Button>
			</div>

			<div className="flex-1 overflow-y-auto p-4 space-y-4">
				<div>
					<div className="flex items-start justify-between gap-2">
						<h3 className="text-base font-semibold text-foreground break-words">{incident.name}</h3>
						<Button
							variant="ghost"
							size="icon"
							className="h-7 w-7 shrink-0"
							onClick={() => onEdit(incident.id)}
							aria-label="Edit incident"
						>
							<Pencil className="h-3.5 w-3.5" />
						</Button>
					</div>
					{incident.description && (
						<p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{incident.description}</p>
					)}
				</div>

				<div className="flex flex-wrap items-center gap-2">
					{incident.worstSeverity && <SeverityBadge severity={incident.worstSeverity} />}
					{incident.firingCount > 0 && (
						<Badge variant="destructive" className="h-5 px-1.5 text-xs">
							{incident.firingCount} firing
						</Badge>
					)}
					{incident.resolvedCount > 0 && (
						<Badge variant="success" className="h-5 px-1.5 text-xs">
							{incident.resolvedCount} resolved
						</Badge>
					)}
				</div>

				<div className="text-xs text-muted-foreground space-y-0.5">
					{incident.earliestStartsAt && <div>Started: {formatLongDateTime(incident.earliestStartsAt)}</div>}
					{incident.latestUpdatedAt && <div>Last update: {formatLongDateTime(incident.latestUpdatedAt)}</div>}
				</div>

				<CollapsibleSection title="Alerts" badge={incident.alertIds.length} defaultOpen>
					<div className="space-y-1">
						{members.map((alert) => (
							<button
								key={alert.id}
								type="button"
								onClick={() => onOpenAlert(alert)}
								className="w-full flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-left hover:bg-muted/60 transition-colors"
							>
								<StatusBadge alert={alert} />
								<span className="text-sm text-foreground truncate flex-1">{alert.alertName}</span>
								<SeverityBadge severity={alert.severity} />
							</button>
						))}
						{unloadedCount > 0 && (
							<div className="text-xs text-muted-foreground px-1 py-1">
								{unloadedCount} more member{unloadedCount === 1 ? '' : 's'} not loaded in this view
								(check the All tab)
							</div>
						)}
					</div>
				</CollapsibleSection>

				<CollapsibleSection
					title="History"
					icon={<History className="h-3.5 w-3.5" />}
					badge={mergedHistory.length}
					defaultOpen={false}
				>
					<AlertHistoryTimeline data={mergedHistory} />
				</CollapsibleSection>
			</div>

			<div className="p-3 border-t shrink-0">
				<Button
					variant="outline"
					className="w-full gap-1.5 text-destructive hover:text-destructive"
					onClick={() => onUngroup(incident.id)}
				>
					<Ungroup className="h-3.5 w-3.5" />
					Ungroup (keep alerts)
				</Button>
			</div>
		</div>
	);
};
