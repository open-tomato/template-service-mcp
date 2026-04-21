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
];
