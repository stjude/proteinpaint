import { defineConfig } from 'eslint/config'
import tsParser from '@typescript-eslint/parser'
import typescriptEslint from '@typescript-eslint/eslint-plugin'
import js from'@eslint/js'
import fs from'fs'
import path from'path'
import { FlatCompat } from'@eslint/eslintrc'

const __dirname = import.meta.dirname
const compat = new FlatCompat({
	baseDirectory: __dirname,
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all
})
const sjppDir = path.join(__dirname, '../../sjpp')
const errOrWarn = fs.existsSync(sjppDir) ? 'error' : 'warn'

export default defineConfig([
	{
		ignores: [
			'**/node_modules/**/*',
			'**/tmp*/*',
			'**/shared/checkers/**/*',
			'augen/**/checkers/**/*',
			'client/dist/',
			'client/types/test/d3.type.spec.ts',
			'container/coverage/server/*',
			'public/',
			'python/',
			'shared/types/dist/*',
			'shared/types/src/test/numeric.type.spec.ts',
			'**/.*',
			'**/bin/*',
			'**/*bundle.*'
		]
	},
	{
		files: ['**/*.ts'],
		languageOptions: {
			parser: tsParser
		},

		plugins: {
			'@typescript-eslint': typescriptEslint
		},

		extends: compat.extends('eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'),

		rules: {
			'no-unused-private-class-members': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-non-null-assertion': 'off',

			'@typescript-eslint/no-unused-vars': [
				errOrWarn,
				{
					caughtErrors: 'all',
					caughtErrorsIgnorePattern: '^_',
					argsIgnorePattern: '^_'
				}
			],

			'@typescript-eslint/consistent-type-imports': errOrWarn
		}
	}
])
