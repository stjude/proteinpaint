const path = require('path')
const { get_term_cte } = require('./termdb.sql')
const { getFilterCTEs } = require('./termdb.filter')
const lines2R = require('./lines2R')
const fs = require('fs')
const imagesize = require('image-size')
const serverconfig = require('./serverconfig')
const utils = require('./utils')
const termdbsql = require('./termdb.sql')
const { querySamples_gdcapi } = require('./mds3.gdc')

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

export async function getData(q, ds, genome) {
	try {
		parse_q(q, ds, genome)
		return await getSampleData(q, q.terms)
	} catch (e) {
		if (e.stack) console.log(e.stack)
		return { error: e.message || e }
	}
}

function parse_q(q, ds, genome) {
	if (!ds.cohort) throw 'cohort missing from ds'
	q.ds = ds
	q.genome = genome
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
	.genome

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
	const { samples, refs } = await getSampleData_dictionaryTerms(q, dictTerms)

	if (q.ds.getSampleIdMap) {
		refs.bySampleId = q.ds.getSampleIdMap(samples)
	}

	// return early if all samples are filtered out by not having matching dictionary term values
	if (dictTerms.length && !Object.keys(samples).length) return { samples, refs }

	// sample data from all terms are added into samples data
	for (const tw of nonDictTerms) {
		// for each non dictionary term type
		// query sample data with its own method and append results to "samples"
		if (tw.term.type == 'geneVariant') {
			const bySampleId = await q.ds.mayGetGeneVariantData(tw, q)
			for (const [sampleId, value] of bySampleId.entries()) {
				if (!(tw.term.name in value)) continue
				if (!dictTerms.length) {
					// only create a sample entry/row when it is not already filtered out by not having any dictionary term values
					if (!(sampleId in samples)) samples[sampleId] = { sample: sampleId }
				}
				if (samples[sampleId]) {
					samples[sampleId][tw.term.name] = value[tw.term.name]
				}
			}
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

/*
input:

q{}
termWrappers[]
	list of tw objects based on dictionary terms

output:

{
	samples: {}
		key: stringified integer id
		val: {}
			sample: int id
			<term id>: { key: str, value: str }
	refs:{}
		{ byTermId: {} }
}
*/
async function getSampleData_dictionaryTerms(q, termWrappers) {
	const samples = {}
	const refs = { byTermId: {} }

	if (!termWrappers.length) return { samples, refs }

	if (q.ds?.variant2samples?.gdcapi) {
		/*

		************** quick fix ****************

		to tell it is gdc dataset, and uses the special method to query cases
		TODO should provide complete list of genes to add to gdcapi query
		to restrict cases to only those mutated on the given genes
		rather than retrieving all 80K cases from gdc
		*/
		return await getSampleData_gdc(q, termWrappers)
	}

	const twByTermId = {}

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
		if ('id' in tw.term) twByTermId[tw.term.id] = tw
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
		const tw = twByTermId[term_id]
		if (tw && tw.term.type == 'condition' && tw.q.mode == 'cox' && tw.q.timeScale == 'age') {
			const v = JSON.parse(value)
			samples[sample][term_id] = { key, value: v.age_end - q.ds.cohort.termdb.ageEndOffset }
		} else {
			samples[sample][term_id] = { key, value }
		}
	}

	return { samples, refs }
}

/*
******** all gdc-specific logic **********
makes same return as getSampleData_dictionaryTerms()

q{}
	.currentGeneNames=[ symbol, ... ]
*/
async function getSampleData_gdc(q, termWrappers) {
	if (!q.genome.genedb.get_gene2canonicalisoform) throw 'gene2canonicalisoform not supported on this genome'

	// currentGeneNames[] contains gene symbols
	// convert to ENST isoforms to work with gdc api
	const isoforms = []
	for (const n of JSON.parse(q.currentGeneNames)) {
		const data = q.genome.genedb.get_gene2canonicalisoform.get(n)
		if (!data.isoform) {
			// no isoform found
			continue
		}
		isoforms.push(data.isoform)
	}

	const param = {
		get: 'samples',
		isoforms
	}

	const sampleLst = await querySamples_gdcapi(
		param,
		['case.observation.sample.tumor_sample_uuid', ...termWrappers.map(i => i.term.id)],
		q.ds
	)

	/*
	here returned samples are using submitter ids as .sample_id
	while other geneVariant terms in the matrix are using tumor_sample_uuid (unconverted)
	lucky the tumor_sample_uuid is still there, assign it to sample_id to be able to match with geneVariant terms

	here the submitter id conversion is wasted but later with cached mapping (no api query) will be trivial to ignore
	*/
	for (const s of sampleLst) {
		s.sample_id = s.tumor_sample_uuid
	}

	const samples = {}
	const refs = { byTermId: {} }

	for (const s of sampleLst) {
		const s2 = {
			sample: s.sample_id
		}
		for (const tw of termWrappers) {
			const v = s[tw.term.id]
			s2[tw.term.id] = {
				key: v,
				value: v
			}
		}
		samples[s.sample_id] = s2
	}
	return { samples, refs }
}
