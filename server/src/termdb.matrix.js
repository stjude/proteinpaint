const path = require('path')
const { get_term_cte, interpolateSqlValues } = require('./termdb.sql')
const { getFilterCTEs } = require('./termdb.filter')
const lines2R = require('./lines2R')
const fs = require('fs')
const imagesize = require('image-size')
const serverconfig = require('./serverconfig')
const utils = require('./utils')
const termdbsql = require('./termdb.sql')
const { querySamples_gdcapi } = require('./mds3.gdc')

/*

for a list of termwrappers, get the sample annotation data to these terms, by obeying categorization method defined in tw.q{}

this method abstracts away lots of details:
1. term types, including dictionary term and non-dict terms (geneVariant and samplelst etc)
2. data source, including sqlite termdb, gdc api, and md3 mutation


Inputs:

q{}
	.filter{}
	.filter0
	.terms[]
		each element is {id=str, term={}, q={}}
ds{}
	server-side dataset object
genome{}
	server-side genome object

Returns:

{
	samples: {}
		key: stringified integer sample id (TODO use integer)
		value: { 
			sample: integerId,
			<termid>: {key, value},
			<more terms...>
			<geneName>:{ 
				key, label, // these two are both gene names and useless
				values:[]
					{gene/isoform/chr/pos/ref/alt/class/mname/dt}
			}
		}
	
	byTermId:{}
	bySampleId:{}
		key: stringified integer id
		value: sample name
}
*/

export async function getData(q, ds, genome) {
	try {
		validateArg(q, ds, genome)
		return await getSampleData(q)
	} catch (e) {
		if (e.stack) console.log(e.stack)
		return { error: e.message || e }
	}
}

function validateArg(q, ds, genome) {
	if (!ds.cohort) throw 'cohort missing from ds'
	if (!q.terms) throw `missing 'terms' parameter`

	// needed by some helper functions
	q.ds = ds
	q.genome = genome

	for (const tw of q.terms) {
		// TODO clean up
		if (!tw.term.name) tw.term = q.ds.cohort.termdb.q.termjsonByOneid(tw.term.id)
		if (!tw.q) console.log('do something??')
	}
	if (q.currentGeneNames) {
		if (!Array.isArray(q.currentGeneNames)) throw 'currentGeneNames[] is not array'
	}
	if (q.filter0) {
		if (typeof q.filter0 == 'string') q.filter0 = JSON.parse(q.filter0)
	}
}

async function getSampleData(q) {
	// dictionary and non-dictionary terms require different methods for data query
	const [dictTerms, nonDictTerms] = divideTerms(q.terms)
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
	//console.log(interpolateSqlValues(sql, values))
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
TODO may move this function to mds3.gdc.js
or merge with querySamples_gdcapi

q{}
	.currentGeneNames=[ symbol, ... ]
*/
async function getSampleData_gdc(q, termWrappers) {
	if (!q.genome.genedb.get_gene2canonicalisoform) throw 'gene2canonicalisoform not supported on this genome'

	const currentGeneNames = q.currentGeneNames || []
	/* TODO

	currentGeneNames values should be termwrappers, instead of gene names
	each tw{}
		name: gene name
		isoform: isoform, if available
		q:{}
			determines allowed datatypes, including snvindel and geneCnv

	pass this array of tw to querySamples_gdcapi
	so it can query samples that has required datatypes on these genes
	*/

	// currentGeneNames[] contains gene symbols
	// convert to ENST isoforms to work with gdc api
	const isoforms = []
	const geneTwLst = []
	for (const n of currentGeneNames) {
		geneTwLst.push({ term: { name: n, type: 'geneVariant' } })
		const data = q.genome.genedb.get_gene2canonicalisoform.get(n)
		if (!data.isoform) {
			// no isoform found
			continue
		}
		isoforms.push(data.isoform)
	}
	if (!isoforms.length) throw 'no matching GDC isoforms found, at least one is needed to limit the sample query'

	const param = {
		get: 'samples',
		isoforms,
		filterObj: q.filter
	}

	const twLst = termWrappers.slice() // duplicate array to insert new ones, do not modify orignal
	twLst.push({ term: { id: 'case.observation.sample.tumor_sample_uuid' } }) // allow submitter id to be assigned to sample_id

	const sampleLst = await querySamples_gdcapi(param, twLst, q.ds, geneTwLst)

	const samples = {}
	const refs = { byTermId: {} }

	for (const s of sampleLst) {
		const s2 = {
			sample: s.sample_id
		}
		for (const tw of termWrappers) {
			const v = s[tw.term.id]

			////////////////////////////
			// somehow value can be undefined! must skip them
			////////////////////////////

			if (Array.isArray(v) && v[0] != undefined && v[0] != null) {
				////////////////////////////
				// "v" can be array
				// e.g. "age of diagnosis"
				////////////////////////////

				s2[tw.term.id] = {
					key: v[0],
					value: v[0]
				}
			} else if (v != undefined && v != null) {
				s2[tw.term.id] = {
					key: v,
					value: v
				}
			}
		}
		samples[s.sample_id] = s2
	}
	return { samples, refs }
}
