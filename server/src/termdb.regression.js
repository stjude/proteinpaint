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
	.q{}
		.scale
	.refGrp
	.interactions[]

input to R is an json object {type, outcome:{rtype}, independent:[ {rtype} ]}
rtype with values numeric/factor is used instead of actual term type
so that R script will not need to interpret term type
*/

// minimum number of samples to run analysis
const minimumSample = 1

export async function get_regression(q, ds) {
	try {
		parse_q(q, ds)

		const startTime = +new Date()
		const sampledata = getSampleData(q, [q.outcome, ...q.independent])
		/* each element is one sample with a key-val map for all its annotations:
		{sample, id2value:Map( tid => {key,value}) }
		*/
		const queryTime = +new Date() - startTime

		// build the input for R script
		const Rinput = makeRinput(q, sampledata)

		const sampleSize = Rinput.outcome.values.length

		validateRinput(q, Rinput, sampleSize)

		const [id2originalId, originalId2id] = replaceTermId(Rinput)

		// specify the formula for fitting regression model
		Rinput.formula = make_formula(q, originalId2id)

		// run regression analysis in R
		const Routput = await lines2R(
			path.join(serverconfig.binpath, 'utils/regression.R'),
			[JSON.stringify(Rinput)],
			[],
			false
		)

		// parse the R output
		const result = { queryTime, sampleSize }
		parseRoutput(Routput, id2originalId, q, result)
		result.totalTime = +new Date() - startTime
		return result
	} catch (e) {
		if (e.stack) console.log(e.stack)
		return { error: e.message || e }
	}
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
	q.outcome.q.computableValuesOnly = true // will prevent appending uncomputable values in CTE constructors
	q.outcome.term = ds.cohort.termdb.q.termjsonByOneid(q.outcome.id)
	if (!q.outcome.term) throw 'invalid outcome term: ' + q.outcome.id
	q.outcome.isNumeric = q.outcome.term.type == 'integer' || q.outcome.term.type == 'float'
	q.outcome.isContinuous = q.outcome.q.mode == 'continuous'

	// independent
	if (!q.independent) throw 'independent[] missing'
	q.independent = JSON.parse(decodeURIComponent(q.independent))
	if (!Array.isArray(q.independent) || q.independent.length == 0) throw 'q.independent is not non-empty array'
	// tw = termWrapper
	for (const tw of q.independent) {
		if (!tw.id) throw '.id missing for an independent term'
		tw.term = ds.cohort.termdb.q.termjsonByOneid(tw.id)
		if (!tw.term) throw `invalid independent term='${tw.id}'`
		if (!tw.q) throw `missing q for term.id='${tw.id}'`
		tw.q.computableValuesOnly = true // will prevent appending uncomputable values in CTE constructors
		tw.isNumeric = tw.term.type == 'float' || tw.term.type == 'integer'
		tw.isContinuous = tw.q.mode == 'continuous'
	}
	// interaction of independent
	for (const i of q.independent) {
		if (!i.interactions) i.interactions = []
		for (const x of i.interactions) {
			if (!q.independent.find(y => y.id == x)) throw 'interacting term id missing from independent[]: ' + x
		}
	}
}

