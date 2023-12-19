import path from 'path'
import { get_samples, get_term_cte, interpolateSqlValues } from './termdb.sql'
import { getFilterCTEs } from './termdb.filter'
import lines2R from './lines2R'
import fs from 'fs'
import imagesize from 'image-size'
import serverconfig from './serverconfig'
import * as utils from './utils'
import * as termdbsql from './termdb.sql'
import { getSampleData_snplstOrLocus } from './termdb.regression'

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
		<term id>:
			bins: CTE.bins
			events: CTE.events
				these info are not available in term object and is computed during run time, and 

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
	// sample data from all terms are added into samples data
	// refs{byTermId, bySampleId} collects "meta" info on terms and samples

	// return early if all samples are filtered out by not having matching dictionary term values
	if (dictTerms.length && !Object.keys(samples).length) return { samples, refs }

	const sampleFilterSet = await mayGetSampleFilterSet(q, nonDictTerms) // conditionally returns a set of sample ids

	for (const tw of nonDictTerms) {
		// for each non dictionary term type
		// query sample data with its own method and append results to "samples"
		if (tw.term.type == 'geneVariant') {
			if (q.ds.cohort?.termdb?.getGeneAlias) refs.byTermId[tw.term.name] = q.ds.cohort?.termdb?.getGeneAlias(q, tw)

			const data = await q.ds.mayGetGeneVariantData(tw, q)

			for (const [sampleId, value] of data.entries()) {
				if (!(tw.term.name in value)) continue
				if (!dictTerms.length) {
					// only create a sample entry/row when it is not already filtered out by not having any dictionary term values
					// FIXME invalid assumption for data downloading
					if (!(sampleId in samples)) samples[sampleId] = { sample: sampleId }
				}
				if (samples[sampleId]) {
					samples[sampleId][tw.term.name] = value[tw.term.name]
				}
			}
		} else if (tw.term.type == 'snplst' || tw.term.type == 'snplocus') {
			tw.type = tw.term.type // required by regression code

			const _samples = new Map()
			await getSampleData_snplstOrLocus(tw, _samples, true)

			for (const [sampleId, value] of _samples) {
				if (sampleFilterSet && !sampleFilterSet.has(sampleId)) continue // filter in use and this sample not in filter

				if (!(sampleId in samples)) samples[sampleId] = { sample: sampleId }

				// convert value.id2value Map to an object
				const snp2value = {}
				for (const [snp, o] of value.id2value) snp2value[snp] = o.value

				samples[sampleId][tw.term.id] = snp2value
			}
		} else {
			throw 'unknown type of non-dictionary term'
		}
	}

	/* for samples collected into samples{}, register them in refs.bySampleId{} with display name
	- for native dataset, samples{} key is integer id, record string name in bySampleId for display
	- for gdc dataset, samples{} key is case uuid, record case submitter id in bySampleId for display

	note:
	- this gets rid of awkward properties e.g. "__sampleName", used to attach alternative sample name in mds3 mutation data points, and centralize such logic here
	- it leaks (minimum amount of) gdc-specific setting in general code 
	- future data sources need to be handled here
	- subject to change!
	*/
	for (const sid in samples) {
		if (q.ds.cohort?.termdb?.q?.id2sampleName) {
			refs.bySampleId[sid] = { label: q.ds.cohort.termdb.q.id2sampleName(Number(sid)) }
		} else if (q.ds.__gdc?.caseid2submitter) {
			refs.bySampleId[sid] = { label: q.ds.__gdc.caseid2submitter.get(sid) }
		}
	}

	return { samples, refs }
}

async function mayGetSampleFilterSet(q, nonDictTerms) {
	// if snplst/snplocus term is present, they will need the set of samples passing filter, to only return gt data for those samples
	if (!nonDictTerms.find(i => i.term.type == 'snplst' || i.term.type == 'snplocus')) {
		// no such term
		return
	}
	if (!q.filter) return // no filter, allow snplst/snplocus to return data for all samples
	return new Set((await get_samples(q.filter, q.ds)).map(i => i.id))
}

export async function getSamplesPerFilter(q, ds, res) {
	q.ds = ds
	const samples = {}
	for (const id in q.filters) {
		const filter = q.filters[id]
		const result = (await get_samples(filter, q.ds)).map(i => i.id)
		samples[id] = Array.from(new Set(result))
	}
	res.send(samples)
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
	if (!termWrappers.length) return { samples: {}, refs: { byTermId: {}, bySampleId: {} } }
	if (q.ds?.cohort?.db) {
		// dataset uses server-side sqlite db, must use this method for dictionary terms
		return await getSampleData_dictionaryTerms_termdb(q, termWrappers)
	}
	if (q.ds?.variant2samples?.get) {
		// ds is not using sqlite db but has v2s method
		return await getSampleData_dictionaryTerms_v2s(q, termWrappers)
	}
	throw 'unknown method for dictionary terms'
}

