const fs = require('fs')

try {
	// script argument from command line
	const scriptArg = getScriptArg()
	// map{}: key=str, value=str

	const terms = parsePhenotree(scriptArg)

	const annotations = parseAnnotations(scriptArg, terms)

	buildDb(terms, annotations, scriptArg)
} catch (e) {
	console.log(`Error: ${e.message || e}\n${usageNote}`)
	process.exit()
}

////////////////////////// helpers

function getScriptArg() {
	const arg = new Map()
	for (let i = 2; i < process.argv.length; i++) {
		const str = process.argv[i]
		const [k, v] = str.split('=')
		arg.set(k, v)
	}

	if (arg.size == 0) throw 'no arguments'

	if (!arg.has('phenotree')) throw 'missing "phenotree=" argument'
	if (!arg.has('annotation')) throw 'missing "annotation=" argument'
	if (!arg.has('dbfile')) arg.set('dbfile', './db')

	return arg
}

function parsePhenotree(scriptArg) {
	const lines = fs
		.readFileSync(scriptArg.get('phenotree'), { encoding: 'utf8' })
		.trim()
		.split('\n')
	// parse
	return terms
}

function parseAnnotations(scriptArg, terms) {
	return annotations
}

function buildDb(terms, annotations, scriptArg) {}

const usageNote = `$ node buildTermdb.js [arg=value] [more arguments] ...
List of supported arguments:
- phenotree
	Required, value is path/to/phenotreeFile
annotation=path/to/annotationFile
dbfile=path/to/output.db
`
