import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { SuperTest, Test } from 'supertest';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';

// Same folder the secrets router resolves for the default private_keys_path
const keysDir = path.resolve(__dirname, '../data/private-keys');

const kubeconfig = `apiVersion: v1
kind: Config
clusters:
  - name: staging
    cluster:
      server: https://10.0.4.12:6443
`;

const deployment = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkout-api
`;

let app: SuperTest<Test>;
let db: Database.Database;
let jwtToken: string;

const uploadsNamed = (originalName: string) => fs.readdirSync(keysDir).filter((f) => f.endsWith(`-${originalName}`));

beforeAll(async () => {
	fs.mkdirSync(keysDir, { recursive: true });
	db = await setupDB();
	app = await setupExpressApp(db);
	jwtToken = await setupUserWithToken(app);
});

afterAll(() => {
	db.close();
	uploadsNamed('staging-kubeconfig.yaml').forEach((f) => fs.rmSync(path.join(keysDir, f), { force: true }));
});

describe('POST /api/v1/secrets', () => {
	test('returns 400 when no file is attached', async () => {
		const res = await app
			.post('/api/v1/secrets')
			.set('Authorization', `Bearer ${jwtToken}`)
			.field('displayName', 'staging cluster')
			.field('secretType', 'kubeconfig');

		expect(res.status).toBe(400);
		expect(res.body).toEqual({ success: false, error: 'secret_file is required' });
	});

	test('drops the upload when the body is invalid', async () => {
		const res = await app
			.post('/api/v1/secrets')
			.set('Authorization', `Bearer ${jwtToken}`)
			.field('displayName', '')
			.field('secretType', 'kubeconfig')
			.attach('secret_file', Buffer.from(kubeconfig), 'no-name-kubeconfig.yaml');

		expect(res.status).toBe(400);
		expect(uploadsNamed('no-name-kubeconfig.yaml')).toHaveLength(0);
	});

	test('drops the upload when the content is rejected', async () => {
		const res = await app
			.post('/api/v1/secrets')
			.set('Authorization', `Bearer ${jwtToken}`)
			.field('displayName', 'checkout deployment')
			.field('secretType', 'kubeconfig')
			.attach('secret_file', Buffer.from(deployment), 'checkout-deployment.yaml');

		expect(res.status).toBe(422);
		expect(uploadsNamed('checkout-deployment.yaml')).toHaveLength(0);
	});

	test('stores a valid kubeconfig encrypted', async () => {
		const res = await app
			.post('/api/v1/secrets')
			.set('Authorization', `Bearer ${jwtToken}`)
			.field('displayName', 'staging cluster')
			.field('secretType', 'kubeconfig')
			.attach('secret_file', Buffer.from(kubeconfig), 'staging-kubeconfig.yaml');

		expect(res.status).toBe(201);
		const [stored] = uploadsNamed('staging-kubeconfig.yaml');
		expect(stored).toBeDefined();
		const onDisk = fs.readFileSync(path.join(keysDir, stored), 'utf-8');
		expect(onDisk).not.toBe(kubeconfig);
		expect(onDisk).not.toContain('kind: Config');
	});
});
