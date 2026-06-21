// Flat ESLint config for the workspace. Zero warnings is the gate (CLAUDE.md):
// run with --max-warnings is unnecessary because rules are set to "error".
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '.claude/**',
      '**/dist/**',
      '**/out/**',
      '**/.vite/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'vendor/**',
      'packages/spice/wasm/**',
      'apps/*/ios/**',
      'apps/*/android/**',
      '**/*.config.js',
      '**/*.config.ts',
      'e2e/playwright.config.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.worker,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Tests and scripts may use console freely.
    files: ['**/*.test.ts', '**/*.bench.ts', '**/scripts/**', 'e2e/**'],
    rules: { 'no-console': 'off' },
  },
  {
    // Leaf invariant (ADR-0013): @bessel/selene-design is a standalone design system.
    // @bessel/ui may import it, but it must import nothing from Bessel, so the package
    // stays publishable and reusable on its own. This makes that one-directional rule
    // machine-enforced rather than review-only: a `@bessel/*` import from inside selene
    // is a lint error.
    files: ['design-system/selene-design/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@bessel/*'],
              message:
                'selene-design is a leaf design system: it must not import from any @bessel package (ADR-0013). Keep the dependency one-directional (ui -> selene).',
            },
          ],
        },
      ],
    },
  },
);
