/*
Create PRS database files using the track table of PRS datasets.

Usage: node make_prs_db.js <track_table.prs>
*/

if (process.argv.length !== 4) {
	console.error('Usage: node make_prs_db.js <track_table.prs> <date(MM/YYYY)>')
	process.exit(1)
}

const date = process.argv[3]

const os = require('os')
const path = require('path')
const glob = require('glob')
const fs = require('fs')
const fetch = require('node-fetch').default
const initBinConfig = require('../../server/shared/termdb.initbinconfig')

// PRS db file paths
const prsDbDir = path.join(os.homedir(), 'tp/files/hg38/sjlife/clinical/PRS')
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
		//const prsId = fields[2]
		const ancestry = fields[3]
		const prsAncestry = fields[1]
		const dir = path.join(os.homedir(), 'tp', fields[4])
		let scoreFile = ''
		let scoreFile_maf = ''
		let prsId = ''
		let prsName = fields[2]
		console.log(scoreFile)
		if (prsAncestry === 'All ancestries') {
			scoreFile = [dir + '/' + prs + '.asa.prs']
			scoreFile.push(dir + '/' + prs + '.ceu.prs')
			scoreFile.push(dir + '/' + prs + '.yri.prs')
			scoreFile_maf = [dir + '/' + prs + '.asa.maf.prs']
			scoreFile_maf.push(dir + '/' + prs + '.ceu.maf.prs')
			scoreFile_maf.push(dir + '/' + prs + '.yri.maf.prs')
			prsId = prs + '_all'
		} else if (prsAncestry === 'European ancestry') {
			scoreFile = [dir + '/' + prs + '.ceu.prs']
			scoreFile_maf = [dir + '/' + prs + '.ceu.maf.prs']
			prsId = prs + '_ceu'
		} else if (prsAncestry === 'Asian ancestry') {
			scoreFile = [dir + '/' + prs + '.asa.prs']
			scoreFile_maf = [dir + '/' + prs + '.asa.maf.prs']
			prsId = prs + '_asa'
		} else if (prsAncestry === 'African ancestry') {
			scoreFile = [dir + '/' + prs + '.yri.prs']
			scoreFile_maf = [dir + '/' + prs + '.yri.maf.prs']
			prsId = prs + '_yri'
		}
		//const scoreFiles_maf = glob.sync(dir + '/*.prs.mafFilt.profile')
		const id2score = get_id2score(scoreFile)
		const id2score_maf = get_id2score(scoreFile_maf)
		const pop2stat = get_stat(prs, dir)
		const pop2stat_maf = get_stat(prs + '_maf', dir)
		const [metadata, metadata_maf] = await get_metadata(prs, dir, pop2stat, pop2stat_maf)

		prsterms2info.set(prsId, { ancestry: ancestry, annotations: id2score, metadata: metadata, prsName: prsName })
		prsterms2info.set(prsId + '_maf', {
			ancestry: ancestry,
			annotations: id2score_maf,
			metadata: metadata_maf,
			prsName: prsName
		})
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

function get_id2score(scoreFile) {
	const id2score = new Map()
	for (const sf of scoreFile) {
		const lines = fs
			.readFileSync(sf, { encoding: 'utf8' })
			.trim()
			.split('\n')
		lines.shift()
		for (const line of lines) {
			const fields = line.split('\t')
			id2score.set(fields[0], Number(fields[2]))
		}
	}
	return id2score
}

function get_stat(pgsID, prsDir) {
	let asa, ceu, yri
	if (pgsID.endsWith('_maf')) {
		const ID = pgsID.split('_')[0]
		asa = read_stat_file(path.join(prsDir, ID + '.asa.maf.stat'))
		ceu = read_stat_file(path.join(prsDir, ID + '.ceu.maf.stat'))
		yri = read_stat_file(path.join(prsDir, ID + '.yri.maf.stat'))
	} else {
		asa = read_stat_file(path.join(prsDir, pgsID + '.asa.stat'))
		ceu = read_stat_file(path.join(prsDir, pgsID + '.ceu.stat'))
		yri = read_stat_file(path.join(prsDir, pgsID + '.yri.stat'))
	}
	const qcStat = { asa: asa, ceu: ceu, yri: yri }
	return qcStat
}

