import { Alert, IncidentSummary } from '@OpsiMate/shared';
import { describe, expect, test, vi } from 'vitest';
import {
	canStartAlertDrag,
	dropId,
	incidentsDissolvedBy,
	resolveDrop,
	preferSpecificTargets,
	followPointer,
} from '@/components/Alerts/AlertDragAndDrop';
import { performDrop } from '@/components/Alerts/hooks/useAlertDragAndDrop';

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

	test('dropping on a plain alert does nothing — one alert or several, incidents are not made that way', () => {
		expect(resolveDrop(dropId.alert('b'), [a], alerts)).toBeNull();
		expect(resolveDrop(dropId.alert('b'), [a, m1], alerts)).toBeNull();
		// Not even over the table background behind the row.
		expect(resolveDrop([dropId.alert('b'), dropId.ungroupedArea()], [a], alerts)).toBeNull();
	});

	test('dropping on a member joins its incident; on itself does nothing', () => {
		expect(resolveDrop(dropId.alert('m1'), [a], alerts)).toEqual({ kind: 'add', incidentId: 7 });
		expect(resolveDrop(dropId.alert('a'), [a], alerts)).toBeNull();
	});

	test('tray: the explicit "New incident" chip is the one drop that creates; remove only for members', () => {
		expect(resolveDrop(dropId.trayNew, [a, b], alerts)).toEqual({ kind: 'create', alerts: [a, b] });
		expect(resolveDrop(dropId.trayRemove, [a, m1], alerts)).toEqual({ kind: 'remove', alerts: [m1] });
		expect(resolveDrop(dropId.trayRemove, [a], alerts)).toBeNull();
	});

	test('the "out of the incident" zone and the table background remove members only', () => {
		expect(resolveDrop(dropId.ungrouped(), [a, m1], alerts)).toEqual({ kind: 'remove', alerts: [m1] });
		expect(resolveDrop(dropId.ungroupedArea(), [m1, m2], alerts)).toEqual({ kind: 'remove', alerts: [m1, m2] });
		expect(resolveDrop(dropId.ungroupedArea(), [a], alerts)).toBeNull();
	});

	test('scoped ids (one folder per segment, one band/background per table) resolve like the plain ones', () => {
		expect(resolveDrop(dropId.incident(7, '«r3»'), [a], alerts)).toEqual({ kind: 'add', incidentId: 7 });
		expect(resolveDrop(dropId.ungrouped(':r1:'), [m1], alerts)).toEqual({ kind: 'remove', alerts: [m1] });
		expect(resolveDrop(dropId.ungroupedArea('«r2»'), [m1], alerts)).toEqual({ kind: 'remove', alerts: [m1] });
		// Two tables' ids are distinct droppables.
		expect(dropId.ungroupedArea('«r1»')).not.toBe(dropId.ungroupedArea('«r2»'));
	});

	test('the Assigned pane assigns only the unowned alerts; owned ones are left alone', () => {
		const owned = { ...alert('o'), ownerId: '2' } as Alert;
		expect(resolveDrop(dropId.assignedPane, [a, owned], alerts)).toEqual({ kind: 'assign', alerts: [a] });
		expect(resolveDrop(dropId.assignedPane, [owned], alerts)).toBeNull();
	});

	test('inside the Assigned pane, unowned alerts dropped on a plain row are assigned, not grouped', () => {
		const owned = { ...alert('o'), ownerId: '2' } as Alert;
		const inPane = (target: Alert) => [dropId.alert(target.id), dropId.ungroupedArea(), dropId.assignedPane];
		expect(resolveDrop(inPane(b), [a], alerts)).toEqual({ kind: 'assign', alerts: [a] });
		// Nothing unowned in the set: nothing to do (already assigned, and rows never group).
		expect(resolveDrop(inPane(b), [owned], alerts)).toBeNull();
		// A member row still means its incident (which takes ownership of the alert anyway).
		expect(resolveDrop(inPane(m1), [a], alerts)).toEqual({ kind: 'add', incidentId: m1.incidentId });
	});

	test('the Unassigned pane takes the owner off owned alerts — dropped on the pane or on a row in it', () => {
		const owned = { ...alert('o'), ownerId: '2' } as Alert;
		const ownedMember = { ...alert('om', 7), ownerId: '2' } as Alert;
		expect(resolveDrop(dropId.unassignedPane, [owned, a], alerts)).toEqual({ kind: 'unassign', alerts: [owned] });
		expect(resolveDrop(dropId.unassignedPane, [a], alerts)).toBeNull();
		const inPane = (target: Alert) => [dropId.alert(target.id), dropId.ungroupedArea(), dropId.unassignedPane];
		// A pulled alert dragged back and dropped on another alert: unassigned, no incident.
		expect(resolveDrop(inPane(b), [owned], alerts)).toEqual({ kind: 'unassign', alerts: [owned] });
		expect(resolveDrop(inPane(b), [owned, ownedMember], alerts)).toEqual({
			kind: 'unassign',
			alerts: [owned, ownedMember],
		});
		// A member row in the pane still means its incident.
		expect(resolveDrop(inPane(m1), [owned], alerts)).toEqual({ kind: 'add', incidentId: 7 });
		// The pane's own empty table space: an owned member is unassigned (which also takes it
		// out of its incident), not merely removed with its owner kept.
		expect(resolveDrop([dropId.ungroupedArea(), dropId.unassignedPane], [ownedMember], alerts)).toEqual({
			kind: 'unassign',
			alerts: [ownedMember],
		});
		// Nothing owned on that background: members are removed as anywhere else.
		expect(resolveDrop([dropId.ungroupedArea(), dropId.unassignedPane], [m1], alerts)).toEqual({
			kind: 'remove',
			alerts: [m1],
		});
	});

	test('with several targets under the pointer, the first that applies wins', () => {
		// A member dragged over a folder inside the Assigned pane: the folder, not the pane.
		expect(resolveDrop([dropId.incident(7), dropId.assignedPane], [a], alerts)).toEqual({
			kind: 'add',
			incidentId: 7,
		});
		// An unowned alert over the Assigned pane's table background: the area says nothing
		// (no members), so the pane applies.
		expect(resolveDrop([dropId.ungroupedArea(), dropId.assignedPane], [a], alerts)).toEqual({
			kind: 'assign',
			alerts: [a],
		});
	});

	test('no target, nothing dragged, or an unknown id does nothing', () => {
		expect(resolveDrop(null, [a], alerts)).toBeNull();
		expect(resolveDrop(dropId.trayNew, [], alerts)).toBeNull();
		expect(resolveDrop('something-else', [a], alerts)).toBeNull();
	});
});