function makeRinput(q, sampledata) {
	// outcome term
	const outcome = {
		id: q.outcome.id,
		rtype: q.outcome.isContinuous ? 'numeric' : 'factor',
		values: []
	}
	if (outcome.rtype === 'factor') outcome.refGrp = q.outcome.refGrp

	// input for R script will be in json format
	const Rinput = {
		type: q.regressionType,
		outcome,
		independent: []
	}

	// independent terms, tw = termWrapper
	for (const tw of q.independent) {
		const independent = {
			id: tw.id,
			rtype: tw.isContinuous ? 'numeric' : 'factor',
			values: []
		}
		if (independent.rtype === 'factor') independent.refGrp = tw.refGrp
		if (tw.q.scale) independent.scale = tw.q.scale
		Rinput.independent.push(independent)
	}

	// for each sample, decide if it has value for all terms
	// if so, the sample can be included for analysis
	// and will fill in values into values[] of all terms, thus ensuring the order of samples are the same across values[] of all terms
	for (const { sample, id2value } of sampledata) {
		if (!id2value.has(q.outcome.id)) continue
		const out = id2value.get(q.outcome.id)
		// is uncomputable-checking still needed??
		const excludeUncomputable = q.outcome.isNumeric || (q.outcome.q.groupsetting && q.outcome.q.groupsetting.inuse)
		if (excludeUncomputable && q.outcome.term.values) {
			if (q.outcome.term.values[out.value] && q.outcome.term.values[out.value].uncomputable) continue
		}

		let skipsample = false
		for (const tw of q.independent) {
			// tw = termWrapper
			const independent = id2value.get(tw.id)
			const values = tw.term.values || {}
			if (!independent) {
				skipsample = true
				break
			}
			const excludeUncomputable = tw.isNumeric || (tw.q.groupsetting && tw.q.groupsetting.inuse)
			if (excludeUncomputable && values[independent.value] && values[independent.value].uncomputable) {
				// TODO: if an uncomputable category is part of a groupset, then it must not be excluded
				skipsample = true
			}
			if (skipsample) break
		}
		if (skipsample) continue

		// this sample has value for all terms and is eligible for regression analysis
		// add its value to values[] of each term
		Rinput.outcome.values.push(Rinput.outcome.rtype === 'numeric' ? out.value : out.key)
		for (const t of Rinput.independent) {
			const v = id2value.get(t.id)
			t.values.push(t.rtype === 'numeric' ? v.value : v.key)
		}
	}
	return Rinput
}

function validateRinput(q, Rinput, sampleSize) {
	// validate R input
	// validate sample size
	if (sampleSize < minimumSample) throw 'too few samples to fit model'
	if (Rinput.independent.find(x => x.values.length !== sampleSize)) throw 'variables have unequal sample sizes'
	// validate outcome variable
	if (q.regressionType === 'linear') {
		if (Rinput.outcome.rtype !== 'numeric') throw 'outcome is not continuous'
		if (Rinput.outcome.refGrp) throw 'reference group given for outcome'
	} else {
		if (Rinput.outcome.rtype === 'numeric') throw 'outcome is continuous'
		if (!Rinput.outcome.refGrp) throw 'reference group not given for outcome'
		const values = new Set(Rinput.outcome.values) // get unique values
		if (values.size !== 2) throw 'outcome is not binary'
		if (!values.has(Rinput.outcome.refGrp)) throw 'reference group not found in outcome values'
	}
	// validate independent variables
	for (const variable of Rinput.independent) {
		if (variable.rtype === 'numeric') {
			if (variable.refGrp) throw `reference group given for '${variable.id}'`
		} else {
			if (!variable.refGrp) throw `reference group not given for '${variable.id}'`
			const values = new Set(variable.values) // get unique values
			if (!values.has(variable.refGrp)) throw `reference group not found in '${variable.id}' values`
			// make sure there's at least 2 categories
			if (values.size < 2) throw `'${variable.id}' has fewer than 2 categories`
		}
	}
}

