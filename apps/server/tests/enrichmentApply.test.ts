import { Alert, AlertEnrichment, AlertSeverity, AlertStatus } from '@OpsiMate/shared';
import { describe, expect, test, vi } from 'vitest';
import { EnrichmentBL } from '../src/bl/enrichments/enrichment.bl';
import { AuditBL } from '../src/bl/audit/audit.bl';
import { EnrichmentRepository } from '../src/dal/enrichmentRepository';

// When several enrichment rules match one alert they chain: highest priority first (ties break
// by creation order), the first rule to write a field key wins, and each rule sees the previous
// rule's output — so summaries compose and later rules can match tags an earlier rule added.
// Only one link case was covered, through the API, so none of that ordering had a guard. These
// tests run the BL directly with a stubbed repository: no database, no HTTP.

const grafanaAlert = (overrides: Partial<Alert> = {}): Alert => ({
	id: 'alert-1',
	type: 'Grafana',
	status: AlertStatus.FIRING,
	severity: AlertSeverity.WARNING,
	alertName: 'disk full on db1',
	summary: 'original',
	tags: {},
	startsAt: '2026-10-01T10:00:00.000Z',
	updatedAt: '2026-10-01T10:05:00.000Z',
	createdAt: '2026-10-01T10:00:00.000Z',
	alertUrl: '',
	isSilenced: false,
	...overrides,
});

// Rules are deliberately NOT given matchAll here: a rule with no criteria matches nothing, so
// every rule below that is meant to fire spells out how it matches.
const rule = (overrides: Partial<AlertEnrichment> & { id: number }): AlertEnrichment => ({
	name: `rule ${overrides.id}`,
	labelMatchers: [],
	addFields: [],
	priority: 0,
	createdAt: '2026-10-01T09:00:00.000Z',
	updatedAt: '2026-10-01T09:00:00.000Z',
	...overrides,
});

const enricherFor = (...rules: AlertEnrichment[]): EnrichmentBL => {
	const repo = { getAllEnrichments: vi.fn().mockResolvedValue(rules) };
	return new EnrichmentBL(repo as unknown as EnrichmentRepository, {} as unknown as AuditBL);
};

describe('applyEnrichments — ordering and conflicts', () => {
	test('the highest-priority rule wins a conflicting field key, whatever order the repository returned', async () => {
		const high = rule({
			id: 1,
			name: 'high',
			priority: 10,
			matchAll: true,
			addFields: [{ key: 'team', value: 'platform' }],
		});
		const low = rule({
			id: 2,
			name: 'low',
			priority: 5,
			matchAll: true,
			addFields: [
				{ key: 'team', value: 'data' },
				{ key: 'tier', value: 'gold' },
			],
		});

		// Passed bottom-up on purpose: the BL ranks the rules itself, it does not trust repo order.
		const [enriched] = await enricherFor(low, high).applyEnrichments([grafanaAlert()]);

		expect(enriched.tags).toEqual({ team: 'platform', tier: 'gold' });
		expect(enriched.appliedEnrichments).toEqual([
			{ id: 1, name: 'high' },
			{ id: 2, name: 'low' },
		]);
	});

	test('equal priority runs the older rule first', async () => {
		const older = rule({
			id: 7,
			name: 'older',
			priority: 3,
			matchAll: true,
			addFields: [{ key: 'owner', value: 'alice' }],
		});
		const newer = rule({
			id: 9,
			name: 'newer',
			priority: 3,
			matchAll: true,
			addFields: [{ key: 'owner', value: 'bob' }],
		});

		const [enriched] = await enricherFor(newer, older).applyEnrichments([grafanaAlert()]);

		expect(enriched.tags.owner).toBe('alice');
		expect(enriched.appliedEnrichments?.map((applied) => applied.id)).toEqual([7, 9]);
	});

	test('a lower-priority rule cannot overwrite a key an earlier rule set, but still adds its own', async () => {
		const first = rule({ id: 1, priority: 10, matchAll: true, addFields: [{ key: 'env', value: 'prod' }] });
		const second = rule({
			id: 2,
			priority: 1,
			matchAll: true,
			addFields: [
				{ key: 'env', value: 'dev' },
				{ key: 'region', value: 'eu' },
			],
		});

		const [enriched] = await enricherFor(first, second).applyEnrichments([grafanaAlert({ tags: { env: 'prod' } })]);

		expect(enriched.tags).toEqual({ env: 'prod', region: 'eu' });
	});

	test('a rule can override a tag the alert already carried', async () => {
		const envToProd = rule({ id: 1, matchAll: true, addFields: [{ key: 'env', value: 'prod' }] });

		const [enriched] = await enricherFor(envToProd).applyEnrichments([grafanaAlert({ tags: { env: 'staging' } })]);

		expect(enriched.tags.env).toBe('prod');
	});

	test('a lower-priority rule can match a tag a higher-priority rule added in the same pass', async () => {
		const addTeam = rule({ id: 1, priority: 10, matchAll: true, addFields: [{ key: 'team', value: 'platform' }] });
		const needsTeam = rule({
			id: 2,
			priority: 1,
			labelMatchers: [{ key: 'team', value: 'platform' }],
			addFields: [{ key: 'sla', value: '24x7' }],
		});

		const [chained] = await enricherFor(addTeam, needsTeam).applyEnrichments([grafanaAlert()]);
		expect(chained.tags).toEqual({ team: 'platform', sla: '24x7' });
		expect(chained.appliedEnrichments?.map((applied) => applied.id)).toEqual([1, 2]);

		// The second rule on its own matches nothing — the first rule is what made it apply.
		const [alone] = await enricherFor(needsTeam).applyEnrichments([grafanaAlert()]);
		expect(alone.tags).toEqual({});
		expect(alone.appliedEnrichments).toBeUndefined();
	});

	test('an alert no rule matches is returned as the same object, with no appliedEnrichments', async () => {
		const alerts = [grafanaAlert({ id: 'a' }), grafanaAlert({ id: 'b', tags: { env: 'prod' } })];
		const onlyStaging = rule({ id: 1, labelMatchers: [{ key: 'env', value: 'staging' }] });

		const enriched = await enricherFor(onlyStaging).applyEnrichments(alerts);

		expect(enriched[0]).toBe(alerts[0]);
		expect(enriched[1]).toBe(alerts[1]);
		expect(enriched[1]).not.toHaveProperty('appliedEnrichments');
	});
});

