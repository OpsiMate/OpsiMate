import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      react: react,
      'jsx-a11y': jsxA11y,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // React Hooks rules
      // TODO: lint rule is too complicated to resolve, this should be done gradually
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // TypeScript rules
      '@typescript-eslint/no-unused-vars': 'off',

      // Semicolons - enforce semicolons everywhere
      semi: ['error', 'always'],

      // React specific rules - enforce functional components only
      'react/function-component-definition': [
        'error',
        {
          namedComponents: 'arrow-function',
          unnamedComponents: 'arrow-function',
        },
      ],

      // Empty lines - max 1 empty line between functions/statements
      'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0 }],
      'lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: true }],

      // Code quality rules
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': 'error',
      'no-debugger': 'error',

      // Import/Export rules
      'no-duplicate-imports': 'error',

      // React best practices
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react/prop-types': 'off', // We use TypeScript

      // Accessibility
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-proptypes': 'error',
      'jsx-a11y/aria-unsupported-elements': 'error',
      'jsx-a11y/role-has-required-aria-props': 'error',
      'jsx-a11y/role-supports-aria-props': 'error',

      // Code style (Prettier handles most formatting)
      quotes: ['error', 'single'],

      // Function rules
      // TODO: lint rule is too complicated to resolve, this should be done gradually
      'max-lines-per-function': ['warn', { max: 50, skipBlankLines: true, skipComments: true }],

      // File length limit (300 lines)
      // TODO: lint rule is too complicated to resolve, this should be done gradually and put as error
      'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],

      // TODO: lint rule is too complicated to resolve, this should be done gradually
      'max-params': ['error', 4],

      // Complexity rules
      // TODO: lint rule is too complicated to resolve, this should be done gradually and put as error
      complexity: ['warn', 10],
      // TODO: lint rule is too complicated to resolve, this should be done gradually
      'max-depth': ['error', 4],
      // TODO: lint rule is too complicated to resolve, this should be done gradually and put as error
      'max-nested-callbacks': ['warn', 3],
    },
  }
);
