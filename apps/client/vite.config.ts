import react from '@vitejs/plugin-react-swc';
import { componentTagger } from 'lovable-tagger';
import path from 'path';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
	server: {
		host: '::',
		port: 8080,
		headers: {
			// Dev-only: lets the JS Self-Profiling API run so performance work can
			// attribute long tasks to real stacks (new Profiler() is blocked without it).
			'Document-Policy': 'js-profiling',
		},
	},
	preview: {
		headers: {
			// Same as server.headers: profiling support for `vite preview` runs.
			'Document-Policy': 'js-profiling',
		},
	},
	plugins: [react(), mode === 'development' && componentTagger()].filter(Boolean),
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
	optimizeDeps: {
		include: ['@OpsiMate/shared'],
		force: true, // Force re-optimization on server start
	},
}));
