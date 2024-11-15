import type { ViolinRequest, ViolinResponse, RouteApi } from '#types'
import { violinPayload } from '#types/checkers'
import { trigger_getViolinPlotData } from '#src/termdb.violin.js'

export const api: RouteApi = {
	endpoint: 'termdb/violin',
	methods: {
		get: {
			...violinPayload,
			init
		},
		post: {
			...violinPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		const q: ViolinRequest = req.query
		let data
		try {
			const g = genomes[q.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets?.[q.dslabel]
			if (!ds) throw 'invalid ds'
			data = await trigger_getViolinPlotData(q, null, ds, g)
		} catch (e: any) {
			data = { error: e?.message || e }
			if (e instanceof Error && e.stack) console.log(e)
		}
		res.send(data satisfies ViolinResponse)
	}
}
