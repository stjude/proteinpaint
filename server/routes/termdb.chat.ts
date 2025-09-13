import type { ChatRequest, ChatResponse, RouteApi } from '#types'
import { ChatPayload } from '#types/checkers'
import { run_rust } from '@sjcrh/proteinpaint-rust'

export const api: RouteApi = {
	endpoint: 'termdb/chat',
	methods: {
		get: {
			...ChatPayload,
			init
		},
		post: {
			...ChatPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res) => {
		const q: ChatRequest = req.query
		try {
			const g = genomes[q.genome]
			if (!g) throw 'invalid genome'
			const ds = g.datasets?.[q.dslabel]
			if (!ds) throw 'invalid dslabel'
			if (!ds.queries?.chat) throw 'not supported'
			const data = await run_rust('aichatbots', JSON.stringify(q))
			// may convert data
			res.send(data as ChatResponse)
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			res.send({ error: e?.message || e })
		}
	}
}