function read_stat_file(file) {
	const pop2stat = new Map()
	const lines = fs
		.readFileSync(file, { encoding: 'utf8' })
		.trim()
		.split('\n')
	for (const line of lines) {
		const fields = line.split('\t')
		pop2stat.set(fields[0], Number(fields[1]))
	}
	return pop2stat
}

function QC(stat, maf = false) {
	const qc = []
	const labels = {
		sexChromosomeVar: 'Sex Chromosome Variants',
		strandAmbiguousVar: 'Strand-ambiguous Variants',
		dupVar: 'Duplicated Variants',
		lowCallRateVar: 'Varinats with low call rate',
		hweFailedVar: 'Variants with failed HWE test',
		mafLowVar: 'Variants with MAF <1% are dropped'
	}
	if (!maf) {
		delete labels.mafLowVar
	}
	const POP = ['asa', 'ceu', 'yri']
	const POPlabel = {
		asa: 'Asian',
		ceu: 'European',
		yri: 'African American'
	}
	for (const c in labels) {
		const value = []
		POP.forEach(v => {
			value.push(POPlabel[v] + '=' + stat[v].get(c))
		})
		qc.push({ label: labels[c], value: value.join('; ') })
	}
	return qc
}

async function get_metadata(pgsID, prsDir, stat, stat_maf) {
	console.log(pgsID)
	const matchedVariant = fs
		.readFileSync(glob.sync(prsDir + '/sjlife.ccss.variants.Match')[0], { encoding: 'utf8' })
		.trim()
		.split('\n')
	const matchedVariantCnt = Array.from(new Set(matchedVariant)).length
	const response = await fetch(`https://www.pgscatalog.org/rest/score/${pgsID}`, { method: 'GET' })
	const obj = await response.json()

	const metadata = [
		{
			label: 'PGS catalog id',
			value: `<a href="https://www.pgscatalog.org/score/${obj.id}" target="_blank">${obj.id}</a>`
		},
		{ label: 'Reported trait', value: obj.trait_reported },
		{
			label: 'Variants',
			value: [
				{ label: 'Number of variants', value: obj.variants_number },
				{ label: 'Number of matched variants', value: matchedVariantCnt },
				{ label: 'Skipped variants', value: QC(stat, (maf = false)) }
			]
		},
		{ label: 'Development method', value: obj.method_name }
	]
	const metadata_maf = [
		{
			label: 'PGS catalog id',
			value: `<a href="https://www.pgscatalog.org/score/${obj.id}" target="_blank">${obj.id}</a>`
		},
		{ label: 'Reported trait', value: obj.trait_reported },
		{
			label: 'Variants',
			value: [
				{ label: 'Number of variants', value: obj.variants_number },
				{ label: 'Number of matched variants', value: matchedVariantCnt },
				{ label: 'Skipped variants', value: QC(stat_maf, (maf = true)) }
			]
		},
		{ label: 'Development method', value: obj.method_name }
	]

	// Information about the development samples may not be available
	let label = 'Development samples'
	let value
	if (obj.samples_variants && obj.samples_variants.length > 0) {
		value = []
		for (const study of obj.samples_variants) {
			value.push({
				label: 'Source study',
				value: [
					{ label: 'Study identifier (GWAS catalog)', value: study.source_GWAS_catalog },
					{ label: 'Sample number', value: study.sample_number },
					{ label: 'Sample ancestry', value: study.ancestry_broad }
				]
			})
		}
	} else if (obj.ancestry_distribution.hasOwnProperty('gwas')) {
		value = []
		for (const pop of Object.entries(obj.ancestry_distribution.gwas.dist)) {
			value.push({
				label: 'Source study',
				value: [
					{ label: 'Sample ancestry', value: pop[0] },
					{ label: 'Percentage', value: pop[1] + '%' },
					{ label: 'Sample number', value: obj.ancestry_distribution.gwas.count }
				]
			})
		}
	} else if (obj.ancestry_distribution.hasOwnProperty('dev')) {
		value = []
		for (const pop of Object.entries(obj.ancestry_distribution.dev.dist)) {
			value.push({
				label: 'Source study',
				value: [
					{ label: 'Sample ancestry', value: pop[0] },
					{ label: 'Percentage', value: pop[1] + '%' },
					{ label: 'Sample number', value: obj.ancestry_distribution.dev.count }
				]
			})
		}
	} else {
		value = 'N/A'
	}
	metadata.push({ label: label, value: value })
	metadata_maf.push({ label: label, value: value })

	// Add publication information
	const pub = {
		label: 'Publication',
		value: [
			{ label: 'Title', value: obj.publication.title },
			{ label: 'Journal', value: obj.publication.journal },
			{ label: 'Date', value: obj.publication.date_publication },
			{
				label: 'PMID',
				value: `<a href="https://pubmed.ncbi.nlm.nih.gov/${obj.publication.PMID}" target="_blank">${obj.publication.PMID}</a>`
			},
			{
				label: 'DOI',
				value: `<a href="https://doi.org/${obj.publication.doi}" target="_blank">${obj.publication.doi}</a>`
			}
		]
	}
	metadata.push(pub)
	metadata_maf.push(pub)

	// Add date detail
	const dateDetail = { label: 'Date', value: date }
	metadata.push(dateDetail)
	metadata_maf.push(dateDetail)

	return [metadata, metadata_maf]
}

