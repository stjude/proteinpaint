const path = require('path')
const { get_term_cte } = require('./termdb.sql')
const { getFilterCTEs } = require('./termdb.filter')
const lines2R = require('./lines2R')
const serverconfig = require('./serverconfig')

/*
q {}
.regressionType
.filter
.outcome{}
	.id
	.type // type will be required later to support molecular datatypes
	.term{} // rehydrated
	.q{}
	.refGrp
.independent[{}]
	.id
	.type
	.isBinned
	.q{}
		.scale
	.refGrp
	.interactions[]

input tsv matrix for R:
	first row is variable name, with space and comma removed
	first column is outcome variable
	rest of columns are for independent variables

TODO
- clarify what is key and val, when to use which, and when to skip uncomputable
		numeric term:
			continuous: use val and exclude uncomputable values (done in sql?)
			binning: use key which is bin label
		categorical and condition term:
			category/grade: use val and exclude uncomputable categories
			groupsetting: still use val (both key/val are groupset labels)
*/

// minimum number of samples to run analysis
const minimumSample = 1
const idsep = '___' // term id separator used in R input data

export async function get_regression(q, ds) {
	try {
		parse_q(q, ds)

		// Rest of rows for R matrix, one for each sample
		const startTime = +new Date()
		const sampledata = getSampleData(q, [q.outcome, ...q.independent])
		/* each element is one sample:
		{sample, id2value:map}, where value is { key, val }

		*/

		const queryTime = +new Date() - startTime

		const [headerline, samplelines, id2originalId, originalId2id] = makeMatrix(q, sampledata)
		const sampleSize = samplelines.length
		if (sampleSize < minimumSample) throw 'too few samples to fit model'

		// create arguments for the R script
		// outcome
		const refGroups = [q.outcome.refGrp]
		const colClasses = [q.outcome.q.mode == 'binary' ? 'factor' : termType2varClass(q.outcome.term.type)]
		const scalingFactors = ['NA']
		// independent terms
		for (const term of q.independent) {
			refGroups.push(term.refGrp)
			colClasses.push(term.isBinned ? 'factor' : termType2varClass(term.term.type))
			scalingFactors.push(term.isBinned || !term.q.scale ? 'NA' : term.q.scale)
		}

		// validate data
		for (const [i, colClass] of colClasses.entries()) {
			const refGrp = refGroups[i]
			if (colClass == 'factor') {
				if (refGrp == 'NA') throw 'reference category not given for categorical variable ' + headerline[i]
				// get unique list of values
				const values = new Set(samplelines.map(l => l[i]))
				// make sure ref grp exists in data
				if (!values.has(refGrp))
					throw `the reference category '${refGrp}' is not found in the variable '${headerline[i]}'`
				// make sure there's at least 2 categories
				if (values.size < 2) throw 'fewer than 2 categories: ' + headerline[i]
			} else {
				// not factor type, must be continuous
				if (refGrp != 'NA') throw 'variable is not factor but ref grp is given: ' + headerline[i]
			}
		}

		const model = make_model(q, originalId2id)

		const data = await lines2R(
			path.join(serverconfig.binpath, 'utils/regression.R'),
			[headerline.join('\t'), ...samplelines.map(i => i.join('\t'))],
			[q.regressionType, colClasses.join(','), refGroups.join(','), scalingFactors.join(','), model],
			false
		)

		const result = { type: q.regressionType, queryTime, sampleSize }
		parseRoutput(data, id2originalId, result)

		result.totalTime = +new Date() - startTime
		return result
	} catch (e) {
		if (e.stack) console.log(e.stack)
		return { error: e.message || e }
	}
}

function termType2varClass(t) {
	// numeric term with binning is 'factor' and is handled outside
	if (t == 'integer') return 'integer'
	if (t == 'float') return 'numeric'
	if (t == 'categorical' || t == 'condition') return 'factor' // including groupset
	throw 'unknown term type to convert to varClass'
}

function parse_q(q, ds) {
	if (!ds.cohort) throw 'cohort missing from ds'
	q.ds = ds

	// client to always specify regressionType
	if (!q.regressionType) throw 'regressionType missing'
	if (['linear', 'logistic'].indexOf(q.regressionType) == -1) throw 'unknown regressionType'

	// outcome
	if (!q.outcome) throw `missing 'outcome' parameter`
	q.outcome = JSON.parse(decodeURIComponent(q.outcome))
	if (!q.outcome) throw `empty 'outcome' parameter`
	if (!('id' in q.outcome)) throw 'outcome.id missing'
	if (!q.outcome.q) throw 'outcome.q missing'
	q.outcome.term = ds.cohort.termdb.q.termjsonByOneid(q.outcome.id)
	if (!q.outcome.term) throw 'invalid outcome term: ' + q.outcome.id

	// independent
	if (!q.independent) throw 'independent[] missing'
	q.independent = JSON.parse(decodeURIComponent(q.independent))
	if (!Array.isArray(q.independent) || q.independent.length == 0) throw 'q.independent is not non-empty array'
	for (const term of q.independent) {
		if (!term.id) throw '.id missing for an indepdent term'
		term.term = ds.cohort.termdb.q.termjsonByOneid(term.id)
		if (!term.term) throw 'invalid independent term: ' + term.id
		if (term.type == 'float' || term.type == 'integer')
			term.isBinned = term.q.mode == 'discrete' || term.q.mode == 'binary'
	}
	// interaction of independent
	for (const i of q.independent) {
		if (!i.interactions) i.interactions = []
		for (const x of i.interactions) {
			if (!q.independent.find(y => y.id == x)) throw 'interacting term id missing from independent[]: ' + x
		}
	}
}

