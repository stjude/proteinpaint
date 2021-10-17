const path = require('path')
const { get_term_cte } = require('./termdb.sql')
const { getFilterCTEs } = require('./termdb.filter')
const lines2R = require('./lines2R')
const serverconfig = require('./serverconfig')

export async function get_regression(q, ds) {
	try {
		if (!ds.cohort) throw 'cohort missing from ds'
		q.ds = ds
		q.independent = JSON.parse(decodeURIComponent(q.independent))
		q.outcome = {
			id: q.term1_id,
			term: ds.cohort.termdb.q.termjsonByOneid(q.term1_id),
			q: JSON.parse(q.term1_q)
		}
		delete q.term1_id
		delete q.term1_q

		const regressionType = q.regressionType || 'linear'
		// Header row of the R data matrix
		const header = ['outcome']
		for (const term of q.independent) {
			term.term = ds.cohort.termdb.q.termjsonByOneid(term.id)
			// QUICK FIX: numeric terms can be used as continuous or as defined by bins,
			// by default it will be used as continuous, if user selects 'as_bins' radio,
			// term.q.mode = 'discrete' or 'binary' will be set, so R should treat as a factor variable
			if (term.type == 'float' || term.type == 'integer')
				term.isBinned = term.q.mode == 'discrete' || term.q.mode == 'binary'
			if (term.isBinned && regressionType == 'linear')
				throw `binned outcome variable, should be continuous for linear regression analysis`
			header.push(term.id)
		}

		// Rest of rows for R matrix, one for each sample
		const startTime = +new Date()
		const rows = getSampleData(q, [q.outcome, ...q.independent])
		const queryTime = +new Date() - startTime
		const tsv = [header.join('\t')]
		const outcomeValues = q.outcome.term.values || {} // Specify regression type
		// Populate data rows of tsv
		for (const row of rows) {
			const outcome = row[q.outcome.id]
			if (outcomeValues[outcome.val] && outcomeValues[outcome.val].uncomputable) {
				continue
			}
			// the first column is the outcome value (if continuous) or key/label (by default)
			const line = [regressionType === 'linear' ? outcome.val : outcome.key]
			for (const term of q.independent) {
				if (!row[term.id]) {
					line.push('NA')
					break
				}
				const key = row[term.id].key
				const value = row[term.id].val
				const val = term.term && term.term.values && term.term.values[value]
				if (val && val.uncomputable) line.push('NA')
				else line.push(term.isBinned ? key : value)
			}
			// Discard samples that have an uncomputable value in any variable because these are not useable in the regression analysis
			if (!line.includes('NA')) tsv.push(line.join('\t'))
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
		//console.log(83, refCategories, colClasses, scalingFactors)

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

	if (typeof q.filter == 'string') q.filter = JSON.parse(decodeURIComponent(q.filter))
	const filter = getFilterCTEs(q.filter, q.ds)
	// must copy filter.values as its copy may be used in separate SQL statements,
	// for example get_rows or numeric min-max, and each CTE generator would
	// have to independently extend its copy of filter values
	const values = filter ? filter.values.slice() : []
	values.push(...terms.map(d => d.id))

	const CTEs = terms.map((t, i) => get_term_cte(q, values, i, filter, t))

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

	// console.log(292, sql, values)
	const rows = q.ds.cohort.db.connection.prepare(sql).all(values)
	const bySample = {}
	for (const r of rows) {
		if (!bySample[r.sample]) {
			bySample[r.sample] = { sample: r.sample }
		}
		const d = bySample[r.sample]
		if (r.term_id in d) throw `duplicate '${r.term_id}' entry for sample='${r.sample}'`
		d[r.term_id] = { key: r.key, val: r.value }
	}
	return Object.values(bySample)
}
