import { describe, expect, it } from 'vitest';
import { distributeWidths } from '@/components/Alerts/AlertsTable/hooks/useContentColumnWidths';

describe('distributeWidths', () => {
	it('gives every column its desired width when everything fits', () => {
		const result = distributeWidths({ a: 200, b: 150 }, { a: 100, b: 100 }, 500);
		expect(result).toEqual({ a: 200, b: 150 });
	});

	it('gives every column its desired width when the fit is exact', () => {
		const result = distributeWidths({ a: 200, b: 150 }, { a: 100, b: 100 }, 350);
		expect(result).toEqual({ a: 200, b: 150 });
	});

	it('shrinks columns proportionally to their slack when space is tight', () => {
		// Overflow 100 over slack 100+50: a gives up 2/3 of the overflow, b 1/3.
		const result = distributeWidths({ a: 200, b: 150 }, { a: 100, b: 100 }, 250);
		expect(result.a + result.b).toBe(250);
		expect(result).toEqual({ a: 133, b: 117 });
	});

	it('clamps every column to its floor when even the floors overflow', () => {
		const result = distributeWidths({ a: 200, b: 150 }, { a: 100, b: 100 }, 150);
		expect(result).toEqual({ a: 100, b: 100 });
	});

	it('keeps floors when available space is negative', () => {
		const result = distributeWidths({ a: 200 }, { a: 100 }, -50);
		expect(result).toEqual({ a: 100 });
	});

	it('never shrinks a column below its floor', () => {
		for (const available of [0, 120, 200, 260, 320, 349]) {
			const result = distributeWidths({ a: 200, b: 150 }, { a: 120, b: 110 }, available);
			expect(result.a).toBeGreaterThanOrEqual(120);
			expect(result.b).toBeGreaterThanOrEqual(110);
		}
	});

	it('handles a single column', () => {
		expect(distributeWidths({ a: 300 }, { a: 150 }, 200)).toEqual({ a: 200 });
		expect(distributeWidths({ a: 300 }, { a: 150 }, 400)).toEqual({ a: 300 });
	});
});
