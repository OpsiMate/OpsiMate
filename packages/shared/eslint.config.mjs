// eslint.config.mjs

import { baseESLintConfig } from '../../eslint.config.base.mjs';
import tseslint from 'typescript-eslint';

export default tseslint.config({ extends: [...baseESLintConfig] }, ...tseslint.configs.recommendedTypeChecked, {
	languageOptions: {
		parserOptions: {
			project: './tsconfig.json',
		},
	},
	rules: {
		'@typescript-eslint/no-explicit-any': 'warn',
		'@typescript-eslint/no-floating-promises': 'error',
	},
});
