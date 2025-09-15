import type { ChatRequest, ChatResponse, RouteApi } from '#types'
import { ChatPayload } from '#types/checkers'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import serverconfig from '../src/serverconfig.js'

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
		//console.log("req:", req.query)
		const q: ChatRequest = req.query
		try {
			const g = genomes[q.genome]
			if (!g) throw 'invalid genome'
			const ds = g.datasets?.[q.dslabel]
			if (!ds) throw 'invalid dslabel'
			//if (!ds.queries?.chat) throw 'not supported'

			//{"user_input": "Show summary plot for sample information", "dataset_file":"sjpp/proteinpaint/server/test/tp/files/hg38/TermdbTest/TermdbTest_embeddings.txt", "dataset_db": "/Users/rpaul1/pp_data/files/hg38/ALL-pharmacotyping/clinical/db8", "apilink": "https://svltgpt01a.stjude.org/v2/models/ray_gateway_router/infer", "comp_model_name": "llama3.3-70b-instruct-vllm", "embedding_model_name": "multi-qa-mpnet-base-dot-v1", "llm_backend_name": "SJ"

			const dataset_agnostic_file = serverconfig.binpath + '/../rust/src/ai_docs3.txt'
			console.log('q:', q)
			console.log('serverconfig:', serverconfig)
			console.log('ds:', serverconfig.tpmasterdir + '/' + ds.cohort.db.file)
			console.log('dataset_agnostic_file:', dataset_agnostic_file)
			const chatbot_input = {
				// Just hardcoding variables here, these will later be defined in more appropriate places
				user_input: q.prompt,
				apilink: 'https://svltgpt01a.stjude.org/v2/models/ray_gateway_router/infer',
				dataset_db: serverconfig.tpmasterdir + '/' + ds.cohort.db.file,
				comp_model_name: 'llama3.3-70b-instruct-vllm',
				embedding_model_name: 'nomic-embed-text-v1.5',
				llm_backend_name: 'SJ',
				dataset_agnostic_file: dataset_agnostic_file
			}

			console.log('chatbot_input:', JSON.stringify(chatbot_input))

			const data = await run_rust('aichatbot', JSON.stringify(chatbot_input))
			console.log('data:', data)
			// may convert data
			res.send(data as ChatResponse)
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			res.send({ error: e?.message || e })
		}
	}
}
