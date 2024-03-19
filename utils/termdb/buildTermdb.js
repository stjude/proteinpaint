const fs = require('fs')
const exec = require('child_process').execSync
const path = require('path')
const { parseDictionary } = require('../../client/src/databrowser/dictionary.parse')
const initBinConfig = require('../../server/shared/termdb.initbinconfig')
import { getColors } from '../../server/shared/common'

/*
TODO
- support new term types: condition, time series
- do not throw upon any data error; collect all errors and output at the end, so data curator can work through them
- support subcohorts, right now only works for dataset without subchort
*/

const usageNote = `
Usage: $ node buildTermdb.js [arg=value] [more arguments] ...

*** Dependencies ***

1. node.js version 16 or above. No NPM packages needed.
2. sqlite3
3. SQL scripts found at working directory:
   anno-by-type.sql              set-included-types.sql
   create.sql        set-default-subcohort.sql setancestry.sql
   term2genes.msigdb.sql

*** List of arguments ***

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
	All the rest of arguments can be missing.

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

termHtmlDef=path/to/file
	Optional. Provide path to a file with html definition for terms.
	File has 2 columns. Does not contain a header line.

	Column 1: term id
	Column 2: stringified json object

term2genes=path/to/file
	Optional. Provide path to a file with list of gene names for each term id.
	File has 2 columns. Does not contain a header line.
	Hardcoded for MSigDB.

dbfile=path/to/file
	Optional. Provide path to output db file
	If missing, creates "./db.runID"

sqlite3=path/to/sqlite3
	Optional. Supply path to a "sqlite3" binary file.
	If missing, "sqlite3" must exist in current environment.


*** Output ***

Following two files are created at current directory, suffixed by a random number.
Move both files to project directory under tp/ and must not commit to repo.
    file "db.runID"
	file "sampleidmap.runID"
`

const runId = Math.ceil(Math.random() * 100000)
// suffix to files created by this script
// e.g. termdb.12345, annotation.12345, etc

// this script will write to following files
// create file names with runId as suffix, to avoid overwriting existing files
// while other files can be temporary, sampleidmap must be kept for reheadering bcf/tabix files
const termdbFile = 'termdb.' + runId,
	sampleidmapFile = 'sampleidmap.' + runId,
	sampleidFile = 'sampleid.' + runId,
	annotationFile = 'annotation.' + runId,
	survivalFile = 'survival.' + runId,
	loadScript = 'load.sql.' + runId

const sampleCollect = {
	name2id: new Map(), // k: sample name, v: integer id
	id: 1 // sample id enumerator
}
//When assigning colors to categories, if no color is provided, a colorMap is created in order to use the same colors for the same categories
const colorMap = new Map()

//////////////////////////////////// main sequence

try {
	// script argument from command line
	const scriptArg = getScriptArg()
	// map{}: key=str, value=str

	const terms = loadDictionary(scriptArg)
	const id2term = new Map()
	for (const t of terms) id2term.set(t.id, t)

	mayLoadHtmlDef(scriptArg, id2term)

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
	console.log('Done!')
} catch (e) {
	console.log(`
		!!! Error: !!! 
		${e.message || e}
	`)
	if (e.stack) console.log(e.stack)
	process.exit()
}

//////////////////////////////////// helpers

function getScriptArg() {
	console.log('validating arguments ...')
	const allowedArgs = new Set([
		'phenotree',
		'terms',
		'annotation',
		'annotation3Col',
		'survival',
		'sqlite3',
		'dbfile',
		'termHtmlDef',
		'term2genes'
	])
	const arg = new Map()
	try {
		for (let i = 2; i < process.argv.length; i++) {
			const str = process.argv[i]
			const [k, v] = str.split('=')
			if (!allowedArgs.has(k)) throw `unsupported argument '${k}' in '${str}'`
			arg.set(k, v)
		}

		if (arg.size == 0) throw 'no arguments'
		if (!arg.has('phenotree') && !arg.has('terms')) throw '"phenotree=" and "terms=" both missing'
		/*
		allow annotation files to be missing, and process only dictionary without sample info

		if (!arg.has('annotation') && !arg.has('annotation3Col') && !arg.has('survival'))
			throw '"annotation=" and "annotation3Col=" and "survival=" all missing'
		*/
		if (!arg.has('dbfile')) arg.set('dbfile', 'db.' + runId)
		if (!arg.has('sqlite3')) arg.set('sqlite3', 'sqlite3')
		try {
			exec(arg.get('sqlite3')) // test if sqlite3 exists
		} catch (e) {
			throw 'sqlite3 command not found'
		}
	} catch (e) {
		console.log(`
			!!! Error: !!! 
			${e.message || e}
		`)
		if (e.stack) console.log(e.stack)
		console.log(usageNote)
		process.exit()
	}

	return arg
}

