import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results', 'public', 'design', 'docs'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_', ignoreRestSiblings: true }],
      'no-console': ['error', { allow: ['warn', 'error', 'debug'] }],
      // TanStack ColumnDef<Row, any>: колонки с разными типами значений
      '@typescript-eslint/no-explicit-any': ['error', { ignoreRestArgs: true }],
    },
  },
  { files: ['tests/**/*.ts', 'scripts/**'], rules: { 'no-console': 'off' } },
);
