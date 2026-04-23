import path from 'path'
import type { DERequest, DEFullResponse, GeneDEEntry, RouteApi } from '#types'
import { diffExpPayload } from '#types/checkers'
import { mayLog } from '#src/helpers.ts'
import serverconfig from '../src/serverconfig.js'
import { get_header_txt } from '#src/utils.js'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { renderVolcano } from '../src/renderVolcano.ts'
import { readCacheFileOrRecompute, resolveDeContext, resolveSampleGroups } from '../src/diffAnalysis.ts'

export const api: RouteApi = {
	endpoint: 'termdb/DE',
	methods: {
		get: {
			...diffExpPayload,
			init
		},
		post: {
			...diffExpPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const q = req.query as DERequest

			// preAnalysis short-circuit: just sample counts, no cache touch.
			if ((q as any).preAnalysis) {
				const { ds, term_results, term_results2 } = await resolveDeContext(q, genomes)
				const groups = resolveSampleGroups(q, ds, term_results, term_results2)
				const group1Name = q.samplelst.groups[0].name
				const group2Name = q.samplelst.groups[1].name
				res.send({
					data: {
						[group1Name]: groups.group1names.length,
						[group2Name]: groups.group2names.length,
						...(groups.alerts.length ? { alert: groups.alerts.join(' | ') } : {})
					}
				})
				return
			}

			// Unified read-or-recompute: hides the cache-hit vs fresh-compute
			// branch behind a single call. On hit, `images` and `bcv` are
			// undefined (fresh R runs are the only source of those).
			const { cacheId, geneData, sample_size1, sample_size2, method, images, bcv } = await readCacheFileOrRecompute({
				daRequest: q,
				genomes
			})

			const rendered = await renderVolcano<GeneDEEntry>(geneData, q.volcanoRender)
			rendered.cacheId = cacheId

			const output: DEFullResponse = {
				data: rendered,
				sample_size1,
				sample_size2,
				method,
				images
			}
			if (bcv != null) output.bcv = bcv
			res.send(output)
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

export async function validate_query_rnaseqGeneCount(ds) {
	const q = ds.queries.rnaseqGeneCount
	if (!q) return
	if (!q.file) throw new Error('unknown data type for rnaseqGeneCount')
	// the gene count matrix tabular text file
	q.file = path.join(serverconfig.tpmasterdir, q.file)
	/*
    first line of matrix must be sample header, samples start from 5th column for text based files
    read the first line to get all samples, and save at q.allSampleSet
    so that samples from analysis request will be screened against q.allSampleSet
    also require that there's no duplicate samples in header line, so rust/r won't break
    */
	{
		let samples: string[] = []
		if (ds.queries.rnaseqGeneCount.storage_type == 'text') {
			samples = (await get_header_txt(q.file, null)).split('\t').slice(4)
		} else if (ds.queries.rnaseqGeneCount.storage_type == 'HDF5') {
			const get_samples_from_hdf5 = {
				hdf5_file: q.file,
				validate: true
			}
			const time1 = new Date().valueOf()
			const result = await run_rust('readH5', JSON.stringify(get_samples_from_hdf5))
			const time2 = new Date().valueOf()
			mayLog('Time taken to query gene expression:', time2 - time1, 'ms')
			const vr = JSON.parse(result)
			if (vr.status !== 'success') throw new Error(vr.message)
			if (!Array.isArray(vr.samples)) throw new Error('HDF5 file has no samples, please check file.')
			samples = vr.samples
		} else throw new Error('unknown storage type:' + ds.queries.rnaseqGeneCount.storage_type)

		q.allSampleSet = new Set(samples)
		//if(q.allSampleSet.size < samples.length) throw 'rnaseqGeneCount.file header contains duplicate samples'
		const unknownSamples: string[] = []
		for (const n of q.allSampleSet) {
			if (!ds.cohort.termdb.q.sampleName2id(n)) unknownSamples.push(n)
		}
		//if (unknownSamples.length)
		//	throw `${ds.label} rnaseqGeneCount: ${unknownSamples.length} out of ${
		//		q.allSampleSet.size
		//	} sample names are unknown: ${unknownSamples.join(',')}`
		console.log(q.allSampleSet.size, `rnaseqGeneCount samples from ${ds.label}`)
	}
}
