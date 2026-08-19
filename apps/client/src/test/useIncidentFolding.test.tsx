import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { Alert, IncidentSummary } from '@OpsiMate/shared';
import { useIncidentFolding } from '@/components/Alerts/AlertsTable/hooks/useIncidentFolding';
import { FlatGroupItem } from '@/components/Alerts/AlertsTable/AlertsTable.types';

const alert = (id: string, incidentId?: number): Alert => ({ id, incidentId }) as Alert;
const leaf = (id: string, incidentId?: number): FlatGroupItem => ({ type: 'leaf', alert: alert(id, incidentId) });
const groupHeader = (key: string): FlatGroupItem =>
	({
		type: 'group',
		key,
		field: 'f',
		value: key,
		count: 0,
		level: 0,
		isExpanded: true,
		groupStatus: 'firing',
	}) as FlatGroupItem;

const incident = (id: number, alertCount: number): IncidentSummary =>
	({ id, name: `Incident #${id}`, alertCount }) as IncidentSummary;

const byId = (...incidents: IncidentSummary[]) => new Map(incidents.map((i) => [i.id, i]));

const rowKinds = (rows: FlatGroupItem[]) =>
	rows.map((r) => (r.type === 'leaf' ? `leaf:${r.alert.id}${r.incidentMember ? '*' : ''}` : `${r.type}`));

describe('useIncidentFolding', () => {
	test('members collapse into one folder at the FIRST member position, preserving sort order', () => {
		const rows = [leaf('a'), leaf('b', 1), leaf('c'), leaf('d', 1)];
		const { result } = renderHook(() => useIncidentFolding(rows, byId(incident(1, 2))));
		// Folder sits where 'b' (the best-sorted member) sat; 'd' folded away.
		expect(rowKinds(result.current.foldedRows)).toEqual(['leaf:a', 'incident', 'leaf:c']);
	});

	test('expanding emits the members right under the folder, marked as members', () => {
		const rows = [leaf('a'), leaf('b', 1), leaf('c'), leaf('d', 1)];
		const { result } = renderHook(() => useIncidentFolding(rows, byId(incident(1, 2))));
		act(() => result.current.toggleIncident(1));
		expect(rowKinds(result.current.foldedRows)).toEqual(['leaf:a', 'incident', 'leaf:b*', 'leaf:d*', 'leaf:c']);
	});

	test('shownCount reflects only the members present in the current rows', () => {
		// Incident 1 has 5 members total, but filters left only two in the list.
		const rows = [leaf('b', 1), leaf('d', 1)];
		const { result } = renderHook(() => useIncidentFolding(rows, byId(incident(1, 5))));
		const folder = result.current.foldedRows[0];
		expect(folder.type).toBe('incident');
		if (folder.type === 'incident') {
			expect(folder.shownCount).toBe(2);
			expect(folder.incident.alertCount).toBe(5);
		}
	});

	test('group-by segments fold independently — one folder per group the incident spans', () => {
		const rows = [groupHeader('g1'), leaf('a', 1), leaf('b', 1), groupHeader('g2'), leaf('c', 1)];
		const { result } = renderHook(() => useIncidentFolding(rows, byId(incident(1, 3))));
		expect(rowKinds(result.current.foldedRows)).toEqual(['group', 'incident', 'group', 'incident']);
	});

	test('alerts referencing an unknown incident render as plain rows', () => {
		// The incidents list can lag the alerts list by a poll — never hide alerts.
		const rows = [leaf('a', 99), leaf('b')];
		const { result } = renderHook(() => useIncidentFolding(rows, byId(incident(1, 2))));
		expect(rowKinds(result.current.foldedRows)).toEqual(['leaf:a', 'leaf:b']);
	});

	test('no incidents at all returns the input array untouched (same identity)', () => {
		const rows = [leaf('a'), leaf('b')];
		const { result } = renderHook(() => useIncidentFolding(rows, new Map()));
		expect(result.current.foldedRows).toBe(rows);
	});
});
