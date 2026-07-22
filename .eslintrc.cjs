const fs = require('fs')
const path = require('path')

const sjppDir = path.join(__dirname, '../../sjpp')
// some lint issues should be errors locally to force developers to address issues
// sooner rather than being seen by others or in remote CI;
// these same issues should be warning in remote CI to not block workflows
const errOrWarn = fs.existsSync(sjppDir) ? 'error' : 'warn'

module.exports = {
	root: false,
	parser: '@typescript-eslint/parser',
	plugins: ['@typescript-eslint'],
	extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
	env: {
		browser: process.env.LINT_ENV == 'browser',
		node: !process.env.LINT_ENV || process.env.LINT_ENV == 'node',
		'shared-node-browser': process.env.LINT_ENV == 'shared'
	},
	rules: {
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
		'@typescript-eslint/consistent-type-imports': errOrWarn,
		// added to eslint:recommended in eslint 9; error locally to prompt cleanup, warn in remote CI to not block
		'no-unused-private-class-members': errOrWarn
	}
}
