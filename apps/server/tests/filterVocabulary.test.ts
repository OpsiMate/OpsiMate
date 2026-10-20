import { AlertFacetsResult } from '@OpsiMate/shared';
import { describe, expect, test } from 'vitest';
import { buildVocabulary, sanitizeFilters, validateFilters } from '../src/bl/alerts/filterVocabulary';

// The filter vocabulary shared by the AI filter-from-text feature (drops what it cannot
// validate) and the MCP tools (rejects it, naming what would be accepted).

const facets: AlertFacetsResult = {
	facets: {
		status: { Firing: 3 },
		severity: { Critical: 1, Warning: 2 },
		type: { Custom: 3 },
		alertName: { 'DB down': 1, 'Disk full': 2 },
		owner: { Unassigned: 2, 'Idan L': 1 },
		'tagKey:env': { prod: 2, staging: 1 },
	},
	total: 3,
	silencedTotal: 0,
	tagKeys: [{ key: 'env', label: 'Env', values: ['prod', 'staging'] }],
};

describe('validateFilters', () => {
	test('canonicalises casing and keeps "!field" exclusions on the same vocabulary', () => {
		const result = validateFilters({ severity: ['critical', 'WARNING'], '!status': ['firing'] }, facets);
		expect(result).toEqual({ ok: true, filters: { severity: ['Critical', 'Warning'], '!status': ['Firing'] } });
	});

	test('fixed values validate even when no alert carries them right now', () => {
		expect(validateFilters({ status: ['Resolved', 'Silenced'] }, facets)).toEqual({
			ok: true,
			filters: { status: ['Resolved', 'Silenced'] },
		});
		// "Unassigned" is what an unowned alert presents, whatever the facets say.
		expect(
			validateFilters({ owner: ['unassigned'] }, { ...facets, facets: { ...facets.facets, owner: {} } })
		).toEqual({ ok: true, filters: { owner: ['Unassigned'] } });
	});

	test('an unknown value is rejected with the known values listed', () => {
		const result = validateFilters({ severity: ['Blocker'] }, facets);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.problems).toHaveLength(1);
		expect(result.problems[0]).toContain('"Blocker"');
		expect(result.problems[0]).toContain('"Critical"');
		expect(result.problems[0]).toContain('"Info"');
	});

	test('an unknown field is rejected with the known fields and tag fields listed', () => {
		const result = validateFilters({ priority: ['P1'] }, facets);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.problems[0]).toContain('"priority"');
		expect(result.problems[0]).toContain('severity');
		expect(result.problems[0]).toContain('tagKey:env');
	});

	test('every problem is reported, not just the first', () => {
		const result = validateFilters({ priority: ['P1'], severity: ['Blocker'], status: ['Firing'] }, facets);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.problems).toHaveLength(2);
	});

	test('alertName and tag values are free text and pass through untouched', () => {
		const filters = { alertName: ['anything'], 'tagKey:env': ['PROD', 'nowhere'], '!tagKey:region': ['eu'] };
		expect(validateFilters(filters, facets)).toEqual({ ok: true, filters });
	});

	test('values are deduplicated after canonicalisation', () => {
		expect(validateFilters({ severity: ['critical', 'Critical'] }, facets)).toEqual({
			ok: true,
			filters: { severity: ['Critical'] },
		});
	});
});

describe('sanitizeFilters (the AI feature keeps dropping silently)', () => {
	test('drops unknown fields and values, keeps the canonical rest', () => {
		expect(
			sanitizeFilters(
				{
					severity: ['critical', 'Blocker'],
					priority: ['P1'],
					alertName: ['x'],
					'tagKey:env': ['PROD'],
					bad: 'no',
				},
				facets
			)
		).toEqual({ severity: ['Critical'], 'tagKey:env': ['prod'] });
	});

	test('the vocabulary carries the fixed values and skips alertName', () => {
		const vocabulary = buildVocabulary(facets);
		expect(vocabulary.status).toEqual(['Firing', 'Muted', 'Silenced', 'Resolved']);
		expect(vocabulary.severity).toEqual(['Critical', 'Warning', 'Info']);
		expect(vocabulary['tagKey:env']).toEqual(['prod', 'staging']);
		expect(vocabulary.alertName).toBeUndefined();
	});
});
