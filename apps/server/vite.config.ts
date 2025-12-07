import { defineConfig } from 'vite';
import { VitePluginNode } from 'vite-plugin-node';

export default defineConfig(() => {
	return {
		server: {
			port: 3001,
			host: '0.0.0.0',
			cors: false,
			allowedHosts: ['host.docker.internal'],
		},
		plugins: [
			...VitePluginNode({
				adapter: 'express',
				appPath: './src/vite-app.ts',
				exportName: 'viteNodeApp',
				tsCompiler: 'esbuild',
				swcOptions: {
					jsc: {
						target: 'es2022',
					},
				},
			}),
		],
		optimizeDeps: {
			exclude: ['better-sqlite3'],
		},
	};
});
