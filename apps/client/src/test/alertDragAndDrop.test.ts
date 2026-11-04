import { Alert, IncidentSummary } from '@OpsiMate/shared';
import { describe, expect, test } from 'vitest';
import {
	canStartAlertDrag,
	dropId,
	incidentsDissolvedBy,
	resolveDrop,
	preferSpecificTargets,
} from '@/components/Alerts/AlertDragAndDrop';

const alert = (id: string, incidentId: number | null = null): Alert => ({ id, incidentId }) as Alert;
const incident = (id: number, alertIds: string[]): IncidentSummary =>
	({ id, name: `I${id}`, alertIds }) as IncidentSummary;
const byId = (...alerts: Alert[]) => new Map(alerts.map((a) => [a.id, a]));

describe('resolveDrop', () => {
	const a = alert('a');
	const b = alert('b');
	const m1 = alert('m1', 7);
	const m2 = alert('m2', 7);
	const alerts = byId(a, b, m1, m2);

	test('dropping on a folder (row or tray chip) adds to that incident', () => {
		expect(resolveDrop(dropId.incident(7), [a], alerts)).toEqual({ kind: 'add', incidentId: 7 });
		expect(resolveDrop(dropId.trayIncident(7), [a, b], alerts)).toEqual({ kind: 'add', incidentId: 7 });
	});

	test('dropping members back on their own folder changes nothing', () => {
		expect(resolveDrop(dropId.incident(7), [m1, m2], alerts)).toBeNull();
		// but a mixed set still adds the newcomer
		expect(resolveDrop(dropId.incident(7), [m1, a], alerts)).toEqual({ kind: 'add', incidentId: 7 });
	});

	test('dropping on a plain alert starts a new incident with both', () => {
		expect(resolveDrop(dropId.alert('b'), [a], alerts)).toEqual({ kind: 'create', alerts: [a, b] });
	});

	test('dropping on a member joins its incident; on itself does nothing', () => {
		expect(resolveDrop(dropId.alert('m1'), [a], alerts)).toEqual({ kind: 'add', incidentId: 7 });
		expect(resolveDrop(dropId.alert('a'), [a], alerts)).toBeNull();
	});

	test('tray: new incident, and remove only for members', () => {
		expect(resolveDrop(dropId.trayNew, [a, b], alerts)).toEqual({ kind: 'create', alerts: [a, b] });
		expect(resolveDrop(dropId.trayRemove, [a, m1], alerts)).toEqual({ kind: 'remove', alerts: [m1] });
		expect(resolveDrop(dropId.trayRemove, [a], alerts)).toBeNull();
	});

	test('the "out of the incident" zone and the table background remove members only', () => {
		expect(resolveDrop(dropId.ungrouped, [a, m1], alerts)).toEqual({ kind: 'remove', alerts: [m1] });
		expect(resolveDrop(dropId.ungroupedArea, [m1, m2], alerts)).toEqual({ kind: 'remove', alerts: [m1, m2] });
		expect(resolveDrop(dropId.ungroupedArea, [a], alerts)).toBeNull();
	});

	test('no target, nothing dragged, or an unknown id does nothing', () => {
		expect(resolveDrop(null, [a], alerts)).toBeNull();
		expect(resolveDrop(dropId.trayNew, [], alerts)).toBeNull();
		expect(resolveDrop('something-else', [a], alerts)).toBeNull();
	});
});

describe('incidentsDissolvedBy', () => {
	test('names the incidents whose every member is in the moving set, except the destination', () => {
		const incidents = [incident(1, ['m1', 'm2']), incident(2, ['x', 'y']), incident(3, ['m3'])];
		const moving = [alert('m1', 1), alert('m2', 1), alert('x', 2), alert('m3', 3)];
		expect(incidentsDissolvedBy(moving, incidents).map((i) => i.id)).toEqual([1, 3]);
		expect(incidentsDissolvedBy(moving, incidents, 1).map((i) => i.id)).toEqual([3]);
	});
});

describe('canStartAlertDrag', () => {
	const press = (
		over: Partial<{ button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; target: Element | null }>
	) => ({
		button: 0,
		metaKey: false,
		ctrlKey: false,
		shiftKey: false,
		target: document.createElement('td'),
		...over,
	});

	test('a plain primary press on a cell may drag', () => {
		expect(canStartAlertDrag(press({}))).toBe(true);
	});

	test('modifier presses and other buttons belong to selection, not dragging', () => {
		expect(canStartAlertDrag(press({ metaKey: true }))).toBe(false);
		expect(canStartAlertDrag(press({ ctrlKey: true }))).toBe(false);
		expect(canStartAlertDrag(press({ shiftKey: true }))).toBe(false);
		expect(canStartAlertDrag(press({ button: 2 }))).toBe(false);
	});

	test('presses on the checkbox cell or on controls never drag', () => {
		const cell = document.createElement('td');
		cell.setAttribute('data-select-cell', '');
		const inner = cell.appendChild(document.createElement('span'));
		expect(canStartAlertDrag(press({ target: inner }))).toBe(false);
		expect(canStartAlertDrag(press({ target: document.createElement('button') }))).toBe(false);
	});
});

describe('preferSpecificTargets', () => {
	test('a row or folder under the pointer beats the table background; the background stands alone', () => {
		const area = { id: dropId.ungroupedArea };
		const row = { id: dropId.alert('a') };
		expect(preferSpecificTargets([area, row])).toEqual([row]);
		expect(preferSpecificTargets([area])).toEqual([area]);
		expect(preferSpecificTargets([])).toEqual([]);
	});
});
