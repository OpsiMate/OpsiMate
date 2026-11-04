import { Alert, IncidentSummary } from '@OpsiMate/shared';
import { useCallback, useMemo, useState } from 'react';
import { FlatGroupItem } from '../AlertsTable.types';

interface LeafRow {
	type: 'leaf';
	alert: Alert;
	incidentMember?: boolean;
}

export interface IncidentFoldingState {
	foldedRows: FlatGroupItem[];
	toggleIncident: (incidentId: number) => void;
}

// Folds alerts that belong to an incident under a single folder row, AFTER filtering,
// sorting and grouping have all run. Within a segment (a run of rows between group
// headers) the plain alerts keep their sort order and the folders come AFTER them, in
// order of their best-sorted member: incidents are already-handled work, so they sit
// below the alerts still waiting for someone. Only members that pass the active
// filters/search/time window are folded (the folder's shownCount vs the summary's
// alertCount is the "3 of 5" the row renders), and in group-by mode each group segment
// folds independently: an incident spanning two groups shows a folder in each, holding
// that group's members. Collapsed by default; expansion is per-session UI state.
export const useIncidentFolding = (
	flatRows: FlatGroupItem[],
	incidentsById: Map<number, IncidentSummary>
): IncidentFoldingState => {
	const [expandedIncidents, setExpandedIncidents] = useState<ReadonlySet<number>>(new Set());

	const toggleIncident = useCallback((incidentId: number) => {
		setExpandedIncidents((current) => {
			const next = new Set(current);
			if (next.has(incidentId)) next.delete(incidentId);
			else next.add(incidentId);
			return next;
		});
	}, []);

	const foldedRows = useMemo(() => {
		if (incidentsById.size === 0) return flatRows;

		// One consecutive run of leaves (between group headers) folds as a unit.
		const foldSegment = (segment: LeafRow[]): FlatGroupItem[] => {
			const membersByIncident = new Map<number, LeafRow[]>();
			for (const row of segment) {
				const incidentId = row.alert.incidentId;
				if (incidentId == null || !incidentsById.has(incidentId)) continue;
				const members = membersByIncident.get(incidentId);
				if (members) members.push(row);
				else membersByIncident.set(incidentId, [row]);
			}
			if (membersByIncident.size === 0) return segment;

			const out: FlatGroupItem[] = [];
			const folders: FlatGroupItem[] = [];
			const emitted = new Set<number>();
			for (const row of segment) {
				const incidentId = row.alert.incidentId;
				const incident = incidentId != null ? incidentsById.get(incidentId) : undefined;
				if (!incident) {
					out.push(row);
					continue;
				}
				// Later members of an already-emitted folder were folded with it.
				if (emitted.has(incident.id)) continue;
				emitted.add(incident.id);
				const members = membersByIncident.get(incident.id) ?? [];
				const isExpanded = expandedIncidents.has(incident.id);
				folders.push({
					type: 'incident',
					incident,
					shownCount: members.length,
					isExpanded,
					members: members.map((member) => member.alert),
				});
				if (isExpanded) {
					folders.push(...members.map((member) => ({ ...member, incidentMember: true })));
				}
			}
			out.push(...folders);
			return out;
		};

		const result: FlatGroupItem[] = [];
		let segment: LeafRow[] = [];
		for (const row of flatRows) {
			if (row.type === 'leaf') {
				segment.push(row);
				continue;
			}
			result.push(...foldSegment(segment));
			segment = [];
			result.push(row);
		}
		result.push(...foldSegment(segment));
		return result;
	}, [flatRows, incidentsById, expandedIncidents]);

	return { foldedRows, toggleIncident };
};
