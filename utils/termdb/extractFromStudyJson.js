const fs = require('fs')

const defaults = {
	tp: '.',
	outputDir: './studyExtract'
}

const usageNote = `
Usage: $ node buildTermdb.js [arg=value] [more arguments] ...

*** Dependencies ***
1. node.js version 12 or above. No NPM packages needed.

*** List of arguments ***
*** NOTE: all paths must be RELATIVE to the current working dir ***
study     the study JSON filepath
tp        the tp directory, defaults to the current working directory
output    the output directory to dump extracted terms, annotations data; defaults to './studyExtract'
`

const arg = getScriptArg()
const studyFilePath = arg.study
const tpPathFromCwd = arg.tp || '.'
const outputDir = arg.output || './studyExtract'
run(studyFilePath)

async function run(file) {
	try {
		console.log(`reading study=${file} ...`)
		const studyJSON = fs.readFileSync('./' + file, { encoding: 'utf8' })
		console.log(`parsing study=${file} ...`)
		const study = JSON.parse(studyJSON)
		console.log(`extracting data from study=${file} ...`)
		const data = await hmjsonETL(study)

		const termsTSV = []
		for (const t of data.terms) {
			const isleaf = 'isleaf' in t ? t.isleaf : 1
			const parent_id = 'parent_id' in t ? t.parent_id : ''
			const jsondata = JSON.stringify({ type: t.type, values: t.values, isleaf })
			termsTSV.push(`${t.id}\t${t.name}\t${parent_id}\t${jsondata}\t\t${t.type}\t${isleaf}`)
		}
		fs.writeFileSync(`${outputDir}/terms.txt`, termsTSV.join('\n'))

		const annoTSV = []
		for (const sample in data.annotations) {
			const anno = data.annotations[sample]
			for (const term_id in anno) {
				if (term_id == 'sample') continue
				annoTSV.push(`${sample}\t${term_id}\t${anno[term_id]}`)
			}
		}
		fs.writeFileSync(`${outputDir}/annotations.txt`, annoTSV.join('\n'))
	} catch (e) {
		throw e
	}
}

async function hmjsonETL(study) {
	const { heatmapJSON, annotations } = study
	if (annotations) {
		if (annotations.inputFormat !== 'metadataTsv') {
			const message = `annotations.inputFormat: '${annotations.inputFormat}' is not supported`
			alert(message)
			throw message
		}

		for (const key in annotations.files) {
			const file = `${tpPathFromCwd}/${annotations.files[key]}`
			console.log(`reading annotation file='${file}' ...`)
			const tsv = fs.readFileSync(file, { encoding: 'utf8' })
			console.log(`adding metadata from annotation file='${file}' ...`)
			heatmapJSON.metadata = addMetadataFromTsv(heatmapJSON, tsv)
		}
	}
	const terms = getTerms(heatmapJSON.metadata)
	return { terms, annotations: heatmapJSON.sampleannotation }
}

function getTerms(metadata) {
	const terms = []
	for (const t of metadata) {
		const term = {
			id: t.key || t.name || t.label,
			name: t.label
		}

		const vKeys = Object.keys(t.values)
		const numericVals = vKeys.filter(isNumeric)
		t.hasOnlyNumericVals = vKeys.length == numericVals.length

		if (t.type) {
			term.type = t.type
		} else if (t.hasOnlyNumericVals) {
			// even though there may be a lot of numeric values here,
			// do not delete, to be used as an argument to initBinConfig()
			// will be deleted later
			t.values = Object.values(t.values) //.filter(v=>v.uncomputable)
			if (!t.values) delete t.values
			term.type = 'float'
		} else {
			term.type = 'categorical'
		}

		if (t.values && ((t.type != 'float' && t.type != 'integer') || t.values.length)) {
			term.values = {}
			for (const key in t.values) {
				term.values[key] = { key, label: key }
				if (t.values[key]) term.values[key].color = t.values[key]
			}
		}

		terms.push(term)
	}
	return terms
}

