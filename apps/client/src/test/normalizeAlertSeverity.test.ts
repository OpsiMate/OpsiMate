import { describe, expect, it } from 'vitest';
import { AlertSeverity, normalizeAlertSeverity } from '@OpsiMate/shared';

describe('normalizeAlertSeverity', () => {
	it.each([
		['crit', AlertSeverity.CRITICAL],
		['P1', AlertSeverity.CRITICAL],
		[' disaster ', AlertSeverity.CRITICAL],
		['warn', AlertSeverity.WARNING],
		['average', AlertSeverity.WARNING],
		['ok', AlertSeverity.INFO],
		['P5', AlertSeverity.INFO],
	])('maps %s to %s', (value, expected) => {
		expect(normalizeAlertSeverity(value)).toBe(expected);
	});

	it.each([undefined, null, '', 'unknown', '__proto__', 'constructor', 'toString'])('falls back for %s', (value) => {
		expect(normalizeAlertSeverity(value)).toBe(AlertSeverity.WARNING);
	});

	it('ignores case and surrounding whitespace', () => {
		expect(normalizeAlertSeverity('  CRIT ')).toBe(AlertSeverity.CRITICAL);
	});
});
