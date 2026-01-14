import fs from 'fs'
import { ezFetch } from '#shared'
//import Ajv from 'ajv'
import { createGenerator } from 'ts-json-schema-generator'
import type { SchemaGenerator } from 'ts-json-schema-generator'
import path from 'path'
import type { ChatRequest, ChatResponse, RouteApi, DbRows, DbValue, SummaryType } from '#types'
import { ChatPayload } from '#types/checkers'
//import { run_rust } from '@sjcrh/proteinpaint-rust'
import serverconfig from '../src/serverconfig.js'
import { mayLog } from '#src/helpers.ts'
//import { run_python } from '@sjcrh/proteinpaint-python'
import Database from 'better-sqlite3'

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
			const serverconfig_ds_entries = serverconfig.genomes
				.find(genome => genome.name == q.genome)
				.datasets.find(dslabel => dslabel.name == ds.label)

			if (!serverconfig_ds_entries.aifiles) {
				throw 'aifiles are missing for chatbot to work'
			}

			let apilink: string
			let comp_model_name: string
			if (serverconfig.llm_backend == 'SJ') {
				apilink = serverconfig.sj_apilink
				comp_model_name = serverconfig.sj_comp_model_name
			} else if (serverconfig.llm_backend == 'ollama') {
				apilink = serverconfig.ollama_apilink
				comp_model_name = serverconfig.ollama_comp_model_name
			} else {
				throw "llm_backend either needs to be 'SJ' or 'ollama'" // Currently only 'SJ' and 'ollama' LLM backends are supported
			}

			//const chatbot_input = {
			//    user_input: q.prompt,
			//    apilink: apilink,
			//    tpmasterdir: serverconfig.tpmasterdir,
			//    comp_model_name: comp_model_name,
			//    embedding_model_name: embedding_model_name,
			//    dataset_db: ds.cohort.db.file,
			//    genedb: g.genedb.dbfile,
			//    aiRoute: serverconfig.aiRoute, // Route file for classifying chat request into various routes
			//    llm_backend_name: serverconfig.llm_backend, // The type of backend (engine) used for running the embedding and completion model. Currently "SJ" and "Ollama" are supported
			//    aifiles: serverconfig_ds_entries.aifiles, // Dataset specific data containing data-specific routes, system prompts for agents and few-shot examples
			//    binpath: serverconfig.binpath
			//}
			//mayLog('chatbot_input:', JSON.stringify(chatbot_input))

			const dataset_db = serverconfig.tpmasterdir + '/' + ds.cohort.db.file
			const genedb = serverconfig.tpmasterdir + '/' + g.genedb.dbfile
			const time1 = new Date().valueOf()
			const classResult = await classify_query_by_dataset_type(
				q.prompt,
				comp_model_name,
				serverconfig.llm_backend,
				apilink,
				serverconfig.aiRoute
			)
			const time2 = new Date().valueOf()
			mayLog('Time taken for classification:', time2 - time1, 'ms')
			mayLog('classResult:', classResult)

			//let ai_output_data: any
			let ai_output_json: any
			if (classResult == 'summary') {
				extract_summary_terms(q.prompt, comp_model_name, apilink, dataset_db, serverconfig_ds_entries.aifiles, genedb)
			}

			//const time1 = new Date().valueOf()
			//const classResult = JSON.parse(await run_rust('query_classification', JSON.stringify(chatbot_input)))
			//const time2 = new Date().valueOf()
			//mayLog('Time taken for classification:', time2 - time1, 'ms')

			//let ai_output_data: any
			//let ai_output_json: any
			//if (classResult.route == 'summary') {
			//	const time1 = new Date().valueOf()
			//	ai_output_data = await run_rust('summary_agent', JSON.stringify(chatbot_input))
			//	const time2 = new Date().valueOf()
			//	mayLog('Time taken for running summary agent:', time2 - time1, 'ms')

			//	for (const line of ai_output_data.split('\n')) {
			//		// The reason we are parsing each line from rust is because we want to debug what is causing the wrong output. As the AI pipeline matures, the rust code will be modified to always return a single JSON
			//		if (line.startsWith('final_output:') == true) {
			//			ai_output_json = JSON.parse(JSON.parse(line.replace('final_output:', '')))
			//		} else {
			//			mayLog(line)
			//		}
			//	}
			//} else if (classResult.route == 'dge') {
			//	ai_output_json = { type: 'html', html: 'DE agent not implemented yet' }
			//} else {
			//	// Will define all other agents later as desired
			//	ai_output_json = { type: 'html', html: 'Unknown classification value' }
			//}

			//     		if (ai_output_json.type == 'plot') {
			//	if (typeof ai_output_json.plot != 'object') throw '.plot{} missing when .type=plot'
			//	if (ai_output_json.plot.simpleFilter) {
			//		// simpleFilter= [ {term:str, category:str} ]
			//		if (!Array.isArray(ai_output_json.plot.simpleFilter)) throw 'ai_output_json.plot.simpleFilter is not array'
			//		const localfilter = { type: 'tvslst', in: true, join: '', lst: [] as any[] }
			//		if (ai_output_json.plot.simpleFilter.length > 1) localfilter.join = 'and' // For now hardcoding join as 'and' if number of filter terms > 1. Will later implement more comprehensive logic
			//		for (const f of ai_output_json.plot.simpleFilter) {
			//			const term = ds.cohort.termdb.q.termjsonByOneid(f.term)
			//			if (!term) throw 'invalid term id from simpleFilter[].term'
			//			if (term.type == 'categorical') {
			//				let cat
			//				for (const ck in term.values) {
			//					if (ck == f.category) cat = ck
			//					else if (term.values[ck].label == f.category) cat = ck
			//				}
			//				if (!cat) throw 'invalid category from ' + JSON.stringify(f)
			//				// term and category validated
			//				localfilter.lst.push({
			//					type: 'tvs',
			//					tvs: {
			//						term,
			//						values: [{ key: cat }]
			//					}
			//				})
			//			} else if (term.type == 'float' || term.type == 'integer') {
			//				const numeric: any = {
			//					type: 'tvs',
			//					tvs: {
			//						term,
			//						ranges: []
			//					}
			//				}
			//				const range: any = {}
			//				if (f.gt && !f.lt) {
			//					range.start = Number(f.gt)
			//					range.stopunbounded = true
			//				} else if (f.lt && !f.gt) {
			//					range.stop = Number(f.lt)
			//					range.startunbounded = true
			//				} else if (f.gt && f.lt) {
			//					range.start = Number(f.gt)
			//					range.stop = Number(f.lt)
			//				} else {
			//					throw 'Neither greater or lesser defined'
			//				}
			//				numeric.tvs.ranges.push(range)
			//				localfilter.lst.push(numeric)
			//			}
			//		}
			//		delete ai_output_json.plot.simpleFilter
			//		ai_output_json.plot.filter = localfilter
			//	}
			//}

			//mayLog('ai_output_json:', ai_output_json)
			res.send(ai_output_json as ChatResponse)
		} catch (e: any) {
			if (e.stack) mayLog(e.stack)
			res.send({ error: e?.message || e })
		}
	}
}

