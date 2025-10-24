import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
	build: {
		target: 'node20',
		outDir: 'dist',
		ssr: true,
		lib: {
			entry: resolve(__dirname, 'src/index.ts'),
			name: 'OpsiMateServer',
			fileName: 'index',
			formats: ['es'],
		},
		rollupOptions: {
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
			output: {
				format: 'es',
			},
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
