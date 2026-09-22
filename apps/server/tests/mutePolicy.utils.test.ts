import { describe, expect, test } from 'vitest';
import { isScheduleActiveNow } from '@OpsiMate/shared';

describe('isScheduleActiveNow', () => {
	test('is active during an overnight schedule', () => {
		const schedule = {
			startTime: '22:00',
			endTime: '06:00',
			daysOfWeek: [1],
		};

		expect(isScheduleActiveNow(schedule, new Date(2026, 8, 7, 23, 0))).toBe(true);
		expect(isScheduleActiveNow(schedule, new Date(2026, 8, 8, 5, 0))).toBe(true);
		expect(isScheduleActiveNow(schedule, new Date(2026, 8, 7, 5, 0))).toBe(false);
		expect(isScheduleActiveNow(schedule, new Date(2026, 8, 8, 23, 0))).toBe(false);
	});
	test('is active during a normal same-day schedule', () => {
		const schedule = {
			startTime: '09:00',
			endTime: '17:00',
			daysOfWeek: [1],
		};

		expect(isScheduleActiveNow(schedule, new Date(2026, 8, 7, 12, 0))).toBe(true);
		expect(isScheduleActiveNow(schedule, new Date(2026, 8, 7, 18, 0))).toBe(false);
	});
	test('is inactive when today is not in the schedule', () => {
		const schedule = {
			startTime: '22:00',
			endTime: '06:00',
			daysOfWeek: [1],
		};

		expect(isScheduleActiveNow(schedule, new Date(2026, 8, 8, 23, 0))).toBe(false);
	});
});
