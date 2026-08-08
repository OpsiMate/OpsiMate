import { describe, expect, test } from 'vitest';
import { Alert } from '@OpsiMate/shared';
import { getAlertLinks } from '@/components/Alerts/utils/links.utils';

const base = { id: 'a', alertName: 'A', tags: {} } as unknown as Alert;

describe('getAlertLinks', () => {
	test('links array is the source of truth when present — legacy fields ignored', () => {
		const alert = {
			...base,
			alertUrl: 'https://legacy.example.com',
			runbookUrl: 'https://runbook.example.com',
			links: [{ label: 'Grafana demo', icon: 'grafana', url: 'https://demo.grafana.dev/' }],
		} as Alert;
		expect(getAlertLinks(alert)).toEqual(alert.links);
	});

	test('legacy alertUrl/runbookUrl fold in when links is absent', () => {
		const alert = {
			...base,
			type: 'Grafana',
			alertUrl: 'https://legacy.example.com',
			runbookUrl: 'https://runbook.example.com',
		} as Alert;
		expect(getAlertLinks(alert)).toEqual([
			{ label: 'Source', icon: 'Grafana', url: 'https://legacy.example.com' },
			{ label: 'Runbook', icon: '', url: 'https://runbook.example.com' },
		]);
	});

	test('an empty links array falls back to legacy fields', () => {
		const alert = { ...base, type: 'Custom', alertUrl: 'https://x.example.com', links: [] } as Alert;
		expect(getAlertLinks(alert)).toEqual([{ label: 'Source', icon: 'Custom', url: 'https://x.example.com' }]);
	});

	test('no links anywhere yields an empty array', () => {
		expect(getAlertLinks({ ...base, alertUrl: '' } as Alert)).toEqual([]);
	});
});
