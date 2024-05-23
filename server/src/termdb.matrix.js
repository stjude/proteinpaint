import path from 'path'
import { get_samples, get_term_cte, interpolateSqlValues } from './termdb.sql'
import { getFilterCTEs } from './termdb.filter'
import serverconfig from './serverconfig'
import { read_file } from './utils'
import { getSampleData_snplstOrLocus } from './termdb.regression'
import { TermTypes, isDictionaryType, isNonDictionaryType } from '#shared/terms'
import { get_bin_label, compute_bins } from '#shared/termdb.bins.js'

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
	samples{}
		key: stringified integer sample id 
		value: { 
			sample: integerId,
			<termid>: {key, value},
			<more terms...>
			<geneName>:{ 
				key, label, // these two are both gene names. useless?? FIXME
				values:[]
					{gene/isoform/chr/pos/ref/alt/class/mname/dt}
			}
		}
	
	byTermId{}
		metadata about terms
		<term id>:
			bins: CTE.bins
			events: CTE.events
				these info are not available in term object and is computed during run time, and 

	bySampleId{}
		metadata about samples (e.g. print names). avoid duplicating such in sample data elements (e.g. mutations)
		[sample integer id]: {label: [string sample name for display], ...}
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
		if (tw?.term?.type && isDictionaryType(tw.term.type)) {
			if (!tw.term.name) tw.term = q.ds.cohort.termdb.q.termjsonByOneid(tw.term.id)
			if (!tw.q) console.log('do something??')
		}
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
	const [samples, byTermId] = await getSampleData_dictionaryTerms(q, dictTerms)
	/* samples={}
	this object collects term annotation data on all samples; even if there's no dict term it still return blank {}
	non-dict term data will be appended to it
	byTermId={}
	collects metadata on terms
	*/

	if (dictTerms.length && !Object.keys(samples).length) {
		// return early if all samples are filtered out by not having matching dictionary term values
		return { samples, refs: { byTermId, bySampleId: {} } }
	}

	for (const tw of nonDictTerms) {
		if (!tw.$id || tw.$id == 'undefined') tw.$id = tw.term.id || tw.term.name //for tests and backwards compatibility

		// for each non dictionary term type
		// query sample data with its own method and append results to "samples"
		if (tw.term.type == 'geneVariant') {
			if (tw.term.gene && q.ds.cohort?.termdb?.getGeneAlias) {
				byTermId[tw.$id] = q.ds.cohort?.termdb?.getGeneAlias(q, tw)
			}

			const data = await q.ds.mayGetGeneVariantData(tw, q)

			for (const [sampleId, value] of data.entries()) {
				if (!(tw.$id in value)) continue
				if (!dictTerms.length) {
					// only create a sample entry/row when it is not already filtered out by not having any dictionary term values
					// FIXME invalid assumption for data downloading
					if (!(sampleId in samples)) samples[sampleId] = { sample: sampleId }
				}
				if (samples[sampleId]) {
					samples[sampleId][tw.$id] = value[tw.$id]
				}
			}
		} else if (tw.term.type == 'snplst' || tw.term.type == 'snplocus') {
			const sampleFilterSet = await mayGetSampleFilterSet4snplst(q, nonDictTerms) // conditionally returns a set of sample ids, FIXME *only* for snplst and snplocus data download in supported ds, not for anything else. TODO remove this bad quick fix

			tw.type = tw.term.type // required by regression code

			const _samples = new Map()
			await getSampleData_snplstOrLocus(tw, _samples, true)

			for (const [sampleId, value] of _samples) {
				if (sampleFilterSet && !sampleFilterSet.has(sampleId)) continue // filter in use and this sample not in filter

				if (!(sampleId in samples)) samples[sampleId] = { sample: sampleId }

				// convert value.id2value Map to an object
				const snp2value = {}
				for (const [snp, o] of value.id2value) snp2value[snp] = o.value

				samples[sampleId][tw.$id] = snp2value
			}
		} else if (tw.term.type == TermTypes.GENE_EXPRESSION || tw.term.type == TermTypes.METABOLITE_INTENSITY) {
			let lst
			if (tw.q?.mode == 'discrete') {
				const min = tw.term.bins.min
				const max = tw.term.bins.max
				lst =
					tw.q.type == 'regular-bin'
						? compute_bins(tw.q, () => {
								return { min, max }
						  })
						: tw.q.lst

				byTermId[tw.$id] = { bins: lst }
			}

			const args = {
				genome: q.ds.genome,
				dslabel: q.ds.label,
				clusterMethod: 'hierarchical',
				distanceMethod: 'euclidean', // TODO refactor get() and remove these arg
				dataType: tw.term.type,
				terms: [tw.term],
				filter: q.filter,
				filter0: q.filter0
			}
			const data = await q.ds.queries[tw.term.type].get(args)
			for (const sampleId in data.term2sample2value.get(tw.term.name)) {
				if (!(sampleId in samples)) {
					samples[sampleId] = { sample: sampleId }
				}
				const values = data.term2sample2value.get(tw.term.name)
				const value = Number(values[sampleId])
				let key = value
				if (tw.q?.mode == 'discrete') {
					//check binary mode
					const bin = getBin(lst, value)
					key = get_bin_label(lst[bin], tw.q)
				}
				samples[sampleId][tw.$id] = { key, value }
			}

			/** pp filter */
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
	const bySampleId = {}
	for (const sid in samples) {
		if (q.ds.cohort?.termdb?.q?.id2sampleName) {
			bySampleId[sid] = { label: q.ds.cohort.termdb.q.id2sampleName(Number(sid)) }
		} else if (q.ds.__gdc?.caseid2submitter) {
			bySampleId[sid] = { label: q.ds.__gdc.caseid2submitter.get(sid) }
		}
	}
	return { samples, refs: { byTermId, bySampleId } }
}

export function getBin(lst, value) {
	value = Math.round(value * 100) / 100 //to keep 2 decimal places

	let bin = lst.findIndex(
		b => (b.startunbounded && value < b.stop) || (b.startunbounded && b.stopinclusive && value == b.stop)
	)
	if (bin == -1)
		bin = lst.findIndex(
			b => (b.stopunbounded && value > b.start) || (b.stopunbounded && b.startinclusive && value == b.start)
		)
	if (bin == -1)
		bin = lst.findIndex(
			b =>
				(value > b.start && value < b.stop) ||
				(b.startinclusive && value == b.start) ||
				(b.stopinclusive && value == b.stop)
		)
	return bin
}

async function mayGetSampleFilterSet4snplst(q, nonDictTerms) {
	// // if snplst/snplocus term is present, they will need the set of samples passing filter, to only return gt data for those samples
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
		const type = tw.term?.type
		if (type) {
			if (isNonDictionaryType(type)) nonDict.push(tw)
			else dict.push(tw)
		} else if (tw.term?.id) dict.push(tw) // TODO: detect using term.type as part of request payload
		else nonDict.push(tw) // TODO: detect using term.type as part of request payload
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
	if (!termWrappers.length) return [{}, {}]
	if (q.ds?.cohort?.db) {
		// dataset uses server-side sqlite db, must use this method for dictionary terms
		return await getSampleData_dictionaryTerms_termdb(q, termWrappers)
	}
	/* gdc ds has no cohort.db. thus call v2s.get() to return sample annotations for its dictionary terms
	 */
	if (q.ds?.variant2samples?.get) {
		// ds is not using sqlite db but has v2s method
		return await getSampleData_dictionaryTerms_v2s(q, termWrappers)
	}
	throw 'unknown method for dictionary terms'
}

export async function getSampleData_dictionaryTerms_termdb(q, termWrappers) {
	const samples = {} // to return
	const byTermId = {} // to return
	const filter = await getFilterCTEs(q.filter, q.ds)
	// must copy filter.values as its copy may be used in separate SQL statements,
	// for example get_rows or numeric min-max, and each CTE generator would
	// have to independently extend its copy of filter values
	const values = filter ? filter.values.slice() : []
	const CTEs = await Promise.all(
		termWrappers.map(async (tw, i) => {
			if (!tw.$id) tw.$id = tw.term.id || tw.term.name
			const CTE = await get_term_cte(q, values, i, filter, tw)
			const $id = tw.$id || tw.term.id
			if (CTE.bins) {
				byTermId[tw.$id] = { bins: CTE.bins }
			}
			if (CTE.events) {
				byTermId[tw.$id] = { events: CTE.events }
			}
			if (tw.term.values) {
				const values = Object.values(tw.term.values)
				if (values.find(v => 'order' in v)) {
					byTermId[tw.$id] = {
						keyOrder: values.sort((a, b) => a.order - b.order).map(v => v.key)
					}
				}
			}
			//if ('id' in tw.term) twBy$id[$id] = tw
			return CTE
		})
	).catch(console.error)

	// for "samplelst" term, term.id is missing and must use term.name
	values.push(...termWrappers.map(tw => tw.$id || tw.term.id || tw.term.name))
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

	for (const { sample, key, term_id, value } of rows) {
		if (limitMutatedSamples && !limitMutatedSamples.has(sample)) continue // this sample is not mutated for given genes
		if (!samples[sample]) samples[sample] = { sample }
		// this assumes unique term key/value for a given sample
		// samples[sample][term_id] = { key, value }

		if (!samples[sample][term_id]) {
			// first value of term for a sample
			samples[sample][term_id] = { key, value }
		} else {
			// samples has multiple values for a term
			// convert to .values[]
			if (!samples[sample][term_id].values) {
				const firstvalue = samples[sample][term_id] // first term value of the sample
				samples[sample][term_id] = { values: [firstvalue] } // convert to object with .values[]
			}
			// add next term value to .values[]
			samples[sample][term_id].values.push({ key, value })
		}
	}
	return [samples, byTermId]
}

// FIXME this never runs
async function mayQueryMutatedSamples(q) {
	if (!q.currentGeneNames) return // no genes, do not query mutated samples and do not limit
	// has genes. query samples mutated on any of these genes, collect sample id into a set and return
	const sampleSet = new Set()
	for (const geneName of q.currentGeneNames) {
		const tw = { term: { gene: geneName, name: geneName, type: 'geneVariant' } }
		const data = await q.ds.mayGetGeneVariantData(tw, q)
		for (const sampleId of data.keys()) {
			sampleSet.add(sampleId)
		}
	}
	return sampleSet
}

/*
using mds3 dataset, that's without server-side sqlite db and will not execute any sql query
so far it's only gdc
later can be other api-based datasets
*/
async function getSampleData_dictionaryTerms_v2s(q, termWrappers) {
	const q2 = {
		filter0: q.filter0, // must pass on gdc filter0 if present
		filterObj: q.filter, // must rename key as "filterObj" but not "filter" to go with what mds3 backend is using
		genome: q.genome,
		get: 'samples',
		twLst: termWrappers,
		// !! gdc specific parameter !!
		// instructs querySamples_gdcapi() to return case uuid as sample.sample_id; more or less harmless as it's ignored by non-gdc ds
		gdcUseCaseuuid: true,
		// !! gdc specific parameter !!
		isHierCluster: q.isHierCluster
	}
	if (q.rglst) {
		// !! gdc specific parameter !! present for block tk in genomic mode
		q2.rglst = q.rglst
	}
	if (q.currentGeneNames) {
		q2.geneTwLst = []
		for (const n of q.currentGeneNames) {
			q2.geneTwLst.push({ term: { id: n, gene: n, name: n, type: 'geneVariant' } })
		}
	} else {
		/* do not throw here
		gene list is not required for loading dict term for gdc gene exp clustering
		but it's required for gdc oncomatrix and will break FIXME
		*/
	}

	const data = await q.ds.variant2samples.get(q2)
	/* data={samples[], byTermId{}}
	data.samples[] is converted to samples{}
	data.byTermId{} is returned without change
	*/

	const samples = {} // data.samples[] converts into this

	for (const s of data.samples) {
		const s2 = {
			sample: s.sample_id
		}
		for (const tw of termWrappers) {
			const id = tw.term.id || tw.term.name
			const $id = tw.$id || id
			if (!tw.$id) tw.$id = $id
			const v = s[id]

			////////////////////////////
			// somehow value can be undefined! must skip them
			////////////////////////////

			if (Array.isArray(v) && v[0] != undefined && v[0] != null) {
				////////////////////////////
				// "v" can be array
				// e.g. "age of diagnosis"
				////////////////////////////
				s2[$id] = {
					key: v[0],
					value: v[0]
				}
			} else if (v != undefined && v != null) {
				s2[$id] = {
					key: v,
					value: v
				}
			}
		}
		samples[s.sample_id] = s2
	}
	return [samples, data.byTermId || {}]
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
			const matrixConfig = await read_file(path.join(serverconfig.tpmasterdir, p.file))
			p.matrixConfig = JSON.parse(matrixConfig)
			if (p.getConfig) p.matrixConfig = p.getConfig(p.matrixConfig)
		} else {
			throw 'unknown data source of one of matrixplots.plots[]'
		}
	}
}