describe('performDrop', () => {
	const actions = () => ({
		addAlertsToIncident: vi.fn(async () => {}),
		removeAlertsFromIncidents: vi.fn(async () => {}),
		openCreateDialogFor: vi.fn(),
		assignAlertsToMe: vi.fn(async () => {}),
		unassignAlerts: vi.fn(async () => {}),
		confirmUnassign: vi.fn(),
	});
	const owned = { ...alert('o'), ownerId: '2' } as Alert;
	const member = { ...alert('om', 7), ownerId: '2' } as Alert;
	const incidents = [incident(7, ['om']), incident(8, ['x', 'y'])];

	test('unassigning plain owned alerts just runs', async () => {
		const a = actions();
		await performDrop({ kind: 'unassign', alerts: [owned] }, [owned], incidents, a);
		expect(a.unassignAlerts).toHaveBeenCalledWith([owned]);
		expect(a.confirmUnassign).not.toHaveBeenCalled();
	});

	test('unassigning every member of an incident asks first — it would dissolve the incident', async () => {
		const a = actions();
		await performDrop({ kind: 'unassign', alerts: [owned, member] }, [owned, member], incidents, a);
		expect(a.unassignAlerts).not.toHaveBeenCalled();
		expect(a.confirmUnassign).toHaveBeenCalledWith([owned, member], [incidents[0]]);
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
		const area = { id: dropId.ungroupedArea() };
		const row = { id: dropId.alert('a') };
		expect(preferSpecificTargets([area, row])).toEqual([row]);
		expect(preferSpecificTargets([{ id: dropId.ungroupedArea('«r1»') }, row])).toEqual([row]);
		expect(preferSpecificTargets([area])).toEqual([area]);
		expect(preferSpecificTargets([])).toEqual([]);
	});

	test('the panes stay in the list after the row under the pointer', () => {
		const area = { id: dropId.ungroupedArea() };
		const row = { id: dropId.alert('a') };
		for (const pane of [{ id: dropId.assignedPane }, { id: dropId.unassignedPane }]) {
			expect(preferSpecificTargets([row, area, pane])).toEqual([row, pane]);
			expect(preferSpecificTargets([area, pane])).toEqual([area, pane]);
		}
	});
});

describe('followPointer', () => {
	const rect = { top: 100, left: 50, width: 400, height: 40, right: 450, bottom: 140 };
	const transform = { x: 10, y: 20, scaleX: 1, scaleY: 1 };
	const args = (activatorEvent: Event | null) =>
		({ activatorEvent, draggingNodeRect: rect, transform }) as unknown as Parameters<typeof followPointer>[0];

	test('re-anchors the overlay to where the row was grabbed, pointer on the grip', () => {
		// Grabbed 300px into the row, 20px down: shift right by 300 - grip, up to centre.
		const press = new MouseEvent('pointerdown', { clientX: 350, clientY: 120 });
		expect(followPointer(args(press))).toEqual({ ...transform, x: 10 + 300 - 20, y: 20 + 20 - 20 });
	});

	test('leaves the transform alone without a pointer event or a rect', () => {
		expect(followPointer(args(null))).toEqual(transform);
		expect(followPointer({ ...args(new MouseEvent('pointerdown')), draggingNodeRect: null })).toEqual(transform);
	});
});
