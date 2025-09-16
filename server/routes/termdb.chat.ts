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

			const dataset_agnostic_file = serverconfig.binpath + '/../rust/src/ai_docs3.txt'
			console.log('q:', q)
			console.log('serverconfig:', serverconfig)
			console.log('ds:', serverconfig.tpmasterdir + '/' + ds.cohort.db.file)
			console.log('dataset_agnostic_file:', dataset_agnostic_file)

			let apilink: string
			let comp_model_name: string
			let embedding_model_name: string
			if (serverconfig.llm_backend != 'SJ') {
				apilink = serverconfig.sj_apilink
				comp_model_name = serverconfig.sj_comp_model_name
				embedding_model_name = serverconfig.sj_embedding_model_name
			} else if (serverconfig.llm_backend != 'ollama') {
				apilink = serverconfig.ollama_apilink
				comp_model_name = serverconfig.ollama_comp_model_name
				embedding_model_name = serverconfig.ollama_embedding_model_name
			} else {
				throw "llm_backend either needs to be 'SJ' or 'ollama'" // Currently only 'SJ' and 'ollama' LLM backends are supported
			}

			const chatbot_input = {
				// Just hardcoding variables here, these will later be defined in more appropriate places
				user_input: q.prompt,
				apilink: apilink,
				dataset_db: serverconfig.tpmasterdir + '/' + ds.cohort.db.file,
				comp_model_name: comp_model_name,
				embedding_model_name: embedding_model_name,
				llm_backend_name: serverconfig.llm_backend, // The type of backend (engine) used for running the embedding and completion model. Currently "SJ" and "Ollama" are supported
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
