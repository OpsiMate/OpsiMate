import { describe, expect, test } from 'vitest';
import { getContrastColor } from '@/lib/colors';
import { getContrastColor as dashboardContrastColor } from '@/components/Dashboards/Dashboards.utils';

describe('tag contrast colour', () => {
	test.each([
		['#ffffff', '#000000'],
		['#000000', '#ffffff'],
		['#ff0000', '#ffffff'],
		['#00ff00', '#000000'],
		['#0000ff', '#ffffff'],
		['#7f7f7f', '#ffffff'],
		['#808080', '#000000'],
		['FFFFFF', '#000000'],
		['000000', '#ffffff'],
	])('uses %s background with %s text', (background, text) => {
		expect(getContrastColor(background)).toBe(text);
	});
	test('keeps the dashboard export pointing to the shared implementation', () => {
		expect(dashboardContrastColor).toBe(getContrastColor);
	});
});
