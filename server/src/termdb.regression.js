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
		// termY is the outcome term
		q.termY = ds.cohort.termdb.q.termjsonByOneid(q.term1_id)
		q.termY_id = q.term1_id
		q.termY_q = JSON.parse(q.term1_q)
		delete q.term1_id
		delete q.term1_q

		// Specify regression type
		const regressionType = q.regressionType || 'linear'

		// Header row of the R data matrix
		const header = ['outcome']
		for (const i in q.independent) {
			const term = q.independent[i]
			const termnum = 'term' + i
			q[termnum + '_id'] = term.id
			if (term.q) q[termnum + '_q'] = term.q
			term.term = ds.cohort.termdb.q.termjsonByOneid(term.id)
			header.push(term.id) //('var'+i)//(term.term.name)
		}

		// Rest of rows for R matrix, one for each sample
		const rows = get_matrix(q, regressionType)
		const tsv = [header.join('\t')]
		const termYvalues = q.termY.values || {}

		// Specify term types and R classes of variables
		// QUICK FIX: numeric terms can be used as continuous or as defined by bins,
		// by default it will be used as continuous, if user selects 'as_bins' radio,
		// term.q.mode = 'discrete' flag will be added
		const indTermTypes = q.independent.map(t => {
			if ((t.type == 'float' || t.type == 'integer') && t.q.mode == 'discrete') return 'categorical'
			else return t.type
		})
		const termTypes = [q.termY.type, ...indTermTypes]
		// Convert term types to R classes
		const colClasses = termTypes.map(type => type2class.get(type))
		// if ('cutoff' in q) colClasses[0] = 'factor'
		if (q.termY_q.mode == 'binary') colClasses[0] = 'factor'

		// Specify reference categories of variables
		const refCategories = []
		refCategories.push(get_refCategory(q.termY, q.termY_q))
		q.independent.map(t => {
			refCategories.push(get_refCategory(t.term, t.q))
		})

		// Specify scaling factors of variables
		const indScalingFactors = q.independent.map(t => {
			if ((t.type !== 'float' && t.type !== 'integer') || t.q.mode === 'discrete') return 'NA'
			return t.q.scale || 'NA'
		})
		const scalingFactors = ['NA', ...indScalingFactors]

		// Populate data rows of tsv
		for (const row of rows) {
			let outcomeVal
			if (termYvalues[row.outcome] && termYvalues[row.outcome].uncomputable) {
				continue
			} else if (regressionType === 'linear') {
				outcomeVal = row.outcome
			} else {
				outcomeVal = row.outkey
			}
			const line = [outcomeVal]
			for (const i in q.independent) {
				const term = q.independent[i]
				const key = row['key' + i]
				const value = row['val' + i]
				const val = term.term && term.term.values && term.term.values[value]
				if ((term.type == 'float' || term.type == 'integer') && term.q.mode == 'discrete') {
					line.push(val && val.uncomputable ? 'NA' : key)
				} else {
					line.push(val && val.uncomputable ? 'NA' : value)
				}
			}
			// Discard samples that have an uncomputable value in any variable because these are not useable in the regression analysis
			if (!line.includes('NA')) tsv.push(line.join('\t'))
		}
		const sampleSize = tsv.length - 1
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
		const result = { sampleSize }

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

function get_matrix(q, regressionType) {
	/*
works for only termdb terms; non-termdb attributes will not work

gets partitioned data for regression analysis

returns
	[{
		outcome, 
		key0, val0, // independent variable 0, required
		key1, val1, // independent variable 1, optional
		key?, val?, // additional independent variables, optional
		...
	}]

q{}
	.filter
	.ds
	.term[Y,0,1,2, ...]_id
	.term[Y,0,1,2, ...]_q
*/

	if (typeof q.filter == 'string') q.filter = JSON.parse(decodeURIComponent(q.filter))
	const filter = getFilterCTEs(q.filter, q.ds)
	// must copy filter.values as its copy may be used in separate SQL statements,
	// for example get_rows or numeric min-max, and each CTE generator would
	// have to independently extend its copy of filter values
	const values = filter ? filter.values.slice() : []
	const outcome = get_term_cte(q, values, 'Y', filter)
	const ctes = []
	const columns = []
	for (const key in q) {
		if (key.startsWith('term') && key.endsWith('_id') && key != 'termY_id') {
			const i = Number(key.split('_')[0].replace('term', ''))
			ctes.push(get_term_cte(q, values, i, filter))
			columns.push(`t${i}.key AS key${i}, t${i}.value AS val${i}`)
		}
	}

	const statement = `WITH
		${filter ? filter.filters + ',' : ''}
		${outcome.sql},
		${ctes.map(t => t.sql).join(',\n')}
		SELECT
			Y.sample AS sample,
			Y.value AS outcome,
			Y.key AS outkey,
      ${columns.join(',\n')}
		FROM ${outcome.tablename} Y
		${ctes.map((t, i) => `JOIN ${t.tablename} t${i} ON t${i}.sample = Y.sample`).join('\n')}
		${filter ? 'WHERE Y.sample IN ' + filter.CTEname : ''}`
	// console.log(220, statement, values)
	const lst = q.ds.cohort.db.connection.prepare(statement).all(values)
	return lst
}

const type2class = new Map([
	['integer', 'integer'],
	['float', 'numeric'],
	['survival', 'numeric'],
	['categorical', 'factor'],
	['condition', 'factor']
])
