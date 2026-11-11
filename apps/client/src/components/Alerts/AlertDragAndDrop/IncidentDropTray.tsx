import { pluralize } from '@/lib/text';
import { Alert, IncidentSummary } from '@OpsiMate/shared';
import { FolderInput, FolderMinus, FolderPlus } from 'lucide-react';
import { DropChip } from './DropChip';
import { dropId } from './dropTargets';

interface IncidentDropTrayProps {
	dragging: Alert[];
	incidents: IncidentSummary[];
}

// Slides in at the bottom while alerts are dragged: one chip per incident that can take
// them, "New incident", and "Remove from incident" when members are being dragged.
// Folders sit at the bottom of the table and are often scrolled out of view, so the
// tray gives every drag a target without scrolling.
export const IncidentDropTray = ({ dragging, incidents }: IncidentDropTrayProps) => {
	const candidates = incidents.filter((incident) => dragging.some((alert) => alert.incidentId !== incident.id));
	const hasMembers = dragging.some((alert) => alert.incidentId != null);
	return (
		<div
			role="toolbar"
			aria-label="Drop targets"
			data-selection-scope
			className="fixed bottom-6 left-1/2 z-50 flex max-w-[90vw] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-lg border border-border bg-background/95 p-2 shadow-xl backdrop-blur"
		>
			<DropChip id={dropId.trayNew} icon={<FolderPlus className="h-3.5 w-3.5" />} label="New incident" />
			{candidates.map((incident) => (
				<DropChip
					key={incident.id}
					id={dropId.trayIncident(incident.id)}
					icon={<FolderInput className="h-3.5 w-3.5" />}
					label={incident.name}
					hint={`${incident.alertCount} ${pluralize(incident.alertCount, 'alert')}`}
				/>
			))}
			{hasMembers && (
				<DropChip
					id={dropId.trayRemove}
					icon={<FolderMinus className="h-3.5 w-3.5" />}
					label="Remove from incident"
					destructive
				/>
			)}
		</div>
	);
};