export async function getSampleData_dictionaryTerms_termdb(q, termWrappers) {
	const samples = {}
	const refs = { byTermId: {}, bySampleId: {} }

	const twByTermId = {}
	const filter = await getFilterCTEs(q.filter, q.ds)
	// must copy filter.values as its copy may be used in separate SQL statements,
	// for example get_rows or numeric min-max, and each CTE generator would
	// have to independently extend its copy of filter values
	const values = filter ? filter.values.slice() : []
	const CTEs = await Promise.all(
		termWrappers.map(async (tw, i) => {
			const CTE = await get_term_cte(q, values, i, filter, tw)
			if (CTE.bins) {
				refs.byTermId[tw.term.id] = { bins: CTE.bins }
			}
			if (CTE.events) {
				refs.byTermId[tw.term.id] = { events: CTE.events }
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
	).catch(console.error)

	// for "samplelst" term, term.id is missing and must use term.name
	values.push(...termWrappers.map(tw => tw.term.id || tw.term.name))
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

	// if q.currentGeneNames is in use, must restrict to these samples
	const limitMutatedSamples = await mayQueryMutatedSamples(q)

	for (const { sample, term_id, key, value } of rows) {
		if (limitMutatedSamples && !limitMutatedSamples.has(sample)) continue // this sample is not mutated for given genes
		if (!samples[sample]) samples[sample] = { sample }
		const tw = twByTermId[term_id]
		// this assumes unique term key/value for a given sample
		// samples[sample][term_id] = { key, value }

		if (!samples[sample][term_id]) samples[sample][term_id] = { key, value }
		else {
			// in case a sample can have multiple value for a given term,
			// or a sample can belong to multiple groups, simply concatenate
			if (!samples[sample][term_id].values) samples[sample][term_id].values = [samples[sample][term_id]]
			samples[sample][term_id].values.push({ key, value })
		}
	}

	for (const sample in samples) {
		for (const term_id in samples[sample]) {
			const values = samples[sample][term_id].values
			if (!values) continue
			// Create a new group for samples that belong to multiple groups
			// The new group name will be a combination of all the group names
			// that apply to a sample, sorted alphanumerically
			// TODO: may simplify to create only one extra group to catch
			// all multi-group samples, regardless of the combination of group names, etc
			const key = values
				.sort()
				.map(v => v.key)
				.sort()
				.join(', ')
			samples[sample][term_id] = { key, val: values.length }
			delete samples[sample][term_id].values
		}
	}

	return { samples, refs }
}

async function mayQueryMutatedSamples(q) {
	if (!q.currentGeneNames) return // no genes, do not query mutated samples and do not limit
	// has genes. query samples mutated on any of these genes, collect sample id into a set and return
	const sampleSet = new Set()
	for (const geneName of q.currentGeneNames) {
		const tw = { term: { name: geneName, type: 'geneVariant' } }
		const bySampleId = await q.ds.mayGetGeneVariantData(tw, q)
		for (const [sampleId, value] of bySampleId.entries()) {
			sampleSet.add(sampleId)
		}
	}
	return sampleSet
}

/*
using mds3 dataset, that's without server-side sqlite db
only gdc runs it
*/
async function getSampleData_dictionaryTerms_v2s(q, termWrappers) {
	const q2 = {
		filter0: q.filter0, // must pass on gdc filter0 if present
		filterObj: q.filter, // must rename key as "filterObj" but not "filter" to go with what mds3 backend is using
		genome: q.genome,
		get: 'samples',
		twLst: termWrappers,
		useIntegerSampleId: true, // ask v2s.get() to return integer sample id
		isHierCluster: q.isHierCluster // optional flag required for gdc dataset
	}
	if (q.currentGeneNames) {
		q2.geneTwLst = []
		for (const n of q.currentGeneNames) {
			q2.geneTwLst.push({ term: { name: n, type: 'geneVariant' } })
		}
	}

	const data = await q.ds.variant2samples.get(q2)

	const samples = {}
	const refs = { byTermId: data.byTermId, bySampleId: {} }

	for (const s of data.samples) {
		const s2 = {
			sample: s.sample_id
		}

		/* optional attribute returned by gdc dataset
		s.sample_id: case uuid for aligning matrix columns
		s.__sampleName: case submitter id for display

		non-gdc won't return this and will display s.sample_id
		*/
		if (s.__sampleName) s2.sampleName = s.__sampleName

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

/*
works with "canned" matrix plot in a dataset, e.g. data from a text file
called in mds3.init
*/
export async function mayInitiateMatrixplots(ds) {
	if (!ds.cohort.matrixplots) return
	if (!Array.isArray(ds.cohort.matrixplots.plots)) throw 'cohort.matrixplots.plots is not array'
	for (const p of ds.cohort.matrixplots.plots) {
		if (!p.name) throw '.name missing from one of matrixplots.plots[]'
		if (p.file) {
			const matrixConfig = await utils.read_file(path.join(serverconfig.tpmasterdir, p.file))
			p.matrixConfig = JSON.parse(matrixConfig)
			if (p.getConfig) p.matrixConfig = p.getConfig(p.matrixConfig)
		} else {
			throw 'unknown data source of one of matrixplots.plots[]'
		}
	}
}