function parseRoutput(Routput, id2originalId, q, result) {
	if (Routput.length !== 1) throw 'expected 1 line in R output'
	const data = JSON.parse(Routput[0])

	// residuals
	result.residuals = data.residuals
	result.residuals.label = q.regressionType === 'linear' ? 'Residuals' : 'Deviance residuals'

	// coefficients
	if (data.coefficients.rows.length < 2)
		throw 'expect at least 2 rows in coefficients table but got ' + data.coefficients.rows.length
	result.coefficients = {
		header: data.coefficients.header,
		intercept: data.coefficients.rows.shift(),
		terms: {}, // individual independent terms, not interaction
		interactions: [] // interactions
	}
	for (const row of data.coefficients.rows) {
		if (row[0].indexOf(':') != -1) {
			// is an interaction
			const interaction = {}
			const [id1, id2] = row.shift().split(':')
			const [cat1, cat2] = row.shift().split(':')
			// row is now only data fields
			interaction.term1 = id2originalId[id1]
			interaction.category1 = cat1
			interaction.term2 = id2originalId[id2]
			interaction.category2 = cat2
			interaction.lst = row
			result.coefficients.interactions.push(interaction)
		} else {
			// not interaction, individual variable
			const id = row.shift()
			const category = row.shift()
			// row is now only data fields
			const termid = id2originalId[id]
			if (!result.coefficients.terms[termid]) result.coefficients.terms[termid] = {}
			if (category) {
				// has category
				if (!result.coefficients.terms[termid].categories) result.coefficients.terms[termid].categories = {}
				result.coefficients.terms[termid].categories[category] = row
			} else {
				// no category
				result.coefficients.terms[termid].fields = row
			}
		}
	}
	result.coefficients.label = 'Coefficients'

	// type III statistics
	result.type3 = {
		header: data.type3.header,
		intercept: data.type3.rows.shift(),
		terms: {}, // individual independent terms, not interaction
		interactions: [] // interactions
	}
	for (const row of data.type3.rows) {
		if (row[0].indexOf(':') != -1) {
			// is an interaction
			const interaction = {}
			const [id1, id2] = row.shift().split(':')
			// row is now only data fields
			interaction.term1 = id2originalId[id1]
			interaction.term2 = id2originalId[id2]
			interaction.lst = row
			result.type3.interactions.push(interaction)
		} else {
			// not interaction, individual variable
			const id = row.shift()
			// row is now only data fields
			const termid = id2originalId[id]
			if (!result.type3.terms[termid]) result.type3.terms[termid] = row
		}
	}
	result.type3.label = 'Type III statistics'

	// other summary statistics
	result.other = data.other
	result.other.label = 'Other summary statistics'

	// warnings
	if (data.warnings) {
		result.warnings = data.warnings
		result.warnings.label = 'Warnings'
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
					key: either (a) bin or groupsetting label, or (b) precomputed or annotated value if no bin/groupset is used, 
					value: precomputed or annotated value
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
			${filter ? `WHERE sample IN ${filter.CTEname}` : ''}
			`
		).join(`UNION ALL`)}`

	const rows = q.ds.cohort.db.connection.prepare(sql).all(values)

	const samples = new Map() // k: sample name, v: {sample, id2value:Map( tid => {key,value}) }
	for (const { sample, term_id, key, value } of rows) {
		if (!samples.has(sample)) {
			samples.set(sample, { sample, id2value: new Map() })
		}

		if (samples.get(sample).id2value.has(term_id)) {
			// can duplication happen?
			throw `duplicate '${term_id}' entry for sample='${sample}'`
		}
		samples.get(sample).id2value.set(term_id, { key, value })
	}
	return samples.values()
}

function make_formula(q, originalId2id) {
	const independent = q.independent.map(i => originalId2id[i.id])

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
		interactions.push(i + ':' + a2b[i])
	}

	return 'outcome ~ ' + independent.join(' + ') + (interactions.length ? ' + ' + interactions.join(' + ') : '')
}

function replaceTermId(Rinput) {
	// use dummy variable IDs in R (to avoid using spaces/commas)
	Rinput.outcome.id = 'outcome'
	const id2originalId = {} // k: new id, v: original term id
	const originalId2id = {} // k: original term id, v: new id
	for (const [i, t] of Rinput.independent.entries()) {
		id2originalId['id' + i] = t.id
		originalId2id[t.id] = 'id' + i
		Rinput.independent[i].id = originalId2id[t.id]
	}
	return [id2originalId, originalId2id]
}
