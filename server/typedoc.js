// TODO: re-enable later
//const types = require('./types/testers/index.ts')
//const test = require('./shared/doc').test

module.exports = {
	entryPoints: ['./shared/types/healthcheck.ts'],
	out: '../public/docs/server',
	groupOrder: ['Termdb', 'Termdb - TW', 'TW', '*'],
	categoryOrder: ['Termdb', 'Termdb - TW', 'TW', '*'],
	categorizeByGroup: true,
	plugin: ['typedoc-plugin-replace-text'],
	replaceText: {
		inCodeCommentText: true,
		inCodeCommentTags: true,
		replacements: [
			{
				pattern: 'Type alias',
				flags: 'gi',
				replace: 'Type'
			}
			/*{
				pattern: /^test\:.*\:$/,
				flags: 'gm',
				replace: match => {
					const name = match.slice(5, -1)
					return 'Test:\n```ts\n' + test[name] + '\n```'
				}
			}*/
		]
	}
}
