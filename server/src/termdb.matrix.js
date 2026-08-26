import path from 'path'
import { string2pos } from '#shared/common.js'
import { get_samples, get_term_cte, get_active_groupset } from './termdb.sql.js'
import { getFilterCTEs } from './termdb.filter.js'
import serverconfig from './serverconfig.js'
import { read_file, trackXfetch } from './utils.js'
import {
	isDictionaryType,
	isNonDictionaryType,
	isSingleCellTerm,
	getBin,
	getSampleType,
	DEFAULT_SAMPLE_TYPE
} from '#shared/terms.js'
import {
	DNA_METHYLATION,
	GENE_EXPRESSION,
	GENE_VARIANT,
	ISOFORM_EXPRESSION,
	METABOLITE_INTENSITY,
	SINGLECELL_CELLTYPE,
	SINGLECELL_GENE_EXPRESSION,
	SSGSEA,
	PROTEOME_ABUNDANCE,
	PSEUDOBULK,
	JUNCTION
} from '#types'
import { get_bin_label, compute_bins, assignBinColors } from '#shared/termdb.bins.js'
import { trigger_getDefaultBins } from './termdb.getDefaultBins.js'
import { getCategories } from './routes/termdb.categories.ts'
import { authApi } from '#src/auth.js'
import {
	expandCustomTermCollection,
	reconstituteCustomTermCollection,
	resolveTermCollectionFractions
} from './termdb.termCollection.ts'
import { mayLimitSamples } from './mds3.filter.js'

/* centralized resolution of a sample id -> display refs ({ label, ... }) for refs.bySampleId{}.
each dataset implements ds.cohort.termdb.q.id2sampleRefs() (native/gdc/mmrf); it owns any id
coercion since id spaces differ (integer for native/mmrf, case-uuid string for gdc).
the id2sampleName branch is a thin fallback for datasets not yet exposing id2sampleRefs; it must
not assume an integer id space, so it tries the raw id first (string ids, e.g. uuids) and only then
the Number()-coerced id (integer-id datasets whose samples{} key is a stringified integer). */
export function id2sampleRef(id, ds) {
	const q = ds?.cohort?.termdb?.q
	if (q?.id2sampleRefs) return q.id2sampleRefs(id)
	if (q?.id2sampleName) return { label: q.id2sampleName(id) ?? q.id2sampleName(Number(id)) }
	return undefined
}

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
	mapParent2Children: boolean
		whether to map annotations of parent samples onto child samples

Returns:
	- see ValidGetDataResponse type in shared/types/src/termdb.matrix.ts for documentation
	- please update types in shared/types/src/termdb.matrix.ts if the return object is changed

TODO: pass mapParent2Children in q{}, instead of as a separate arg, when calling getData()
*/

