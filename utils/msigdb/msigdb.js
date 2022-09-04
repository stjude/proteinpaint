if (process.argv.length != 3) {
	console.log('<XML file> creates "msigdb.db" in the current folder')
	process.exit()
}

const xmlFile = process.argv[2]

const fs = require('fs'),
	readline = require('readline')

// for now, skip these at L1
const L1skip = new Set(['ARCHIVED'])

const L1name = {
	C1: 'C1: positional gene sets',
	C2: 'C2: curated gene sets',
	C3: 'C3: regulatory target gene sets',
	C4: 'C4: computational gene sets',
	C5: 'C5: ontology gene sets',
	C6: 'C6: oncogenic signature gene sets',
	C7: 'C7: immunologic signature gene sets',
	C8: 'C8: cell type signature gene sets',
	H: 'H: hallmark gene sets'
}
const L2name = {
	C1_NONE: 'C1_NONE',
	C2_CGP: 'CGP: chemical and genetic perturbations',
	C2_CP: 'CP: Canonical pathways',
	C5_GO: 'GO: Gene Ontology gene sets',
	CGN: 'CGN: cancer gene neighborhoods',
	CGP: 'CGP: chemical and genetic perturbations',
	CM: 'CM: cancer modules',
	CP: 'CP: Canonical pathways',
	GO: 'GO: Gene Ontology gene sets',
	HPO: 'HPO: Human Phenotype Ontology',
	IMMUNESIGDB: 'ImmuneSigDB subset of C7',
	MIR: 'MIR: microRNA targets',
	TFT: 'TFT: transcription factor targets',
	VAX: 'VAX: vaccine reponse gene sets'
}
const L3name = {
	BIOCARTA: 'BIOCARTA subset of CP',
	BP: 'BP: subset of GO',
	CC: 'CC: subset of GO',
	GTRD: 'GTRD subset of TFT',
	KEGG: 'KEGG subset of CP',
	MF: 'MF: subset of GO',
	MIRDB: 'miRDB subset of MIR',
	MIR_Legacy: 'MIR_Legacy subset of MIR',
	PID: 'PID subset of CP',
	REACTOME: 'REACTOME subset of CP',
	TFT_Legacy: 'TFT_Legacy subset of TFT',
	WIKIPATHWAYS: 'WikiPathways subset of CP'
}

const id2term = new Map()
/*
key: term id
value: { type:str, L1:str, L2:str, L3:str, genes }
*/
let nonHumanCount = 0
let missingGeneCount = 0

const rl = readline.createInterface({ input: fs.createReadStream(xmlFile) })
rl.on('line', parseLine)
rl.on('close', outputFiles)

////////////////////////////// helpers

/*
input:
a line of an xml tag describing a gene set

find eligible gene sets and record in the global "id2term" map
*/
function parseLine(line) {
	if (!line.startsWith('<GENESET ')) {
		console.log('skipped line:', line)
		return
	}

	const k2v = xmlLine2kv(line)

	if (k2v.get('ORGANISM') != 'Homo sapiens') {
		nonHumanCount++
		return
	}

	// an object representing this geneset, with attributes parsed from the xml line {L1, L2, L3, genes, ...}
	// to be kept in id2term
	const term = {
		L1: null, // required
		L2: '-', // optional
		L3: '-', // optional
		def: []
	}

	try {
		// STANDARD_NAME as id
		const termId = k2v.get('STANDARD_NAME').trim()
		if (!termId) throw 'STANDARD_NAME missing or blank'
		if (id2term.has(termId)) throw 'duplicating term ID: ' + termId

		// CATEGORY* as hierarchy
		const L1 = k2v.get('CATEGORY_CODE').trim()
		if (!L1) throw 'CATEGORY_CODE missing or blank'
		if (L1skip.has(L1)) return

		term.L1 = L1name[L1]
		if (!term.L1) throw 'unknown L1: ' + L1

		const tmp = k2v.get('SUB_CATEGORY_CODE').trim()
		if (tmp) {
			// if both L2+L3, they are joined by :
			const [L2, L3] = tmp.split(':')
			if (!L2) throw 'SUB_CATEGORY_CODE begins with ":"'
			term.L2 = L2name[L2]
			if (!term.L2) throw 'unknown L2: ' + L2
			if (L3) {
				term.L3 = L3name[L3]
				if (!term.L3) throw 'unknown L3: ' + L3
			}
		}

		// MEMBERS as genes
		if (k2v.has('MEMBERS_SYMBOLIZED')) {
			const s = k2v.get('MEMBERS_SYMBOLIZED').trim()
			if (!s) throw 'MEMBERS_SYMBOLIZED is blank'
			term.genes = s
		} else if (k2v.has('MEMBERS')) {
			const s = k2v.get('MEMBERS').trim()
			if (!s) throw 'MEMBERS is blank'
			term.genes = s
		} else {
			missingGeneCount++
			return
		}

		term.def.push({ label: 'Gene count', value: term.genes.split(',').length })

		// DESCRIPTION_BRIEF
		if (k2v.has('DESCRIPTION_BRIEF')) {
			const tmp = k2v.get('DESCRIPTION_BRIEF').trim()
			if (tmp) {
				term.def.push({ label: 'Description', value: tmp })
			}
		}

		term.def.push({
			label: 'Source',
			value: `<a href=https://www.gsea-msigdb.org/gsea/msigdb/cards/${termId}.html target=_blank>MSigDB</a>`
		})

		id2term.set(termId, term)
	} catch (e) {
		throw 'Error: ' + e + '\nLINE ' + line
	}
}

