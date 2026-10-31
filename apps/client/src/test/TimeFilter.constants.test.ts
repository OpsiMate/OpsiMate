import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
	PRESET_COLUMNS,
	QUICK_PRESETS,
	getPresetConfig,
	getPresetLabel,
} from '@/components/Alerts/AlertsTable/TimeFilter/TimeFilter.constants';
import type { QuickPreset } from '@/components/Alerts/AlertsTable/TimeFilter/TimeFilter.types';

const NOW = new Date(2026, 5, 15, 14, 37, 21, 456);

const getRangeOf = (preset: QuickPreset) => {
	const config = getPresetConfig(preset);
	if (!config) throw new Error(`missing preset ${preset}`);
	return config.getRange();
};

describe('TimeFilter.constants', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('QUICK_PRESETS getRange', () => {
		test('last15m spans the 15 minutes ending now', () => {
			const { from, to } = getRangeOf('last15m');

			expect(to.getTime()).toBe(NOW.getTime());
			expect(from.getTime()).toBe(NOW.getTime() - 15 * 60 * 1000);
		});

		test('today starts at local midnight and ends now', () => {
			const { from, to } = getRangeOf('today');

			expect(from.getTime()).toBe(new Date(2026, 5, 15, 0, 0, 0, 0).getTime());
			expect(to.getTime()).toBe(NOW.getTime());
		});
	});

	describe('PRESET_COLUMNS', () => {
		test('flattened, contains every QUICK_PRESETS value exactly once', () => {
			const flattened = PRESET_COLUMNS.flat();

			expect(flattened).toHaveLength(QUICK_PRESETS.length);
			expect(new Set(flattened).size).toBe(flattened.length);
			expect([...flattened].sort()).toEqual(QUICK_PRESETS.map((p) => p.value).sort());
		});
	});

	describe('getPresetLabel', () => {
		test('returns the label of a known preset', () => {
			expect(getPresetLabel('last7d')).toBe('Last 7 days');
		});

		test('falls back to the raw value for an unknown preset', () => {
			expect(getPresetLabel('bogus' as QuickPreset)).toBe('bogus');
		});
	});

	describe('getPresetConfig', () => {
		test('is undefined for an unknown preset', () => {
			expect(getPresetConfig('bogus' as QuickPreset)).toBeUndefined();
		});
	});
});
