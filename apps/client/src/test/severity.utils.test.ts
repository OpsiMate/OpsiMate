import { Alert, AlertSeverity } from '@OpsiMate/shared';
import {
	SEVERITY_LABELS,
	SEVERITY_RANK,
	SEVERITY_ROW_CLASSES,
	SEVERITY_TEXT_CLASSES,
	getAlertSeverity,
} from '@/components/Alerts/utils/severity.utils';
import { describe, expect, test } from 'vitest';

describe('getAlertSeverity', () => {
	test('prefers explicit severity over severity and priority tags', () => {
		const alert = {
			severity: AlertSeverity.INFO,
			tags: { severity: 'critical', priority: 'P1' },
		} as unknown as Alert;

		expect(getAlertSeverity(alert)).toBe(AlertSeverity.INFO);
	});

	test('falls back from the severity tag to the priority tag, then the default', () => {
		expect(getAlertSeverity({ tags: { severity: 'critical', priority: 'P5' } } as unknown as Alert)).toBe(
			AlertSeverity.CRITICAL
		);
		expect(getAlertSeverity({ tags: { priority: 'P1' } } as unknown as Alert)).toBe(AlertSeverity.CRITICAL);
		expect(getAlertSeverity({ tags: {} } as unknown as Alert)).toBe(AlertSeverity.WARNING);
		expect(getAlertSeverity({} as unknown as Alert)).toBe(AlertSeverity.WARNING);
	});
});

describe('severity display helpers', () => {
	test('ranks critical above warning above info', () => {
		expect(SEVERITY_RANK[AlertSeverity.CRITICAL]).toBeGreaterThan(SEVERITY_RANK[AlertSeverity.WARNING]);
		expect(SEVERITY_RANK[AlertSeverity.WARNING]).toBeGreaterThan(SEVERITY_RANK[AlertSeverity.INFO]);
	});

	test('defines every exported map for every severity', () => {
		for (const severity of Object.values(AlertSeverity)) {
			expect(Object.hasOwn(SEVERITY_RANK, severity)).toBe(true);
			expect(Object.hasOwn(SEVERITY_LABELS, severity)).toBe(true);
			expect(Object.hasOwn(SEVERITY_ROW_CLASSES, severity)).toBe(true);
			expect(Object.hasOwn(SEVERITY_TEXT_CLASSES, severity)).toBe(true);
		}
	});
});
