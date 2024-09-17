/*
	Command-line trigger for specHelpers.writeImportCode()

	Usage:
	node import-specs.js [name=STR] [dir=STR]
	
	See the specHelpers.writeImportCode() opts arguments
	for description of the 'name', 'dir' options
*/
import path from 'path'
import fs from 'fs'
import { writeImportCode } from './specHelpers'

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
	;(async () => {
		await writeImportCode(opts, targetFile)
	})()
}
