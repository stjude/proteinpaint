/** @type {import('typedoc').TypeDocOptions} */
module.exports = {
	entryPoints: ['./test/checkers/index.ts'],
	out: './public/docs',
	categorizeByGroup: true,
	plugin: ['typedoc-plugin-replace-text', 'typedoc-plugin-missing-exports'],
	excludeExternals: true,
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
