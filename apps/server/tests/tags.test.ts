import { SuperTest, Test } from 'supertest';
import { Tag } from '@OpsiMate/shared';
import Database from 'better-sqlite3';
import { expect } from 'vitest';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

const seedTags = () => {
	db.exec('DELETE FROM tags');
	db.prepare(
		`
			INSERT INTO tags (id, name, color, created_at)
			VALUES (1, 'Test Tag', '#FF5733', CURRENT_TIMESTAMP)`
	).run();
};

beforeAll(async () => {
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
});

beforeEach(() => {
	seedTags();
});

afterAll(() => {
	db.close();
});

describe('Tags API', () => {
	test('should get all tags', async () => {
		const res = await app.get('/api/v1/tags').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);

		const tags = res.body.data;
		expect(Array.isArray(tags)).toBe(true);
		expect(tags.length).toEqual(1);

		const tag = tags[0];
		expect(tag.id).toBeDefined();
		expect(tag.name).toBe('Test Tag');
		expect(tag.color).toBe('#FF5733');
	});

	test('should create a new tag', async () => {
		const tagData = {
			name: 'New Tag',
			color: '#00FF00',
		};

		const createRes = await app.post('/api/v1/tags').set('Authorization', `Bearer ${jwtToken}`).send(tagData);

		expect(createRes.status).toBe(201);
		expect(createRes.body.success).toBe(true);
		expect(createRes.body.data.id).toBeDefined();
		expect(createRes.body.message).toBe('Tag created successfully');

		// Verify the tag was created
		const getRes = await app.get('/api/v1/tags').set('Authorization', `Bearer ${jwtToken}`);
		expect(getRes.status).toBe(200);

		const newTag = getRes.body.data.find((t: Tag) => t.name === 'New Tag');
		expect(newTag).toBeDefined();
		expect(newTag.color).toBe('#00FF00');
	});

	test('should get a tag by ID', async () => {
		const res = await app.get('/api/v1/tags/1').set('Authorization', `Bearer ${jwtToken}`);
		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);

		const tag = res.body.data;
		expect(tag.id).toBe(1);
		expect(tag.name).toBe('Test Tag');
		expect(tag.color).toBe('#FF5733');
	});

	test('should update an existing tag', async () => {
		const updateData = {
			name: 'Updated Tag',
			color: '#0000FF',
		};

		const updateRes = await app.put('/api/v1/tags/1').set('Authorization', `Bearer ${jwtToken}`).send(updateData);

		expect(updateRes.status).toBe(200);
		expect(updateRes.body.success).toBe(true);
		expect(updateRes.body.message).toBe('Tag updated successfully');

		// Verify the tag was updated
		const getRes = await app.get('/api/v1/tags/1').set('Authorization', `Bearer ${jwtToken}`);
		expect(getRes.status).toBe(200);

		const updatedTag = getRes.body.data;
		expect(updatedTag.name).toBe('Updated Tag');
		expect(updatedTag.color).toBe('#0000FF');
	});

	test('should delete a tag', async () => {
		const deleteRes = await app.delete('/api/v1/tags/1').set('Authorization', `Bearer ${jwtToken}`);

		expect(deleteRes.status).toBe(200);
		expect(deleteRes.body.success).toBe(true);
		expect(deleteRes.body.message).toBe('Tag deleted successfully');

		// Verify the tag was deleted
		const getRes = await app.get('/api/v1/tags/1').set('Authorization', `Bearer ${jwtToken}`);
		expect(getRes.status).toBe(404);
		expect(getRes.body.success).toBe(false);
		expect(getRes.body.error).toBe('Tag not found');
	});

	test('should require authentication', async () => {
		const getRes = await app.get('/api/v1/tags');
		expect(getRes.status).toBe(401);

		const createRes = await app.post('/api/v1/tags').send({
			name: 'Unauthorized Tag',
			color: '#FF0000',
		});
		expect(createRes.status).toBe(401);
	});

	test('should handle validation errors', async () => {
		const invalidData = {
			// Missing required color field
			name: 'Invalid Tag',
		};

		const createRes = await app.post('/api/v1/tags').set('Authorization', `Bearer ${jwtToken}`).send(invalidData);

		expect(createRes.status).toBe(400);
		expect(createRes.body.success).toBe(false);
		expect(createRes.body.error).toBe('Validation error');
	});
});
