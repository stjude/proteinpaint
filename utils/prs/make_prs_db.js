/*
Create PRS database files using the track table of PRS datasets.

Usage: node make_prs_db.js <track_table.prs>
*/

if (process.argv.length !== 3) {
	console.error('Usage: node make_prs_db.js <track_table.prs>')
	process.exit(1)
}

const os = require('os')
const path = require('path')
const glob = require('glob')
const fs = require('fs')
const fetch = require('node-fetch').default
const initBinConfig = require('../../server/shared/termdb.initbinconfig')

// PRS db file paths
const prsDbDir = path.join(os.homedir(), 'data', 'tp/files/hg38/sjlife/clinical/PRS')
const ancestryFile = path.join(prsDbDir, 'ancestry.prs')
const annotationFile = path.join(prsDbDir, 'annotation.scores')
const termdbFile = path.join(prsDbDir, 'termdb.prs')
const termid2htmlFile = path.join(prsDbDir, 'termid2htmldef.prs')

;(async function() {
	// Map PRS terms to their ancestries, annotations, and metadata
	const prsterms2info = new Map()
	const ancestries = new Set()
	const lines = fs
		.readFileSync(process.argv[2], { encoding: 'utf8' })
		.trim()
		.split('\n')
	lines.shift() //skip header
	for (const line of lines) {
		const fields = line.split('\t')
		const prs = fields[0]
		const ancestry = fields[1]
		const dir = path.join(os.homedir(), 'data', 'tp', fields[2])
		const scoreFiles = glob.sync(dir + '/*.prs.profile')
		const scoreFiles_maf = glob.sync(dir + '/*.prs.mafFilt.profile')
		const id2score = get_id2score(scoreFiles)
		const id2score_maf = get_id2score(scoreFiles_maf)
		const metadata = await get_metadata(prs, dir)
		prsterms2info.set('prs_' + prs, { ancestry: ancestry, annotations: id2score, metadata: metadata })
		prsterms2info.set('prs_' + prs + '_maf', { ancestry: ancestry, annotations: id2score_maf, metadata: metadata })
		ancestries.add(ancestry)
	}

	// Build a term-ancestry map
	// First, determine ancestries of parent terms
	const term2ancestry = new Map()
	for (const ancestry of ancestries) {
		const terms = ancestry.split(',')
		for (let i = 0; i < terms.length; i++) {
			const term = terms[i]
			let termAncestry
			if (i === 0) {
				termAncestry = ''
			} else {
				termAncestry = terms.slice(0, i).join(',')
			}
			term2ancestry.set(term, termAncestry)
		}
	}
	// Now add in ancestries of prs terms
	for (const [term, info] of prsterms2info) {
		term2ancestry.set(term, info.ancestry)
	}

	// Output ancestry data
	write_ancestry(term2ancestry)

	// Output annotation data
	write_annotations(prsterms2info)

	// Output termdb data
	write_termdb(term2ancestry, prsterms2info)

	// Output termid2html data
	write_termid2html(prsterms2info)
})()

function get_id2score(scoreFiles) {
	const id2score = new Map()
	for (const file of scoreFiles) {
		const lines = fs
			.readFileSync(file, { encoding: 'utf8' })
			.trim()
			.split('\n')
		lines.shift()
		for (const line of lines) {
			const fields = line.split('\t')
			id2score.set(fields[1], Number(fields[3]))
		}
	}
	return id2score
}

async function get_metadata(pgsID, prsDir) {
	const metadata = {}
	const matchedVariantCnt = fs
		.readFileSync(glob.sync(prsDir + '/*.data.hg38.matched.txt')[0], { encoding: 'utf8' })
		.trim()
		.split('\n').length
	const response = await fetch(`https://www.pgscatalog.org/rest/score/${pgsID}`, { method: 'GET' })
	const obj = await response.json()
	metadata['PGS ID'] = obj.id
	metadata['Mapped Trait'] = obj.trait_reported
	metadata['Publication Date'] = obj.publication.date_publication
	metadata['Number of Variants'] = {
		Original: obj.variants_number,
		'SJLIFE + CCSS matched': matchedVariantCnt,
		'QC description': null
	}
	metadata['Development Method'] = obj.method_name
	metadata['Development Samples'] = {
		'Study Identifier': obj.samples_variants[0].source_GWAS_catalog,
		'Sample Number': obj.samples_variants[0].sample_number,
		'Sample Ancestry': obj.samples_variants[0].ancestry_broad
	}
	return metadata
}

function write_ancestry(term2ancestry) {
	const out_ancestry = []
	for (const [term, ancestry] of term2ancestry) {
		for (parent of ancestry.split(',')) {
			out_ancestry.push(term + '\t' + parent + '\n')
		}
	}
	fs.writeFileSync(ancestryFile, out_ancestry.join(''))
}

function write_annotations(prsterms2info) {
	const out_annotations = []
	for (const [term, info] of prsterms2info) {
		for (const [id, score] of info.annotations) {
			out_annotations.push(id + '\t' + term + '\t' + score + '\n')
		}
	}
	fs.writeFileSync(annotationFile, out_annotations.join(''))
}

function write_termdb(term2ancestry, prsterms2info) {
	const out_termdb = []
	for (const [term, ancestry] of term2ancestry) {
		let parent, childOrder
		if (term === 'Genetic Factors') {
			parent = ''
			childOrder = 5
		} else {
			const parents = ancestry.split(',')
			parent = parents[parents.length - 1]
			childOrder = 0
		}
		let json
		if (prsterms2info.has(term)) {
			let name
			if (term.endsWith('_maf')) {
				name = term.replace(/^prs_/, '').replace(/_maf$/, ' (MAF>1%)')
			} else {
				name = term.replace(/^prs_/, '')
			}
			const scores = prsterms2info.get(term).annotations.values()
			const binconfig = initBinConfig(Array.from(scores))
			json = {
				name: name,
				id: term,
				isleaf: true,
				type: 'float',
				hashtmldetail: true,
				bins: {
					default: binconfig
				}
			}
		} else {
			json = {
				name: term,
				id: term
			}
		}
		const type = json.type ? json.type : ''
		const isleaf = json.isleaf ? 1 : 0
		out_termdb.push(
			term +
				'\t' +
				term +
				'\t' +
				parent +
				'\t' +
				JSON.stringify(json) +
				'\t' +
				childOrder +
				'\t' +
				type +
				'\t' +
				isleaf +
				'\n'
		)
	}
	fs.writeFileSync(termdbFile, out_termdb.join(''))
}

function write_termid2html(prsterms2info) {
	const out_termid2html = []
	for (const [term, info] of prsterms2info) {
		out_termid2html.push(term + '\t' + JSON.stringify({ description: info.metadata }) + '\n')
	}
	fs.writeFileSync(termid2htmlFile, out_termid2html.join(''))
}
