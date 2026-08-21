// eslint.config.js — proteinpaint flat config (eslint 10)
// Replaces the legacy .eslintrc.cjs + .eslintignore (and the ESLINT_USE_FLAT_CONFIG=false
// compat flag). Per-workspace environment globals are declared below (mirrors the previous
// per-directory --env / LINT_ENV setup): client/front = browser, server/rust/python/R = node,
// shared = both. Note: no-undef is off (TypeScript handles undefined vars), so these globals
// are declarative today and only take effect if no-undef is ever turned on.
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier' //Turns off rules that fight prettier
import globals from 'globals' //ready made list of environment globals
import fs from 'fs' //Node's file-system module
import path from 'path' //Node's path module
import { fileURLToPath } from 'url'

// Some lint issues should be errors locally to force developers to address them sooner,
// but only warnings in remote CI so they don't block workflows.
const currentDir = path.dirname(fileURLToPath(import.meta.url))
const sjppDir = path.join(currentDir, '../../sjpp')
const errOrWarn = fs.existsSync(sjppDir) ? 'error' : 'warn'

export default tseslint.config(
	{
		// lint TypeScript only (matches the old `--ext .ts`); ported .eslintignore patterns + deps
		// Skip all JavaScript files
		ignores: [
			'**/*.js',
			'**/*.cjs',
			'**/*.mjs',
			'**/tmp*/*',
			'client/types/test/d3.type.spec.ts',
			'container/coverage/server/*',
			'shared/types/dist/*',
			'shared/types/src/test/numeric.type.spec.ts',
			'**/dist/**',
			'**/*.d.ts'
		]
	},
	{
		files: ['**/*.ts'],
		extends: [js.configs.recommended, ...tseslint.configs.recommended, prettier],
		rules: {
			// TypeScript handles undefined vars, so no-undef stays off
			'no-undef': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-non-null-assertion': 'off',
			'@typescript-eslint/no-unused-vars': [
				errOrWarn,
				{ caughtErrors: 'all', caughtErrorsIgnorePattern: '^_', argsIgnorePattern: '^_' }
			],
			'@typescript-eslint/consistent-type-imports': errOrWarn,
			'no-unused-private-class-members': errOrWarn,
			// eslint 10 added these to recommended; keep this PR behavior-neutral (adopt separately)
			'no-useless-assignment': 'off',
			'preserve-caught-error': 'off',
			'no-unassigned-vars': 'off'
		}
	},
	// per-workspace environment globals (browser vs node vs shared)
	{
		files: ['client/**/*.ts', 'front/**/*.ts'],
		// RequestInfo/RequestInit are TS type-only aliases (not in globals.browser); whitelist so no-undef doesn't flag type usage
		languageOptions: { globals: { ...globals.browser, RequestInfo: 'readonly', RequestInit: 'readonly' } },
		rules: { 'no-undef': 'error' }
	},
	{
		files: ['server/**/*.ts', 'rust/**/*.ts', 'python/**/*.ts', 'R/**/*.ts'],
		// NodeJS namespace + webpack's __non_webpack_require__ aren't in globals.node; whitelist for no-undef
		languageOptions: { globals: { ...globals.node, NodeJS: 'readonly', __non_webpack_require__: 'readonly' } },
		rules: { 'no-undef': 'error' }
	},
	{
		files: ['shared/**/*.ts'],
		// shared type code references DOM types (Element/MouseEvent/Selection) not in the intersection; whitelist for no-undef
		languageOptions: {
			// TODO: shared code should not expect browser globals like Element, MouseEvent, Selection,
			// see the comment in shared/types/src/termsetting.ts to move these browser-specific type declarations
			// to client/termsetting/types.ts instead
			globals: { ...globals['shared-node-browser'], Element: 'readonly', MouseEvent: 'readonly', Selection: 'readonly' }
		},
		rules: { 'no-undef': 'error' }
	}
)
