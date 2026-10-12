import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
	plugins: [react()],
	test: {
		globals: true,
		environment: 'jsdom',
		setupFiles: './src/test/setup.ts',
		css: true,
		// Node 26 exposes a built-in localStorage global that shadows jsdom's
		// implementation. Disable it in forked workers so browser tests keep using
		// the jsdom storage configured by the test environment.
		execArgv: ['--no-experimental-webstorage'],
		// Console output goes straight to stdout instead of being shipped to the main
		// process over RPC. A log emitted late — an async query settling as its file
		// finishes — could otherwise still be in flight at teardown, which vitest reports
		// as "Closing rpc while onUserConsoleLog was pending" and fails a green run.
		disableConsoleIntercept: true,
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
			'@OpsiMate/shared': path.resolve(__dirname, '../../packages/shared/src'),
		},
	},
});