/* convert sampledata to matrix format
also collect unique values for variables that are not continuous
which may consume memory and may need to be improved
*/
function makeMatrix(q, sampledata) {
	// Populate data rows of tsv. first line is header
	// in the header line, use new id e.g. `id0` to replace original id, to avoid introducing space/comma into R data
	const id2originalId = {} // k: new id, v: original term id
	const originalId2id = {} // k: original term id, v: new id
	for (const [i, t] of q.independent.entries()) {
		id2originalId['id' + i] = t.id
		originalId2id[t.id] = 'id' + i
	}
	const headerline = ['outcome', ...q.independent.map(i => originalId2id[i.id])]

	// may generate a line for each sample, if the sample has valid value for all terms
	// store lines as arrays but not \t joined string, for checking refGrp value
	const lines = []

	for (const { sample, id2value } of sampledata) {
		const outcome = id2value.get(q.outcome.id)
		if (!outcome) {
			// lacks outcome value for this sample, skip
			continue
		}

		if (q.outcome.term.values) {
			// outcome term has values{}, need to check if value is uncomputable:
			if (q.outcome.term.values[outcome.val] && q.outcome.term.values[outcome.val].uncomputable) {
				continue
			}
		}

		// the first column is the outcome variable; if continuous, use val, otherwise use key
		const line = [q.regressionType === 'linear' ? outcome.val : outcome.key]

		// rest of columns for independent terms
		let skipsample = false
		for (const term of q.independent) {
			if (!id2value.has(term.id)) {
				// missing value for this term
				skipsample = true
				break
			}

			const { key, val } = id2value.get(term.id)

			/*
			TODO
			if a uncomputable category is part of a groupset, then it must not be excluded
			*/
			if (term.term.values && term.term.values[val] && term.term.values[val].uncomputable) {
				skipsample = true
				break
			}

			if (term.isBinned) {
				// key is the bin label
				line.push(key)
			} else {
				// term is not binned
				// for all the other cases will use val
				// including groupsetting which both val and key are group labels (yes)
				line.push(val)
			}
		}
		if (skipsample) continue
		lines.push(line)
	}
	return [headerline, lines, id2originalId, originalId2id]
}