describe('applyEnrichments — templates', () => {
	test('a field value can copy a tag the alert already has', async () => {
		const copyTeam = rule({ id: 1, matchAll: true, addFields: [{ key: 'owner', value: '{{label.team}}' }] });

		const [enriched] = await enricherFor(copyTeam).applyEnrichments([grafanaAlert({ tags: { team: 'platform' } })]);

		expect(enriched.tags.owner).toBe('platform');
	});

	test('summary templates chain, so a later rule sees the summary the previous rule produced', async () => {
		const ruleA = rule({ id: 1, priority: 10, matchAll: true, summaryTemplate: '[A] {{summary}}' });
		const ruleB = rule({ id: 2, priority: 5, matchAll: true, summaryTemplate: '[B] {{summary}}' });

		const [enriched] = await enricherFor(ruleA, ruleB).applyEnrichments([grafanaAlert({ summary: 'original' })]);

		expect(enriched.summary).toBe('[B] [A] original');
	});

	test('a blank or whitespace-only summary template keeps the current summary', async () => {
		for (const summaryTemplate of ['', '   ']) {
			const blank = rule({ id: 1, matchAll: true, summaryTemplate });

			const [enriched] = await enricherFor(blank).applyEnrichments([grafanaAlert({ summary: 'original' })]);

			expect(enriched.summary).toBe('original');
			expect(enriched.appliedEnrichments).toHaveLength(1);
		}
	});

	test('an unknown placeholder is left exactly as written', async () => {
		const templated = rule({
			id: 1,
			matchAll: true,
			summaryTemplate: 'host={{nope}}',
			addFields: [{ key: 'note', value: '{{nope}}' }],
		});

		const [enriched] = await enricherFor(templated).applyEnrichments([grafanaAlert()]);

		expect(enriched.summary).toBe('host={{nope}}');
		expect(enriched.tags.note).toBe('{{nope}}');
	});
});

describe('applyEnrichments — severity', () => {
	test('a severity field rewrites both the first-class severity and the severity tag', async () => {
		const escalate = rule({ id: 1, matchAll: true, addFields: [{ key: 'severity', value: 'CRIT' }] });

		const [enriched] = await enricherFor(escalate).applyEnrichments([
			grafanaAlert({ severity: AlertSeverity.WARNING }),
		]);

		expect(enriched.severity).toBe(AlertSeverity.CRITICAL);
		expect(enriched.tags.severity).toBe(AlertSeverity.CRITICAL);
	});

	test('a lower-priority rule cannot change a severity an earlier rule already set', async () => {
		const toCritical = rule({
			id: 1,
			priority: 10,
			matchAll: true,
			addFields: [{ key: 'severity', value: 'CRIT' }],
		});
		const toInfo = rule({ id: 2, priority: 1, matchAll: true, addFields: [{ key: 'severity', value: 'info' }] });

		const [enriched] = await enricherFor(toCritical, toInfo).applyEnrichments([grafanaAlert()]);

		expect(enriched.severity).toBe(AlertSeverity.CRITICAL);
		expect(enriched.tags.severity).toBe(AlertSeverity.CRITICAL);
		expect(enriched.appliedEnrichments?.map((applied) => applied.id)).toEqual([1, 2]);
	});
});

