import { PSEUDOBULK } from '#shared/terms.js'
import { plotColor } from '#shared/common.js'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { file_is_readable } from '#src/utils.js'
import { run_python } from '@sjcrh/proteinpaint-python'
import { getH5samples } from '../utils/h5samples.ts'
import { mayLimitSamples } from '#src/mds3.filter.js'

/**
 * 1. Validate the structure of the pseudobulk object in the dataset.
 *
 * 2. Convert the pseudobulk terms into term objects and add them to
 * ds.queries.singleCell.terms for use in termdbConfig.termType2terms.pseudobulk.
 *
 * 3. Adds ds.queries.singleCell.pseudobulk.get()
 *
 */
export async function validatePseudobulk(ds: any) {
	const pseudobulk = ds.queries.singleCell.pseudobulk

	if (typeof pseudobulk != 'object') throw new Error('singleCell.pseudobulk is not object')
	for (const assayKey of Object.keys(pseudobulk)) {
		if (typeof pseudobulk[assayKey] != 'object') throw new Error(`singleCell.pseudobulk.${assayKey} is not object`)

		/**
		 * each member makes a term
		 * In termdb.config, these terms are added to termdbConfig.termType2terms.pseudobulk
		 * for access on the client. */
		if (!ds.queries.singleCell.terms) ds.queries.singleCell.terms = []

		for (const memberId of Object.keys(pseudobulk[assayKey])) {
			// a member corresponds to a cell type (or lineage) with categories
			const member = pseudobulk[assayKey][memberId]
			if (typeof member.folder != 'string') throw 'member.folder not string'
			if (typeof member.meanExt != 'string') throw 'member.meanExt not string'
			if (typeof member.categories != 'object') throw 'member.categories{} not object'
			if (!Object.keys(member.categories).length) throw 'no keys in member.categories{}'

			for (const category in member.categories) {
				// push a term
				ds.queries.singleCell.terms.push({
					name: member.categories[category].label || category,
					id: category,
					type: PSEUDOBULK,
					assay: assayKey,
					memberId: memberId,
					color: member.categories[category].color || plotColor,
					isleaf: true,
					bins: {
						default: {
							type: 'custom-bin',
							lst: [],
							isDummyPreset: true
						},
						less: {
							type: 'custom-bin',
							lst: [],
							isDummyPreset: true
						}
					}
				})

				member.categories[category].samples = [] as any[]
				const meanfile = path.join(serverconfig.tpmasterdir, member.folder, category + member.meanExt)
				member.categories[category].meanfile = meanfile
				await file_is_readable(meanfile)
				const samples = await getH5samples(meanfile)
				if (!Array.isArray(samples)) throw new Error('samples not array')
				if (!samples.length) throw 'HDF5 file has no samples, please check file.'
				for (const sn of samples) {
					const si = ds.cohort.termdb.q.sampleName2id(sn)
					if (si === undefined) {
						// samples in hdf5 file must be in sync with db
						throw `unknown sample ${sn} from HDF5 ${meanfile}`
					}
					member.categories[category].samples.push(si)
				}
				console.log(
					`${ds.label} pseudobulk ${assayKey} ${memberId} ${category} mean HDF5 samples:`,
					member.categories[category].samples.length
				)

				// TODO validate total and percentage files
			}
		}
	}

	// getter only supports mean. TODO total and percentage!

	pseudobulk.get = async (param: any) => {
		if (!Array.isArray(param.terms)) throw new Error('.terms[] not array')
		// all terms needs to be by the same HDF5 file! TODO validate and reject otherwise
		const _t = param.terms[0]?.term
		if (!_t) throw new Error('param.terms[0].term missing')
		const thisCategory = pseudobulk[_t.assay]?.[_t.memberId]?.categories?.[_t.category]
		if (!thisCategory) throw 'pseudobulk[_t.assay]?.[_t.memberId]?.categories?.[_t.category] missing'

		const limitSamples = await mayLimitSamples(param, thisCategory.samples, ds)
		if (limitSamples?.size == 0) {
			// Got 0 sample after filtering, must still return expected structure with no data
			return { term2sample2value: new Map(), byTermId: {}, bySampleId: {} }
		}

		// Set up sample IDs and labels
		const bySampleId = {}
		const samples = thisCategory.samples || []
		if (limitSamples) {
			for (const sid of limitSamples) {
				if (ds.cohort?.termdb?.q?.id2sampleRefs) {
					bySampleId[sid] = ds.cohort.termdb.q.id2sampleRefs(sid)
				} else {
					bySampleId[sid] = { label: ds.cohort.termdb.q.id2sampleName(sid) }
				}
			}
		} else {
			// Use all samples with exp data
			for (const sid of samples) {
				if (ds.cohort?.termdb?.q?.id2sampleRefs) {
					bySampleId[sid] = ds.cohort.termdb.q.id2sampleRefs(sid)
				} else {
					bySampleId[sid] = { label: ds.cohort.termdb.q.id2sampleName(sid) }
				}
			}
		}

		// Initialize data structure
		const term2sample2value = new Map()
		const byTermId = {}

		// First, collect all gene names
		const geneNames: string[] = []
		for (const tw of param.terms) {
			if (tw.term.gene) {
				geneNames.push(tw.term.gene)
			}
		}

		if (geneNames.length === 0) {
			console.log('No genes to query')
			return { term2sample2value, byTermId }
		}

		const result = JSON.parse(
			await run_python('readHDF5.py', JSON.stringify({ hdf5_file: thisCategory.meanfile, query: geneNames }))
		)

		const genesData = result.query_output || {}
		if (!genesData) throw 'No expression data returned from HDF5 query'
		for (const tw of param.terms) {
			if (!tw.term.gene) continue

			// Get this gene's data from the batch response
			const geneResult = genesData[tw.term.gene]
			if (!geneResult) {
				console.warn(`No data found for gene ${tw.term.gene} in the response`)
				continue
			}

			// Extract just the samples data
			const samplesData = geneResult.samples || {}
			// Convert the gene data to the expected format
			const s2v = {}

			for (const sampleName in samplesData) {
				const sampleId = ds.cohort.termdb.q.sampleName2id(sampleName)
				if (!sampleId) continue
				if (limitSamples && !limitSamples.has(sampleId)) continue
				if (!Number.isFinite(samplesData[sampleName])) continue // skip non-numeric values
				s2v[sampleId] = samplesData[sampleName]
			}

			if (Object.keys(s2v).length) {
				term2sample2value.set(tw.$id, s2v)
			}
		}
		if (term2sample2value.size == 0) {
			throw 'No data available for the input ' + param.terms?.map(tw => tw.term.gene).join(', ')
		}

		return { term2sample2value, byTermId, bySampleId }
	}
}