/*
parses the space-separated attributes on the xml tag, into key-value pairs
(potentially reusable)
find two patterns:
1. keyOnly(space)
2. key="word1(space)word2"(space)
*/
function xmlLine2kv(line) {
	const k2v = new Map()

	let previousIndex = 0,
		doubleQuoteStarted = false,
		thisKey

	for (let i = 0; i < line.length; i++) {
		const c = line[i]
		if (doubleQuoteStarted) {
			if (c == '"') {
				// seeing 2nd "
				const thisValue = line.substring(previousIndex, i)
				k2v.set(thisKey, thisValue)
				doubleQuoteStarted = false
				thisKey = null
				previousIndex = i + 2
			}
			// ignore all else characters as they are all inside the quoted value for thisKey
			continue
		}

		// for the rest, hasn't seen first double quote

		if (c == '"') {
			// seeing 1st "
			doubleQuoteStarted = true
			previousIndex = i + 1
			continue
		}
		if (c == ' ') {
			previousIndex = i + 1
			continue
		}
		if (c == '=') {
			// end of key
			thisKey = line.substring(previousIndex, i)
		}
	}
	return k2v
}

function outputFiles() {
	outputPhenotree()
	outputGenes()
	outputTermHtmlDef()
	console.log('Skipped non-human sets:', nonHumanCount)
	console.log('Missing genes:', missingGeneCount)
}

function outputGenes() {
	const lines = []
	for (const [id, term] of id2term) {
		lines.push(id + '\t' + term.genes)
	}
	fs.writeFileSync('term2genes', lines.join('\n'))
}

function outputPhenotree() {
	const lines = ['Level_1\tLevel_2\tLevel_3\tLevel_4\tVariable\ttype']

	let maxIdLen = 0
	for (const [id, term] of id2term) {
		const { L1, L2, L3 } = term
		maxIdLen = Math.max(maxIdLen, id.length, L1.length, L2.length, L3.length)
		if (L2 == '-') {
			lines.push(`${L1}\t${id}\t-\t-\t${id}\tcategorical`)
			continue
		}
		if (L3 == '-') {
			lines.push(`${L1}\t${L2}\t${id}\t-\t${id}\tcategorical`)
			continue
		}
		lines.push(`${L1}\t${L2}\t${L3}\t${id}\t${id}\tcategorical`)
	}
	fs.writeFileSync('phenotree', lines.join('\n'))
	console.log('max ID length:', maxIdLen)
}

function outputTermHtmlDef() {
	const lines = []
	for (const [id, term] of id2term) {
		lines.push(`${id}\t${JSON.stringify({ description: term.def })}`)
	}
	fs.writeFileSync('termhtmldef', lines.join('\n'))
}
