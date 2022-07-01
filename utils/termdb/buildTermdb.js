const fs = require('fs')
const exec = require('child_process').execSync
const { parseDictionary } = require('../../client/src/databrowser/dictionary.parse')
const initBinConfig = require('../../shared/termdb.initbinconfig')

/*
requires SQL scripts e.g. "create.sql" to be found under current dir

TODO
- support parent-child; right now there's no hierarchies
- support new term types: condition, survival, time series
- support annotation3Col
*/

const usageNote = `
Usage: $ node buildTermdb.js [arg=value] [more arguments] ...

List of arguments:

phenotree=path/to/file
	Optional. Value is path/to/phenotreeFile
	This format supports categorical, integer and float term types. It does not support survival type.
	Format: https://docs.google.com/document/d/19RwEbWi7Q1bGemz3XpcgylvGh2brT06GFcXxM6rWjI0/edit#heading=h.yskgvu6d9wag

terms=path/to/file
	Optional. Value is path/to/termsFile
	The file is tab-delimited text file, with 7 columns. File does not have a header line.
	This format supports categorical/integer/float/survival term types.

	Column 1: id character varying(100) not null,
	name character varying(100) not null,
	parent_id character varying(100),
	jsondata json not null,
	child_order integer not null,
	type text,
	isleaf int

	Either "phenotree" or "terms" is needed.

annotation=path/to/file
	Optional. Provide path to annotation file as a sample-by-term matrix
	1st line must be header, each field is term id
	1st column must be sample id

	sample \\t term1 \\t term2 \\t ...
	aaa    \\t v1    \\t v2    \\t ...
	bbb    \\t v3    \\t v4    \\t ...

annotation3Col=path/to/file
	Optional. Provide path to annotation file in 3-column format
	File has no header line
	1st column is sample name, 2nd column is term ID, 3rd column is value

survival=path/to/file
	Optional. Provide path to survival data.
	File has 4 columns. Does not contain a header line.

	Column 1: sample name
	Column 2: survival term ID
	Column 3: time to event
	Column 4: exit code, 0=death, 1=censored (TODO verify)

dbfile=path/to/file
	Optional. Provide path to output db file
	If missing, creates "./db"

sqlite3=path/to/sqlite3
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
	survivalFile = 'survival.' + runId,
	loadScript = 'load.sql.' + runId

const sampleCollect = {
	name2id: new Map(), // k: sample name, v: integer id
	id: 1 // sample id enumerator
}

//////////////////////////////////// main sequence

try {
	// script argument from command line
	const scriptArg = getScriptArg()
	// map{}: key=str, value=str

	const terms = loadDictionary(scriptArg)

	const annotationData = loadAnnotationFile(scriptArg, terms, sampleCollect)
	// annotationFile written, if data is available

	const survivalData = loadSurvival(scriptArg, terms, sampleCollect)
	// survivalFile written, if data is available

	// load annotations first, in order to populate .values{} for categorical terms
	// and convert all samples to integer ids

	finalizeTerms(terms)

	// then write termdbFile, sampleidmap
	writeFiles(terms)

	buildDb(annotationData, survivalData, scriptArg)
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
	if (!arg.has('phenotree') && !arg.has('terms')) throw '"phenotree=" and "terms=" both missing'
	if (!arg.has('annotation') && !arg.has('annotation3Col') && !arg.has('survival'))
		throw '"annotation=" and "annotation3Col=" and "survival=" all missing'
	if (!arg.has('dbfile')) arg.set('dbfile', 'db.' + runId)
	if (!arg.has('sqlite3')) arg.set('sqlite3', 'sqlite3')
	try {
		exec(arg.get('sqlite3')) // test if sqlite3 exists
	} catch (e) {
		throw 'sqlite3 command not found'
	}

	return arg
}

function loadDictionary(scriptArg) {
	let terms // array of term objects
	if (scriptArg.has('phenotree')) {
		const out = parseDictionary(fs.readFileSync(scriptArg.get('phenotree'), { encoding: 'utf8' }))

		terms = out.terms
	} else {
		terms = loadTermsFile(scriptArg)
	}

	// fill missing attributes and placeholders in term objects
	for (const term of terms) {
		if (!term.type) continue // not graphable
		if (term.type == 'categorical') {
			if (!term.values) term.values = {}
			if (!term.groupsetting) term.groupsetting = { disabled: true }
		} else if (term.type == 'integer' || term.type == 'float') {
			if (!term.values) term.values = {}
			term.__all_values = [] // placeholder to collect all sample values and make binconfig
		} else if (term.type == 'survival') {
		} else {
			throw 'loadDictionary: unknown term type'
		}
	}
	return terms
}

function loadTermsFile(scriptArg) {
	/* use "terms" file
	 */
	const terms = []
	for (const line of fs
		.readFileSync(scriptArg.get('terms'), { encoding: 'utf8' })
		.trim()
		.split('\n')) {
		const [termid, termname, parent_id, jsontext, child_order, type, isleaf] = line.split('\t')

		if (!termid) throw 'termid missing from terms file'
		if (!jsontext) throw 'jsontext missing from terms file'
		const term = JSON.parse(jsontext)
		term.id = termid
		term.name = termname || termid
		if (type) {
			term.type = type
		} else {
			// no type, should be non-graphable branch
		}

		// !!!!!!quick fix to assign _parent_id!!!!
		// need to see how parseDictionary() generate these attributes
		term._parent_id = parent_id
		term._child_order = child_order
		term._isleaf = isleaf
		terms.push(term)
	}
	return terms
}

function loadAnnotationFile(scriptArg, terms, sampleCollect) {
	if (!scriptArg.has('annotation') && !scriptArg.has('annotation3Col')) return

	const annotations = new Map()
	// k: sample integer id
	// v: map{}, k: term id, v: value

	if (scriptArg.has('annotation')) {
		loadMatrix()
	} else {
		load3Col()
	}
	// contents are loaded to annotations{}

	// write annotation file for db loading
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

	/******* helpers
	load3Col()
	loadMatrix()
	loadValue()
	*/

	function load3Col() {
		for (const line of fs
			.readFileSync(scriptArg.get('annotation3Col'), { encoding: 'utf8' })
			.trim()
			.split('\n')) {
			const [sample, termid, value] = line.split('\t')
			if (!sample || !termid || !value) continue

			let sampleId
			if (sampleCollect.name2id.has(sample)) {
				sampleId = sampleCollect.name2id.get(sample)
			} else {
				sampleId = sampleCollect.id++
				sampleCollect.name2id.set(sample, sampleId)
			}

			const term = terms.find(i => i.id == termid)
			if (!term) throw 'annotation3Col invalid term id: ' + termid
			loadValue(sampleId, term, value)
		}
	}

	function loadMatrix() {
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
		for (let i = 1; i < lines.length; i++) {
			const l = lines[i].split('\t')
			const sample = l[0]
			if (!sample) throw `blank sample name at line ${i + 1}`
			if (sampleCollect.name2id.has(sample)) throw `duplicate sample at line ${i + 1}`
			const sampleId = sampleCollect.id++
			sampleCollect.name2id.set(sample, sampleId)

			for (const [j, term] of hterms.entries()) {
				const v = l[j + 1]
				if (!v) {
					// blank, no value for this term
					continue
				}
				loadValue(sampleId, term, v)
			}
		}
	}

	function loadValue(sampleId, term, v) {
		if (!annotations.has(sampleId)) annotations.set(sampleId, new Map())

		if (term.type == 'categorical') {
			annotations.get(sampleId).set(term.id, v)
			if (!(v in term.values)) {
				// the category is missing from .values{}, auto add
				term.values[v] = { label: v }
			}
		} else if (term.type == 'float') {
			const n = Number(v)
			if (Number.isNaN(n)) throw `value=${v} not number for type=float, term=${term.id}, line=${i + 1}`
			annotations.get(sampleId).set(term.id, n)
			term.__all_values.push(n)
		} else if (term.type == 'integer') {
			const n = Number(v)
			if (Number.isInteger(n)) throw `value=${v} not integer for type=integer, term=${term.id}, line=${i + 1}`
			annotations.get(sampleId).set(term.id, n)
			term.__all_values.push(n)
		} else {
			throw `unknown term type: ${JSON.stringify(term)}`
		}
	}
}

function loadSurvival(scriptArg, terms, sampleCollect) {
	if (!scriptArg.has('survival')) return
	const survivalData = new Map() // k: sample id, v: map( termid=>[v1,v2])
	for (const line of fs
		.readFileSync(scriptArg.get('survival'), { encoding: 'utf8' })
		.trim()
		.split('\n')) {
		const [sample, termid, v1, v2] = line.split('\t')
		if (!sample || !termid || !v1 || !v2) continue

		let sampleId
		if (sampleCollect.name2id.has(sample)) {
			sampleId = sampleCollect.name2id.get(sample)
		} else {
			sampleId = sampleCollect.id++
			sampleCollect.name2id.set(sample, sampleId)
		}

		const term = terms.find(i => i.id == termid)
		if (!term) throw 'survival invalid term id: ' + termid
		if (term.type != 'survival') throw 'term id ' + termid + ' type!=survival'

		const tte = Number(v1),
			ec = Number(v2)
		if (Number.isNaN(tte)) throw 'time-to-event not a number'
		if (!Number.isInteger(ec)) throw 'exit code not integer'

		if (!survivalData.has(sampleId)) survivalData.set(sampleId, new Map())
		survivalData.get(sampleId).set(termid, [tte, ec])
	}

	const lines = []
	for (const [s, o] of survivalData) {
		for (const [tid, l] of o) {
			lines.push(`${s}\t${tid}\t${l[0]}\t${l[1]}`)
		}
	}
	fs.writeFileSync(survivalFile, lines.join('\n') + '\n')

	return survivalData
}

function finalizeTerms(terms) {
	for (const term of terms) {
		if (!term.type) continue
		if (term.type == 'categorical') {
			// to do: add checking
		} else if (term.type == 'integer' || term.type == 'float') {
			const computableValues = []
			for (const v of term.__all_values) {
				if (!term.values[v] || !term.values[v].uncomputable) {
					computableValues.push(v)
				}
			}
			if (!term.bins) term.bins = {}
			if (!term.bins.default) {
				term.bins.default = initBinConfig(computableValues)
			}
			delete term.__all_values
		} else if (term.type == 'survival') {
		} else {
			throw 'finalizeTerms: unknown term type'
		}
	}
}

function writeFiles(terms) {
	{
		const lines = []
		for (const t of terms) {
			const parent_id = t._parent_id || ''
			delete t._parent_id
			const child_order = t._child_order
			delete t._child_order
			const isleaf = t._isleaf
			delete t._isleaf
			lines.push(`${t.id}\t${t.name}\t${parent_id}\t${JSON.stringify(t)}\t${child_order}\t${t.type || ''}\t${isleaf}`)
		}
		fs.writeFileSync(termdbFile, lines.join('\n') + '\n')
	}
	{
		const lines = []
		for (const [s, i] of sampleCollect.name2id) lines.push(i + '\t' + s)
		fs.writeFileSync(sampleidFile, lines.join('\n') + '\n')
	}
}

function buildDb(annotationData, survivalData, scriptArg) {
	const cmd = scriptArg.get('sqlite3') + ' ' + scriptArg.get('dbfile')

	// create db with blank tables
	exec(cmd + ' < ./create.sql')

	// ".import" commands
	const importLines = ['.mode tab', `.import ${termdbFile} terms`, `.import ${sampleidFile} sampleidmap`]
	if (annotationData) importLines.push(`.import ${annotationFile} annotations`)
	if (survivalData) importLines.push(`.import ${survivalFile} survival`)

	// temp script to load tables
	fs.writeFileSync(loadScript, importLines.join('\n'))

	// load db
	exec(cmd + ' < ' + loadScript)
	fs.unlink(loadScript, () => {})

	// finish up
	// TODO purpose of each step, as well as order
	exec(cmd + ' < ./setancestry.sql')
	exec(cmd + ' < ./set-default-subcohort.sql')
	exec(cmd + ' < ./set-included-types.sql')
	exec(cmd + ' < ./anno-by-type.sql')
	exec(cmd + ' < ./indexing.sql')
}
