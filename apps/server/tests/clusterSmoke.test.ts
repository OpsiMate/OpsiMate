import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

// Boots the real entry point (src/index.ts) with WEB_CONCURRENCY=2 against a
// throw-away database and checks the things only a real multi-process boot can prove:
// both workers come up on one port, a write through one worker is readable through
// the other, and /metrics answers for the whole group.

const API_TOKEN = 'cluster-smoke-token';
const BOOT_TIMEOUT_MS = 45_000;

let child: ChildProcess | null = null;
let baseUrl = '';
let tmpDir = '';
let stderr = '';

const freePort = () =>
	new Promise<number>((resolve, reject) => {
		const server = net.createServer();
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			const port = typeof address === 'object' && address ? address.port : 0;
			server.close(() => resolve(port));
		});
		server.on('error', reject);
	});

const waitForHealth = async (url: string, timeoutMs: number) => {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1000) });
			if (res.ok) return;
		} catch {
			// not up yet
		}
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	throw new Error(`server did not become healthy within ${timeoutMs}ms\n${stderr.slice(-2000)}`);
};

interface AlertListBody {
	data: { alerts: { id: string }[] };
}

beforeAll(async () => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opsimate-cluster-'));
	fs.mkdirSync(path.join(tmpDir, 'keys'));
	const port = await freePort();
	fs.writeFileSync(
		path.join(tmpDir, 'config.yml'),
		[
			'server:',
			`  port: ${port}`,
			'  host: "127.0.0.1"',
			'database:',
			`  path: "${path.join(tmpDir, 'db.sqlite')}"`,
			'security:',
			`  private_keys_path: "${path.join(tmpDir, 'keys')}"`,
			`  api_token: "${API_TOKEN}"`,
		].join('\n')
	);
	baseUrl = `http://127.0.0.1:${port}`;
	child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
		cwd: path.resolve(__dirname, '..'),
		env: {
			...process.env,
			CONFIG_FILE: path.join(tmpDir, 'config.yml'),
			WEB_CONCURRENCY: '2',
			ALERTS_SNAPSHOT_TTL_MS: '600000', // only the generation row may explain cross-worker reads
			PORT: String(port),
			HOST: '127.0.0.1',
		},
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	child.stdout?.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
	child.stderr?.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
	await waitForHealth(baseUrl, BOOT_TIMEOUT_MS);
}, BOOT_TIMEOUT_MS + 5000);

afterAll(async () => {
	if (child && child.exitCode === null) {
		child.kill('SIGTERM');
		await new Promise<void>((resolve) => {
			child?.once('exit', () => resolve());
			setTimeout(resolve, 15_000).unref();
		});
	}
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('cluster mode (WEB_CONCURRENCY=2)', () => {
	test('the primary reports two workers', () => {
		expect(stderr).toMatch(/2 HTTP workers/);
	});

	test('a write through one worker is readable through every worker', async () => {
		const post = await fetch(`${baseUrl}/api/v1/alerts/custom?api_token=${API_TOKEN}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ id: 'cluster-1', alertName: 'cluster smoke', tags: { env: 'test' } }),
		});
		expect(post.status).toBe(200);
		// Connections are distributed across workers; ten fresh requests hit both.
		for (let i = 0; i < 10; i++) {
			const res = await fetch(`${baseUrl}/api/v1/alerts?api_token=${API_TOKEN}&limit=50`, {
				headers: { connection: 'close' },
			});
			expect(res.status).toBe(200);
			const body = (await res.json()) as AlertListBody;
			expect(body.data.alerts.map((a) => a.id)).toContain('cluster-1');
		}
	});

	test('/metrics aggregates across workers', async () => {
		const res = await fetch(`${baseUrl}/metrics`);
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).toMatch(/^opsimate_alerts_ingested_total\{[^}]*\} [1-9]/m);
		expect(text).toMatch(/^opsimate_ingest_batch_size_count [1-9]/m);
	});
});
