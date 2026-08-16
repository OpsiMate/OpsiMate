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

describe('getAlertTagArray and getAlertTagEntries', () => {
	const testAlert = {
		tags: {
			severity: AlertSeverity.CRITICAL,
			fix: AlertFix.AUTO,
			priority: 'P1',
		},
	} as unknown as Alert;

	it('filters out severity key from tag lists', () => {
		expect(getAlertTagsArray(testAlert)).not.toContain(testAlert.tags.severity);
		getAlertTagEntries(testAlert).forEach((tagKV) => expect(tagKV).not.toContain('severity'));
	});

	it('filters out fix key from tags list', () => {
		expect(getAlertTagsArray(testAlert)).not.toContain(testAlert.tags.fix);
		getAlertTagEntries(testAlert).forEach((tagKV) => expect(tagKV).not.toContain('fix'));
	});

	it('empty string tag values are dropped', () => {
		const testAlertWithEmptyTags = {
			tags: {
				...testAlert.tags,
				empty: '',
			},
		} as unknown as Alert;

		expect(getAlertTagsArray(testAlertWithEmptyTags)).not.toContain('');
		getAlertTagEntries(testAlertWithEmptyTags).forEach((tagKV) => expect(tagKV).not.toContain(''));
	});

	it('returns an empty array for missing tags field', () => {
		const testAlertWithNoTags = {} as unknown as Alert;

		expect(getAlertTagsArray(testAlertWithNoTags)).toEqual([]);
		expect(getAlertTagEntries(testAlertWithNoTags)).toEqual([]);
	});

	it('returns an empty array for non object tag field', () => {
		const testAlertWithNonObjectTags = {
			tags: 'severity: info',
		} as unknown as Alert;

		expect(getAlertTagsArray(testAlertWithNonObjectTags)).toEqual([]);
		expect(getAlertTagEntries(testAlertWithNonObjectTags)).toEqual([]);
	});
});

describe('alertMatchesTagFilter', () => {
	const testAlert = {
		tags: {
			severity: AlertSeverity.CRITICAL,
			fix: AlertFix.AUTO,
			priority: 'P1',
		},
	} as unknown as Alert;

	it('returns true for an empty filter list (no filter)', () => {
		const emptyFilterValues = [];

		expect(alertMatchesTagFilter(testAlert, emptyFilterValues)).toBeTruthy();
	});

	it('returns false when filter list does not match a tag', () => {
		const idFilterValues = ['id'];

		expect(alertMatchesTagFilter(testAlert, idFilterValues)).toBeFalsy();
	});
});

describe('getAlertTagsString', () => {
	it('returns alert tags as a string joined with ,', () => {
		const testAlert = {
			tags: {
				priority: 'P1',
				customTag: 'ops',
			},
		} as unknown as Alert;
		const expectedTags = [testAlert.tags.priority, testAlert.tags.customTag];

		expect(getAlertTagsString(testAlert)).toEqual(expectedTags.join(', '));
	});

	it('returns empty string for no tags', () => {
		const testAlertWithNoTags = {} as unknown as Alert;

		expect(getAlertTagsString(testAlertWithNoTags)).toEqual('');
	});
});
