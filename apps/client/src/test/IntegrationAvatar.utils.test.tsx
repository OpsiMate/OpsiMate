import { Alert, AlertIntegrationKind, AlertSeverity, AlertStatus } from '@OpsiMate/shared';
import { describe, expect, test } from 'vitest';
import {
	getIntegrationLabel,
	integrationDefinitions,
	normalizeIntegration,
	resolveAlertIntegration,
} from '@/components/Alerts/IntegrationAvatar.utils';

// Exercise legacy/unrecognized type values that make the fallback chain necessary.
function alert(overrides: Partial<Omit<Alert, 'type'>> & { type?: string | null } = {}): Alert {
	return {
		id: 'unknown-1',
		type: undefined,
		status: AlertStatus.FIRING,
		severity: AlertSeverity.WARNING,
		tags: {},
		startsAt: '2026-01-01T00:00:00Z',
		updatedAt: '2026-01-01T00:00:00Z',
		createdAt: '2026-01-01T00:00:00Z',
		alertUrl: '',
		alertName: 'Example alert',
		isSilenced: false,
		...overrides,
	} as Alert;
}

describe('integration normalization', () => {
	test.each([
		['Grafana', 'grafana'],
		['grafana', 'grafana'],
		['prefix-GRAFANA-suffix', 'grafana'],
		['gCp', 'gcp'],
		['GOOGLE Cloud alert', 'gcp'],
		['UPTIMEKUMA_9', 'uptimekuma'],
		['service-UPTIME-KUMA-down', 'uptimekuma'],
		['prefix-DATADOG-suffix', 'datadog'],
		['prefix-ZABBIX-suffix', 'zabbix'],
		['prefix-CUSTOM-suffix', 'custom'],
	])('normalizes %s to %s', (value, expected) => {
		expect(normalizeIntegration(value)).toBe(expected);
	});

	test.each([undefined, null, '', 'unrecognized'])('does not invent a match for %s', (value) => {
		expect(normalizeIntegration(value)).toBeUndefined();
	});
});

describe('integration source precedence', () => {
	test('explicit type wins over a conflicting tag, id and summary', () => {
		expect(
			resolveAlertIntegration(
				alert({ type: 'Grafana', tags: { source: 'GCP' }, id: 'datadog-1', summary: 'Zabbix' })
			)
		).toBe('grafana');
	});

	test('explicit Custom is a recognized type and does not fall through', () => {
		expect(resolveAlertIntegration(alert({ type: 'Custom', tags: { source: 'Grafana' }, id: 'gcp-1' }))).toBe(
			'custom'
		);
	});

	test('primary tag wins over the id and summary when type is unrecognized', () => {
		expect(
			resolveAlertIntegration(
				alert({ type: 'legacy', tags: { source: 'GCP' }, id: 'datadog-1', summary: 'Zabbix' })
			)
		).toBe('gcp');
	});

	test('id wins over summary when type and primary tag do not match', () => {
		expect(
			resolveAlertIntegration(
				alert({ type: '', tags: { team: 'operations' }, id: 'UPTIMEKUMA_9', summary: 'Grafana' })
			)
		).toBe('uptimekuma');
	});

	test('summary is used when earlier sources do not match', () => {
		expect(
			resolveAlertIntegration(alert({ type: null, tags: { team: 'operations' }, summary: 'Alert from DATADOG' }))
		).toBe('datadog');
	});

	test('falls back to custom when no source matches', () => {
		expect(resolveAlertIntegration(alert())).toBe('custom');
		expect(
			resolveAlertIntegration(alert({ type: 'legacy', tags: { team: 'operations' }, summary: 'Disk full' }))
		).toBe('custom');
	});
});

describe('primary integration tag', () => {
	test('only the primary visible tag participates in resolution', () => {
		expect(
			resolveAlertIntegration(alert({ tags: { team: 'operations', source: 'Grafana' }, id: 'zabbix-1' }))
		).toBe('zabbix');
	});

	test('hidden and empty tags do not displace the primary visible tag', () => {
		expect(
			resolveAlertIntegration(
				alert({ tags: { severity: 'Grafana', fix: 'Datadog', empty: '', source: 'GCP' }, id: 'zabbix-1' })
			)
		).toBe('gcp');
	});
});

const labels: Record<AlertIntegrationKind, string> = {
	grafana: 'Grafana',
	gcp: 'Google Cloud',
	uptimekuma: 'Uptime Kuma',
	datadog: 'Datadog',
	zabbix: 'Zabbix',
	custom: 'Custom',
};

test.each(Object.entries(labels))('%s has the expected label in shared and avatar definitions', (kind, label) => {
	expect(getIntegrationLabel(kind as AlertIntegrationKind)).toBe(label);
	expect(integrationDefinitions[kind as AlertIntegrationKind].label).toBe(label);
});
