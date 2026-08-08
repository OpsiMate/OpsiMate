import { describe, expect, test } from 'vitest';
import { Alert, AlertFix, normalizeAlertFix } from '@OpsiMate/shared';
import { getAlertFix } from '@/components/Alerts/utils/fix.utils';

describe('normalizeAlertFix', () => {
	test('recognizes manual synonyms', () => {
		for (const v of ['manual', 'Manual Fix', 'MANUALFIX', 'manual_fix', 'manual-fix']) {
			expect(normalizeAlertFix(v)).toBe(AlertFix.MANUAL);
		}
	});

	test('recognizes auto synonyms', () => {
		for (const v of ['auto', 'Auto Fix', 'autofix', 'AUTOMATIC', 'automated', 'auto_fix']) {
			expect(normalizeAlertFix(v)).toBe(AlertFix.AUTO);
		}
	});

	test('unknown or missing values are null — no default, unlike severity', () => {
		expect(normalizeAlertFix('sometimes')).toBeNull();
		expect(normalizeAlertFix('')).toBeNull();
		expect(normalizeAlertFix(undefined)).toBeNull();
		expect(normalizeAlertFix(null)).toBeNull();
	});

	test('prototype keys in user-controlled input do not resolve', () => {
		expect(normalizeAlertFix('constructor')).toBeNull();
		expect(normalizeAlertFix('__proto__')).toBeNull();
	});
});

describe('getAlertFix', () => {
	test('reads the fix tag; absent tag is null', () => {
		expect(getAlertFix({ tags: { fix: 'manual' } } as unknown as Alert)).toBe(AlertFix.MANUAL);
		expect(getAlertFix({ tags: { fix: 'auto' } } as unknown as Alert)).toBe(AlertFix.AUTO);
		expect(getAlertFix({ tags: {} } as unknown as Alert)).toBeNull();
		expect(getAlertFix({} as unknown as Alert)).toBeNull();
	});
});
