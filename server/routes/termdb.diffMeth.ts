import type { DiffMethEntry, DiffMethFullResponse, DiffMethRequest, RouteApi } from '#types'
import { diffMethPayload } from '#types/checkers'
import { renderVolcano } from '../src/renderVolcano.ts'
import { readCacheFileOrRecomputeDm, resolveDaContext, resolveDmSampleGroups } from '../src/diffAnalysis.ts'

export const api: RouteApi = {
	endpoint: 'termdb/diffMeth',
	methods: {
		get: {
			...diffMethPayload,
			init
		},
		post: {
			...diffMethPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const q = req.query as DiffMethRequest

			if ((q as any).preAnalysis) {
				const { ds, term_results, term_results2 } = await resolveDaContext(q, genomes)
				const groups = resolveDmSampleGroups(q, ds, term_results, term_results2)
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

			const { cacheId, promoterData, sample_size1, sample_size2 } = await readCacheFileOrRecomputeDm({
				daRequest: q,
				genomes
			})

			const rendered = await renderVolcano<DiffMethEntry>(promoterData, q.volcanoRender)
			rendered.cacheId = cacheId

			// Empty dots is valid (strict thresholds) and the PNG should still
			// return; only abort if no rows reached the renderer at all.
			if (rendered.totalRows === 0)
				throw new Error('No promoters passed filtering. Try relaxing group criteria or selecting more samples.')

			const output: DiffMethFullResponse = {
				data: rendered,
				sample_size1,
				sample_size2
			}
			res.send(output)
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}