async function call_ollama(prompt: string, model_name: string, apilink: string) {
	const temperature = 0.01
	const top_p = 0.95
	const timeout = 200000
	const payload = {
		model: model_name,
		messages: [{ role: 'user', content: prompt }],
		raw: false,
		stream: false,
		keep_alive: 15, //Keep the LLM loaded for 15mins
		options: {
			top_p: top_p,
			temperature: temperature,
			num_ctx: 10000
		}
	}

	try {
		const result = await ezFetch(apilink + '/api/chat', {
			method: 'POST',
			body: payload, // ezfetch automatically stringifies objects
			headers: { 'Content-Type': 'application/json' },
			timeout: { request: timeout } // ezfetch accepts milliseconds directly
		})
		if (result && result.message && result.message.content && result.message.content.length > 0)
			return result.message.content
		else {
			throw 'Error: Received an unexpected response format:' + result
		}
	} catch (error) {
		return 'Error: Ollama API request failed:' + error
	}
}

async function call_sj_llm(prompt: string, model_name: string, apilink: string) {
	const temperature = 0.01
	const top_p = 0.95
	const timeout = 200000
	const max_new_tokens = 512
	const payload = {
		inputs: [
			{
				model_name: model_name,
				inputs: {
					text: prompt,
					max_new_tokens: max_new_tokens,
					temperature: temperature,
					top_p: top_p
				}
			}
		]
	}

	try {
		const response = await ezFetch(apilink, {
			method: 'POST',
			body: payload, // ezfetch automatically stringifies objects
			headers: { 'Content-Type': 'application/json' },
			timeout: { request: timeout } // ezfetch accepts milliseconds directly
		})
		const result = response.outputs[0].generated_text
		return result
	} catch (error) {
		return 'Error: SJ API request failed:' + error
	}
}

async function readJSONFile(file: string) {
	const json_file = await fs.promises.readFile(file)
	return JSON.parse(json_file.toString())
}