export async function getData(q, ds, mapParent2Children) {
	if (serverconfig.debugmode && !ds?.cohort?.db) trackXfetch(new Map())

	try {
		validateArg(q, ds)
		// !!! CRITICAL !!!
		// must always call authApi.mayAdjustFilter(), dataset-specific logic exceptions
		// must be coded inside a ds.cohort.termdb.getAdditionalFilter() option
		authApi.mayAdjustFilter(q, ds, q.terms)

		const originalTerms = q.terms
		const { expandedTerms, tcMappings } = expandCustomTermCollection(originalTerms)
		q.terms = expandedTerms

		// set flag for mapping from parent to children
		maySetMapParent2Children(q, ds, mapParent2Children)

		const data = await getSampleData(q, ds)
		reconstituteCustomTermCollection(data, tcMappings)
		resolveTermCollectionFractions(data, originalTerms)

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
		trackXfetch(null)
		return data
	} catch (e) {
		//console.log(72, 'termdb.matrix getData() catch')
		trackXfetch(null)
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

// When maxActiveQueriesBeforeSingleQueryBatch is reached, a request will be allowed
// to have only one active query per batch. If the number is below this,
// then maxConcurrentQueries will be used as the batch size.
const maxActiveQueriesBeforeSingleQueryBatch = serverconfig.features?.maxActiveQueriesBeforeSingleQueryBatch || 10
const maxPendingQueriesBeforeRejectingRequest = serverconfig.features?.maxPendingQueriesBeforeRejectingRequest || 100
let numActiveQueriesAcrossUsers = 0,
	numPendingQueriesAcrossUsers = 0

async function getSampleData(q, ds) {
	// dictionary and non-dictionary terms require different methods for data query
	const [dictTerms, geneVariantTws, nonDictTerms] = divideTerms(q, ds)

	/* a samplelst term carries its own annotation in tw.q.groups[] and has no data source to
	query. a ds with a sqlite db turns those groups into a CTE (termdb.sql.samplelst.js), but a
	ds without one (e.g. GDC) has no such path: its dictionary getter is handed a term it cannot
	know, every sample comes back unannotated, and an overlay of custom groups then matches no
	sample at all. Split them out of dictTerms and annotate them here from the group lists. */
	const sampleLstTws = ds.cohort.db ? [] : dictTerms.filter(tw => tw.term.type == 'samplelst')
	for (const tw of sampleLstTws) dictTerms.splice(dictTerms.indexOf(tw), 1)

	/* a negated group ("everyone not in this list") needs a sample universe to subtract from. the
	sqlite path takes it from sampleidmap; here the only universe is what the other terms of this
	request return, so a request carrying nothing but negated groups would come back silently
	empty. throw before any query work rather than return a wrong answer. */
	if (isNegatedSampleLstOnlyRequest(q.terms, sampleLstTws))
		throw 'a samplelst term with a "not in" group requires another term in the same request, which this dataset needs to define the sample universe'

	// query dictionary term data
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

	if (geneVariantTws.length) {
		// special handling of these tws
		if (q.ds.queries?.snvindel?.byisoform?.processTwsInOneQuery) {
			// special ds handling, must make one query with all tws, but not to process one tw a time
			await q.ds.queries.snvindel.byisoform.get(q, geneVariantTws, samples)
		} else {
			if (!q.ds.mayGetGeneVariantData) throw 'not supported by dataset: geneVariant'
			const maxGenesPerUser = ds.cohort.termdb?.maxGenesPerUser || 1000
			const totalNumGenes = geneVariantTws.reduce(twlstGeneCountReducer, 0)
			// throttle a user submitting too many genes
			if (totalNumGenes > maxGenesPerUser) {
				throw `Too many genes submitted. Limit the total number of genes to ${maxGenesPerUser} or fewer.`
			}
			// for current pending requests from all users impacting the next request
			if (numPendingQueriesAcrossUsers + totalNumGenes > maxPendingQueriesBeforeRejectingRequest) {
				// prevent PP server crash, out of memory issue
				throw `The server is too busy, try again in a few minutes.`
			}

			try {
				numPendingQueriesAcrossUsers += totalNumGenes
				// 1 query here means 1 gene query, but downstream code may trigger multiple requests per query;
				// for example, 1 gene query will trigger 3 GDC API requests plus the shared `/cases` request
				const maxConcurrentQueries = ds.cohort.termdb.maxConcurrentQueries || 10
				const promises = []
				let numGenes = 0

				for (const [i, tw] of geneVariantTws.entries()) {
					if (tw.term.gene && q.ds.cohort?.termdb?.getGeneAlias) {
						byTermId[tw.$id] = q.ds.cohort?.termdb?.getGeneAlias(q, tw)
					}
					// a geneVariant term may have 1 more genes
					numGenes += tw.term.genes?.length || 1
					// this may contain 1 or more query promise
					promises.push(setGeneVariantDataForTw(q, tw, samples))

					// prevent excessive API calls that may lead to network errors,
					// for example https://gdc-ctds.atlassian.net/browse/SV-2728
					if (
						numActiveQueriesAcrossUsers > maxActiveQueriesBeforeSingleQueryBatch ||
						numGenes >= maxConcurrentQueries ||
						i >= geneVariantTws.length - 1 // detect the end of geneVariantTws array
					) {
						const batchSize = numGenes
						numActiveQueriesAcrossUsers += batchSize
						try {
							const results = await Promise.allSettled(promises)
							const firstRejected = results.find(r => r.status === 'rejected')
							if (firstRejected) {
								throw firstRejected.reason
							}
						} finally {
							numActiveQueriesAcrossUsers -= batchSize
							promises.length = 0 // empty out the array
							numGenes = 0
						}
					}
				}
			} finally {
				numPendingQueriesAcrossUsers -= totalNumGenes
			}
		}
	}
	let processedSingleCellTerm = false
	// for each non dictionary term type
	// query sample data with its own method and append results to "samples"
	for (const tw of nonDictTerms) {
		if (tw.term?.type == 'snp') {
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
			tw.term.type == GENE_EXPRESSION ||
			tw.term.type == ISOFORM_EXPRESSION ||
			tw.term.type == METABOLITE_INTENSITY ||
			tw.term.type == SSGSEA ||
			tw.term.type == DNA_METHYLATION ||
			tw.term.type == JUNCTION ||
			tw.term.type == PSEUDOBULK ||
			tw.term.type == PROTEOME_ABUNDANCE
		) {
			let queryHandler
			if (tw.term.type == PROTEOME_ABUNDANCE) {
				queryHandler = q.ds.queries?.proteome
			} else if (tw.term.type == PSEUDOBULK) {
				queryHandler = q.ds.queries?.singleCell?.pseudobulk
			} else if (tw.term.type == JUNCTION) {
				queryHandler = q.ds.queries?.junction
			} else {
				queryHandler = q.ds.queries?.[tw.term.type]
			}
			if (!queryHandler) throw 'not supported by dataset: ' + tw.term.type
			let lstOfBins // of this tw. only set when q.mode is discrete
			if (tw.q?.mode == 'discrete' || tw.q?.mode == 'binary') {
				lstOfBins = await findListOfBins(q, tw, ds)
				byTermId[tw.$id] = { bins: lstOfBins }
			}
			const args = {
				genome: q.ds.genomename,
				dslabel: q.ds.label,
				terms: [tw],
				filter: q.filter,
				filter0: q.filter0,
				dataTypeDetails: tw.term.dataTypeDetails,
				mapParent2Children: q.mapParent2Children,
				sampleType: q.sampleType
			}
			const data = await queryHandler.get(args, q.ds) // 2nd ds parameter is needed for ds-supplied getter
			const values = data.term2sample2value.get(tw.$id)
			for (const sampleId in values) {
				if (!(sampleId in samples)) samples[sampleId] = { sample: sampleId }
				if (!Number.isFinite(values[sampleId])) continue // skip non-numeric values
				const value = Number(values[sampleId])
				let key = value
				if (lstOfBins) {
					// term is in binning mode. key should be changed into the label of the bin to which value belongs
					const bin = getBin(lstOfBins, value)
					key = get_bin_label(lstOfBins[bin], tw.q)
				}
				samples[sampleId][tw.$id] = { key, value }
			}
		} else if (tw.term.type == SINGLECELL_GENE_EXPRESSION) {
			if (!q.ds.queries?.singleCell?.geneExpression)
				throw new Error('not supported by dataset: singleCell.geneExpression')
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
					// custom bins are used as given and never go through compute_bins(), so they must be
					// colored here, same as in findListOfBins() -- and on a copy, for the same reason
					lst = assignBinColors(tw.q.lst.map(bin => ({ ...bin })))
				}
				byTermId[tw.$id] = { bins: lst }
			}
			const geneExpMap = await q.ds.queries.singleCell.geneExpression.get(q, tw.term.sample, tw.term.gene)
			let filteredSamples = new Set()
			if ((q.filter?.lst?.length || q.filter0) && tw.term.sample?.isMetaResult) {
				filteredSamples = await q.ds.queries.singleCell.samples.getFilteredSingleCellSamples(q)
			}
			/** geneExpMap returns cells => (cellId: value), not samples.
			 * The cellId is never in the samples object, as cells are not in
			 * the termdb. Get the sampleId and add object to samples with the value.
			 *
			 * NOTE: ds.queries.singleCell.data.metaIdMap required for matching the
			 * cohort level term to the cell is made on init from the single cell
			 * plot files. The hdf5 does not contain the sampleId to map to the
			 * cohort level term. This will need to addressed if plot files do not
			 * exist but the hdf5 does. */
			for (const sampleId in geneExpMap) {
				if (!(sampleId in samples)) {
					const cell = { cellId: sampleId }
					const scEntry = getSingleCellSampleEntry(samples, q.ds, tw, cell, filteredSamples)
					if (!scEntry) continue // cell is filtered out based on cohort level term filter
					samples[sampleId] = scEntry
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
		} else if (tw.term.type == SINGLECELL_CELLTYPE) {
			if (!q.ds.queries?.singleCell?.data) throw new Error('not supported by dataset: singleCell.data')
			const data = await q.ds.queries.singleCell.data.get({
				sample: tw.term.sample,
				plots: [tw.term.plot],
				colorBy: { [tw.term.plot]: tw.term.name }
			})
			let filteredSamples = new Set()
			if ((q.filter?.lst?.length || q.filter0) && tw.term.sample?.isMetaResult) {
				filteredSamples = await q.ds.queries.singleCell.samples.getFilteredSingleCellSamples(q)
			}
			const groups = tw.q?.customset?.groups
			for (const cell of data.plots[0].noExpCells) {
				const sampleId = cell.cellId
				if (!(sampleId in samples)) {
					const scEntry = getSingleCellSampleEntry(samples, q.ds, tw, cell, filteredSamples)
					if (!scEntry) continue // cell is filtered out based on cohort level term filter
					samples[sampleId] = scEntry
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

		/** Only hydrate meta result cell rows once */
		if (isSingleCellTerm(tw.term) && !processedSingleCellTerm) {
			hydrateMetaResultCellRows(samples)
			processedSingleCellTerm = true
		}
	}

	/* annotate the groups of samplelst terms last, so that a negated group ("not in this list")
	can be resolved against the samples the other terms of this request actually returned.

	scopedSamples is the set of sample ids this request is allowed to see, and bounds which group
	members may be *added* to samples{}: the group lists come straight from the client, and the
	sqlite path intersects them with q.filter in getAnnotationRows(), so this path must not hand
	back a sample that the filter, filter0 or authApi.mayAdjustFilter() excluded. */
	const scopedSamples = sampleLstTws.length ? await getSampleLstScope(q, ds) : undefined
	setSampleLstData(sampleLstTws, samples, scopedSamples)

	// resolve each id -> display refs via the dataset's id2sampleRefs() (see id2sampleRef())
	const bySampleId = {}
	for (const sid in samples) {
		const ref = id2sampleRef(samples[sid]?.sampleId ?? sid, q.ds)
		if (ref) bySampleId[sid] = ref
	}

	// determine the sample type
	let sampleType
	if (q.sampleType) {
		// query sample type defined
		sampleType = q.ds.cohort.termdb.sampleTypes[q.sampleType]
	} else if (processedSingleCellTerm === true) {
		// work around for single cell cases
		// TODO: may support single cell as another
		// sample type in ds.cohort.termdb.sampleTypes
		sampleType = { name: 'cell', plural_name: 'cells' }
	} else {
		// determine sample type based on the returned samples
		const sids = Object.keys(samples)
		if (sids.length) {
			const firstComparableId = samples[sids[0]]?.sampleId
			const sid = Number(firstComparableId ?? sids[0]) || firstComparableId || sids[0]
			const stid = q.ds.sampleId2Type?.get?.(sid)
			if (stid !== undefined && q.ds.cohort?.termdb?.sampleTypes) {
				sampleType = q.ds.cohort.termdb.sampleTypes[stid]
			}
		}
	}

	return { samples, refs: { byTermId, bySampleId }, sampleType }
}
/********** Start single cell helpers **********
 *
 * Single cell data is unique. Cells, not samples, are displayed. At times, those cells are
 * compared against cohort level terms in the termdb. The sampleId from the tsv file is mapped
 * to the primary key in the termdb to match the cohort level data to the cell data.
 *
 * The helpers below are used to:
 * 1. map the cell to the sampleId in the termdb, and then get the cohort level data for that
 * sampleId, and attach it to the cell data. This is done in getSingleCellSampleEntry() and
 * getSampleId4Cell()
 * 2. for single cell meta analysis results, the "cell" is actually a pseudo-sample that
 * represents a group of cells. The sampleId of this pseudo-sample is mapped to the sampleId
 * in the termdb, and then get the cohort level data for that sampleId, and attach it to
 * the pseudo-sample data. This is done in hydrateMetaResultCellRows()
 */

function getSingleCellSampleEntry(samples, ds, tw, _cell, filteredSamples) {
	const sampleId = getSampleId4Cell(ds, tw, _cell, filteredSamples)
	if (!sampleId) {
		if (!tw.term.sample?.isMetaResult) return { sample: _cell.cellId }
		else return null
	}
	const sample = samples[sampleId]
	const cell = sample ? structuredClone(sample) : {}
	cell.sample = _cell.cellId
	cell.sampleId = sampleId
	return cell
}

//See documentation above
function getSampleId4Cell(ds, tw, cell, filteredSamples) {
	if (!tw.term.sample?.isMetaResult) return
	/** Note: Do not use .eID. Only for GDC in separate pathway */
	const metaResultId = tw.term.sample.sID
	const metaIdMap = ds.queries?.singleCell?.data?.metaIdMap?.get?.(metaResultId)
	const sampleMappingCache = ds.queries?.singleCell?.samples?.sampleMappingCache
	let sampleName = metaIdMap?.get?.(cell.cellId)
	if (!sampleName && cell.sampleId != undefined) {
		sampleName = sampleMappingCache?.sampleIntId2Name?.get?.(cell.sampleId)
		if (!sampleName) {
			const numericSampleId = Number(cell.sampleId)
			if (Number.isFinite(numericSampleId)) {
				sampleName = sampleMappingCache?.sampleIntId2Name?.get?.(numericSampleId)
			}
		}
		if (!sampleName && typeof cell.sampleId == 'string') sampleName = cell.sampleId
	}
	if (!sampleName) return
	if (filteredSamples.size > 0 && !filteredSamples.has(sampleName)) return
	const sampleId =
		sampleMappingCache?.sampleName2IntId?.get?.(sampleName) ?? ds.cohort?.termdb?.q?.sampleName2id?.(sampleName)
	if (sampleId == undefined) {
		throw new Error(`single cell meta result cannot map sample name = ${sampleName} to sample id`)
	}
	return String(sampleId)
}

//See documentation above
function hydrateMetaResultCellRows(samples) {
	for (const _sampleId in samples) {
		const row = samples[_sampleId]
		const sampleId = row?.sampleId
		if (!sampleId) continue
		const parentRow = samples[sampleId]
		if (!parentRow) continue
		for (const [termId, value] of Object.entries(parentRow)) {
			if (termId == 'sample' || termId == 'sampleId') continue
			if (!(termId in row)) row[termId] = value
		}
	}
}
//********** End single cell helpers **********

function twlstGeneCountReducer(sum, tw) {
	return sum + (tw.term.genes?.length || 1)
}

async function setGeneVariantDataForTw(q, tw, samples) {
	const data = await q.ds.mayGetGeneVariantData(tw, q)
	for (const [sampleId, value] of data.entries()) {
		if (!(sampleId in samples)) samples[sampleId] = { sample: sampleId }
		samples[sampleId][tw.$id] = value[tw.$id]
	}
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

/*
True when the request has nothing but samplelst terms and at least one of their groups is
negated. See the call site: such a request has no sample universe for the negation to subtract
from, and would silently resolve to no samples at all.
*/
export function isNegatedSampleLstOnlyRequest(terms, sampleLstTws) {
	if (!sampleLstTws.length || sampleLstTws.length != terms?.length) return false
	return sampleLstTws.some(tw => tw.q?.groups?.some(g => g.in === false))
}

/*
True when q.filter carries a term type that ds.cohort.termdb.filterSamples() does not resolve.
gdc's filter2GDCfilter() silently skips geneVariant/geneExpression/survival tvs -- they are
applied later, in post-processing that filterSamples() never runs -- so with one of them active
its answer is broader than the request's real result set. get_samplecount() (termdb.sql.js)
refuses to use filterSamples for exactly this reason.

survival is a dictionary type, so it is named separately from the isNonDictionaryType() check.
*/
export function hasFilterTermsUnsupportedByFilterSamples(filter) {
	if (!Array.isArray(filter?.lst)) return false
	for (const item of filter.lst) {
		if (item.type == 'tvslst') {
			if (hasFilterTermsUnsupportedByFilterSamples(item)) return true
			continue
		}
		const type = item.tvs?.term?.type
		if (!type) continue // isNonDictionaryType() throws on a missing type
		if (type == 'survival' || isNonDictionaryType(type)) return true
	}
	return false
}

/*
The set of sample ids this request is authorized to see. It bounds which samplelst group members
may be added to samples{} (see setSampleLstData): the group lists come straight from the client,
and the sqlite path intersects them with q.filter in getAnnotationRows(), so this path must not
hand back a sample that q.filter, q.filter0 or authApi.mayAdjustFilter() excluded.

Returns an empty Set when no trustworthy bound can be established, which annotates only the
samples the filtered queries already returned. Returns undefined only when the ds reports no
bound at all, in which case every listed member is accepted.
*/
async function getSampleLstScope(q, ds) {
	if (hasFilterTermsUnsupportedByFilterSamples(q.filter)) return new Set() // see above, fail closed
	if (typeof ds.cohort.termdb.filterSamples != 'function') return new Set() // ds cannot report a scope
	/* returnAllSamples: with no filter in play the authorized scope is the whole cohort, not
	"whatever the client names", so an id that exists in no cohort is still rejected. a ds that
	does not implement the flag returns undefined here and stays permissive. */
	return await ds.cohort.termdb.filterSamples(q, ds, true)
}

/* Scope ids and samples{} keys are strings for every current no-db ds (gdc case uuid, mmrf
submitter id). The Number() fallback mirrors id2sampleRef() above, so a ds that keys its scope
by integer still matches the stringified id. */
function isInSampleLstScope(scopedSamples, sampleId) {
	if (!scopedSamples) return true // ds reported no bound
	return scopedSamples.has(sampleId) || scopedSamples.has(Number(sampleId))
}

/*
Annotate samples with the groups of samplelst terms, for datasets that cannot express those
groups in SQL (see the sampleLstTws comment in getSampleData). Each group writes
{key,value} = group.name onto its samples, and a group with in:false covers the samples that are
*not* listed. A sample already annotated for this term is left alone, so an explicit membership
is never overwritten by a later negated group.

scopedSamples: see getSampleLstScope(). A listed group member that is absent from samples{} is
added only when it is in scope; without that a client could name any sample id and have it
echoed back, e.g. through refs.bySampleId. Samples already in samples{} were returned by the
filtered queries, so they are annotated regardless.

samples{} is modified in place.
*/
export function setSampleLstData(termWrappers, samples, scopedSamples) {
	for (const tw of termWrappers) {
		const groups = tw.q?.groups
		if (!Array.isArray(groups)) throw 'samplelst tw.q.groups[] is not an array'
		for (const group of groups) {
			/* sampleId || sample, deliberately the same falsy-fallback rule as sampleLstSql.getCTE():
			the two paths read the same client tw, so a divergence here would let one dataset annotate
			a sample that another drops. ids are request data, so also normalize to string -- a numeric
			id must still match the always-string keys that for..in yields below -- and drop the blanks,
			including '', which no sampleidmap row can carry and which would otherwise become an
			empty-named sample. */
			const ids = new Set(
				(group.values || [])
					.map(v => v?.sampleId || v?.sample)
					.filter(id => id !== undefined && id !== null && id !== '')
					.map(String)
			)
			if (group.in === false) {
				for (const sampleId in samples) {
					if (ids.has(sampleId) || samples[sampleId][tw.$id]) continue
					samples[sampleId][tw.$id] = { key: group.name, value: group.name }
				}
				continue
			}
			for (const sampleId of ids) {
				// assigning to '__proto__' would run the prototype setter rather than create a row,
				// and the write that follows would then land outside samples{}. no sample is named this
				if (sampleId == '__proto__') continue
				// Object.hasOwn(), not `in`: an id such as 'constructor' matches an inherited property,
				// which would skip row creation and write the annotation onto Object itself
				if (!Object.hasOwn(samples, sampleId)) {
					if (!isInSampleLstScope(scopedSamples, sampleId)) continue // out of scope, see above
					samples[sampleId] = { sample: sampleId }
				}
				if (samples[sampleId][tw.$id]) continue
				samples[sampleId][tw.$id] = { key: group.name, value: group.name }
			}
		}
	}
}

export function divideTerms(q, ds) {
	/*
	Divide q.terms into dict / gene-variant / non-dict lists by term type. This is the central
	choke point every sample-data route flows through, so role-based term visibility is enforced
	inline at every dict-push site: when the dataset declares an isTermVisible hook, dict terms
	the requester cannot see are dropped before downstream queries are issued. Datasets without
	the hook are unaffected — every dict term flows through.

	A termCollection has no scalar `id` — it's identified by `name` + its member terms. Passing
	the collection term to isTermVisible would yield false for any role consulting an allowlist
	(no id to match), which would silently drop the collection before SQL. Decide visibility
	from the members instead: the collection is visible iff every member term is visible to the
	requesting role. term.termlst — the list of member term objects — is the source of truth
	(mds3.init builds it from termIds, and the client echoes it back in the payload); the legacy
	termIds[] is not consulted.
	*/
	const dict = [],
		geneVariantTws = [],
		nonDict = []
	const isTermCollectionVisible = tw => {
		/*
		Members arrive in the request payload, so normalize each to a consistent term-object
		shape before the visibility hook sees it: a bare id string becomes { id } (the shape
		older clients use), and a member that isn't an object — including a non-array termlst or
		a null/number entry — carries no resolvable identity and drops the whole collection. This
		keeps the hook's input uniform and preserves the fail-closed default for partial lists.
		*/
		const members = Array.isArray(tw.term?.termlst) ? tw.term.termlst : []
		if (!members.length) return false
		return members.every(m => {
			const term = typeof m === 'string' ? { id: m } : m
			if (!term || typeof term !== 'object') return false
			return ds.cohort.termdb.isTermVisible(q.__protected__, term)
		})
	}
	for (const tw of q.terms) {
		const type = tw.term?.type
		// TODO FIXME should require valid term type, reject if not and remove assumptions and guesses
		if (type) {
			if (!tw.$id || tw.$id == 'undefined') tw.$id = tw.term.id || tw.term.name //for tests and backwards compatibility
			if (type == GENE_VARIANT) {
				geneVariantTws.push(tw) // collect into own list to process separately later
			} else if (isNonDictionaryType(type)) {
				nonDict.push(tw)
			} else if (type == 'termCollection') {
				if (ds.cohort.termdb.isTermVisible) {
					if (isTermCollectionVisible(tw)) dict.push(tw)
				} else {
					dict.push(tw)
				}
			} else {
				if (ds.cohort.termdb.isTermVisible) {
					if (ds.cohort.termdb.isTermVisible(q.__protected__, tw.term)) {
						dict.push(tw)
					}
				} else {
					dict.push(tw)
				}
			}
		} else if (tw.term?.id) {
			// term.type missing and has term.id, assume it is shorthand for coding up dict term on client
			if (ds.cohort.termdb.isTermVisible) {
				if (ds.cohort.termdb.isTermVisible(q.__protected__, tw.term)) {
					dict.push(tw)
				}
			} else {
				dict.push(tw)
			}
		} else {
			nonDict.push(tw)
		}
	}
	return [dict, geneVariantTws, nonDict]
}

// function to set the mapParent2Children flag, which controls
// whether to map parent-level data onto child samples
export function maySetMapParent2Children(q, ds, mapParent2Children) {
	if (!ds.cohort?.termdb?.hasSampleAncestry) {
		// no sample ancestry, so should not map parent to children
		q.mapParent2Children = false
		return
	}
	if (typeof mapParent2Children === 'boolean') {
		// flag supplied by caller
		q.mapParent2Children = mapParent2Children
		// set query sample type to default
		q.sampleType = DEFAULT_SAMPLE_TYPE
		return
	}
	// ds has sample ancestry and mapParent2Children is undefined
	// determine sample types that are being queried
	const sampleTypes = getSampleTypes(q, ds)
	const types = [...sampleTypes]
	if (!types.length) {
		throw 'no sample types found'
	} else if (types.length == 1) {
		// single sample type, no need to map parent to children
		const type = types[0]
		if (!ds.cohort.termdb.sampleTypes[type]) throw 'invalid sample type'
		q.mapParent2Children = false
		q.sampleType = type
	} else {
		// multiple sample types
		const config = {}
		for (const type of types) {
			config[type] = ds.cohort.termdb.sampleTypes[type]
		}
		const parentTypes = new Set(
			Object.values(config)
				.map(d => d.parent_id)
				.filter(Number.isInteger)
		)
		if (!parentTypes.size) throw 'parent sample types missing'
		if (types.some(type => parentTypes.has(type))) {
			// some query sample types are parents of others, so map parent to children
			q.mapParent2Children = true
			const childTypes = types.filter(type => !parentTypes.has(type))
			if (childTypes.length != 1) throw 'should have a single child sample type'
			q.sampleType = childTypes[0]
		}
	}
}

/*
input:

q{}
termWrappers[]
	list of tw objects based on dictionary terms

output:

[
	samples: {}
		key: stringified integer id
		val: {}
			sample: int id
			<tw.$id>: { key: str, value: str }
	byTermId: {}
]
*/
async function getSampleData_dictionaryTerms(q, termWrappers) {
	if (!termWrappers.length) return [{}, {}]
	// distinguish between dictionary terms with cached or uncached data
	const cachedTermWrappers = []
	const uncachedTermWrappers = []
	for (const tw of termWrappers) {
		q.ds?.termid2sample2value?.has(tw.term.id) ? cachedTermWrappers.push(tw) : uncachedTermWrappers.push(tw)
	}
	// query uncached dictionary term data
	const [samples, byTermId] = await getSampleData_dictionaryTerms_uncached(q, uncachedTermWrappers)
	// query cached dictionary term data
	await getSampleData_dictionaryTerms_cached(q, cachedTermWrappers, samples, byTermId)
	// return all queried dictionary term data
	return [samples, byTermId]
}

async function getSampleData_dictionaryTerms_uncached(q, termWrappers) {
	if (!termWrappers.length) return [{}, {}]
	if (q.ds?.cohort?.db) {
		// dataset uses server-side sqlite db, must use this method for dictionary terms
		return await getSampleData_dictionaryTerms_termdb(q, termWrappers)
	}
	if (q.ds.cohort.termdb.dictionary?.get) {
		// ds-supplied getter to retrieve dictionary term data
		return await q.ds.cohort.termdb.dictionary.get(q, termWrappers)
	}
	if (q.ds.cohort.termdb.q?.getAdHocTermValues) {
		//ds is not using sqlite db but has getAdHocTermValues method
		return await q.ds.cohort.termdb.q?.getAdHocTermValues(q, termWrappers)
	}
	throw 'unknown method for dictionary terms'
}

async function getSampleData_dictionaryTerms_cached(q, termWrappers, samples, byTermId) {
	for (const tw of termWrappers) {
		const sample2value = q.ds.termid2sample2value.get(tw.term.id)
		const limitSamples = await mayLimitSamples(q, [...sample2value.keys()], q.ds)
		let lstOfBins // of this tw. only set when q.mode is discrete
		if (tw.q?.mode == 'discrete' || tw.q?.mode == 'binary') {
			lstOfBins = await findListOfBins(q, tw, q.ds)
			byTermId[tw.$id] = { bins: lstOfBins }
		}
		for (const [sample, value] of sample2value) {
			if (limitSamples && !limitSamples.has(sample)) continue
			if (!samples[sample]) samples[sample] = { sample }
			if (samples[sample][tw.$id]) throw 'should not have multiple values for sample'
			let key = value
			if (lstOfBins) {
				// term is in binning mode, key should be bin label
				const bin = getBin(lstOfBins, value)
				key = get_bin_label(lstOfBins[bin], tw.q)
			}
			samples[sample][tw.$id] = { key, value }
		}
	}
}

export async function getSampleData_dictionaryTerms_termdb(q, termWrappers) {
	const byTermId = {} // to return
	// must copy filter.values as its copy may be used in separate SQL statements,
	// for example get_rows or numeric min-max, and each CTE generator would
	// have to independently extend its copy of filter values
	const filter = await getFilterCTEs(q.filter, q.ds, q.mapParent2Children, q.sampleType)
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
	const rows = await getAnnotationRows(q, termWrappers, filter, CTEs, values)
	const samples = await getSamples(q, rows, termWrappers)
	return [samples, byTermId]
}

function getSampleTypes(q, ds) {
	const twLst = q.terms ? q.terms : q.tw ? [q.tw] : []
	const filter = q.filter
	const filter0 = q.filter0
	const twTypes = getTwSampleTypes(twLst, ds)
	const filterTypes = getFilterSampleTypes(filter, ds)
	const filter0Types = ds.getFilter0SampleTypes ? ds.getFilter0SampleTypes(filter0, ds) : new Set()
	const types = new Set([...twTypes, ...filterTypes, ...filter0Types])
	return types
}

function getTwSampleTypes(twLst, ds) {
	const types = new Set()
	for (const tw of twLst) {
		const type = getSampleType(tw, ds)
		types.add(type)
	}
	return types
}

function getFilterSampleTypes(filter, ds) {
	const types = new Set()
	if (!filter) return types
	for (const item of filter.lst) {
		if (item.type == 'tvslst') {
			for (const type of getFilterSampleTypes(item, ds)) types.add(type)
		} else {
			if (item.tag == 'cohortFilter') continue
			const type = getSampleType({ term: item.tvs.term }, ds)
			if (Number.isInteger(type)) types.add(type)
		}
	}
	return types
}

/*
When querying sample annotations for dictionary terms, the query is split into two parts:
1. CTEs are generated for each term, and the CTEs are combined into a single SQL query
2. The SQL query is executed and the results are processed into a map of samples

Mapping parent annotations onto child samples: when mapParent2Children is true and the term sample type is a parent of the query sample type, then map the annotations of the term onto child samples with sample type matching the query sample type
*/
export async function getAnnotationRows(q, termWrappers, filter, CTEs, values) {
	const sql = `WITH
		${filter ? filter.filters + ',' : ''}
		${CTEs.map(t => t.sql).join(',\n')}
		${CTEs.map((t, i) => {
			const tw = termWrappers[i]
			let query
			const sampleType = getSampleType(tw, q.ds)
			if (q.mapParent2Children && q.ds.cohort.termdb.sampleTypes[q.sampleType].parent_id == sampleType) {
				// need to map parent annotations onto child samples and
				// term sample type is parent of query sample type
				query = `SELECT sa.sample_id as sample, key, value, ? as term_id
				FROM sample_ancestry sa
				JOIN ${t.tablename} ON sa.ancestor_id = sample
				JOIN sampleidmap sm ON sa.sample_id = sm.id
				WHERE sm.sample_type = ${q.sampleType}
				${filter ? `AND sa.sample_id IN ${filter.CTEname}` : ''}`
			} else {
				// query annotations directly
				query = `SELECT sample, key, value, ? as term_id
				FROM ${t.tablename}
				${filter ? `WHERE sample IN ${filter.CTEname}` : ''}`
			}
			return query
		}).join('\nUNION ALL\n')}`

	const rows = q.ds.cohort.db.connection.prepare(sql).all(values)
	return rows
}

const termTypesWithJsonValue = new Set(['termCollection'])

// returns a data object indexed by sampleId then tw.$id
// - may also preprocess data by tw.$id
export async function getSamples(q, rows, termWrappers) {
	// reshapes the data rows into the following:
	// samples = {
	//   [sampleId]: {
	//      [termId]: {key, value} | {key, values[]}
	//   }
	// }
	const tw$idsWithJson = new Set(
		termWrappers
			.filter(tw => termTypesWithJsonValue.has(tw.term?.type) && tw.term?.memberType !== 'categorical')
			.map(tw => tw.$id)
	)

	const samples = {} // to return
	// if q.currentGeneNames is in use, must restrict to these samples
	const limitMutatedSamples = await mayQueryMutatedSamples(q)
	for (const { sample, key, term_id, value } of rows) {
		if (limitMutatedSamples && !limitMutatedSamples.has(sample)) {
			// this sample is not mutated for given genes
			continue
		}
		if (!samples[sample]) samples[sample] = { sample }
		const v = tw$idsWithJson.has(term_id) && typeof value == 'string' ? JSON.parse(value) : value
		// this assumes unique term key/value for a given sample
		// samples[sample][term_id] = { key, value }
		if (!samples[sample][term_id]) {
			// first value of term for a sample
			samples[sample][term_id] = { key, value: v }
		} else {
			// samples has multiple values for a term
			// convert to .values[]
			if (!samples[sample][term_id].values) {
				const firstvalue = samples[sample][term_id] // first term value of the sample
				if (firstvalue.key === key && firstvalue.value === v) continue // duplicate
				samples[sample][term_id] = { values: [firstvalue] } // convert to object with .values[]
			}
			// add next term value to .values[]
			samples[sample][term_id].values.push({ key, value: v })
		}
	}
	return samples
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
			const parsedConfig = JSON.parse(matrixConfig)
			p.matrixConfig = p.getConfig?.(parsedConfig) || parsedConfig
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
			const parsedConfig = JSON.parse(numericDictTermClusterConfig)
			const config = p.getConfig?.(parsedConfig) || parsedConfig
			normalizeLegacyHierClusterDataType(config)
			p.numericDictTermClusterConfig = config
		} else {
			throw 'unknown data source of one of numericDictTermCluster.plots[]'
		}
	}
}

/*
backward-compat: pre-built numericDictTermCluster plot configs (and old saved sessions) were authored
with the now-removed synthetic dataType 'numericDictTerm'. Rewrite it to the actual
term type of the clustered terms — e.g. 'float' for Drug Sensitivity.
*/
function normalizeLegacyHierClusterDataType(config) {
	if (!config || config.dataType != 'numericDictTerm') return
	const lst = config.termgroups?.find(g => g.type == 'hierCluster')?.lst
	config.dataType = lst?.[0]?.term?.type || 'float'
}

async function findListOfBins(q, tw, ds) {
	// for non-dict terms which may lack tw.term.bins
	if (tw.q.type == 'custom-bin') {
		if (!Array.isArray(tw.q.lst)) throw 'q.type is custom-bin but q.lst is missing' // when mode is custom bin, q.lst must always be present
		// custom bins are used as given and never go through compute_bins(), which is where bins
		// are colored. without this they reach the client colorless and consumers that color by bin
		// (e.g. the scatter color legend) fall back to a scheme of their own that can yield nearly
		// identical bin colors. dictionary numeric terms are already colored this way, as their bins
		// are always computed via get_bins() in termdb.sql.js
		//
		// color a per-bin copy rather than q.lst[] itself: the returned list is handed straight to
		// the response as refs.byTermId[$id].bins, and callers go on to mutate those bins (e.g.
		// termdb.barchart.js overlays q.binColored on them), which would otherwise write back into
		// the request. compute_bins() likewise returns a copy for a custom-bin config
		return assignBinColors(tw.q.lst.map(bin => ({ ...bin })))
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
	term{}
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
	if (tw.term.type == 'snplst' && !useAllSamples) {
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
		// deliberately not asking for the mname tally (withMnames): this runs for
		// every geneVariant term of every data request and the result is attached
		// to the response, where no consumer reads mnames. only the
		// termdb/categories route needs them, for the term-editing UIs
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
	if (!sampleIds.length) return
	const hiddenIds = ds.cohort.termdb.hiddenIds
	let rows
	if (hiddenIds?.length) {
		rows = ds.cohort.db.connection
			.prepare(
				`SELECT distinct value as name FROM anno_categorical WHERE term_id in (${hiddenIds
					.map(s => '?')
					.join(',')}) and sample in (${sampleIds.map(s => '?').join(',')})`
			)
			.all([...hiddenIds, ...sampleIds])
	} else {
		rows = ds.cohort.db.connection
			.prepare(`SELECT name FROM sampleidmap WHERE id in (${sampleIds.map(s => '?').join(',')})`)
			.all(sampleIds)
	}
	const names = rows.map(s => s.name)
	// pass sampleNames since portal token does not know internal sample ID-to-name mapping
	const access = ds.cohort.termdb.checkAccessToSampleData(q, {
		count: names.length,
		names
	})
	if (!access.canAccess) {
		throw {
			message: access.message || `One or more terms has less than ${access.minSize} samples with data.`,
			code: 'ERR_MIN_SIZE'
		}
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
	if (!access1.canAccess) {
		throw {
			message: `One or more terms has less than ${access1.minSize} samples with data.`,
			code: 'ERR_MIN_SIZE'
		}
	}
}