describe('applyEnrichments — links', () => {
	test('the legacy alertUrl and runbookUrl on the alert materialize before the links from the rule', async () => {
		const withLink = rule({
			id: 1,
			matchAll: true,
			addLinks: [{ label: 'Dashboard', icon: 'grafana', url: 'https://dash.example.com' }],
		});
		const alert = grafanaAlert({
			alertUrl: 'https://grafana.example.com/abc',
			runbookUrl: 'https://wiki.example.com/db',
		});

		const [enriched] = await enricherFor(withLink).applyEnrichments([alert]);

		expect(enriched.links).toEqual([
			{ label: 'Source', icon: 'Grafana', url: 'https://grafana.example.com/abc' },
			{ label: 'Runbook', icon: '', url: 'https://wiki.example.com/db' },
			{ label: 'Dashboard', icon: 'grafana', url: 'https://dash.example.com' },
		]);
	});

	test('an alert that already has links does not get its alertUrl folded in again', async () => {
		const withLink = rule({
			id: 1,
			matchAll: true,
			// No icon on purpose — a missing icon becomes the generic link icon.
			addLinks: [{ label: 'Dashboard', url: 'https://dash.example.com' }],
		});
		const alert = grafanaAlert({
			alertUrl: 'https://grafana.example.com/abc',
			links: [{ label: 'Existing', icon: '', url: 'https://existing.example.com' }],
		});

		const [enriched] = await enricherFor(withLink).applyEnrichments([alert]);

		expect(enriched.links).toEqual([
			{ label: 'Existing', icon: '', url: 'https://existing.example.com' },
			{ label: 'Dashboard', icon: '', url: 'https://dash.example.com' },
		]);
	});

	test('chained rules adding the same url leave one link, and the first label wins', async () => {
		const first = rule({
			id: 1,
			priority: 10,
			matchAll: true,
			addLinks: [{ label: 'Board', icon: '', url: 'https://shared.example.com' }],
		});
		const second = rule({
			id: 2,
			priority: 5,
			matchAll: true,
			addLinks: [
				{ label: 'Board again', icon: '', url: 'https://shared.example.com' },
				{ label: 'Other', icon: '', url: 'https://other.example.com' },
			],
		});

		const [enriched] = await enricherFor(first, second).applyEnrichments([grafanaAlert()]);

		expect(enriched.links).toEqual([
			{ label: 'Board', icon: '', url: 'https://shared.example.com' },
			{ label: 'Other', icon: '', url: 'https://other.example.com' },
		]);
	});

	test('a link whose url resolves to nothing is skipped', async () => {
		const blank = rule({
			id: 1,
			matchAll: true,
			addLinks: [
				{ label: 'Empty', icon: '', url: '' },
				{ label: 'From an empty summary', icon: '', url: '{{summary}}' },
			],
		});

		const [enriched] = await enricherFor(blank).applyEnrichments([grafanaAlert({ summary: '' })]);

		expect(enriched.links).toEqual([]);
	});

	test('link labels and urls are templated like field values', async () => {
		const templated = rule({
			id: 1,
			matchAll: true,
			addLinks: [
				{ label: '{{name}} on {{label.host}}', icon: '', url: 'https://example.com/host/{{label.host}}' },
			],
		});

		const [enriched] = await enricherFor(templated).applyEnrichments([
			grafanaAlert({ alertName: 'disk full', tags: { host: 'db1' } }),
		]);

		expect(enriched.links).toEqual([{ label: 'disk full on db1', icon: '', url: 'https://example.com/host/db1' }]);
	});
});

describe('applyEnrichments — matching and failures', () => {
	test('a rule with no criteria decorates nothing', async () => {
		const alerts = [grafanaAlert({ id: 'a' }), grafanaAlert({ id: 'b', tags: { env: 'prod' } })];
		const noCriteria = rule({ id: 1, addFields: [{ key: 'managed', value: 'yes' }] });

		const enriched = await enricherFor(noCriteria).applyEnrichments(alerts);

		expect(enriched[0]).toBe(alerts[0]);
		expect(enriched[1]).toBe(alerts[1]);
	});

	test('the same rule with matchAll decorates every alert', async () => {
		const alerts = [grafanaAlert({ id: 'a' }), grafanaAlert({ id: 'b', tags: { env: 'prod' } })];
		const matchEverything = rule({
			id: 1,
			name: 'all',
			matchAll: true,
			addFields: [{ key: 'managed', value: 'yes' }],
		});

		const enriched = await enricherFor(matchEverything).applyEnrichments(alerts);

		expect(enriched.map((alert) => alert.tags.managed)).toEqual(['yes', 'yes']);
		expect(enriched[1].appliedEnrichments).toEqual([{ id: 1, name: 'all' }]);
	});

	test('a repository that fails leaves every alert untouched', async () => {
		const alerts = [grafanaAlert({ id: 'a' }), grafanaAlert({ id: 'b' })];
		const repo = { getAllEnrichments: vi.fn().mockRejectedValue(new Error('db is down')) };
		const bl = new EnrichmentBL(repo as unknown as EnrichmentRepository, {} as unknown as AuditBL);

		const enriched = await bl.applyEnrichments(alerts);

		expect(enriched[0]).toBe(alerts[0]);
		expect(enriched[1]).toBe(alerts[1]);
	});

	test('no rules at all leaves every alert untouched', async () => {
		const alerts = [grafanaAlert({ id: 'a' }), grafanaAlert({ id: 'b' })];

		const enriched = await enricherFor().applyEnrichments(alerts);

		expect(enriched[0]).toBe(alerts[0]);
		expect(enriched[1]).toBe(alerts[1]);
	});
});
