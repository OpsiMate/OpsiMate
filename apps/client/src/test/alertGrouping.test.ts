import { describe, expect, it } from 'vitest';
import { Alert } from '@OpsiMate/shared';
import { flattenGroups, groupAlerts } from '@/components/Alerts/AlertsTable/AlertsTable.utils';

const alert = (id: string, status: 'firing' | 'resolved', flags = {}): Alert =>
	({ id, status, ...flags } as Alert);

describe('alert grouping', () => {
	it('groups alerts and rolls status up with firing precedence', () => {
		const alerts = [alert('resolved', 'resolved'), alert('muted', 'resolved', { isMuted: true }), alert('firing', 'firing')];
		const groups = groupAlerts(alerts, ['team'], (item) => item.id === 'firing' ? 'ops' : 'platform');
		const flattened = flattenGroups(groups, new Set(groups.map((group) => group.type === 'group' ? group.key : '')));
		const ops = flattened.find((item) => item.type === 'group' && item.value === 'ops');
		const platform = flattened.find((item) => item.type === 'group' && item.value === 'platform');
		expect(ops?.groupStatus).toBe('firing');
		expect(platform?.groupStatus).toBe('muted');
	});

	it('flattens collapsed groups to headers and expanded groups depth-first', () => {
		const alerts = [alert('a', 'resolved'), alert('b', 'resolved')];
		const groups = groupAlerts(alerts, ['team'], () => 'ops');
		const key = groups[0].type === 'group' ? groups[0].key : '';
		expect(flattenGroups(groups, new Set()).map((item) => item.type)).toEqual(['group']);
		expect(flattenGroups(groups, new Set([key])).map((item) => item.type)).toEqual(['group', 'leaf', 'leaf']);
		expect(alerts.map((item) => item.id)).toEqual(['a', 'b']);
	});
});
