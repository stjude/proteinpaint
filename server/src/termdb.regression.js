const path = require('path')
const { get_term_cte } = require('./termdb.sql')
const { getFilterCTEs } = require('./termdb.filter')
const lines2R = require('./lines2R')
const serverconfig = require('./serverconfig')

/*
q {}
.regressionType
.filter
.term1_id
.term1_q // converted to q.outcome
.outcome{}
	.id
	.term
.independent[{}]
	.id
	.type
	.isBinned

input tsv matrix for R: first column is outcome variable
*/

export async function get_regression(q, ds) {
	try {
		if (!ds.cohort) throw 'cohort missing from ds'
		parse_q(q, ds)

		// client to always specify regressionType
		const regressionType = q.regressionType || 'linear'

		// Header row of the R data matrix
		const header = ['outcome', ...q.independent.map(i => i.id)]

		// Rest of rows for R matrix, one for each sample
		const startTime = +new Date()
		const sampledata = getSampleData(q, [q.outcome, ...q.independent])
		// each element is one sample:
		// {sample, id2value:map}, where value is { key, val }
		const queryTime = +new Date() - startTime

		// Populate data rows of tsv
		const tsv = [header.join('\t')]
		for (const { sample, id2value } of sampledata) {
			const outcome = id2value.get(q.outcome.id)
			if (!outcome) {
				// lacks outcome value for this sample, skip
				continue
			}
			if (q.outcome.term.values) {
				// outcome term has values{}, need to check if value is uncomputable:
				// for linear, to only allow numeric values and exclude uncomputable values (can this be done in sql instead?)
				// for logistic, still only allow numeric
				// for independent, any need to check?
				// also, when to use key? when to use val??
				if (q.outcome.term.values[outcome.val] && q.outcome.term.values[outcome.val].uncomputable) {
					continue
				}
			}

			// the first column is the outcome variable; if continuous, use val, otherwise use key
			const line = [regressionType === 'linear' ? outcome.val : outcome.key]

			// rest of columns for independent terms
			let skipsample = false
			for (const term of q.independent) {
				if (!id2value.has(term.id)) {
					// missing value for this term
					skipsample = true
					break
				}

				const { key, val } = id2value.get(term.id)

				if (term.isBinned) {
					line.push(key)
				} else {
					// to use val, check if is uncomputable
					if (term.term.values && term.term.values[val] && term.term.values[val].uncomputable) {
						skipsample = true
						break
					}
					line.push(val)
				}
			}
			if (skipsample) continue
			tsv.push(line.join('\t'))
		}

		// create arguments for the R script
		const refCategories = [get_refCategory(q.outcome.term, q.outcome.q)]
		// Specify term types and R classes of variables
		const termType2varClass = {
			integer: 'integer',
			float: 'numeric',
			survival: 'numeric',
			categorical: 'factor',
			condition: 'factor'
		}
		const colClasses = [q.outcome.q.mode == 'binary' ? 'factor' : termType2varClass[q.outcome.term.type]]
		const scalingFactors = ['NA']
		for (const term of q.independent) {
			const t = term.term
			const q = term.q
			refCategories.push(get_refCategory(t, q))
			colClasses.push(term.isBinned ? 'factor' : termType2varClass[t.type])
			scalingFactors.push(term.isBinned || !q.scale ? 'NA' : q.scale)
		}

		//console.log(82)
		//console.log('regressionType:', regressionType)
		//console.log('colClasses:', colClasses)
		//console.log('refCategories:', refCategories)
		//console.log('scalingFactors:', scalingFactors)
		//console.log('tsv:', tsv)

		// Validate tsv prior to R script
		if (tsv.length === 0) throw 'tsv is empty'
		if (tsv.length === 1) throw 'tsv only has header'
		for (const [i, colClass] of colClasses.entries()) {
			const ref = refCategories[i]
			const col = tsv.map(line => line.split('\t')[i])
			const variable = col.shift()
			if (colClass === 'factor') {
				if (ref === 'NA') throw `reference category not given for categorical variable '${variable}'`
				if (!col.includes(ref))
					throw `the reference category '${ref}' is not found in the variable '${variable}' in the tsv`
			} else {
				if (ref !== 'NA') throw `reference category given for continuous variable '${variable}'`
			}
		}

		const data = await lines2R(
			path.join(serverconfig.binpath, 'utils/regression.R'),
			tsv,
			[regressionType, colClasses.join(','), refCategories.join(','), scalingFactors.join(',')],
			false
		)

		const type2lines = new Map()
		// k: type e.g.Deviance Residuals
		// v: list of lines
		let lineType // type of current line

		for (const line of data) {
			if (line.startsWith('#')) {
				lineType = line.split('#')[2]
				type2lines.set(lineType, [])
				continue
			}
			type2lines.get(lineType).push(line)
		}
		// parse lines into this result structure
		const result = { queryTime, sampleSize: tsv.length - 1 }

		{
			const lines = type2lines.get('Warning messages')
			if (lines) {
				result.warnings = {
					label: 'Warning messages',
					lst: lines
				}
			}
		}
		{
			const lines = type2lines.get('Deviance Residuals')
			if (lines) {
				if (lines.length != 2) throw 'expect 2 lines for Deviance Residuals but got ' + lines.length
				result.devianceResiduals = {
					label: 'Deviance Residuals',
					lst: []
				}
				// 1st line is header
				const header = lines[0].split('\t')
				// 2nd line is values
				const values = lines[1].split('\t')
				for (const [i, h] of header.entries()) {
					result.devianceResiduals.lst.push([h, values[i]])
				}
			}
		}
		{
			const lines = type2lines.get('Coefficients')
			if (lines) {
				if (lines.length < 3) throw 'expect at least 3 lines from Coefficients'
				result.coefficients = {
					label: 'Coefficients',
					header: lines
						.shift()
						.split('\t')
						.slice(2), // 1st line is header
					intercept: lines
						.shift()
						.split('\t')
						.slice(2), // 2nd line is intercept
					terms: {}
				}
				// rest of lines are categories of independent terms
				for (const line of lines) {
					const l = line.split('\t')
					const termid = l.shift()
					if (!result.coefficients.terms[termid]) result.coefficients.terms[termid] = {}
					const category = l.shift()
					if (category) {
						// has category
						if (!result.coefficients.terms[termid].categories) result.coefficients.terms[termid].categories = {}
						result.coefficients.terms[termid].categories[category] = l
					} else {
						// no category
						result.coefficients.terms[termid].fields = l
					}
				}
			}
		}
		{
			const lines = type2lines.get('Type III statistics')
			if (lines) {
				result.type3 = {
					label: 'Type III statistics',
					header: lines.shift().split('\t'),
					lst: lines.map(i => i.split('\t'))
				}
			}
		}
		{
			const lines = type2lines.get('Other summary statistics')
			if (lines) {
				result.otherSummary = {
					label: 'Other summary statistics',
					lst: lines.map(i => i.split('\t'))
				}
			}
		}
		// Verify that the computed sample size is consistent with the degrees of freedom
		/*
		const nullDevDf = result
			.find(table => table.name === 'Other summary statistics')
			.rows.find(row => row[0] === 'Null deviance df')[1]
		if (sampleSize !== Number(nullDevDf) + 1) throw 'computed sample size and degrees of freedom are inconsistent'
			*/
		result.totalTime = +new Date() - startTime
		return result
	} catch (e) {
		if (e.stack) console.log(e.stack)
		return { error: e.message || e }
	}
}

