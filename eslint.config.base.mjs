import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export const baseESLintConfig = tseslint.config( 
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ['**/*.ts'],
		rules: {
			'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
			'no-console': 'warn',
		},
	},
);