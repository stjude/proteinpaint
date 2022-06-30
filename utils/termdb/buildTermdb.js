const fs = require('fs')
const exec = require('child_process').execSync
const { parseDictionary } = require('../../client/src/databrowser/dictionary.parse')

/*
requires SQL scripts e.g. "create.sql" to be found under current dir

TODO
- support new term types: condition, survival, time series
- support annotation3Col
*/

const usageNote = `
Usage: $ node buildTermdb.js [arg=value] [more arguments] ...

List of arguments:

phenotree=path
	Required. Value is path/to/phenotreeFile
	Format: https://docs.google.com/document/d/19RwEbWi7Q1bGemz3XpcgylvGh2brT06GFcXxM6rWjI0/edit#heading=h.yskgvu6d9wag

annotation=path
	Optional. Provide path to annotation file as a sample-by-term matrix
	1st line must be header, each field is term id
	1st column must be sample id

	sample \\t term1 \\t term2 \\t ...
	aaa    \\t v1    \\t v2    \\t ...
	bbb    \\t v3    \\t v4    \\t ...

annotation3Col=path
	Optional. Provide path to annotation file in 3-column format
	File has no header line
	1st column is sample name, 2nd column is term ID, 3rd column is value

dbfile=path
	Optional. Provide path to output db file
	If missing, creates "./db"

sqlite3=path
	Optional. Supply path to a "sqlite3" binary file.
	If missing, "sqlite3" must exist in current environment.
`

const runId = Math.ceil(Math.random() * 100000)
// suffix to files created by this script
// e.g. termdb.12345, annotation.12345, etc

// this script will write to following files
// create file names with runId as suffix, to avoid overwriting existing files
// while other files can be temporary, sampleidmap must be kept for reheadering bcf/tabix files
const termdbFile = 'termdb.' + runId,
	sampleidFile = 'sampleidmap.' + runId,
	annotationFile = 'annotation.' + runId,
	loadScript = 'load.sql.' + runId

//////////////////////////////////// main sequence

try {
	// script argument from command line
	const scriptArg = getScriptArg()
	// map{}: key=str, value=str

	const terms = loadPhenotree(scriptArg)

	const annotations = loadAnnotationFile(scriptArg, terms)
	// sampleidFile and annotationFile written

	// load annotations first, in order to populate .values{} for categorical terms
	// then write termdbFile
	writeTermsFile(terms)

	buildDb(terms, annotations, scriptArg)
	// dbfile is created
} catch (e) {
	console.log(`Error: ${e.message || e}`)
	if (e.stack) console.log(e.stack)
	console.log(usageNote)
	process.exit()
}

//////////////////////////////////// helpers

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
	if (!arg.has('dbfile')) arg.set('dbfile', 'db.' + runId)
	if (!arg.has('sqlite3')) arg.set('sqlite3', 'sqlite3')
	try {
		exec(arg.get('sqlite3')) // test if sqlite3 exists
	} catch (e) {
		throw 'sqlite3 command not found'
	}

	return arg
}

function loadPhenotree(scriptArg) {
	const out = parseDictionary(fs.readFileSync(scriptArg.get('phenotree'), { encoding: 'utf8' }))

	return out.terms
}

function loadAnnotationFile(scriptArg, terms) {
	const lines = fs
		.readFileSync(scriptArg.get('annotation'), { encoding: 'utf8' })
		.trim()
		.split('\n')
	const hterms = [] // array of term objs by order of file columns
	const headerfields = lines[0].split('\t')
	for (let i = 1; i < headerfields.length; i++) {
		const tid = headerfields[i]
		if (!tid) throw `blank field at column ${i + 1} in file header`
		const t = terms.find(j => j.id == tid)
		if (!t) throw `header field is not a term id: ${tid}`
		hterms.push(t)
	}

	const annotations = new Map()
	// k: sample integer id
	// v: map{}, k: term id, v: value

	const sample2id = new Map()
	// k: sample name
	// v: integer id
	let _id = 1

	for (let i = 1; i < lines.length; i++) {
		const l = lines[i].split('\t')
		const sample = l[0]
		if (!sample) throw `blank sample name at line ${i + 1}`
		if (sample2id.has(sample)) throw `duplicate sample at line ${i + 1}`
		const sampleId = _id++
		sample2id.set(sample, sampleId)

		annotations.set(sampleId, new Map())

		for (const [j, term] of hterms.entries()) {
			const v = l[j + 1]
			if (!v) {
				// blank, no value for this term
				continue
			}
			if (term.type == 'categorical') {
				annotations.get(sampleId).set(term.id, v)
				if (!(v in term.values)) {
					// auto add
					term.values[v] = { label: v }
				}
			} else if (term.type == 'float') {
				const n = Number(v)
				if (Number.isNaN(n)) throw `value=${v} not number for type=float, term=${term.id}, line=${i + 1}`
				annotations.get(sampleId).set(term.id, n)
			} else if (term.type == 'integer') {
				const n = Number(v)
				if (Number.isInteger(n)) throw `value=${v} not integer for type=integer, term=${term.id}, line=${i + 1}`
				annotations.get(sampleId).set(term.id, n)
			} else {
				throw `unknown term type: ${JSON.stringify(term)}`
			}
		}
	}

	{
		const lines = []
		for (const [s, i] of sample2id) lines.push(i + '\t' + s)
		fs.writeFileSync(sampleidFile, lines.join('\n') + '\n')
	}
	{
		const lines = []
		for (const [s, o] of annotations) {
			for (const [k, v] of o) {
				lines.push(s + '\t' + k + '\t' + v)
			}
		}
		fs.writeFileSync(annotationFile, lines.join('\n') + '\n')
	}

	return annotations
}

function writeTermsFile(terms) {
	const lines = []
	for (const t of terms) {
		lines.push(`${t.id}\t${t.name}\t${t.parent_id || null}\t${JSON.stringify(t)}\t1\t${t.type}\t1`)
	}
	fs.writeFileSync(termdbFile, lines.join('\n') + '\n')
}

function buildDb(terms, annotations, scriptArg) {
	const cmd = scriptArg.get('sqlite3') + ' ' + scriptArg.get('dbfile')

	// create db with blank tables
	exec(cmd + ' < ./create.sql')

	// temp script to load tables
	fs.writeFileSync(
		loadScript,
		`.mode tab
.import ${termdbFile} terms
.import ${annotationFile} annotations
.import ${sampleidFile} sampleidmap\n`
	)

	// load db
	exec(cmd + ' < ' + loadScript)
	fs.unlink(loadScript, () => {})

	// finish up
	exec(cmd + ' < ./set-default-subcohort.sql')
	exec(cmd + ' < ./set-included-types.sql')
	exec(cmd + ' < ./anno-by-type.sql')
}