function isNumeric(n) {
	return !isNaN(parseFloat(n)) && isFinite(n)
}

function addMetadataFromTsv(hm, data) {
	const sampleannotation = {}
	const metadata = {}
	const metaOrder = []
	const groups = {}
	const colorFxn = () => '#ccc' //scaleOrdinal(schemeCategory20)
	let header

	const metakeys = {}
	if (hm.metadata)
		hm.metadata.forEach(grp => {
			metakeys[grp.name] = grp.key
		})
	const rows = typeof data == 'string' ? annoFromTsv(data) : data
	rows.forEach(a => {
		if (!a) return
		if (a.group) {
			a.genegrpname = a.group
			if (!metakeys[a.group]) metakeys[a.group] = a.group
		}
		const key = metakeys[a.term] ? metakeys[a.term] : a.term
		a.gene = a.term
		a.anno = a.term

		const m = Array.isArray(hm.metadata) && hm.metadata.find(m => m.key == a.term)
		if (!metadata[a.term]) {
			metaOrder.push(a.term)
			metadata[a.term] = {
				name: a.term,
				setkey: a.group ? metakeys[a.group] : null,
				label: a.term,
				key: key,
				values: {},
				renderAs: a.renderAs,
				colorRange: a.colorRange ? a.colorRange.split(',') : null,
				barh: a.barh,
				sortorder: 'sortorder' in a && !isNaN(a.sortorder) ? +a.sortorder : 0
			}
		}

		if (!groups[a.group]) {
			groups[a.group] = {}
		}
		if (metadata[a.term].renderAs || !metadata[a.term].values[a.value]) {
			if (a.color) {
				metadata[a.term].values[a.value] = a.color
				groups[a.group][a.value] = a.color
			} else if (groups[a.group][a.value]) {
				metadata[a.term].values[a.value] = groups[a.group][a.value]
			} else if (metadata[a.term]) {
				metadata[a.term].values[a.value] = ''
				groups[a.group][a.value] = ''
			}

			if (a.legendorder) {
				if (!metadata[a.term].legendorder) metadata[a.term].legendorder = {}
				metadata[a.term].legendorder[a.value] = +a.legendorder
			}
		}
		a.fill = metadata[a.term].values[a.value] ? metadata[a.term].values[a.value] : ''

		if (!sampleannotation[a.sample]) sampleannotation[a.sample] = {}
		sampleannotation[a.sample][a.term] = a.value
	})

	hm.sampleannotation = sampleannotation

	return Object.values(metadata).sort((a, b) => {
		return (a.sortorder || b.sortorder) && a.sortorder != b.sortorder
			? a.sortorder - b.sortorder
			: metaOrder.indexOf(a.key) - metaOrder.indexOf(b.key)
	})
}

function annoFromTsv(text) {
	return text.split('\n').reduce((data, line) => {
		if (!line) return data
		if (!data.header) data.header = line.split('\t')
		else {
			const vals = line.split('\t')
			const a = {}
			data.header.map((k, j) => {
				if (vals[j] /*|| k!='color'*/) a[k] = vals[j]
				if (k == 'sortorder' && !isNaN(a[k])) {
					// isNaN() will coerce string values to numeric where applicable
					// see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/NaN
					a[k] = +a[k]
				}
			})
			data.push(a)
		}
		return data
	}, [])
}

function getScriptArg() {
	console.log('validating arguments ...')
	const allowedArgs = new Set(['study', 'tp', 'output'])
	const arg = {}
	try {
		for (let i = 2; i < process.argv.length; i++) {
			const str = process.argv[i]
			const [k, v] = str.split('=')
			if (!allowedArgs.has(k)) throw `unsupported argument '${k}' in '${str}'`
			arg[k] = v
		}
		if (arg.size == 0) throw 'no arguments'
		if (!arg.study) throw 'missing "study=" argument'
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
