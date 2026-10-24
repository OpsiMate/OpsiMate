import { defineConfig } from 'vite';
import { resolve } from 'path';

// Bundled like the server (one file per entry, dependencies external), so the output
// runs as plain Node ESM without extension rewriting.
export default defineConfig({
	build: {
		target: 'node20',
		outDir: 'dist',
		ssr: true,
		rollupOptions: {
			input: {
				cli: resolve(__dirname, 'src/cli.ts'),
				index: resolve(__dirname, 'src/index.ts'),
			},
			output: {
				format: 'es',
				entryFileNames: '[name].js',
			},
			external: [
				'express',
				'zod',
				'@OpsiMate/shared',
				'@modelcontextprotocol/server',
				'@modelcontextprotocol/server/stdio',
				'@modelcontextprotocol/node',
			],
		},
		minify: false,
		sourcemap: true,
	},
	define: {
		'process.env.NODE_ENV': '"production"',
	},
});
