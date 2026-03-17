import type { RouteApi, TermdbDmrRequest, TermdbDmrSuccessResponse } from '#types'
import { TermdbDmrPayload } from '#types/checkers'
import { run_python } from '@sjcrh/proteinpaint-python'
import { invalidcoord } from '#shared/common.js'
import { mayLog } from '#src/helpers.ts'
import { formatElapsedTime } from '#shared'
import { getRegulatoryAnnotations } from '#src/regulatoryAnnotations.ts'

export const api: RouteApi = {
	endpoint: 'termdb/dmr',
	methods: {
		get: {
			...TermdbDmrPayload,
			init
		},
		post: {
			...TermdbDmrPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const q: TermdbDmrRequest = req.query
			const genome = genomes[q.genome]
			if (!genome) throw new Error('invalid genome')
			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw new Error('invalid ds')
			if (!ds.queries?.dnaMethylation) throw new Error('analysis not supported')
			if (!ds.queries.dnaMethylation.priorsFile)
				throw new Error(
					'DMR analysis requires a precomputed priors file. ' +
						'Configure dnaMethylation.priorsFile in the dataset and run compute_methylation_priors.py to generate it.'
				)

			if (!Array.isArray(q.group1) || q.group1.length == 0) throw new Error('group1 not non empty array')
			if (!Array.isArray(q.group2) || q.group2.length == 0) throw new Error('group2 not non empty array')
			if (invalidcoord(genome, q.chr, q.start, q.stop)) throw new Error('invalid chr/start/stop')

			const group1 = q.group1.map(s => s.sample).filter(Boolean)
			const group2 = q.group2.map(s => s.sample).filter(Boolean)
			if (group1.length < 3) throw new Error(`Need at least 3 samples in group1, got ${group1.length}`)
			if (group2.length < 3) throw new Error(`Need at least 3 samples in group2, got ${group2.length}`)

			// Merge client-supplied annotations with server-side regulatory annotations
			// from tabix-indexed BED files (CpG islands, ENCODE cCREs)
			const clientAnnotations = q.annotations || []
			const regulatoryAnnotations = await getRegulatoryAnnotations(genome, q.chr, q.start, q.stop)
			const annotations = [...clientAnnotations, ...regulatoryAnnotations]

			const gpdmInput: Record<string, unknown> = {
				h5file: ds.queries.dnaMethylation.file,
				chr: q.chr,
				start: q.start,
				stop: q.stop,
				group1,
				group2,
				annotations,
				nan_threshold: q.nan_threshold ?? 0.5,
				priors_file: ds.queries.dnaMethylation.priorsFile
			}

			const time1 = Date.now()
			const result = JSON.parse(await run_python('gpdm_analysis.py', JSON.stringify(gpdmInput)))
			mayLog('DMR analysis time:', formatElapsedTime(Date.now() - time1))
			if (result.error) throw new Error(result.error)

			// Build annotation items for client visualization.
			// Extract the type prefix from the annotation name (e.g. "CGI_chr7_123" → "CGI")
			const annotationItems = regulatoryAnnotations.map(a => {
				const typePart = a.name.split('_')[0]
				return { name: a.name, chr: q.chr, start: a.start, stop: a.end, type: typePart }
			})

			res.send({
				status: 'ok',
				dmrs: result.dmrs,
				annotations: annotationItems,
				diagnostic: result.diagnostic
			} as TermdbDmrSuccessResponse)
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			res.send({ error: msg })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}