function parse_q(q, ds) {
	q.ds = ds

	// outcome
	if (!q.term1_id) throw 'term1_id missing'
	if (!q.term1_q) throw 'term1_q missing'
	q.outcome = {
		id: q.term1_id,
		term: ds.cohort.termdb.q.termjsonByOneid(q.term1_id),
		q: JSON.parse(q.term1_q)
	}
	if (!q.outcome.term) throw 'invalid outcome term: ' + q.term1_id
	delete q.term1_id
	delete q.term1_q

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
}

/*
decide reference category
- term: the term json object {type, values, ...}
- q: client side config for this term (should tell which category is chosen as reference, if applicable)
*/
function get_refCategory(term, q) {
	if (q.refGrp) return q.refGrp
	if (term.type == 'categorical' || term.type == 'condition') {
		// q attribute will tell which category is reference
		// else first category as reference
		if (q.groupsetting && q.groupsetting.inuse && q.groupsetting.predefined_groupset_idx !== undefined)
			return term.groupsetting.lst[q.groupsetting.predefined_groupset_idx].groups[0]['name']
		else if (q.groupsetting && q.groupsetting.inuse) return q.groupsetting.customset.groups[0]['name']
		else return Object.keys(term.values)[0]
	}
	if (term.type == 'integer' || term.type == 'float') {
		// TODO when numeric term is divided to bins, term should indicate which bin is reference
		// this currently won't work if term is divided to bins
		return 'NA'
	}
	throw 'unknown term type for refCategories'
}

function getSampleData(q, terms) {
	/*
	works for only termdb terms; non-termdb attributes will not work
	gets data for regression analysis, one row for each sample
	
	Arguments
	q{}
		.filter
		.ds
	
	terms[]
		array of {id, term, q}

	Returns
	[
		{
			sample: STRING,
			
			// one or more entries by term id
		  [term.id]: {
		 		// depending on term type and desired 
				key: bin label or precomputed label or annotated value, 
				val: precomputed or annotated value
			},
			...
		}, 
		...
	]
	*/

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
	const samples = new Map() // k: sample name, v: {sample, terms:{}}
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