async function classify_query_by_dataset_type(
	user_prompt: string,
	comp_model_name: string,
	llm_backend_type: string,
	apilink: string,
	aiRoute: string
) {
	const data = await readJSONFile(aiRoute)
	mayLog('ai_json:', data)

	let contents = data['general'] // The general description should be right at the top of the system prompt
	for (const key of Object.keys(data)) {
		// Add descriptions of all other agents after the general description
		if (key != 'general') {
			contents += data[key]
		}
	}
	const template = contents + ' Question: {' + user_prompt + '} Answer: {answer}'

	let response: string
	if (llm_backend_type == 'SJ') {
		// Local SJ server
		response = await call_sj_llm(template, comp_model_name, apilink)
	} else if (llm_backend_type == 'ollama') {
		// Ollama server
		response = await call_ollama(template, comp_model_name, apilink)
	} else {
		// Will later add support for azure server also
		throw 'Unknown LLM backend'
	}
	console.log('response:', response)
	return JSON.parse(response)['answer']
}

async function extract_summary_terms(
	prompt: string,
	model_name: string,
	apilink: string,
	dataset_db: string,
	ai_json: string,
	genedb: string
) {
	const { db_rows, rag_docs } = await parse_dataset_db(dataset_db)
	//mayLog('db_rows:', db_rows)
	//mayLog('rag_docs:', rag_docs)
	const genes_list = await parse_geneset_db(genedb)
	mayLog('genedb:', genes_list)
	const SchemaConfig = {
		path: path.resolve('termdb.chat.ts'),
		// Path to your tsconfig (required for proper type resolution)
		tsconfig: path.resolve(serverconfig.binpath, '../tsconfig.json'),
		// Name of the exported type we want to convert
		type: 'SummaryType',
		// Only expose exported symbols (default)
		expose: 'export' as 'export' | 'all' | 'none' | undefined,
		// Put the whole schema under a top‑level $ref (optional but convenient)
		topRef: true,
		// Turn off type‑checking for speed (set to true if you want full checks)
		skipTypeCheck: true
	}
	const generator: SchemaGenerator = createGenerator(SchemaConfig)
	const orderSchema = JSON.stringify(generator.createSchema(SchemaConfig.type))
	const summary_variable: SummaryType = {
		// Just defined this variable so that can commit to repo for now. Will be deleted later
		term: 'abc'
	}
	mayLog('summary_variable:', summary_variable)
	mayLog('orderSchema:', orderSchema)
	mayLog(db_rows, rag_docs)
	const words = prompt.split(/\s+/).map(str => str.toUpperCase()) // Split on whitespace and convert to uppercase
	const common_genes = words.filter(item => genes_list.includes(item))
	mayLog('common_genes:', common_genes)
}

async function parse_geneset_db(genedb: string) {
	const db = new Database(genedb)
	// Query the database
	const desc_rows = db.prepare('SELECT * from codingGenes').all()
	let genes_list: string[] = []
	desc_rows.forEach((row: any) => {
		genes_list.push(row.name)
	})
	genes_list = genes_list.map(str => str.toUpperCase()) // Converting to uppercase
	return genes_list
}

async function parse_dataset_db(dataset_db: string) {
	const db = new Database(dataset_db)
	// Query the database
	const desc_rows = db.prepare('SELECT * from termhtmldef').all()

	const description_map: any = []
	// Process the retrieved rows
	desc_rows.forEach((row: any) => {
		const name: string = row.id
		const jsonhtml = JSON.parse(row.jsonhtml)
		const description: string = jsonhtml.description[0].value
		description_map.push({ name: name, description: description })
	})

	const term_db_rows = db.prepare('SELECT * from terms').all()
	const rag_docs: string[] = []
	const db_rows: DbRows[] = []

	term_db_rows.forEach((row: any) => {
		const found = description_map.find((item: any) => item.name === row.id)
		if (found) {
			// Restrict db to only those items that have a description
			const jsondata = JSON.parse(row.jsondata)
			const description = description_map.filter((item: any) => item.name === row.id)
			const term_type: string = row.type

			const values: DbValue[] = []
			if (jsondata.values && jsondata.values.length > 0) {
				for (const key of Object.keys(jsondata.values)) {
					const value = jsondata.values[key]
					const db_val: DbValue = { key: key, label: value }
					values.push(db_val)
				}
			}
			const db_row: DbRows = {
				name: row.id,
				description: description[0].description,
				values: values,
				term_type: term_type
			}
			const stringified_db = parse_db_rows(db_row)
			rag_docs.push(stringified_db)
			db_rows.push(db_row)
		}
	})
	return { db_rows, rag_docs }
}

function parse_db_rows(db_row: DbRows) {
	let output_string: string =
		'Name of the field is:' +
		db_row.name +
		'. This field is of the type:' +
		db_row.term_type +
		'. Description: ' +
		db_row.description

	if (db_row.values.length > 0) {
		output_string += 'This field contains the following possible values.'
		for (const value of db_row.values) {
			output_string += 'The key is ' + value.key + ' and the label is ' + value.label
		}
	}
	return output_string
}
