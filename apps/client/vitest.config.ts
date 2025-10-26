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
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
			'@OpsiMate/shared': path.resolve(__dirname, '../../packages/shared/src'),
		},
	},
});
