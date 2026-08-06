import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		// vitest 4 switched the default pool from 'forks' to 'threads'. These are
		// integration-style tests (real express apps, native better-sqlite3, config
		// singletons); under threads they cross-contaminate and fail flakily —
		// keep the process isolation they were written against.
		pool: 'forks',
		setupFiles: ['./tests/setup.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: ['node_modules/', 'dist/', 'tests/', '**/*.d.ts', '**/*.test.ts', '**/*.spec.ts'],
		},
	},
	resolve: {
		alias: {
			'@OpsiMate/shared': path.resolve(__dirname, '../../packages/shared/src'),
		},
	},
});
