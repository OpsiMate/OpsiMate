import type { AiFilterResult } from '@OpsiMate/shared';
import { aiFilterTimeRange } from '@/components/Alerts/utils/aiFilter.utils';
import { describe, expect, test } from 'vitest';

const result = (lastMinutes?: number): AiFilterResult => ({
	filters: {},
	explanation: 'test result',
	...(lastMinutes === undefined ? {} : { lastMinutes }),
});

describe('AI filter time range', () => {
	test('a query without a time phrase clears the previous AI window', () => {
		let timeRange = aiFilterTimeRange(result(60));
		expect(timeRange).toEqual({ from: null, to: null, preset: 'last1h' });

		timeRange = aiFilterTimeRange(result());
		expect(timeRange).toEqual({ from: null, to: null, preset: null });
	});
});
