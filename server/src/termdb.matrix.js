const path = require('path')
const { get_term_cte } = require('./termdb.sql')
const { getFilterCTEs } = require('./termdb.filter')
const lines2R = require('./lines2R')
const fs = require('fs')
const imagesize = require('image-size')
const serverconfig = require('./serverconfig')
const utils = require('./utils')
const termdbsql = require('./termdb.sql')
const get_flagset = require('./bulk.mset').get_flagset

/*
q {}
.regressionType
.filter
.outcome{}
	.id
	.type // type will be required later to support molecular datatypes
	.term{} // rehydrated
	.q{}
		.computableValuesOnly:true // always added
	.refGrp
.independent[{}]
	.id
	.type
	.term{} // rehydrated
	.q{}
		.scale
		.computableValuesOnly:true // always added
	.refGrp
	.interactions[] // always added; empty if no interaction
	.snpidlst[] // list of snp ids, for type=snplst, added when parsing cache file

input to R is an json object {type, outcome:{rtype}, independent:[ {rtype} ]}
rtype with values numeric/factor is used instead of actual term type
so that R script will not need to interpret term type

***  function cascade  ***
get_regression()
	parse_q
	getSampleData
		divideTerms
		getSampleData_dictionaryTerms
		getSampleData_snplstOrLocus
			doImputation
			applyGeneticModel
	makeRinput
	validateRinput
	replaceTermId
	... run R ...
	parseRoutput
*/

// minimum number of samples to run analysis
const minimumSample = 1

export async function getData(q, ds) {
	try {
		parse_q(q, ds)
		return await getSampleData(q, q.terms)
	} catch (e) {
		if (e.stack) console.log(e.stack)
		return { error: e.message || e }
	}
}

function parse_q(q, ds) {
	if (!ds.cohort) throw 'cohort missing from ds'
	q.ds = ds
	if (!q.terms) throw `missing 'terms' parameter`
	q.terms.map(tw => {
		if (!tw.term.name) tw.term = q.ds.cohort.termdb.q.termjsonByOneid(tw.term.id)
	})
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

Returns 
	{
		lst: [
			{sample, termid1: {key, value(s)}, }
		]
	}
*/
async function getSampleData(q, terms) {
	// dictionary and non-dictionary terms require different methods for data query
	const [dictTerms, nonDictTerms] = divideTerms(terms)

	const { samples, refs } = getSampleData_dictionaryTerms(q, dictTerms)

	// sample data from all terms are loaded into "samples"
	for (const tw of nonDictTerms) {
		// for each non dictionary term type
		// query sample data with its own method and append results to "samples"
		if (tw.term.type == 'geneVariant') {
			await add_geneMutation2SampleData(tw, samples, q, dictTerms.length)
		} else {
			throw 'unknown type of independent non-dictionary term'
		}
	}

	return { samples, refs }
}

function divideTerms(lst) {
	// quick fix to divide list of term to two lists
	// TODO ways to generalize; may use `shared/usecase2termtypes.js` with "regression":{nonDictTypes:['snplst','prs']}
	// shared between server and client
	const dict = [],
		nonDict = []
	for (const tw of lst) {
		const type = tw.term.type
		if (type == 'snplst' || type == 'snplocus' || type == 'geneVariant') {
			nonDict.push(tw)
		} else {
			dict.push(tw)
		}
	}
	return [dict, nonDict]
}

function getSampleData_dictionaryTerms(q, termWrappers) {
	const samples = {}
	const refs = { byTermId: {} }
	if (!termWrappers.length) return { samples, refs }

	const filter = getFilterCTEs(q.filter, q.ds)
	// must copy filter.values as its copy may be used in separate SQL statements,
	// for example get_rows or numeric min-max, and each CTE generator would
	// have to independently extend its copy of filter values
	const values = filter ? filter.values.slice() : []

	const CTEs = termWrappers.map((tw, i) => {
		const CTE = get_term_cte(q, values, i, filter, tw)
		if (CTE.bins) {
			refs.byTermId[tw.term.id] = { bins: CTE.bins }
		}
		if (tw.term.values) {
			const values = Object.values(tw.term.values)
			if (values.find(v => 'order' in v)) {
				refs.byTermId[tw.term.id] = {
					keyOrder: values.sort((a, b) => a.order - b.order).map(v => v.key)
				}
			}
		}
		return CTE
	})
	values.push(...termWrappers.map(tw => tw.term.id))

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
	for (const { sample, term_id, key, value } of rows) {
		if (!samples[sample]) samples[sample] = { sample }
		samples[sample][term_id] = { key, value }
	}

	return { samples, refs }
}

async function add_geneMutation2SampleData(tw, samples, q, dictTermsLength = 0) {
	// return early if all samples are filtered out by not having matching dictionary term values
	if (dictTermsLength && !Object.keys(samples).length) return
	const tname = tw.term.name
	const flagset = await get_flagset(q.ds.cohort, q.genome)
	const sampleData = {}
	for (const flagname in flagset) {
		const flag = flagset[flagname]
		if (!(tname in flag.data)) continue
		for (const d of flag.data[tname]) {
			// TODO: fix the sample names in the PNET mutation text files
			const sname = d.sample.split(';')[0].trim()
			// only create a sample entry/row when it is not already filtered out by not having any dictionary term values
			if (!dictTermsLength && !(sname in samples)) samples[sname] = { sample: sname }
			const row = samples[sname]
			if (!row) continue
			if (!row[tname]) row[tname] = { key: tname, values: [], label: tname }
			row[tname].values.push(d)
		}
	}
}
