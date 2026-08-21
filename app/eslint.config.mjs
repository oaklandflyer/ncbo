import globals from 'globals';
import nextPlugin from '@next/eslint-plugin-next';

/**
 * One rule, and the reason it exists.
 *
 * A page shipped with `viewer?.signedIn` in it and no `viewer` in scope. The
 * optional chaining looks like a guard and is not one: `?.` protects against a
 * variable that holds null, never against a variable that does not exist. An
 * undeclared identifier is a ReferenceError the moment the line runs.
 *
 * `next build` compiled it happily — that is a runtime error, not a type error
 * — and this project had no linter to say otherwise. It reached production and
 * took out /hub/profile/edit for everybody.
 *
 * So: `no-undef`, as an error, in CI.
 *
 * The config is deliberately one rule rather than a house style. This codebase
 * has never been linted, and switching on a few hundred stylistic opinions in
 * the same commit as an outage fix would bury the one rule that matters under
 * noise nobody asked for. Two rules were tried and dropped:
 *
 *   `no-unused-vars` flags every component used only in JSX, because core
 *   ESLint cannot see JSX as a reference without the React plugin. 274
 *   warnings, all false.
 *
 *   The `@next/next` rules are a real ruleset worth having, but adopting them
 *   is a decision about house style and belongs in its own change. The plugin
 *   is registered and nothing from it is enabled, which is only so the
 *   existing `eslint-disable @next/next/...` comments resolve to a rule that
 *   exists rather than erroring as unknown.
 */
export default [
  {
    files: ['**/*.js', '**/*.mjs'],
    plugins: { '@next/next': nextPlugin },
    linterOptions: {
      /* Those disable comments are for a ruleset this config does not switch
         on, so they are all "unused" here. They are not wrong, and deleting
         them would only have to be undone later. */
      reportUnusedDisableDirectives: 'off',
    },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.serviceworker,
        React: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
    },
  },
  {
    ignores: ['.next/**', 'node_modules/**'],
  },
];
