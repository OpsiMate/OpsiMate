import { describe, expect, test } from 'vitest';
import { criteriaMatchesAlert, getNameNeedles } from '@OpsiMate/shared';
import { parseNameColumn, serializeNameColumn } from '../src/dal/matcherColumn';

// Name matching gained OR: a rule can now say "name contains disk OR cpu", which label
// matchers could always express through groups. These pin the semantics AND the storage
// round-trip, including rows written before the list existed.

const alert = (alertName: string, tags: Record<string, string> = {}) => ({ alertName, tags });

describe('getNameNeedles', () => {
	test('the OR list wins when present', () => {
		expect(getNameNeedles({ nameContains: 'legacy', nameContainsAny: ['disk', 'cpu'] })).toEqual(['disk', 'cpu']);
	});

	test('a rule saved with the single legacy value folds into a one-item list', () => {
		expect(getNameNeedles({ nameContains: 'disk' })).toEqual(['disk']);
	});

	test('blank rows never become a match-everything needle', () => {
		expect(getNameNeedles({ nameContainsAny: ['  ', ''] })).toEqual([]);
		expect(getNameNeedles({ nameContains: '   ' })).toEqual([]);
	});
});

describe('criteriaMatchesAlert — name OR', () => {
	test('any needle matching is enough, case-insensitively', () => {
		const rule = { nameContainsAny: ['disk', 'CPU'] };
		expect(criteriaMatchesAlert(rule, alert('Disk full on db1'), { emptyCriteriaMatches: false })).toBe(true);
		expect(criteriaMatchesAlert(rule, alert('High cpu steal'), { emptyCriteriaMatches: false })).toBe(true);
		expect(criteriaMatchesAlert(rule, alert('Memory pressure'), { emptyCriteriaMatches: false })).toBe(false);
	});

	test('name and label groups still AND together', () => {
		const rule = { nameContainsAny: ['disk'], labelMatcherGroups: [[{ key: 'env', value: 'prod' }]] };
		expect(criteriaMatchesAlert(rule, alert('Disk full', { env: 'prod' }), { emptyCriteriaMatches: false })).toBe(
			true
		);
		// Right name, wrong env.
		expect(criteriaMatchesAlert(rule, alert('Disk full', { env: 'dev' }), { emptyCriteriaMatches: false })).toBe(
			false
		);
		// Right env, wrong name.
		expect(criteriaMatchesAlert(rule, alert('Memory', { env: 'prod' }), { emptyCriteriaMatches: false })).toBe(
			false
		);
	});

	test('matchAll short-circuits every criterion', () => {
		expect(
			criteriaMatchesAlert({ matchAll: true, nameContainsAny: ['nope'] }, alert('anything'), {
				emptyCriteriaMatches: false,
			})
		).toBe(true);
	});

	test('an empty rule means nothing for mute/enrichment and everything for actions', () => {
		expect(criteriaMatchesAlert({}, alert('anything'), { emptyCriteriaMatches: false })).toBe(false);
		expect(criteriaMatchesAlert({}, alert('anything'), { emptyCriteriaMatches: true })).toBe(true);
	});
});

describe('name column storage', () => {
	test('a single needle stays a plain string, so older code still reads it', () => {
		expect(serializeNameColumn({ nameContainsAny: ['disk'] })).toBe('disk');
	});

	test('multiple needles serialize as JSON and round-trip', () => {
		const raw = serializeNameColumn({ nameContainsAny: ['disk', 'cpu'] });
		expect(raw).toBe('["disk","cpu"]');
		expect(parseNameColumn(raw)).toEqual({ nameContains: 'disk', nameContainsAny: ['disk', 'cpu'] });
	});

	test('legacy rows (a bare substring) read as a one-item list', () => {
		expect(parseNameColumn('disk')).toEqual({ nameContains: 'disk', nameContainsAny: ['disk'] });
	});

	test('no criterion round-trips as null', () => {
		expect(serializeNameColumn({})).toBeNull();
		expect(parseNameColumn(null)).toEqual({ nameContains: null, nameContainsAny: [] });
	});

	test('a literal name that merely starts with "[" is not mistaken for JSON', () => {
		expect(parseNameColumn('[PROD] disk full')).toEqual({
			nameContains: '[PROD] disk full',
			nameContainsAny: ['[PROD] disk full'],
		});
	});
});