function write_ancestry(term2ancestry) {
	//const out_ancestry = []
	const fWrite = fs.createWriteStream(ancestryFile)
	for (const [term, ancestry] of term2ancestry) {
		for (parent of ancestry.split(',')) {
			fWrite.write(term + '\t' + parent + '\n')
			//out_ancestry.push(term + '\t' + parent + '\n')
		}
	}
	//fs.writeFileSync(ancestryFile, out_ancestry.join(''))
}

function write_annotations(prsterms2info) {
	//const out_annotations = []
	const fWrite = fs.createWriteStream(annotationFile)
	for (const [term, info] of prsterms2info) {
		for (const [id, score] of info.annotations) {
			fWrite.write(id + '\t' + term + '\t' + score + '\n')
			//out_annotations.push(id + '\t' + term + '\t' + score + '\n')
		}
	}
	//fs.writeFileSync(annotationFile, out_annotations.join(''))
}

function write_termdb(term2ancestry, prsterms2info) {
	//const out_termdb = []
	const fWrite = fs.createWriteStream(termdbFile)
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
		let name
		if (prsterms2info.has(term)) {
			//let name
			if (term.endsWith('_maf')) {
				name = prsterms2info.get(term).prsName + ' (MAF>1%)'
				//name = term.replace(/^prs_/, '').replace(/_maf$/, ' (MAF>1%)')
			} else {
				name = prsterms2info.get(term).prsName
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
			name = term
			json = {
				name: term,
				id: term
			}
		}
		const type = json.type ? json.type : ''
		const isleaf = json.isleaf ? 1 : 0
		fWrite.write(
			term +
				'\t' +
				name +
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
}

function write_termid2html(prsterms2info) {
	//const out_termid2html = []
	const fWrite = fs.createWriteStream(termid2htmlFile)
	for (const [term, info] of prsterms2info) {
		fWrite.write(term + '\t' + JSON.stringify({ description: info.metadata }) + '\n')
		//out_termid2html.push(term + '\t' + JSON.stringify({ description: info.metadata }) + '\n')
	}
	//fs.writeFileSync(termid2htmlFile, out_termid2html.join(''))
}
