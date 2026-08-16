import {
	type Alert,
	AlertFix,
	alertMatchesTagFilter,
	AlertSeverity,
	getAlertTagEntries,
	getAlertTagsArray,
	getAlertTagsString,
} from '@OpsiMate/shared';
import { describe, it, expect } from 'vitest';

const mkAlert = (overrides?: Partial<Alert>): Alert =>
	({
		id: '1',
		alertName: `alert 1`,
		type: 'Grafana',
		status: 'firing',
		severity: 'info',
		tags: {
			severity: AlertSeverity.CRITICAL,
			fix: AlertFix.AUTO,
			priority: 'P1',
		},
		startsAt: new Date(0).toISOString(),
		updatedAt: new Date(0).toISOString(),
		createdAt: new Date(0).toISOString(),
		isSilenced: false,
		...overrides,
	}) as unknown as Alert;

const testAlertWithNonObjectTags = {
	tags: 'severity: info',
} as unknown as Alert;

describe('getAlertTagArray and getAlertTagEntries', () => {
	const testAlert = mkAlert();

	it('filters out severity and fix key from tag lists', () => {
		expect(getAlertTagsArray(testAlert)).toEqual(['P1']);

		const keys = getAlertTagEntries(testAlert).map((tag) => tag.key);
		expect(keys).toEqual(['priority']);
	});

	it('drops empty string tag values', () => {
		const testAlertWithEmptyTags = mkAlert({
			tags: {
				...mkAlert().tags,
				empty: '',
			},
		});

		expect(getAlertTagsArray(testAlertWithEmptyTags)).not.toContain('');

		const values = getAlertTagEntries(testAlertWithEmptyTags).map((tag) => tag.key);
		expect(values).not.toContain('');
		expect(values).toHaveLength(1);
	});

	it('returns an empty array for missing tags field', () => {
		const testAlertWithNoTags = {} as unknown as Alert;

		expect(getAlertTagsArray(testAlertWithNoTags)).toEqual([]);
		expect(getAlertTagEntries(testAlertWithNoTags)).toEqual([]);
	});

	it('returns an empty array for non object tag field', () => {
		expect(getAlertTagsArray(testAlertWithNonObjectTags)).toEqual([]);
		expect(getAlertTagEntries(testAlertWithNonObjectTags)).toEqual([]);
	});
});

describe('alertMatchesTagFilter', () => {
	const testAlert = mkAlert();

	it('returns true when the tag matches in the filter list', () => {
		const fitlerValues = ['P1'];
		expect(alertMatchesTagFilter(testAlert, fitlerValues)).toBeTruthy();
	});

	it('returns true for an empty filter list (no filter)', () => {
		const emptyFilterValues: string[] = [];

		expect(alertMatchesTagFilter(testAlert, emptyFilterValues)).toBeTruthy();
	});

	it('returns false when filter list does not match a tag', () => {
		const idFilterValues = ['id'];

		expect(alertMatchesTagFilter(testAlert, idFilterValues)).toBeFalsy();
	});
});

describe('getAlertTagsString', () => {
	it('returns alert tags as a string joined with ,', () => {
		const testAlert = mkAlert({
			tags: {
				priority: 'P1',
				customTag: 'ops',
			},
		});

		const expectedTags = [testAlert.tags.priority, testAlert.tags.customTag];

		expect(getAlertTagsString(testAlert)).toEqual(expectedTags.join(', '));
	});

	it('returns empty string for no tags', () => {
		const testAlertWithNoTags = {} as unknown as Alert;

		expect(getAlertTagsString(testAlertWithNoTags)).toEqual('');
	});
});