function parseRoutput(data, id2originalId, result) {
	//console.log(data)
	const type2lines = new Map()
	// k: type e.g.Deviance Residuals
	// v: list of lines
	let lineType // type of current line

	for (const line of data) {
		if (line.startsWith('#')) {
			lineType = line.substring(1)
			type2lines.set(lineType, [])
			continue
		}
		type2lines.get(lineType).push(line)
	}
	// parse lines into this result structure

	{
		const lines = type2lines.get('warnings')
		if (lines) {
			result.warnings = {
				label: 'Warning messages',
				lst: lines
			}
		}
	}
	{
		const lines = type2lines.get('residuals')
		if (lines) {
			if (lines.length != 2) throw 'expect 2 lines for residuals but got ' + lines.length
			result.residuals = {
				label: result.type === 'linear' ? 'Residuals' : 'Deviance residuals',
				lst: []
			}
			// 1st line is header
			const header = lines[0].split('\t')
			// 2nd line is values
			const values = lines[1].split('\t')
			for (const [i, h] of header.entries()) {
				result.residuals.lst.push([h, values[i]])
			}
		}
	}
	{
		const lines = type2lines.get('coefficients')
		if (lines) {
			if (lines.length < 3) throw 'expect at least 3 lines from coefficients'

			// 1st line is header
			const header = lines.shift().split('\t')
			header.unshift('Category')
			header.unshift('Variable')
			// 2nd line is intercept
			const intercept = lines
				.shift()
				.split('\t')
				.slice(1)

			result.coefficients = {
				label: 'Coefficients',
				header,
				intercept,
				terms: {}, // individual independent terms, not interaction
				interactions: [] // interaction rows
			}

			// rest of lines are either individual independent variables, or interactions
			for (const line of lines) {
				const l = line.split('\t')
				if (l[0].indexOf(':') != -1) {
					// is an interaction
					const row = {}
					const [t1, t2] = l[0].split(':')
					const [id1, cat1] = t1.split(idsep)
					row.term1 = id2originalId[id1]
					row.category1 = cat1
					const [id2, cat2] = t2.split(idsep)
					row.term2 = id2originalId[id2]
					row.category2 = cat2
					row.lst = l.slice(1)
					result.coefficients.interactions.push(row)
				} else {
					// not interaction, individual variable
					const [id, category] = l[0].split(idsep)
					const termid = id2originalId[id] || id
					if (!result.coefficients.terms[termid]) result.coefficients.terms[termid] = {}
					if (category) {
						// has category
						if (!result.coefficients.terms[termid].categories) result.coefficients.terms[termid].categories = {}
						result.coefficients.terms[termid].categories[category] = l.slice(1)
					} else {
						// no category
						result.coefficients.terms[termid].fields = l.slice(1)
					}
				}
			}
		}
	}
	{
		const lines = type2lines.get('type3')
		if (lines) {
			const header = lines.shift().split('\t')
			header.unshift('Variable')
			result.type3 = {
				label: 'Type III statistics',
				header,
				lst: []
			}
			for (const line of lines) {
				const l = line.split('\t')
				const t = l[0]
				const row = {}
				if (t == '<none>') {
					row.lst = l.slice(1)
				} else {
					if (t.indexOf(':') != -1) {
						const [t1, t2] = t.split(':')
						row.id1 = id2originalId[t1.replace(idsep, '')]
						row.id2 = id2originalId[t2.replace(idsep, '')]
					} else {
						row.id1 = id2originalId[t.replace(idsep, '')]
					}
					row.lst = l.slice(1)
				}
				result.type3.lst.push(row)
			}
		}
	}
	{
		const lines = type2lines.get('other')
		if (lines) {
			result.other = {
				label: 'Other summary statistics',
				lst: lines.map(i => i.split('\t'))
			}
		}
	}
}

/*
may move to termdb.sql.js later

works for only termdb terms; non-termdb attributes will not work
gets data for regression analysis, one row for each sample

Arguments
q{}
	.filter
	.ds

terms[]
	array of {id, term, q}

Returns two data structures
1.
	[
		{
	  	sample: STRING,

			// one or more entries by term id
			id2value: Map[
				term.id,
				{
					// depending on term type and desired 
					key: bin label or precomputed label or annotated value, 
					val: precomputed or annotated value
				}
			]
		},
		...
	]
2.
*/
function getSampleData(q, terms) {
	const filter = getFilterCTEs(q.filter, q.ds)
	// must copy filter.values as its copy may be used in separate SQL statements,
	// for example get_rows or numeric min-max, and each CTE generator would
	// have to independently extend its copy of filter values
	const values = filter ? filter.values.slice() : []
	const CTEs = terms.map((t, i) => get_term_cte(q, values, i, filter, t))
	values.push(...terms.map(d => d.id))

	const sql = `WITH
		${filter ? filter.filters + ',' : ''}
		${CTEs.map(t => t.sql).join(',\n')}
		${CTEs.map(
			t => `
		SELECT sample, key, value, ? as term_id
		FROM ${t.tablename} 
		WHERE sample IN ${filter.CTEname}
		`
		).join(`UNION ALL`)}`

	const rows = q.ds.cohort.db.connection.prepare(sql).all(values)
	// each row {sample, term_id, key, val}

	const samples = new Map() // k: sample name, v: {sample, id2value:Map( tid => {key,val}) }
	for (const r of rows) {
		if (!samples.has(r.sample)) {
			samples.set(r.sample, { sample: r.sample, id2value: new Map() })
		}

		if (samples.get(r.sample).id2value.has(r.term_id)) {
			// can duplication happen?
			throw `duplicate '${r.term_id}' entry for sample='${r.sample}'`
		}
		samples.get(r.sample).id2value.set(r.term_id, { key: r.key, val: r.value })
	}
	return samples.values()
}

function make_model(q, originalId2id) {
	const independent = q.independent.map(i => originalId2id[i.id] + idsep)

	// get unique list of interaction pairs
	const a2b = {}
	for (const i of q.independent) {
		const a = originalId2id[i.id]
		for (const j of i.interactions) {
			const b = originalId2id[j]
			if (a2b[a] == b || a2b[b] == a) {
				// already seen
			} else {
				a2b[a] = b
			}
		}
	}

	const interactions = []
	for (const i in a2b) {
		interactions.push(i + idsep + ' : ' + a2b[i] + idsep)
	}

	// excluding space but should be fine to include them
	return 'outcome___ ~ ' + independent.join(' + ') + (interactions.length ? ' + ' + interactions.join(' + ') : '')
}
