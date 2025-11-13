import path from 'path'
import { string2pos } from '#shared/common.js'
import { get_samples, get_term_cte, interpolateSqlValues, get_active_groupset } from './termdb.sql.js'
import { getFilterCTEs } from './termdb.filter.js'
import serverconfig from './serverconfig.js'
import { read_file } from './utils.js'
import {
	TermTypes,
	isDictionaryType,
	isNonDictionaryType,
	getBin,
	getParentType,
	getSampleType
} from '#shared/terms.js'
import { get_bin_label, compute_bins } from '#shared/termdb.bins.js'
import { trigger_getDefaultBins } from './termdb.getDefaultBins.js'
import { getCategories } from '../routes/termdb.categories.ts'
import { authApi } from '#src/auth.js'

/*
for a list of termwrappers, get the sample annotation data to these terms, by obeying categorization method defined in tw.q{}

this method abstracts away lots of details:
1. term types, including dictionary term and non-dict terms (geneVariant and samplelst etc)
2. data source, including sqlite termdb, gdc api, and md3 mutation


Inputs:
	q{}
		.filter{}
		.filter0
		.terms[] array of tw
	ds{}
		server-side dataset object
	onlyChildren: boolean
		true: the term annotates parent samples, the query will return annotations for the children of the samples that have the term
		false: the term annotates child samples, the query will return annotations for the samples that have the term

Returns:
	- see ValidGetDataResponse type in shared/types/src/termdb.matrix.ts for documentation
	- please update types in shared/types/src/termdb.matrix.ts if the return object is changed
*/

export async function getData(q, ds, onlyChildren = false) {
	try {
		validateArg(q, ds)
		authApi.mayAdjustFilter(q, ds, q.terms)
		const data = await getSampleData(q, ds, onlyChildren)

		checkAccessToSampleData(data, ds, q)

		// get categories within same data request to avoid a separate
		// getCategories() request, which can be time-consuming for
		// datasets without local db (e.g. GDC)
		const categories = mayGetCategories(data, q, ds)
		if (categories) {
			const byTermId = data.refs.byTermId
			for (const k of Object.keys(categories)) {
				if (!Object.keys(byTermId).includes(k)) byTermId[k] = {}
				byTermId[k].categories = categories[k]
			}
		}
		return data
	} catch (e) {
		if (e.stack) console.log(e.stack)
		return { error: e.message || e, code: e.code } // ok for e.code to be undefined
	}
}

