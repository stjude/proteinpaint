import path from 'path'
import { get_samples, get_term_cte, interpolateSqlValues, get_active_groupset } from './termdb.sql'
import { getFilterCTEs } from './termdb.filter'
import serverconfig from './serverconfig'
import { read_file } from './utils'
import { getSampleData_snplstOrLocus } from './termdb.regression'
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
import { geneVariantTermGroupsetting } from '#shared/common.js'

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

export async function getData(q, ds, genome, onlyChildren = false) {
	try {
		validateArg(q, ds, genome)
		return await getSampleData(q, ds, onlyChildren)
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

async function getSampleData(q, ds, onlyChildren = false) {
	// dictionary and non-dictionary terms require different methods for data query
	const [dictTerms, nonDictTerms] = divideTerms(q.terms)
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

	for (const tw of nonDictTerms) {
		if (!tw.$id || tw.$id == 'undefined') tw.$id = tw.term.id || tw.term.name //for tests and backwards compatibility

		// for each non dictionary term type
		// query sample data with its own method and append results to "samples"
		if (tw.term.type == 'geneVariant') {
			if (!q.ds.mayGetGeneVariantData) throw 'not supported by dataset: geneVariant'
			if (tw.term.gene && q.ds.cohort?.termdb?.getGeneAlias) {
				byTermId[tw.$id] = q.ds.cohort?.termdb?.getGeneAlias(q, tw)
			}

			const data = await q.ds.mayGetGeneVariantData(tw, q)

			for (const [sampleId, value] of data.entries()) {
				if (!(sampleId in samples)) samples[sampleId] = { sample: sampleId }
				samples[sampleId][tw.$id] = value[tw.$id]
			}
		} else if (tw.term.type == 'snp') {
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
		} else if (tw.term.type == TermTypes.GENE_EXPRESSION || tw.term.type == TermTypes.METABOLITE_INTENSITY) {
			if (!q.ds.queries?.[tw.term.type]) throw 'not supported by dataset: ' + tw.term.type
			let lstOfBins // of this tw. only set when q.mode is discrete
			if (tw.q?.mode == 'discrete' || tw.q?.mode == 'binary') {
				lstOfBins = await findListOfBins(q, tw, ds)
				byTermId[tw.$id] = { bins: lstOfBins }
			}
			const args = {
				genome: q.ds.genome,
				dslabel: q.ds.label,
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
			const data = await q.ds.queries.singleCell.data.get({ sample: tw.term.sample, plots: [tw.term.plot] })
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
		const stid = q.ds.sampleId2Type.get(Number(sids[0]))
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
	).catch(console.error)

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

async function mayQueryMutatedSamples(q) {
	if (!q.currentGeneNames) return // no genes, do not query mutated samples and do not limit
	// has genes. query samples mutated on any of these genes, collect sample id into a set and return
	const sampleSet = new Set()
	for (const geneName of q.currentGeneNames) {
		// TODO: use fillTW() here
		const tw = {
			term: {
				kind: 'gene',
				gene: geneName,
				name: geneName,
				type: 'geneVariant',
				groupsetting: geneVariantTermGroupsetting
			},
			q: { type: 'values' }
		}
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
				if (typeof v == 'object') {
					// v is {key,value}, should be for survival term
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
					genome: ds.genome,
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
