import { describe, expect, test } from 'vitest';
import { Alert, AlertSeverity, AlertStatus, collectAlertTagKeys } from '@OpsiMate/shared';

const makeAlert = (tags?: unknown): Alert => ({
	id: 'alert-1',
	alertName: 'Test Alert',
	status: AlertStatus.FIRING,
	severity: AlertSeverity.CRITICAL,
	type: 'Custom',
	startsAt: '2026-10-14T00:00:00.000Z',
	updatedAt: '2026-10-14T00:00:00.000Z',
	alertUrl: '',
	isSilenced: false,
	isMuted: false,
	isRead: false,
	ownerId: null,
	createdAt: '2026-10-14 00:00:00',
	tags: tags as Record<string, string>,
});

describe('collectAlertTagKeys', () => {
	test('returns an empty array when given an empty alerts list', () => {
		expect(collectAlertTagKeys([])).toEqual([]);
	});

	test('never lists severity and fix tags even when they have values', () => {
		const alerts = [
			makeAlert({
				severity: 'critical',
				fix: 'restart-service',
				environment: 'production',
			}),
		];

		const keys = collectAlertTagKeys(alerts);
		expect(keys.some((k) => k.key === 'severity')).toBe(false);
		expect(keys.some((k) => k.key === 'fix')).toBe(false);
		expect(keys.map((k) => k.key)).toEqual(['environment']);
	});

	test('does not list tags with empty string values', () => {
		const alerts = [
			makeAlert({
				cluster: '',
				datacenter: 'us-east-1',
			}),
			makeAlert({
				cluster: '',
			}),
		];

		const keys = collectAlertTagKeys(alerts);
		expect(keys.some((k) => k.key === 'cluster')).toBe(false);
		expect(keys.map((k) => k.key)).toEqual(['datacenter']);
		expect(keys[0].values).toEqual(['us-east-1']);
	});

	test('de-duplicates and sorts values across alerts', () => {
		const alerts = [
			makeAlert({ env: 'staging' }),
			makeAlert({ env: 'prod' }),
			makeAlert({ env: 'staging' }),
			makeAlert({ env: 'dev' }),
			makeAlert({ env: 'prod' }),
		];

		const keys = collectAlertTagKeys(alerts);
		const envKey = keys.find((k) => k.key === 'env');
		expect(envKey).toBeDefined();
		expect(envKey?.values).toEqual(['dev', 'prod', 'staging']);
	});

	test('formats tag key labels correctly according to naming rules', () => {
		const alerts = [
			makeAlert({
				env: 'prod',
				'env-name': 'production',
				service_owner: 'sre',
				ENV: 'prod-legacy',
				'a--b': 'test',
			}),
		];

		const keys = collectAlertTagKeys(alerts);
		const labelMap = Object.fromEntries(keys.map((k) => [k.key, k.label]));

		expect(labelMap['env']).toBe('Env');
		expect(labelMap['env-name']).toBe('Env Name');
		expect(labelMap['service_owner']).toBe('Service Owner');
		expect(labelMap['ENV']).toBe('Env');
		expect(labelMap['a--b']).toBe('A B');
	});

	test('sorts results by formatted label rather than raw key or appearance order', () => {
		const alerts = [
			makeAlert({
				'z-a': 'val1', // label: "Z A"
				alpha: 'val2', // label: "Alpha"
				b_z: 'val3', // label: "B Z"
				charlie: 'val4', // label: "Charlie"
			}),
		];

		const keys = collectAlertTagKeys(alerts);
		const labels = keys.map((k) => k.label);

		expect(labels).toEqual(['Alpha', 'B Z', 'Charlie', 'Z A']);
	});

	test('gracefully skips alerts with null, undefined, or non-object tags without throwing', () => {
		const alerts = [
			makeAlert(null),
			makeAlert(undefined),
			makeAlert('not-an-object'),
			makeAlert(123),
			makeAlert({ valid_tag: 'ok' }),
		];

		expect(() => collectAlertTagKeys(alerts)).not.toThrow();
		const keys = collectAlertTagKeys(alerts);
		expect(keys.length).toBe(1);
		expect(keys[0].key).toBe('valid_tag');
		expect(keys[0].label).toBe('Valid Tag');
		expect(keys[0].values).toEqual(['ok']);
	});

	test('ensures every entry has exactly the shape { key, label, values }', () => {
		const alerts = [
			makeAlert({
				region: 'eu-west-1',
				team: 'devops',
			}),
		];

		const keys = collectAlertTagKeys(alerts);
		expect(keys.length).toBe(2);

		for (const entry of keys) {
			const entryKeys = Object.keys(entry).sort();
			expect(entryKeys).toEqual(['key', 'label', 'values'].sort());
			expect(typeof entry.key).toBe('string');
			expect(typeof entry.label).toBe('string');
			expect(Array.isArray(entry.values)).toBe(true);
		}
	});
});
