import { SeverityBadge } from '@/components/Alerts/SeverityBadge';
import { Badge } from '@/components/ui/badge';
import { formatShortDateTime } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IncidentSummary } from '@OpsiMate/shared';
import { ChevronDown, ChevronRight, FolderOpen, Folder, MoreVertical, Pencil, Ungroup } from 'lucide-react';

interface IncidentRowProps {
	incident: IncidentSummary;
	// Members passing the current filters/search/time window (what expanding shows).
	shownCount: number;
	isExpanded: boolean;
	onToggle: (incidentId: number) => void;
	// Opens the incident details panel (separate from expand/collapse).
	onOpen?: (incidentId: number) => void;
	// Rename/edit-details dialog.
	onEdit?: (incidentId: number) => void;
	// Deletes the incident, leaving its alerts untouched.
	onUngroup?: (incidentId: number) => void;
	isActive?: boolean;
}

// The folder row an incident renders as in the alerts table. The row body toggles
// expansion — the same gesture as group headers — and the name opens the incident
// panel. Roll-ups show worst severity and the firing/resolved split so a CLOSED
// folder still tells the story.
export const IncidentRow = ({
	incident,
	shownCount,
	isExpanded,
	onToggle,
	onOpen,
	onEdit,
	onUngroup,
	isActive,
}: IncidentRowProps) => {
	const partial = shownCount < incident.alertCount;
	return (
		<div
			className={cn(
				'flex items-center gap-2 h-9 border-b border-border bg-primary/[0.04] hover:bg-primary/[0.08] px-2 cursor-pointer select-none',
				isActive && 'bg-primary/10 shadow-[inset_3px_0_0_0] shadow-primary'
			)}
			onClick={() => onToggle(incident.id)}
			role="row"
		>
			{/* A real button, not just the clickable row: keyboard users need a focusable
			    toggle, and aria-expanded belongs on the control that toggles. */}
			<button
				type="button"
				aria-expanded={isExpanded}
				aria-label={isExpanded ? 'Collapse incident' : 'Expand incident'}
				className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
				onClick={(e) => {
					e.stopPropagation();
					onToggle(incident.id);
				}}
			>
				{isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
			</button>
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
			{(onEdit || onUngroup) && (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							aria-label="Incident actions"
							className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
							onClick={(e) => e.stopPropagation()}
						>
							<MoreVertical className="h-3.5 w-3.5" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						{onEdit && (
							<DropdownMenuItem
								onClick={(e) => {
									e.stopPropagation();
									onEdit(incident.id);
								}}
							>
								<Pencil className="mr-2 h-3 w-3" />
								Rename / edit details
							</DropdownMenuItem>
						)}
						{onEdit && onUngroup && <DropdownMenuSeparator />}
						{onUngroup && (
							<DropdownMenuItem
								className="text-destructive focus:text-destructive"
								onClick={(e) => {
									e.stopPropagation();
									onUngroup(incident.id);
								}}
							>
								<Ungroup className="mr-2 h-3 w-3" />
								Ungroup (keep alerts)
							</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</div>
	);
};