function loadDictionary(scriptArg) {
	let terms // array of term objects
	if (scriptArg.has('phenotree')) {
		console.log('parsing dictionary ...')
		const out = parseDictionary(fs.readFileSync(scriptArg.get('phenotree'), { encoding: 'utf8' }))
		terms = out.terms
	} else {
		terms = loadTermsFile(scriptArg)
	}

	console.log('filling in missing term attributes ...')
	// fill missing attributes and placeholders in term objects
	for (const term of terms) {
		if (!term.type) continue // not graphable
		if (term.type == 'categorical') {
			if (!term.values) term.values = {}
			const numValues = term.values ? Object.keys(term.values).length : 0
			if (!term.groupsetting) term.groupsetting = { disabled: numValues < 3 }
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
	console.log('loading terms ...')
	/* use "terms" file
	 */
	const terms = []
	const parent_ids = new Set() //To store parent_id for each term in terms
	for (const line of fs.readFileSync(scriptArg.get('terms'), { encoding: 'utf8' }).trim().split('\n')) {
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

		term.parent_id = parent_id
		parent_ids.add(parent_id)
		term.child_order = child_order // not an official json attribute
		term.isleaf = Number(isleaf) ? true : false
		terms.push(term)
	}
	//parent term, whose term.id is found as a parent_id for another term, should have isleaf: 0
	for (const term of terms) {
		if (parent_ids.has(term.id) && term.isleaf) {
			throw term.id + ': isleaf cannot be true for a parent term'
		}
	}
	return terms
}

function mayLoadHtmlDef(scriptArg, id2term) {
	if (!scriptArg.has('termHtmlDef')) return
	for (const line of fs.readFileSync(scriptArg.get('termHtmlDef'), { encoding: 'utf8' }).trim().split('\n')) {
		const [id, s] = line.split('\t')
		if (!id) throw 'id field blank in termHtmlDef file'
		const term = id2term.get(id)
		if (!term) throw 'unknown term id from termHtmlDef: ' + id
		term.hashtmldetail = true
	}
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
		console.log('loading annotation3Col ...')
		for (const line of fs.readFileSync(scriptArg.get('annotation3Col'), { encoding: 'utf8' }).trim().split('\n')) {
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
			if (!term) throw `annotation3Col invalid term id: '${termid}'`
			loadValue(sampleId, term, value)
		}
	}

	function loadMatrix() {
		console.log('loading annotation ...')
		const lines = fs.readFileSync(scriptArg.get('annotation'), { encoding: 'utf8' }).trim().split('\n')
		const hterms = [] // array of term objs by order of file columns
		const headerfields = lines[0].split('\t')
		for (let i = 1; i < headerfields.length; i++) {
			const tid = headerfields[i]
			if (!tid) throw `blank field at column ${i + 1} in file header`
			const t = terms.find(j => j.id == tid)
			if (!t) throw `header field is not a term id: '${tid}'`
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
			if ('color' in term.values[v]) colorMap.set(v, term.values[v].color)
		} else if (term.type == 'float') {
			const n = Number(v)
			if (Number.isNaN(n)) throw `value=${v} not number for type=float, term=${term.id}`
			annotations.get(sampleId).set(term.id, n)
			term.__all_values.push(n)
		} else if (term.type == 'integer') {
			const n = Number(v)
			if (!Number.isInteger(n)) throw `value=${v} not integer for type=integer, term=${term.id}`
			annotations.get(sampleId).set(term.id, n)
			term.__all_values.push(n)
		} else {
			throw `unknown term type: ${JSON.stringify(term)}`
		}
	}
}

function loadSurvival(scriptArg, terms, sampleCollect) {
	if (!scriptArg.has('survival')) return
	console.log('loading survival ...')
	const survivalData = new Map() // k: sample id, v: map( termid=>[v1,v2])
	for (const line of fs.readFileSync(scriptArg.get('survival'), { encoding: 'utf8' }).trim().split('\n')) {
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
		if (!term) throw `survival invalid term id: '${termid}'`
		if (term.type != 'survival') throw `term id '${termid}' type!=survival`

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
	console.log('finalizing terms ...')
	for (const term of terms) {
		if (!term.type) continue
		if (term.type == 'categorical') {
			// to do: add checking
			if (term.values?.length > 2 && term.groupsetting) {
				delete term.groupsetting.disabled
			}
			const k2c = getColors(Object.keys(term.values).length)
			for (const v in term.values) {
				if (!term.values[v].color) {
					const color = colorMap.get(v)
					if (color) term.values[v].color = color
					else colorMap.set(v, k2c(v))
				}
			}
		} else if (term.type == 'integer' || term.type == 'float') {
			const computableValues = []
			for (const v of term.__all_values) {
				if (!term.values[v] || !term.values[v].uncomputable) {
					computableValues.push(v)
				}
			}
			if (!term.bins) term.bins = {}
			if (!term.bins.default && computableValues.length) {
				// missing bin config and has data, generate default config
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
	console.log('writing the input files ...')
	{
		const lines = []
		for (const t of terms) {
			if (t.parent_id == null) {
				/* null for parent_id will fill the string "null" into the terms table
				must delete
				should fix parseDictionary so it won't assign null to root terms
				*/
				delete t.parent_id
			}

			const parent_id = t.parent_id || ''
			delete t.parent_id
			const isleaf = t.isleaf ? 1 : 0
			const child_order = t.child_order
			delete t.child_order
			lines.push(`${t.id}\t${t.name}\t${parent_id}\t${JSON.stringify(t)}\t${child_order}\t${t.type || ''}\t${isleaf}`)
		}
		fs.writeFileSync(termdbFile, lines.join('\n') + '\n')
	}

	if (sampleCollect.name2id.size) {
		const lines = []
		let ids = []
		for (const [s, i] of sampleCollect.name2id) {
			ids.push(i)
			lines.push(i + '\t' + s)
		}
		ids = [...new Set(ids)]

		fs.writeFileSync(sampleidmapFile, lines.join('\n') + '\n')
		if (ids.length == lines.length) fs.writeFileSync(sampleidFile, lines.join('\n') + '\n')
		else fs.writeFileSync(sampleidFile, ids.join('\n') + '\n')
	}
}

function buildDb(annotationData, survivalData, scriptArg) {
	function runDBScript(script, dir = __dirname) {
		console.log(`Running script ${script}`)
		const script_path = path.join(dir, script)
		exec(`${scriptArg.get('sqlite3')} ${scriptArg.get('dbfile')} < ${script_path}`)
	}

	// create db with blank tables
	runDBScript('create.sql')
	console.log('importing data into the db file ...')

	if (scriptArg.has('term2genes')) runDBScript('term2genes.msigdb.sql')

	// ".import" commands
	const importLines = ['PRAGMA foreign_keys=ON;', '.mode tabs']
	if (sampleCollect.name2id.size) {
		importLines.push(`.import ${sampleidFile} samples`)
		importLines.push(`.import ${sampleidmapFile} sampleidmap`)
	}
	importLines.push(`.import ${termdbFile} terms`)
	if (annotationData) importLines.push(`.import ${annotationFile} annotations`)

	if (survivalData) importLines.push(`.import ${survivalFile} survival`)

	if (scriptArg.has('termHtmlDef')) importLines.push(`.import ${scriptArg.get('termHtmlDef')} termhtmldef`)

	if (scriptArg.has('term2genes')) importLines.push(`.import ${scriptArg.get('term2genes')} term2genes`)

	if (scriptArg.has('sampleAncestry')) importLines.push(`.import ${scriptArg.get('sampleAncestry')} sample_ancestry`)

	// temp script to load tables
	fs.writeFileSync(loadScript, importLines.join('\n'))

	// load db
	exec(`${scriptArg.get('sqlite3')} ${scriptArg.get('dbfile')} < ${loadScript}`)

	// index all tables
	runDBScript('indexing.sql')

	// populate ancestry table
	runDBScript('setancestry.sql')

	// populate cohort,term_id,count fields from subcohort_terms table
	// only works for dataset without subcohort, fill blank string to cohort
	if (annotationData || survivalData) runDBScript('set-default-subcohort.sql')
	else runDBScript('set-default-subcohort-no-sample.sql')

	// populate included_types and child_types fields from subcohort_terms table
	runDBScript('set-included-types.sql')

	// create 3 separate tables anno-categorical/integer/float
	runDBScript('anno-by-type.sql')

	fs.unlink(sampleidFile, () => {})
	fs.unlink(sampleidmapFile, () => {})
	fs.unlink(annotationFile, () => {})
	fs.unlink(survivalFile, () => {})
	fs.unlink(loadScript, () => {})
	fs.unlink(termdbFile, () => {})
	fs.unlink(annotationFile, () => {})
	fs.unlink(survivalFile, () => {})
}
