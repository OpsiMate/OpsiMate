import { AlertEnrichmentVersion, RetentionResource } from '@OpsiMate/shared';
import Database from 'better-sqlite3';
import { SuperTest, Test } from 'supertest';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup.ts';
import { EnrichmentRepository } from '../src/dal/enrichmentRepository';
import { RetentionRepository } from '../src/dal/retentionRepository';

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

beforeAll(async () => {
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
});

afterAll(() => {
	db.close();
});

describe('Enrichment version history API', () => {
	test('backfills the current content for enrichments created before version history', async () => {
		const legacyDb = new Database(':memory:');
		legacyDb.exec(`
			CREATE TABLE alert_enrichments (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL,
				name_contains TEXT,
				label_matchers TEXT,
				add_fields TEXT,
				summary_template TEXT,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);
			INSERT INTO alert_enrichments (name, name_contains, label_matchers, add_fields, updated_at)
			VALUES (
				'Legacy enrichment',
				'database',
				'[]',
				'[{"key":"team","value":"platform"}]',
				'2024-01-15 12:30:00'
			);
		`);

		const repository = new EnrichmentRepository(legacyDb);
		await repository.initEnrichmentsTable();
		const versions = await repository.getEnrichmentVersions(1);

		expect(versions).toHaveLength(1);
		expect(versions[0].content.name).toBe('Legacy enrichment');
		expect(versions[0].content.addFields).toEqual([{ key: 'team', value: 'platform' }]);
		expect(versions[0].createdAt).toBe('2024-01-15T12:30:00.000Z');
		expect(
			legacyDb.prepare(`SELECT version_history_initialized FROM alert_enrichments WHERE id = 1`).get()
		).toEqual({ version_history_initialized: 1 });
		legacyDb.close();
	});

	test('stores the full content and author for create and update', async () => {
		const createResponse = await app
			.post('/api/v1/enrichments')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({
				name: 'Production database alerts',
				nameContainsAny: ['database', 'postgres'],
				addFields: [{ key: 'team', value: 'platform' }],
				priority: 2,
			});

		expect(createResponse.status).toBe(201);
		const enrichmentId = createResponse.body.data.id as number;

		const updateResponse = await app
			.put(`/api/v1/enrichments/${enrichmentId}`)
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({
				addFields: [
					{ key: 'team', value: 'platform' },
					{ key: 'severity', value: 'critical' },
				],
				priority: 10,
			});

		expect(updateResponse.status).toBe(200);

		const historyResponse = await app
			.get(`/api/v1/enrichments/${enrichmentId}/history`)
			.set('Authorization', `Bearer ${jwtToken}`);

		expect(historyResponse.status).toBe(200);
		const versions = historyResponse.body.data as AlertEnrichmentVersion[];
		expect(versions).toHaveLength(2);
		expect(versions.map((version) => version.version)).toEqual([2, 1]);
		expect(versions.every((version) => version.author === 'Provider User')).toBe(true);
		expect(
			versions.every((version) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(version.createdAt))
		).toBe(true);
		expect(versions[0].content.priority).toBe(10);
		expect(versions[0].content.addFields).toContainEqual({ key: 'severity', value: 'critical' });
		expect(versions[1].content.priority).toBe(2);
		expect(versions[1].content.addFields).not.toContainEqual({ key: 'severity', value: 'critical' });
	});

	test('does not create a version for an empty update', async () => {
		const createResponse = await app
			.post('/api/v1/enrichments')
			.set('Authorization', `Bearer ${jwtToken}`)
			.send({ name: 'No-op update rule', matchAll: true, addFields: [{ key: 'owner', value: 'noc' }] });
		const enrichmentId = createResponse.body.data.id as number;

		await app.put(`/api/v1/enrichments/${enrichmentId}`).set('Authorization', `Bearer ${jwtToken}`).send({});

		const historyResponse = await app
			.get(`/api/v1/enrichments/${enrichmentId}/history`)
			.set('Authorization', `Bearer ${jwtToken}`);

		expect(historyResponse.body.data).toHaveLength(1);
	});

	test('retention can remove old versions without deleting the enrichment', async () => {
		const retentionDb = new Database(':memory:');
		const enrichmentRepository = new EnrichmentRepository(retentionDb);
		const retentionRepository = new RetentionRepository(retentionDb);
		await enrichmentRepository.initEnrichmentsTable();
		await retentionRepository.initRetentionTables();

		const { lastID } = await enrichmentRepository.createEnrichment({
			name: 'Retained rule',
			nameContains: 'database',
			labelMatchers: [],
			addFields: [{ key: 'team', value: 'platform' }],
			addLinks: [],
			summaryTemplate: null,
			priority: 1,
			createdBy: 'Provider User',
			lastModifiedBy: 'Provider User',
		});
		retentionDb
			.prepare(`UPDATE alert_enrichment_versions SET created_at = ? WHERE enrichment_id = ?`)
			.run('2024-01-15T12:30:00.000Z', lastID);

		const deleted = await retentionRepository.purgeOlderThan(
			RetentionResource.EnrichmentVersions,
			'2025-01-01T00:00:00.000Z'
		);

		expect(deleted).toBe(1);
		expect(await enrichmentRepository.getEnrichmentVersions(lastID)).toEqual([]);
		expect((await enrichmentRepository.getEnrichmentById(lastID))?.name).toBe('Retained rule');

		await enrichmentRepository.initEnrichmentsTable();
		expect(await enrichmentRepository.getEnrichmentVersions(lastID)).toEqual([]);
		retentionDb.close();
	});

	test('returns not found for an unknown enrichment', async () => {
		const response = await app.get('/api/v1/enrichments/999999/history').set('Authorization', `Bearer ${jwtToken}`);

		expect(response.status).toBe(404);
		expect(response.body).toEqual({ success: false, error: 'Enrichment not found' });
	});
});
