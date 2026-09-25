import { groupAlerts, flattenGroups } from '@/components/Alerts/AlertsTable/AlertsTable.utils';
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
		expect(flattened.map((item) => (item.type === 'group' ? item.key : item.alert.id))).toEqual([
			rootKey,
			apiKey,
			'1',
			webKey,
			'2',
		]);
		expect(groups).toEqual(originalGroups);
		expect(alerts.map((alert) => alert.id)).toEqual(['1', '2']);
	});
});
