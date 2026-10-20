import { afterEach, describe, expect, test, vi } from 'vitest';
import {
	isQuickTimePreset,
	QUICK_TIME_PRESETS,
	QuickTimePreset,
	resolveDashboardTimeRange,
	resolveQuickPreset,
} from '@OpsiMate/shared';

// The shared preset table is what both the browser's time filter and the server resolve
// a saved dashboard's "Last 1 hour" / "Today" against — these pin the windows per preset
// and the one zone-sensitive case ('today') so the two sides can't drift apart.

const now = new Date('2024-06-15T12:00:00.000Z');

interface PresetExpectation {
	preset: QuickTimePreset;
	label: string;
	// Minutes before `now` the window starts; null for 'today'.
	minutesBack: number | null;
}

const expectations: PresetExpectation[] = [
	{ preset: 'last1m', label: 'Last 1 minute', minutesBack: 1 },
	{ preset: 'last2m', label: 'Last 2 minutes', minutesBack: 2 },
	{ preset: 'last5m', label: 'Last 5 minutes', minutesBack: 5 },
	{ preset: 'last15m', label: 'Last 15 minutes', minutesBack: 15 },
	{ preset: 'last30m', label: 'Last 30 minutes', minutesBack: 30 },
	{ preset: 'last1h', label: 'Last 1 hour', minutesBack: 60 },
	{ preset: 'last2h', label: 'Last 2 hours', minutesBack: 2 * 60 },
	{ preset: 'last6h', label: 'Last 6 hours', minutesBack: 6 * 60 },
	{ preset: 'last12h', label: 'Last 12 hours', minutesBack: 12 * 60 },
	{ preset: 'last24h', label: 'Last 24 hours', minutesBack: 24 * 60 },
	{ preset: 'today', label: 'Today', minutesBack: null },
	{ preset: 'last2d', label: 'Last 2 days', minutesBack: 2 * 24 * 60 },
	{ preset: 'last3d', label: 'Last 3 days', minutesBack: 3 * 24 * 60 },
	{ preset: 'last5d', label: 'Last 5 days', minutesBack: 5 * 24 * 60 },
	{ preset: 'last7d', label: 'Last 7 days', minutesBack: 7 * 24 * 60 },
];

describe('QUICK_TIME_PRESETS', () => {
	test('is the full preset table in the order the UI lays it out', () => {
		expect(QUICK_TIME_PRESETS.map((p) => p.value)).toEqual(expectations.map((e) => e.preset));
		expect(QUICK_TIME_PRESETS.map((p) => p.label)).toEqual(expectations.map((e) => e.label));
	});

	test('isQuickTimePreset accepts only the table', () => {
		expect(isQuickTimePreset('last1h')).toBe(true);
		expect(isQuickTimePreset('today')).toBe(true);
		expect(isQuickTimePreset('custom')).toBe(false);
		expect(isQuickTimePreset('last99h')).toBe(false);
		expect(isQuickTimePreset(null)).toBe(false);
		expect(isQuickTimePreset(undefined)).toBe(false);
	});
});

