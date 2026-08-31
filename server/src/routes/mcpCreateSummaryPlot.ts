import type { RouteApi, RoutePayload } from '#types'
import { resolveSummaryPlot } from '../mcp/resolveSummaryPlot.ts'

/** MCP POC endpoint (see server/src/mcp/) — builds a validated 'summary' plot config for the
 * create_summary_plot tool. Standalone route, independent of the termdb/chat endpoint and the AI
 * chat feature it backs. */

type McpCreateSummaryPlotRequest = {
	genome: string
	dslabel: string
	term: string
	term2?: string
}

const payload: RoutePayload = {
	init,
	request: { typeId: 'McpCreateSummaryPlotRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'McpCreateSummaryPlotResponse' }
}

export const api: RouteApi = {
	endpoint: 'mcp/createSummaryPlot',
	methods: { get: payload }
}

function init({ genomes }) {
	return async (req, res) => {
		try {
			const q: McpCreateSummaryPlotRequest = req.query
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw 'invalid dslabel'
			if (!q.term) throw 'term is required'
			res.send(resolveSummaryPlot(ds, q.term, q.term2))
		} catch (e: any) {
			res.send({ error: e?.message || e })
		}
	}
}
