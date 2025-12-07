import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
	build: {
		target: 'node20',
		outDir: 'dist',
		ssr: true,
		rollupOptions: {
			input: {
				index: resolve(__dirname, 'src/index.ts'),
				worker: resolve(__dirname, 'src/worker.ts'),
			},
			output: {
				format: 'es',
				entryFileNames: '[name].js',
			},
			external: [
				// Node.js built-ins
				'fs',
				'path',
				'url',
				'util',
				'crypto',
				'os',
				'child_process',
				'http',
				'https',
				'net',
				'tls',
				'stream',
				'events',
				'buffer',
				// Dependencies that should not be bundled
				'express',
				'cors',
				'bcrypt',
				'better-sqlite3',
				'jsonwebtoken',
				'@kubernetes/client-node',
				'node-ssh',
				'nodemailer',
				'multer',
				'js-yaml',
				'zod',
				'express-promise-router',
				'sshpk',
				'@OpsiMate/shared',
			],
		},
		minify: false,
		sourcemap: true,
		commonjsOptions: {
			include: [/node_modules/],
			transformMixedEsModules: true,
		},
	},
	// Optimize dependencies for production
	optimizeDeps: {
		exclude: ['better-sqlite3', '@kubernetes/client-node'],
	},
	define: {
		'process.env.NODE_ENV': '"production"',
	},
});
