// eslint.config.js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
	// Plain-JS bootstraps (snapshotWorker.dev.mjs) carry no type information for the
	// type-checked rules below.
	{ ignores: ['**/*.mjs'] },
	js.configs.recommended,
	...tseslint.configs.recommended,
	...tseslint.configs.recommendedTypeChecked,
	{
		files: ['**/*.ts'],
		languageOptions: {
			parserOptions: {
				project: './tsconfig.json',
			},
		},
		rules: {
			'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-floating-promises': 'error',
			'no-console': 'warn',
		},
	},
	{
		files: ['tests/**/*.ts'],
		rules: {
			// Supertest types res.body as any, so these unsafe rules add noise in tests.
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
		},
	},
];