describe('resolveQuickPreset', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	test.each(expectations.filter((e) => e.minutesBack !== null))(
		'$preset ends at now and starts $minutesBack minutes earlier',
		({ preset, minutesBack }) => {
			const { from, to } = resolveQuickPreset(preset, { now });
			expect(to.toISOString()).toBe('2024-06-15T12:00:00.000Z');
			expect(from.toISOString()).toBe(new Date(now.getTime() - (minutesBack ?? 0) * 60_000).toISOString());
		}
	);

	test('today without a zone is the process-local midnight, as the browser computes it', () => {
		const expected = new Date(now);
		expected.setHours(0, 0, 0, 0);
		const { from, to } = resolveQuickPreset('today', { now });
		expect(from.getTime()).toBe(expected.getTime());
		expect(to).toBe(now);
	});

	test('today in UTC starts at 00:00Z', () => {
		const { from } = resolveQuickPreset('today', { now, timeZone: 'UTC' });
		expect(from.toISOString()).toBe('2024-06-15T00:00:00.000Z');
	});

	test('today in Asia/Jerusalem starts at the zone midnight (21:00Z the evening before in summer)', () => {
		const { from } = resolveQuickPreset('today', { now, timeZone: 'Asia/Jerusalem' });
		expect(from.toISOString()).toBe('2024-06-14T21:00:00.000Z');
	});

	test('today follows the zone calendar day, not the UTC one', () => {
		// 22:00Z on the 15th is already 07:00 on the 16th in Tokyo.
		const { from } = resolveQuickPreset('today', {
			now: new Date('2024-06-15T22:00:00.000Z'),
			timeZone: 'Asia/Tokyo',
		});
		expect(from.toISOString()).toBe('2024-06-15T15:00:00.000Z');
	});

	test('today uses the offset in force at midnight when DST changed earlier that day', () => {
		// Israel moved to summer time at 02:00 on 2024-03-29: midnight was still UTC+2,
		// so "today" starts at 22:00Z the evening before — not 21:00Z, the offset at noon.
		const { from } = resolveQuickPreset('today', {
			now: new Date('2024-03-29T12:00:00.000Z'),
			timeZone: 'Asia/Jerusalem',
		});
		expect(from.toISOString()).toBe('2024-03-28T22:00:00.000Z');
	});

	test('defaults now to the wall clock', () => {
		vi.useFakeTimers();
		vi.setSystemTime(now);
		const { from, to } = resolveQuickPreset('last1h');
		expect(to.toISOString()).toBe('2024-06-15T12:00:00.000Z');
		expect(from.toISOString()).toBe('2024-06-15T11:00:00.000Z');
	});

	test('rejects a zone the runtime does not know', () => {
		expect(() => resolveQuickPreset('today', { now, timeZone: 'Mars/Olympus_Mons' })).toThrow(RangeError);
	});
});

describe('resolveDashboardTimeRange', () => {
	test('materializes a quick preset as ISO strings', () => {
		expect(resolveDashboardTimeRange({ from: null, to: null, preset: 'last1h' }, { now })).toEqual({
			from: '2024-06-15T11:00:00.000Z',
			to: '2024-06-15T12:00:00.000Z',
		});
	});

	test('ignores dates an older client froze in next to a quick preset', () => {
		const stale = { from: '2020-01-01T00:00:00.000Z', to: '2020-01-02T00:00:00.000Z', preset: 'last24h' };
		expect(resolveDashboardTimeRange(stale, { now })).toEqual({
			from: '2024-06-14T12:00:00.000Z',
			to: '2024-06-15T12:00:00.000Z',
		});
	});

	test('passes custom dates through untouched', () => {
		const custom = { from: '2024-01-01T00:00:00.000Z', to: '2024-01-02T00:00:00.000Z', preset: 'custom' };
		expect(resolveDashboardTimeRange(custom, { now })).toEqual({
			from: '2024-01-01T00:00:00.000Z',
			to: '2024-01-02T00:00:00.000Z',
		});
		expect(resolveDashboardTimeRange({ from: '2024-01-01T00:00:00.000Z', to: null, preset: 'custom' })).toEqual({
			from: '2024-01-01T00:00:00.000Z',
			to: null,
		});
	});

	test('an unknown preset with no dates, no preset, or no range at all is the open window', () => {
		expect(resolveDashboardTimeRange({ from: null, to: null, preset: 'last99h' })).toEqual({
			from: null,
			to: null,
		});
		expect(resolveDashboardTimeRange({ from: null, to: null, preset: null })).toEqual({ from: null, to: null });
		expect(resolveDashboardTimeRange(null)).toEqual({ from: null, to: null });
		expect(resolveDashboardTimeRange(undefined)).toEqual({ from: null, to: null });
	});
});
