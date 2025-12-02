import type { ChatRequest, ChatResponse, RouteApi } from '#types'
import { ChatPayload } from '#types/checkers'
import { run_python } from '@sjcrh/proteinpaint-python'
// import path from 'path'
// import serverconfig from '#src/serverconfig.js'

export const api: RouteApi = {
	endpoint: 'chatBot',
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
		const query: ChatRequest = req.query
		try {
			const g = genomes[query.genome]
			if (!g) throw 'invalid genome'
			const ds = g.datasets?.[query.dslabel]
			if (!ds) throw 'invalid dslabel'

			//const df = path.join(serverconfig.tpmasterdir, ds.queries.chat.termsDescriptions)
			const chatbot_input = {
				prompt: query.prompt,
				genome: query.genome,
				dslabel: query.dslabel
				//terms_tsv_path:  df
			}
			try {
				const ai_output_data = await run_python('chatBot.py', JSON.stringify(chatbot_input))
				res.send(ai_output_data as ChatResponse)
			} catch (error) {
				const errmsg = 'Error running chatBot Python script:' + error
				throw new Error(errmsg)
			}
		} catch (e: any) {
			if (e) console.log(e)
			res.send({ error: e?.message || e })
		}
	}
}
