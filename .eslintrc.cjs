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
		'@typescript-eslint/consistent-type-imports': errOrWarn
	}
}
