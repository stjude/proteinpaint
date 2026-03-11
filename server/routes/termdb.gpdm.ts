import type { RouteApi, TermdbGpdmRequest, TermdbGpdmSuccessResponse } from '#types'
import { TermdbGpdmPayload } from '#types/checkers'
import { run_python } from '@sjcrh/proteinpaint-python'
import { invalidcoord } from '#shared/common.js'
import { get_ds_tdb } from '../src/termdb.js'
import { mayLog } from '#src/helpers.ts'
import { formatElapsedTime } from '#shared'

export const api: RouteApi = {
	endpoint: 'termdb/gpdm',
	methods: {
		get: {
			...TermdbGpdmPayload,
			init
		},
		post: {
			...TermdbGpdmPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const q: TermdbGpdmRequest = req.query
			const genome = genomes[q.genome]
			if (!genome) throw new Error('invalid genome')
			const [ds] = get_ds_tdb(genome, q)
			if (!ds.queries?.dnaMethylation) throw new Error('dnaMethylation not configured for this dataset')

			if (!Array.isArray(q.group1) || q.group1.length === 0) throw new Error('group1 must be a non-empty array')
			if (!Array.isArray(q.group2) || q.group2.length === 0) throw new Error('group2 must be a non-empty array')
			if (invalidcoord(genome, q.chr, q.start, q.stop)) throw new Error('invalid chr/start/stop')

			// Convert sample IDs to names, filtering to those in the methylation dataset
			const group1names: string[] = []
			const group2names: string[] = []

			for (const s of q.group1) {
				if (!Number.isInteger(s.sampleId)) continue
				const n = ds.cohort.termdb.q.id2sampleName(s.sampleId)
				if (n) group1names.push(n)
			}
			for (const s of q.group2) {
				if (!Number.isInteger(s.sampleId)) continue
				const n = ds.cohort.termdb.q.id2sampleName(s.sampleId)
				if (n) group2names.push(n)
			}

			if (group1names.length < 3) throw new Error(`Need at least 3 samples in group1, got ${group1names.length}`)
			if (group2names.length < 3) throw new Error(`Need at least 3 samples in group2, got ${group2names.length}`)

			const gpdmInput = {
				h5file: ds.queries.dnaMethylation.file,
				chr: q.chr,
				start: q.start,
				stop: q.stop,
				group1: group1names,
				group2: group2names,
				annotations: q.annotations || [],
				nan_threshold: q.nan_threshold ?? 0.5
			}

			const time1 = Date.now()
			const result = JSON.parse(await run_python('gpdm_analysis.py', JSON.stringify(gpdmInput)))
			mayLog('GPDM analysis time:', formatElapsedTime(Date.now() - time1))

			if (result.error) throw new Error(result.error)
			res.send(result as TermdbGpdmSuccessResponse)
		} catch (e: any) {
			res.send({ error: e.message || e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}
