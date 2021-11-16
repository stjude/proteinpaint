/*
	Creates a target file to import matching test spec files.
	Whenever that target file is updated, it will 
	trigger a rebundling of the app in development mode.

	Usage:
	node import-specs.js [name=STR] [dir=STR]
	
	name: 
		- a glob string to match against spec filenames under client/src
		- defaults to '*'
		- name=? (question mark) will create a target file if missing,
			but will not overwrite if it exists
	
	dir: 
		- a glob string to match against spec dir names under client/src
		- defaults to '**'
*/
const path = require('path')
const writeImportCode = require('./specHelpers').writeImportCode

// get user-supplied arguments from the command line
const opts = process.argv
	.filter(v => v.includes('='))
	.reduce((obj, opt) => {
		const [key, val] = opt.split('=')
		obj[key] = val
		return obj
	}, {})

const targetFile = path.join(__dirname, './internals.js')

if (opts.name != '?' || !fs.existsSync(targetFile)) {
	writeImportCode(opts, targetFile)
}
