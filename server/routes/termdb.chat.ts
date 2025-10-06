import type { ChatRequest, ChatResponse, RouteApi } from '#types'
import { ChatPayload } from '#types/checkers'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import serverconfig from '../src/serverconfig.js'
import { mayLog } from '#src/helpers.ts'
import path from 'path'

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

			let apilink: string
			let comp_model_name: string
			let embedding_model_name: string
			if (serverconfig.llm_backend == 'SJ') {
				apilink = serverconfig.sj_apilink
				comp_model_name = serverconfig.sj_comp_model_name
				embedding_model_name = serverconfig.sj_embedding_model_name
			} else if (serverconfig.llm_backend == 'ollama') {
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
				dataset_db: path.join(serverconfig.tpmasterdir, ds.cohort.db.file),
				genedb: path.join(serverconfig.tpmasterdir, genomes[q.genome].genedb.dbfile),
				comp_model_name: comp_model_name,
				embedding_model_name: embedding_model_name,
				llm_backend_name: serverconfig.llm_backend, // The type of backend (engine) used for running the embedding and completion model. Currently "SJ" and "Ollama" are supported
				hasGeneExpression: ds.queries.geneExpression ? true : false
			}
			//mayLog('chatbot_input:', JSON.stringify(chatbot_input))

			const time1 = new Date().valueOf()
			const ai_output_data = await run_rust('aichatbot', JSON.stringify(chatbot_input))
			const time2 = new Date().valueOf()
			mayLog('Time taken to run rust AI chatbot:', time2 - time1, 'ms')
			let ai_output_json: ChatResponse | string = ''
			for (const line of ai_output_data.split('\n')) {
				// The reason we are parsing each line from rust is because we want to debug what is causing the wrong output. As the AI pipeline matures, the rust code will be modified to always return a single JSON
				if (line.startsWith('final_output:') == true) {
					ai_output_json = JSON.parse(line.replace('final_output:', ''))
				} else {
					mayLog(line)
				}
			}
			res.send(ai_output_json as ChatResponse)
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			res.send({ error: e?.message || e })
		}
	}
}
