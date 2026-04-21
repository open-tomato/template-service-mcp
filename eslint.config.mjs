import baseConfig from '@open-tomato/eslint-config/base';
import globals from 'globals';

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...baseConfig,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      // TypeScript's compiler handles undefined-variable checks for types;
      // no-undef incorrectly flags TypeScript-only types like RequestInit.
      'no-undef': 'off',
    },
  },
  {
    // Tests are excluded from the production tsconfig (`**/*.test.ts`), so
    // the import/typescript resolver cannot see them — disable the rule
    // here. Test imports are validated at runtime by vitest.
    files: ['tests/**/*.ts'],
    rules: {
      'import/no-unresolved': 'off',
    },
  },
];
