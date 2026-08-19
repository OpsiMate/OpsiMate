import { describe, expect, test } from 'vitest';
import { AlertEnrichment } from '@OpsiMate/shared';
import { describeEnrichmentEffects } from '@/pages/Enrichments';

// The Enrichment column sorts by this string, so it has to read like the badges do.
// These assertions pin the exact wording — if EffectBadges changes its decorations and
// this is not updated, the sort quietly stops agreeing with the column.

const enrichment = (partial: Partial<AlertEnrichment>): AlertEnrichment =>
	({ id: 1, name: 'r', addFields: [], ...partial }) as AlertEnrichment;

describe('describeEnrichmentEffects', () => {
	test('fields carry the badge\'s "+" prefix', () => {
		expect(describeEnrichmentEffects(enrichment({ addFields: [{ key: 'severity', value: 'info' }] }))).toBe(
			'+severity=info'
		);
	});

	test('the summary template carries its "summary: " prefix', () => {
		expect(describeEnrichmentEffects(enrichment({ summaryTemplate: '{{summary}} hi' }))).toBe(
			'summary: {{summary}} hi'
		);
	});

	// The badge renders only the label, so the key must too: keying off the url when the
	// label is blank makes two identical-looking rows sort apart.
	test('links contribute their label, never the url behind it', () => {
		const withLink = enrichment({
			addLinks: [{ label: 'Runbook', url: 'https://wiki.example.com/zzz-sorts-last' }],
		});
		expect(describeEnrichmentEffects(withLink)).toBe('Runbook');
		expect(describeEnrichmentEffects(withLink)).not.toContain('wiki.example.com');
	});

	test('everything appears in the order the badges render', () => {
		const full = enrichment({
			addFields: [
				{ key: 'a', value: '1' },
				{ key: 'b', value: '2' },
			],
			addLinks: [{ label: 'Dash', url: 'u' }],
			summaryTemplate: 'S',
		});
		expect(describeEnrichmentEffects(full)).toBe('+a=1 +b=2 Dash summary: S');
	});

	test('a rule with no effects is empty, which useTableSort treats as absent', () => {
		expect(describeEnrichmentEffects(enrichment({}))).toBe('');
	});

	test('two rules with different effects never produce the same key', () => {
		const a = describeEnrichmentEffects(enrichment({ addFields: [{ key: 'k', value: '1' }] }));
		const b = describeEnrichmentEffects(enrichment({ addFields: [{ key: 'k', value: '2' }] }));
		expect(a).not.toBe(b);
	});
});
