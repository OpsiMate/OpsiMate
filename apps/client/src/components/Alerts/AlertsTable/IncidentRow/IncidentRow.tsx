import { IncidentRollups } from '@/components/Alerts/IncidentRollups';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { SELECT_COLUMN_WIDTH } from '../AlertsTable.constants';
import { formatShortDateTime } from '@/lib/datetime';
import { pluralize } from '@/lib/text';
import { cn } from '@/lib/utils';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IncidentSummary } from '@OpsiMate/shared';
import { ChevronDown, ChevronRight, FolderOpen, Folder, MoreVertical, Pencil, Ungroup, User } from 'lucide-react';

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
	// How many of the folded members are selected; undefined hides the checkbox (no selection on this table).
	selectionState?: 'none' | 'some' | 'all';
	// The folder checkbox: select every member, or unselect them all.
	onToggleSelection?: () => void;
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
	selectionState,
	onToggleSelection,
}: IncidentRowProps) => {
	const partial = shownCount < incident.alertCount;
	return (
		<div
			className={cn(
				'flex items-center gap-2 h-9 border-b border-border bg-primary/[0.04] hover:bg-primary/[0.08] pr-2 cursor-pointer select-none',
				// Without a checkbox cell the chevron takes the select column's padding.
				selectionState === undefined && 'pl-2',
				isActive && 'bg-primary/10 shadow-[inset_3px_0_0_0] shadow-primary'
			)}
			onClick={() => onToggle(incident.id)}
			role="row"
		>
			{selectionState !== undefined && (
				// Sits under the table's select column so the folder checkbox lines up with the
				// rows' checkboxes. Mixed state when only some members are selected.
				<div
					className="flex shrink-0 items-center justify-center"
					style={{ width: SELECT_COLUMN_WIDTH }}
					onClick={(e) => e.stopPropagation()}
				>
					<Checkbox
						checked={selectionState === 'all' ? true : selectionState === 'some' ? 'indeterminate' : false}
						onCheckedChange={() => onToggleSelection?.()}
						aria-label={selectionState === 'all' ? 'Unselect incident alerts' : 'Select incident alerts'}
						className="h-3 w-3 border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary"
					/>
				</div>
			)}
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
				{pluralize(incident.alertCount, 'alert')}
			</Badge>
			{incident.ownerName && (
				<span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0" title="Incident owner">
					<User className="h-3 w-3" />
					{incident.ownerName}
				</span>
			)}
			<IncidentRollups incident={incident} />
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
