import { SeverityBadge } from '@/components/Alerts/SeverityBadge';
import { Badge } from '@/components/ui/badge';
import { formatShortDateTime } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import { IncidentSummary } from '@OpsiMate/shared';
import { ChevronDown, ChevronRight, FolderOpen, Folder } from 'lucide-react';

interface IncidentRowProps {
	incident: IncidentSummary;
	// Members passing the current filters/search/time window (what expanding shows).
	shownCount: number;
	isExpanded: boolean;
	onToggle: (incidentId: number) => void;
	// Opens the incident details panel (separate from expand/collapse).
	onOpen?: (incidentId: number) => void;
	isActive?: boolean;
}

// The folder row an incident renders as in the alerts table. The row body toggles
// expansion — the same gesture as group headers — and the name opens the incident
// panel. Roll-ups show worst severity and the firing/resolved split so a CLOSED
// folder still tells the story.
export const IncidentRow = ({ incident, shownCount, isExpanded, onToggle, onOpen, isActive }: IncidentRowProps) => {
	const partial = shownCount < incident.alertCount;
	return (
		<div
			className={cn(
				'flex items-center gap-2 h-9 border-b border-border bg-primary/[0.04] hover:bg-primary/[0.08] px-2 cursor-pointer select-none',
				isActive && 'bg-primary/10 shadow-[inset_3px_0_0_0] shadow-primary'
			)}
			onClick={() => onToggle(incident.id)}
			role="row"
			aria-expanded={isExpanded}
		>
			{isExpanded ? (
				<ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
			) : (
				<ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
			)}
			{isExpanded ? (
				<FolderOpen className="h-4 w-4 shrink-0 text-primary" />
			) : (
				<Folder className="h-4 w-4 shrink-0 text-primary" />
			)}
			<button
				type="button"
				className="text-sm font-semibold text-foreground truncate hover:underline"
				onClick={(e) => {
					e.stopPropagation();
					onOpen?.(incident.id);
				}}
				title={incident.description || incident.name}
			>
				{incident.name}
			</button>
			<Badge variant="outline" className="h-5 px-1.5 text-xs shrink-0">
				{partial ? `${shownCount} of ${incident.alertCount}` : incident.alertCount}{' '}
				{incident.alertCount === 1 ? 'alert' : 'alerts'}
			</Badge>
			{incident.worstSeverity && <SeverityBadge severity={incident.worstSeverity} />}
			{incident.firingCount > 0 ? (
				<Badge variant="destructive" className="h-5 px-1.5 text-xs shrink-0">
					{incident.firingCount} firing
				</Badge>
			) : (
				<Badge variant="success" className="h-5 px-1.5 text-xs shrink-0">
					resolved
				</Badge>
			)}
			{incident.resolvedCount > 0 && incident.firingCount > 0 && (
				<span className="text-xs text-muted-foreground shrink-0">{incident.resolvedCount} resolved</span>
			)}
			<span className="ml-auto text-xs text-muted-foreground shrink-0">
				{incident.latestUpdatedAt ? formatShortDateTime(incident.latestUpdatedAt, '') : ''}
			</span>
		</div>
	);
};
