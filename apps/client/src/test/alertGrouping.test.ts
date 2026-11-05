import { flattenGroups, groupAlerts, memberSelectionState } from '@/components/Alerts/AlertsTable/AlertsTable.utils';
import { AlertStatus, type Alert } from '@OpsiMate/shared';
import { describe, expect, it } from 'vitest';

const mkAlert = (id: string, overrides: Partial<Alert> = {}): Alert =>
	({
		id,
		alertName: `alert ${id}`,
		status: AlertStatus.RESOLVED,
		severity: 'info',
		tags: {},
		isMuted: false,
		isSilenced: false,
		...overrides,
	}) as Alert;

const valueGetter = (alert: Alert, field: string): string => String(alert.tags?.[field] ?? '');

describe('alert grouping', () => {
	it('groups alerts by key without mutating the input', () => {
		const alerts = [
			mkAlert('1', { tags: { team: 'platform' } }),
			mkAlert('2', { tags: { team: 'product' } }),
			mkAlert('3', { tags: { team: 'platform' } }),
		];
		const originalOrder = [...alerts];

		const groups = groupAlerts(alerts, ['team'], valueGetter);

		expect(groups).toMatchObject([
			{
				type: 'group',
				value: 'platform',
				count: 2,
				children: [
					{ type: 'leaf', alert: { id: '1' } },
					{ type: 'leaf', alert: { id: '3' } },
				],
			},
			{
				type: 'group',
				value: 'product',
				count: 1,
				children: [{ type: 'leaf', alert: { id: '2' } }],
			},
		]);
		expect(alerts).toEqual(originalOrder);
	});
});

describe('flattening alert groups', () => {
	it('rolls group status up using firing, muted, resolved precedence', () => {
		const alerts = [
			mkAlert('firing', { status: AlertStatus.FIRING }),
			mkAlert('muted', { status: AlertStatus.FIRING, isMuted: true }),
			mkAlert('resolved'),
		];

		const [group] = groupAlerts(alerts, ['severity'], () => 'all');
		const [header] = flattenGroups([group], new Set());
		expect(header).toMatchObject({ type: 'group', groupStatus: 'firing' });

		const [mutedGroup] = groupAlerts(alerts.slice(1), ['severity'], () => 'all');
		const [mutedHeader] = flattenGroups([mutedGroup], new Set());
		expect(mutedHeader).toMatchObject({ type: 'group', groupStatus: 'muted' });

		const [resolvedGroup] = groupAlerts(alerts.slice(2), ['severity'], () => 'all');
		const [resolvedHeader] = flattenGroups([resolvedGroup], new Set());
		expect(resolvedHeader).toMatchObject({ type: 'group', groupStatus: 'resolved' });
	});

	it('flattens expanded nested groups depth-first and leaves collapsed groups closed', () => {
		const alerts = [
			mkAlert('1', { tags: { team: 'platform', service: 'api' } }),
			mkAlert('2', { tags: { team: 'platform', service: 'web' } }),
		];
		const groups = groupAlerts(alerts, ['team', 'service'], valueGetter);
		const originalGroups = structuredClone(groups);
		const rootKey = 'root:platform';
		const apiKey = `${rootKey}:api`;
		const webKey = `${rootKey}:web`;

		expect(flattenGroups(groups, new Set())).toMatchObject([{ type: 'group', key: rootKey }]);

		const flattened = flattenGroups(groups, new Set([rootKey, apiKey, webKey]));
		expect(
			flattened.map((item) =>
				item.type === 'group'
					? item.key
					: item.type === 'incident'
						? `incident:${item.incident.id}`
						: item.alert.id
			)
		).toEqual([rootKey, apiKey, '1', webKey, '2']);
		expect(groups).toEqual(originalGroups);
		expect(alerts.map((alert) => alert.id)).toEqual(['1', '2']);
	});
});

describe('group members and their selection state', () => {
	const alert = (id: string, service: string, env: string): Alert =>
		({ id, status: 'firing', tags: { service, env } }) as unknown as Alert;
	const alerts = [alert('1', 'api', 'prod'), alert('2', 'api', 'dev'), alert('3', 'web', 'prod')];
	const byTag = (a: Alert, field: string) => (a.tags as Record<string, string>)[field];

	it('a header carries every alert under it, nested groups included', () => {
		const groups = groupAlerts(alerts, ['service', 'env'], byTag);
		const flattened = flattenGroups(groups, new Set(groups.map((g) => (g.type === 'group' ? g.key : ''))));
		// Expanded, so each top-level group is followed by its env sub-headers and rows.
		const [api, web] = flattened.filter((item) => item.type === 'group' && item.level === 0);
		// Members follow the nested order (env 'dev' sorts before 'prod').
		expect(api.type === 'group' && api.members.map((a) => a.id)).toEqual(['2', '1']);
		expect(web.type === 'group' && web.members.map((a) => a.id)).toEqual(['3']);
	});

	it('none / some / all of the members selected', () => {
		expect(memberSelectionState(alerts, [])).toBe('none');
		expect(memberSelectionState(alerts, [alerts[1]])).toBe('some');
		expect(memberSelectionState(alerts, [...alerts])).toBe('all');
		expect(memberSelectionState([], alerts)).toBe('none');
	});
});
