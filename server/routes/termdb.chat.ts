import type { ChatRequest, ChatResponse, RouteApi } from '#types'
import { ChatPayload } from '#types/checkers'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import serverconfig from '../src/serverconfig.js'
import { mayLog } from '#src/helpers.ts'
import { run_python } from '@sjcrh/proteinpaint-python'

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

			if (serverconfig.features.pythonChatBot) {
				// Use the chat bot based on langGraph
				//const df = path.join(serverconfig.tpmasterdir, ds.queries.chat.termsDescriptions)
				const chatbot_input = {
					prompt: q.prompt,
					genome: q.genome,
					dslabel: q.dslabel
					//terms_tsv_path: df
				}
				try {
					const ai_output_data = await run_python('chatBot.py', JSON.stringify(chatbot_input))
					res.send(ai_output_data as ChatResponse)
				} catch (error) {
					const errmsg = 'Error running chatBot Python script:' + error
					throw new Error(errmsg)
				}
				return
			}
			console.log('serverconfig:', serverconfig)
			const serverconfig_ds_entries = serverconfig.genomes
				.find(genome => genome.name == q.genome)
				.datasets.find(dslabel => dslabel.name == ds.label)

			if (!serverconfig_ds_entries.aifiles) {
				throw 'aifiles are missing for chatbot to work'
			}

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
				user_input: q.prompt,
				apilink: apilink,
				tpmasterdir: serverconfig.tpmasterdir,
				comp_model_name: comp_model_name,
				embedding_model_name: embedding_model_name,
				dataset_db: ds.cohort.db.file,
				genedb: g.genedb.dbfile,
				aiRoute: serverconfig.aiRoute, // Route file for classifying chat request into various routes
				llm_backend_name: serverconfig.llm_backend, // The type of backend (engine) used for running the embedding and completion model. Currently "SJ" and "Ollama" are supported
				aifiles: serverconfig_ds_entries.aifiles, // Dataset specific data containing data-specific routes, system prompts for agents and few-shot examples
				binpath: serverconfig.binpath
			}
			//mayLog('chatbot_input:', JSON.stringify(chatbot_input))

			const time1 = new Date().valueOf()
			const ai_output_data = await run_rust('aichatbot', JSON.stringify(chatbot_input))
			const time2 = new Date().valueOf()
			mayLog('Time taken to run rust AI chatbot:', time2 - time1, 'ms')
			let ai_output_json: any
			for (const line of ai_output_data.split('\n')) {
				// The reason we are parsing each line from rust is because we want to debug what is causing the wrong output. As the AI pipeline matures, the rust code will be modified to always return a single JSON
				if (line.startsWith('final_output:') == true) {
					ai_output_json = JSON.parse(JSON.parse(line.replace('final_output:', '')))
				} else {
					mayLog(line)
				}
			}

			if (ai_output_json.type == 'plot') {
				if (typeof ai_output_json.plot != 'object') throw '.plot{} missing when .type=plot'
				if (ai_output_json.plot.simpleFilter) {
					// simpleFilter= [ {term:str, category:str} ]
					if (!Array.isArray(ai_output_json.plot.simpleFilter)) throw 'ai_output_json.plot.simpleFilter is not array'
					const localfilter = { type: 'tvslst', in: true, join: '', lst: [] as any[] }
					if (ai_output_json.plot.simpleFilter.length > 1) localfilter.join = 'and' // For now hardcoding join as 'and' if number of filter terms > 1. Will later implement more comprehensive logic
					for (const f of ai_output_json.plot.simpleFilter) {
						const term = ds.cohort.termdb.q.termjsonByOneid(f.term)
						if (!term) throw 'invalid term id from simpleFilter[].term'
						if (term.type == 'categorical') {
							let cat
							for (const ck in term.values) {
								if (ck == f.category) cat = ck
								else if (term.values[ck].label == f.category) cat = ck
							}
							if (!cat) throw 'invalid category from ' + JSON.stringify(f)
							// term and category validated
							localfilter.lst.push({
								type: 'tvs',
								tvs: {
									term,
									values: [{ key: cat }]
								}
							})
						} else if (term.type == 'float') {
							const numeric: any = {
								type: 'tvs',
								tvs: {
									term,
									ranges: []
								}
							}
							const range: any = {}
							if (f.gt && !f.lt) {
								range.start = Number(f.gt)
								range.stopunbounded = true
							} else if (f.lt && !f.gt) {
								range.stop = Number(f.lt)
								range.startunbounded = true
							} else if (f.gt && f.lt) {
								range.start = Number(f.gt)
								range.stop = Number(f.lt)
							} else {
								throw 'Neither greater or lesser defined'
							}
							numeric.tvs.ranges.push(range)
							localfilter.lst.push(numeric)
						}
					}
					delete ai_output_json.plot.simpleFilter
					ai_output_json.plot.filter = localfilter
				}
				console.log('ai_output_json:', ai_output_json)
				res.send(ai_output_json as ChatResponse)
			}
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			res.send({ error: e?.message || e })
		}
	}
}