function validateArg(q, ds) {
	if (!ds.cohort) throw 'cohort missing from ds'
	if (!q.terms) throw `missing 'terms' parameter`

	// needed by some helper functions
	q.ds = ds

	for (const tw of q.terms) {
		// TODO clean up
		if ((tw?.term?.type && isDictionaryType(tw.term.type)) || (!tw.term?.type && tw.term.id)) {
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
	if (ds.cohort?.termdb?.getRestrictedTermValues) {
		if (!q.__protected__) throw `missing q.__protected__, must be set upstream of getData()`
		// also validated in authApi.mayAdjustFilter()
	}
}

async function getSampleData(q, ds, onlyChildren = false) {
	// dictionary and non-dictionary terms require different methods for data query
	const [dictTerms, geneVariantTws, nonDictTerms] = divideTerms(q.terms)
	const [samples, byTermId] = await getSampleData_dictionaryTerms(q, dictTerms, onlyChildren)
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

	if (geneVariantTws.length) {
		// special handling of these tws
		if (q.ds.queries?.snvindel?.byisoform?.processTwsInOneQuery) {
			// special ds handling, must make one query with all tws, but not to process one tw a time
			await q.ds.queries.snvindel.byisoform.get(q, geneVariantTws, samples)
		} else {
			// common ds handling, one query per tw
			if (!q.ds.mayGetGeneVariantData) throw 'not supported by dataset: geneVariant'
			const promises = []
			for (const tw of geneVariantTws) {
				if (tw.term.gene && q.ds.cohort?.termdb?.getGeneAlias) {
					byTermId[tw.$id] = q.ds.cohort?.termdb?.getGeneAlias(q, tw)
				}

				promises.push(
					(async () => {
						const data = await q.ds.mayGetGeneVariantData(tw, q)

						for (const [sampleId, value] of data.entries()) {
							if (!(sampleId in samples)) samples[sampleId] = { sample: sampleId }
							samples[sampleId][tw.$id] = value[tw.$id]
						}
					})()
				)
			}
			await Promise.all(promises)
		}
	}

	// for each non dictionary term type
	// query sample data with its own method and append results to "samples"
	for (const tw of nonDictTerms) {
		if (tw.term.type == 'snp') {
			const sampleGTs = await getSnpData(tw, q)
			const groupset = get_active_groupset(tw.term, tw.q)
			for (const s of sampleGTs) {
				if (!(s.sample_id in samples)) samples[s.sample_id] = { sample: s.sample_id }
				if (groupset) {
					// groupsetting is active
					const group = groupset.groups.find(group => {
						return group.values.map(v => v.key).includes(s.gt)
					})
					if (!group) throw 'unable to assign sample to group'
					samples[s.sample_id][tw.$id] = { key: group.name, value: group.name }
				} else {
					// groupsetting is not active
					samples[s.sample_id][tw.$id] = { key: s.gt, value: s.gt }
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
		} else if (
			tw.term.type == TermTypes.GENE_EXPRESSION ||
			tw.term.type == TermTypes.METABOLITE_INTENSITY ||
			tw.term.type == TermTypes.SSGSEA
		) {
			if (!q.ds.queries?.[tw.term.type]) throw 'not supported by dataset: ' + tw.term.type
			let lstOfBins // of this tw. only set when q.mode is discrete
			if (tw.q?.mode == 'discrete' || tw.q?.mode == 'binary') {
				lstOfBins = await findListOfBins(q, tw, ds)
				byTermId[tw.$id] = { bins: lstOfBins }
			}
			const args = {
				genome: q.ds.genomename,
				dslabel: q.ds.label,
				dataType: tw.term.type,
				terms: [tw],
				filter: q.filter,
				filter0: q.filter0
			}
			const data = await q.ds.queries[tw.term.type].get(args)
			const values = data.term2sample2value.get(tw.$id)
			for (const sampleId in values) {
				if (!(sampleId in samples)) samples[sampleId] = { sample: sampleId }
				const value = Number(values[sampleId])
				let key = value
				if (lstOfBins) {
					// term is in binning mode. key should be changed into the label of the bin to which value belongs
					const bin = getBin(lstOfBins, value)
					key = get_bin_label(lstOfBins[bin], tw.q)
				}
				samples[sampleId][tw.$id] = { key, value }
			}
		} else if (tw.term.type == TermTypes.SINGLECELL_GENE_EXPRESSION) {
			if (!q.ds.queries?.singleCell?.geneExpression) throw 'not supported by dataset: singleCell.geneExpression'
			let lst // list of bins based on tw config
			if (tw.q?.mode == 'discrete') {
				const min = tw.term.bins.min
				const max = tw.term.bins.max
				if (tw.q.type == 'regular-bin') {
					lst = compute_bins(tw.q, () => {
						return { min, max }
					})
				} else {
					if (!tw.q.lst) throw 'q.type is not discrete and q.lst[] is missing'
					lst = tw.q.lst
				}
				byTermId[tw.$id] = { bins: lst }
			}
			const geneExpMap = await q.ds.queries.singleCell.geneExpression.get({
				sample: tw.term.sample,
				gene: tw.term.gene
			})
			//samples are cells
			for (const sampleId in geneExpMap) {
				if (!(sampleId in samples)) {
					samples[sampleId] = { sample: sampleId }
				}
				const value = geneExpMap[sampleId]
				let key = value
				if (tw.q?.mode == 'discrete') {
					//check binary mode
					const bin = getBin(lst, value)
					key = get_bin_label(lst[bin], tw.q)
				}
				samples[sampleId][tw.$id] = { value, key }
			}
		} else if (tw.term.type == TermTypes.SINGLECELL_CELLTYPE) {
			if (!q.ds.queries?.singleCell?.data) throw 'not supported by dataset: singleCell.data'
			const data = await q.ds.queries.singleCell.data.get({
				sample: tw.term.sample,
				plots: [tw.term.plot],
				colorBy: { [tw.term.plot]: tw.term.colorBy }
			})
			const groups = tw.q?.customset?.groups
			for (const cell of data.plots[0].noExpCells) {
				const sampleId = cell.cellId
				if (!(sampleId in samples)) {
					samples[sampleId] = { sample: sampleId }
				}
				let value = cell.category
				if (groups) {
					//custom groups where created
					const group = groups.find(g => Object.values(g.values).find(v => v.key == value))
					if (group) value = group.name
				}
				samples[sampleId][tw.$id] = { value, key: value }
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
	const bySampleId = {}
	for (const sid in samples) {
		if (q.ds.cohort?.termdb?.q?.id2sampleName) {
			bySampleId[sid] = { label: q.ds.cohort.termdb.q.id2sampleName(Number(sid)) }
		} else if (q.ds.__gdc?.caseid2submitter) {
			bySampleId[sid] = { label: q.ds.__gdc.caseid2submitter.get(sid) }
		}
	}
	const sids = Object.keys(samples)
	let sampleType
	if (sids.length > 0) {
		const sid = Number(sids[0]) || sids[0]
		const stid = q.ds.sampleId2Type.get(sid)
		sampleType = q.ds.cohort.termdb.sampleTypes[stid]
	}
	return { samples, refs: { byTermId, bySampleId }, sampleType }
}

// function to get sample genotype data for a single snp
export async function getSnpData(tw, q) {
	if (!q.ds.queries?.snvindel?.byrange) throw 'not supported by dataset: snvindel.byrange'
	const arg = {
		addFormatValues: true,
		filter0: q.filter0, // hidden filter
		filterObj: q.filter, // pp filter, must change key name to "filterObj" to be consistent with mds3 client
		sessionid: q.sessionid
	}
	if (!tw.term.chr || !Number.isInteger(tw.term.start) || !Number.isInteger(tw.term.stop))
		throw 'snp term does not have valid coordinate'
	arg.rglst = [tw.term]
	// retrieve variant data
	// will include all alleles of any snv or indel
	// that overlaps the given coordinate
	const _mlst = await q.ds.queries.snvindel.byrange.get(arg)
	// filter for alleles of queried variant
	const mlst = _mlst.filter(m => m.pos == tw.term.start && m.ref == tw.term.ref && tw.term.alt.includes(m.alt))
	// parse sample genotypes
	// can use mlst[0].samples because .samples[] will
	// be identical for each element of mlst[]
	const sampleGTs = []
	for (const s of mlst[0].samples) {
		if (!('GT' in s.formatK2v)) throw 'sample must have GT format'
		const gt = s.formatK2v.GT
		const alleles = []
		for (const a of gt.split('/')) {
			if (!a || a === '.') {
				// gt is missing
				// TODO: handle missing gt
				continue
			} else {
				// gt is present
				// allele is represented as index
				const i = Number(a)
				if (i === 0) {
					// ref allele
					alleles.push(tw.term.ref)
				} else {
					// alt allele
					const m = mlst.find(m => i === m.altAlleleIdx)
					if (!m) throw 'alt allele idx cannot be found'
					alleles.push(m.alt)
				}
			}
		}
		sampleGTs.push({ sample_id: s.sample_id, gt: alleles.join('/') })
	}
	return sampleGTs
}

async function mayGetSampleFilterSet4snplst(q, nonDictTerms) {
	// // if snplst/snplocus term is present, they will need the set of samples passing filter, to only return gt data for those samples
	if (!nonDictTerms.find(i => i.term.type == 'snplst' || i.term.type == 'snplocus')) {
		// no such term
		return
	}
	if (!q.filter) return // no filter, allow snplst/snplocus to return data for all samples
	return new Set((await get_samples(q, q.ds)).map(i => i.id))
}

export function divideTerms(lst) {
	// divide query list of tw into following lists based on term type
	const dict = [],
		geneVariantTws = [],
		nonDict = []
	for (const tw of lst) {
		const type = tw.term?.type
		// TODO FIXME should require valid term type, reject if not and remove assumptions and guesses
		if (type) {
			if (!tw.$id || tw.$id == 'undefined') tw.$id = tw.term.id || tw.term.name //for tests and backwards compatibility
			if (type == TermTypes.GENE_VARIANT) {
				geneVariantTws.push(tw) // collect into own list to process separately later
			} else if (isNonDictionaryType(type)) {
				nonDict.push(tw)
			} else {
				dict.push(tw)
			}
		} else if (tw.term?.id) {
			// term.type missing and has term.id, assume it is shorthand for coding up dict term on client
			dict.push(tw)
		} else {
			nonDict.push(tw)
		}
	}
	return [dict, geneVariantTws, nonDict]
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
async function getSampleData_dictionaryTerms(q, termWrappers, onlyChildren = false) {
	if (!termWrappers.length) return [{}, {}]
	if (q.ds?.cohort?.db) {
		// dataset uses server-side sqlite db, must use this method for dictionary terms
		return await getSampleData_dictionaryTerms_termdb(q, termWrappers, onlyChildren)
	}
	/* gdc ds has no cohort.db. thus call v2s.get() to return sample annotations for its dictionary terms
	 */
	if (q.ds?.variant2samples?.get) {
		// ds is not using sqlite db but has v2s method
		return await getSampleData_dictionaryTerms_v2s(q, termWrappers)
	}
	if (q.ds.cohort.termdb.q?.getAdHocTermValues) {
		//ds is not using sqlite db but has getAdHocTermValues method
		return await q.ds.cohort.termdb.q?.getAdHocTermValues(q, termWrappers)
	}
	throw 'unknown method for dictionary terms'
}

export async function getSampleData_dictionaryTerms_termdb(q, termWrappers, onlyChildren) {
	const byTermId = {} // to return
	// must copy filter.values as its copy may be used in separate SQL statements,
	// for example get_rows or numeric min-max, and each CTE generator would
	// have to independently extend its copy of filter values
	const sampleTypes = getSampleTypes(termWrappers, q.ds)
	const filter = await getFilterCTEs(q.filter, q.ds, sampleTypes)
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
	).catch(err => {
		console.error(err)
		throw err
	})

	// for "samplelst" term, term.id is missing and must use term.name
	values.push(...termWrappers.map(tw => tw.$id || tw.term.id || tw.term.name))
	const types = filter ? filter.sampleTypes : sampleTypes //the filter adds the types in the filter, that need to be considered
	if (!onlyChildren) onlyChildren = types.size > 1
	const rows = await getAnnotationRows(q, termWrappers, filter, CTEs, values, types, onlyChildren)
	const samples = await getSamples(q, rows)
	return [samples, byTermId]
}

export function getSampleTypes(termWrappers, ds) {
	const types = new Set()
	for (const tw of termWrappers) {
		const type = getSampleType(tw.term, ds)
		types.add(type)
	}
	return types
}

/*
When querying sample annotations for dictionary terms, the query is split into two parts:
1. CTEs are generated for each term, and the CTEs are combined into a single SQL query
2. The SQL query is executed and the results are processed into a map of samples
The query for a term needs to be generated based on the sample types present in the query and
considering if the current term is a parent term or a child term.:
- If `onlyChildren` is true  and the term annotates parent samples, the query will return annotations for the children of the samples that have the term
- If `onlyChildren` is false or the term annotates child samples, the query will return annotations for the samples that have the term
 */
export async function getAnnotationRows(q, termWrappers, filter, CTEs, values, types, onlyChildren) {
	const parentType = getParentType(types, q.ds)
	const sql = `WITH
		${filter ? filter.filters + ',' : ''}
		${CTEs.map(t => t.sql).join(',\n')}
		${CTEs.map((t, i) => {
			const tw = termWrappers[i]
			const sampleType = getSampleType(tw.term, q.ds)
			let query
			if (onlyChildren && parentType == sampleType && q.ds.cohort.termdb.hasSampleAncestry)
				query = ` select sa.sample_id as sample, key, value, ? as term_id
				 from sample_ancestry sa join ${t.tablename} on sa.ancestor_id = sample
				${filter ? ` WHERE sample_id IN ${filter.CTEname} ` : ''}`
			else
				query = ` SELECT sample, key, value, ? as term_id
				FROM ${t.tablename}
				${filter ? ` WHERE sample IN ${filter.CTEname} ` : ''}`
			return query
		}).join(`UNION ALL`)}`
	//console.log(interpolateSqlValues(sql, values))

	const rows = q.ds.cohort.db.connection.prepare(sql).all(values)
	return rows
}

export async function getSamples(q, rows) {
	const samples = {} // to return
	// if q.currentGeneNames is in use, must restrict to these samples
	const limitMutatedSamples = await mayQueryMutatedSamples(q)
	for (const { sample, key, term_id, value } of rows) {
		addSample(sample, term_id, key, value)
	}
	return samples

	function addSample(sample, term_id, key, value) {
		if (limitMutatedSamples && !limitMutatedSamples.has(sample)) return // this sample is not mutated for given genes
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
				if (firstvalue.key == key && firstvalue.value == value) return // duplicate
				samples[sample][term_id] = { values: [firstvalue] } // convert to object with .values[]
			}
			// add next term value to .values[]
			samples[sample][term_id].values.push({ key, value })
		}
	}
}

// FIXME change currentGeneNames[] into list of tw (but may increase request payload a lot esp for matrix with many genes)
async function mayQueryMutatedSamples(q) {
	if (!q.currentGeneNames) return // no genes, do not query mutated samples and do not limit
	// has genes. query samples mutated on any of these genes, collect sample id into a set and return
	const sampleSet = new Set()
	for (const geneName of q.currentGeneNames) {
		// TODO: use fillTW() here
		// the string can be either gene name or "chr:start-stop"
		let gene
		const c = string2pos(geneName, q.ds.genomeObj, true)
		if (c) {
			gene = {
				kind: 'coord',
				type: 'geneVariant',
				id: geneName,
				chr: c.chr,
				start: c.start,
				stop: c.stop
			}
		} else {
			gene = {
				kind: 'gene',
				type: 'geneVariant',
				id: geneName,
				gene: geneName,
				name: geneName
			}
		}
		const data = await q.ds.mayGetGeneVariantData(
			{
				term: {
					name: geneName,
					genes: [gene],
					type: 'geneVariant',
					groupsetting: { disabled: false }
				},
				q: { type: 'values' }
			},
			q
		)
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
	const q2 = Object.assign(
		{
			filter0: q.filter0, // must pass on gdc filter0 if present
			filterObj: q.filter, // must rename key as "filterObj" but not "filter" to go with what mds3 backend is using
			genome: q.genome,
			get: 'samples',
			twLst: termWrappers,
			isHierCluster: q.isHierCluster // !! gdc specific parameter !!
		},
		q.ds.mayGetGeneVariantDataParam || {}
	)
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
				if (typeof v == 'object') {
					// v is {key,value}, should be for survival term
					// now also for discrete numeric term to support {key: bin, value: value}
					s2[$id] = v
				} else {
					// v is number/string, should be for non-survival term
					s2[$id] = {
						key: v,
						value: v
					}
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

/*
works with "canned" NumericDictionaryTerm plot in a dataset, e.g. data from a text file
called in mds3.init
*/
export async function mayInitiateNumericDictionaryTermplots(ds) {
	if (!ds.cohort.termdb?.numericDictTermCluster?.plots) return
	if (!Array.isArray(ds.cohort.termdb.numericDictTermCluster.plots))
		throw 'cohort.termdb.numericDictTermCluster.plots is not array'
	for (const p of ds.cohort.termdb.numericDictTermCluster.plots) {
		if (!p.name) throw '.name missing from one of numericDictTermCluster.plots[]'
		if (p.file) {
			const numericDictTermClusterConfig = await read_file(path.join(serverconfig.tpmasterdir, p.file))
			p.numericDictTermClusterConfig = JSON.parse(numericDictTermClusterConfig)
			if (p.getConfig) p.numericDictTermClusterConfig = p.getConfig(p.numericDictTermClusterConfig)
		} else {
			throw 'unknown data source of one of numericDictTermClusterConfig.plots[]'
		}
	}
}

async function findListOfBins(q, tw, ds) {
	// for non-dict terms which may lack tw.term.bins
	if (tw.q.type == 'custom-bin') {
		if (Array.isArray(tw.q.lst)) return tw.q.lst
		throw 'q.type is custom-bin but q.lst is missing' // when mode is custom bin, q.lst must always be present
	}
	if (tw.q.type == 'regular-bin') {
		// is regular bin. must compute the bins from tw.term.bins
		if (!tw.term.bins) {
			/* term.bins will be missing when initially launching violin plot of such terms
			in such case, edit term1 via termsetting ui (but not summary chart tab Barchart) and change it from continuous to discrete and apply to make barchart,
			tw.term.bins will be missing but tw.q.lst[] will be present.
			in such case, use it
			should be true for both q.type=regular-bin or q.type=custom-bin
			*/
			// term lacks bins. compute it on the fly. expensive step and not supposed to happen?
			await new Promise(async (resolve, reject) => {
				const _q = {
					tw,
					genome: ds.genomename,
					dslabel: ds.label,
					filter: q.filter,
					filter0: q.filter0
				}
				await trigger_getDefaultBins(_q, ds, {
					send(bins) {
						if (bins.error) throw reject(bins.error)
						tw.term.bins = bins
						resolve()
					}
				})
			})
		}
		const min = tw.term.bins.min
		const max = tw.term.bins.max
		const lst = compute_bins(tw.q, () => {
			return { min, max }
		})
		for (const b of lst) {
			if (!('name' in b) && b.label) b.name = b.label
		}
		return lst
	}
	throw 'unknown tw.q.type when q.mode is discrete'
}

/*
tw{}
	type
	q{}
		cacheid
		alleleType: 0/1
		geneticModel: 0/1/2/3
		missingGenotype: 0/1
		snp2effAle{}
		snp2refGrp{}
samples {Map}
	contains all samples that have valid data for all dict terms
	only get genotype data for these samples,
	but do not introduce new samples to this map
	as those will miss value for dict terms and ineligible for analysis

useAllSamples true/false
	if true
		-populate "samples" with all of those from cache file
		-do not perform imputation
*/
async function getSampleData_snplstOrLocus(tw, samples, useAllSamples) {
	const lines = (await read_file(path.join(serverconfig.cache_snpgt.dir, tw.q.cacheid))).split('\n')
	// cols: snpid, chr, pos, ref, alt, eff, <s1>, <s2>,...

	// array of sample ids from the cache file; note cache file contains all the samples from the dataset
	const cachesampleheader = lines[0]
		.split('\t')
		.slice(serverconfig.cache_snpgt.sampleColumn) // from 7th column
		.map(Number) // sample ids are integer

	if (useAllSamples) {
		for (const i of cachesampleheader) samples.set(i, { id2value: new Map() })
	}

	// make a list of true/false, same length of cachesampleheader
	// to tell if a cache file column (a sample) is in use
	// do not apply q.filter here
	// as samples{} is already computed with q.filter in getSampleData_dictionaryTerms
	const sampleinfilter = cachesampleheader.map(i => samples.has(i))

	// load cache file data into this temporary structure for computing in this function
	const snp2sample = new Map()
	// k: snpid
	// v: { effAle, refAle, altAles, samples: map { k: sample id, v: gt } }

	// load cache file to snp2sample
	for (let i = 1; i < lines.length; i++) {
		const l = lines[i].split('\t')

		const snpid = l[0] // snpid is used as "term id"

		const snpObj = {
			// get effect allele from q, but not from cache file
			// column [5] is for user-assigned effect allele
			refAle: l[3],
			altAles: l[4].split(','),
			samples: new Map()
		}

		if (tw.q.snp2effAle) {
			snpObj.effAle = tw.q.snp2effAle[snpid]
		} else {
			// this is missing when generated from data download ui (called from getData)
			// fill in effAle using first ALT so it can return data
			snpObj.effAle = snpObj.altAles[0]
		}

		snp2sample.set(snpid, snpObj)

		for (const [j, sampleid] of cachesampleheader.entries()) {
			if (!sampleinfilter[j]) {
				// this sample is filtered out
				continue
			}
			const gt = l[j + serverconfig.cache_snpgt.sampleColumn]
			if (gt) {
				snp2sample.get(snpid).samples.set(sampleid, gt)
			}
		}
	}

	// imputation
	if (tw.type == 'snplst' && !useAllSamples) {
		doImputation(snp2sample, tw, cachesampleheader, sampleinfilter)
	}

	// for all snps, count samples by genotypes, keep in snpgt2count, for showing as result.headerRow
	tw.snpgt2count = new Map()
	// k: snpid, v:{gt:INT}
	for (const [snpid, o] of snp2sample) {
		const gt2count = new Map()
		for (const [sampleid, gt] of o.samples) {
			// count gt for this snp
			gt2count.set(gt, 1 + (gt2count.get(gt) || 0))
		}
		tw.snpgt2count.set(snpid, gt2count)
	}

	categorizeSnpsByAF(tw, snp2sample)
	// tw.lowAFsnps, tw.highAFsnps, tw.monomorphicLst, tw.snpid2AFstr are created

	// for highAFsnps, write data into "samples{}" for model-fitting
	for (const [snpid, o] of tw.highAFsnps) {
		for (const [sampleid, gt] of o.samples) {
			// for this sample, convert gt to value
			const [gtA1, gtA2] = gt.split('/') // assuming diploid
			const v = applyGeneticModel(tw, o.effAle, gtA1, gtA2)
			// sampleid must be present in samples{map}, no need to check
			samples.get(sampleid).id2value.set(snpid, { key: v, value: v })
		}
	}
}

/* categorize variants to three groups:
lower than cutoff:
	create tw.lowAFsnps and store these, later to be analyzed by Fisher/Wilcox
higher than cutoff:
	keep in snp2sample
monomorphic:
	delete from snp2sample, do not analyze
	// TODO: may report this to user

prev comments on this func:
 creates following on the tw{} to divide the snps
 tw.lowAFsnps{} tw.highAFsnp tw.monomorphicLst[] tw.snpid2AFstr{}
 sample data for high-AF snps are kept in sampledata[]
*/
function categorizeSnpsByAF(tw, snp2sample) {
	// same as snp2sample, to store snps with AF<cutoff, later to use for Fisher
	tw.lowAFsnps = new Map()
	// same as snp2sample, to store snps with AF>=cutoff, to be used for model-fitting
	tw.highAFsnps = new Map()
	// list of snpid for monomorphic ones
	tw.monomorphicLst = []
	tw.snpid2AFstr = new Map()
	// k: snpid, v: af string, '5.1%', for display only, not for computing

	for (const [snpid, o] of snp2sample) {
		if (tw.snpgt2count.get(snpid).size == 1) {
			// monomorphic, not to be used for any analysis
			tw.monomorphicLst.push(snpid)
			continue
		}

		const totalsamplecount = o.samples.size
		// o.effAle is effect allele
		let effAleCount = 0 // count number of effect alleles across samples
		for (const [sampleid, gt] of o.samples) {
			const [a1, a2] = gt.split('/') // assuming diploid
			effAleCount += (a1 == o.effAle ? 1 : 0) + (a2 == o.effAle ? 1 : 0)
		}

		const af = effAleCount / (totalsamplecount * 2)
		tw.snpid2AFstr.set(snpid, (af * 100).toFixed(1) + '%')

		if (af < tw.q.AFcutoff / 100) {
			// AF lower than cutoff, will not use for model-fitting
			// move this snp from snp2sample to lowAFsnps
			tw.lowAFsnps.set(snpid, o)
		} else {
			// AF above cutoff, use for model-fitting
			tw.highAFsnps.set(snpid, o)
		}
	}
}

function doImputation(snp2sample, tw, cachesampleheader, sampleinfilter) {
	if (tw.q.missingGenotype == 0) {
		// as homozygous major/ref allele, which is not effect allele
		for (const o of snp2sample.values()) {
			// { effAle, refAle, altAles, samples }
			// find an allele from this snp that is not effect allele
			let notEffAle
			if (o.refAle != o.effAle) {
				notEffAle = o.refAle
			} else {
				for (const a of o.altAles) {
					if (a != o.effAle) {
						notEffAle = a
						break
					}
				}
			}
			if (!notEffAle) throw 'not finding a non-effect allele' // not possible
			for (const [i, sampleid] of cachesampleheader.entries()) {
				if (!sampleinfilter[i]) continue
				if (!o.samples.has(sampleid)) {
					// this sample is missing gt call for this snp
					o.samples.set(sampleid, notEffAle + '/' + notEffAle)
				}
			}
		}
		return
	}
	if (tw.q.missingGenotype == 1) {
		// drop sample
		const incompleteSamples = new Set() // any samples with missing gt
		for (const { samples } of snp2sample.values()) {
			for (const [i, sampleid] of cachesampleheader.entries()) {
				if (!sampleinfilter[i]) continue
				if (!samples.has(sampleid)) {
					// this sample is missing gt
					incompleteSamples.add(sampleid)
				}
			}
		}
		// delete incomplete samples from all snps
		for (const { samples } of snp2sample.values()) {
			for (const s of incompleteSamples) {
				samples.delete(s)
			}
		}
		return
	}
	throw 'invalid missingGenotype value'
}

function applyGeneticModel(tw, effAle, a1, a2) {
	switch (tw.q.geneticModel) {
		case 0:
			// additive
			return (a1 == effAle ? 1 : 0) + (a2 == effAle ? 1 : 0)
		case 1:
			// dominant
			if (a1 == effAle || a2 == effAle) return 1
			return 0
		case 2:
			// recessive
			return a1 == effAle && a2 == effAle ? 1 : 0
		case 3:
			// by genotype
			return a1 + '/' + a2
		default:
			throw 'unknown geneticModel option'
	}
}

// get categories of terms
// for now only considering geneVariant terms and
// categorical terms without .values{}
function mayGetCategories(data, q, ds) {
	const twLst = []
	for (const _tw of q.terms) {
		const tw = structuredClone({ q: {}, term: _tw.term, $id: _tw.$id })
		let term = tw.term
		if (!term.type) term = q.ds.cohort.termdb.q.termjsonByOneid(tw.term.id)
		if (term.type == 'geneVariant' || (term.type == 'categorical' && !hasValues(term))) twLst.push(tw)
	}
	if (!twLst.length) return
	const categories = {}
	for (const tw of twLst) {
		const [lst, orderedLabels] = getCategories(data, { tw }, ds, tw.$id)
		categories[tw.$id] = { lst, orderedLabels }
	}
	return categories
}

function hasValues(term) {
	return term.values && Object.keys(term.values).length
}

/*
	data: return value of getSampleData()
	ds: dataset object
	q: req.query
*/
function checkAccessToSampleData(data, ds, q) {
	// handle the option to require a minimum sample size for data
	if (!ds.cohort.termdb.checkAccessToSampleData) return
	// quick check

	const sampleIds = Object.keys(data.samples)
	const hiddenIds = ds.cohort.termdb.hiddenIds || []
	const names = ds.cohort.db.connection
		.prepare(
			`SELECT value as name FROM anno_categorical WHERE term_id in (${hiddenIds
				.map(s => '?')
				.join(',')}) and sample in (${sampleIds.map(s => '?').join(',')})`
		)
		.all([...hiddenIds, ...sampleIds])
	const namesSet = new Set(names.map(s => s.name))
	// pass sampleNames since portal token does not know internal sample ID-to-name mapping
	const access = ds.cohort.termdb.checkAccessToSampleData(q, {
		count: namesSet.size,
		names: [...namesSet]
	})
	if (!access.canAccess)
		throw {
			message: access.message || `One or more terms has less than ${access.minSize} samples with data.`,
			code: 'ERR_MIN_SIZE'
		}
	// more detailed check
	const sampleSizeByTermId = new Map()
	for (const [sid, dataByTermId] of Object.entries(data.samples)) {
		for (const tid of Object.keys(dataByTermId)) {
			if (!sampleSizeByTermId.has(tid)) sampleSizeByTermId.set(tid, new Set())
			sampleSizeByTermId.get(tid).add(sid)
		}
	}
	const counts = [...sampleSizeByTermId.values()].map(v => v.size) // list of sample counts for each and every term
	const access1 = ds.cohort.termdb.checkAccessToSampleData(q, { count: Math.min(...counts) })
	if (!access1.canAccess)
		throw {
			message: `One or more terms has less than ${access1.minSize} samples with data.`,
			code: 'ERR_MIN_SIZE'
		}
}
