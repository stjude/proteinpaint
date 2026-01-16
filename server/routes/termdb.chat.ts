import fs from 'fs'
import { ezFetch } from '#shared'
import { createGenerator } from 'ts-json-schema-generator'
import type { SchemaGenerator } from 'ts-json-schema-generator'
import path from 'path'
import type { ChatRequest, ChatResponse, RouteApi, DbRows, DbValue, SummaryType, ValidTerm } from '#types'
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
				extract_summary_terms(
					q.prompt,
					serverconfig.llm_backend,
					comp_model_name,
					apilink,
					dataset_db,
					serverconfig_ds_entries.aifiles,
					genedb
				)
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
	llm_backend_type: string,
	comp_model_name: string,
	apilink: string,
	dataset_db: string,
	ai_json: string,
	genedb: string
) {
	const { db_rows, rag_docs } = await parse_dataset_db(dataset_db)
	//mayLog('db_rows:', db_rows)
	//mayLog('rag_docs:', rag_docs)
	const genes_list = await parse_geneset_db(genedb)
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
	const StringifiedSchema = JSON.stringify(generator.createSchema(SchemaConfig.type)) // May use a typescript definition in the future which may be generated at server startup
	const words = prompt.split(/\s+/).map(str => str.toUpperCase()) // Split on whitespace and convert to uppercase
	const common_genes = words.filter(item => genes_list.includes(item)) // The reason behind showing common genes that are actually present in the genedb is because otherwise showing ~20000 genes would increase the number of tokens significantly and may cause the LLM to loose context. Much easier to parse out relevant genes from the user prompt.

	// Read dataset JSON file
	const dataset_json: any = await readJSONFile(ai_json)

	// Parse out training data from the dataset JSON and add it to a string
	const summary_ds = dataset_json.charts.filter((chart: any) => chart.type == 'Summary')
	if (summary_ds.length == 0) throw 'summary information not present in dataset file'
	if (summary_ds[0].TrainingData.length == 0) throw 'no training data provided for summary agent'

	let train_iter = 0
	let training_data = ''
	for (const train_data of summary_ds[0].TrainingData) {
		train_iter += 1
		training_data +=
			'Example question' +
			train_iter.toString() +
			': ' +
			train_data.question +
			' Example answer' +
			train_iter.toString() +
			':' +
			JSON.stringify(train_data.answer) +
			' '
	}

	let system_prompt =
		'I am an assistant that extracts the summary terms from user query. The final output must be in the following JSON format with NO extra comments. The JSON schema is as follows: ' +
		StringifiedSchema +
		' term and term2 (if present) should ONLY contain names of the fields from the sqlite db. The "simpleFilter" field is optional and should contain an array of JSON terms with which the dataset will be filtered. A variable simultaneously CANNOT be part of both "term"/"term2" and "simpleFilter". There are two kinds of filter variables: "Categorical" and "Numeric". "Categorical" variables are those variables which can have a fixed set of values e.g. gender, race. They are defined by the "CategoricalFilterTerm" which consists of "term" (a field from the sqlite3 db)  and "category" (a value of the field from the sqlite db).  "Numeric" variables are those which can have any numeric value. They are defined by "NumericFilterTerm" and contain  the subfields "term" (a field from the sqlite3 db), "start" an optional filter which is defined when a lower cutoff is defined in the user input for the numeric variable and "stop" an optional filter which is defined when a higher cutoff is defined in the user input for the numeric variable. The optional "html" field only contain messages of terms in the user input that were not found in their respective databases. The sqlite db in plain language is as follows: ' +
		rag_docs.join(',') +
		' training data is as follows:' +
		training_data

	if (dataset_json.hasGeneExpression) {
		// If dataset has geneExpression data
		if (common_genes.length > 0) {
			system_prompt += '\n List of relevant genes are as follows (separated by comma(,)):' + common_genes.join(',')
		}
	} else {
		if (common_genes.length > 0) {
			system_prompt +=
				'\n Dataset does NOT support gene expression. If any relevant genes are found, add a message in "html" field "Dataset does not support gene expression". List of relevant genes are as follows (separated by comma(,)):' +
				common_genes.join(',')
		}
	}

	system_prompt += ' Question: {' + prompt + '} answer:'
	//mayLog('system_prompt:', system_prompt)

	let response: string
	if (llm_backend_type == 'SJ') {
		// Local SJ server
		response = await call_sj_llm(system_prompt, comp_model_name, apilink)
	} else if (llm_backend_type == 'ollama') {
		// Ollama server
		response = await call_ollama(system_prompt, comp_model_name, apilink)
	} else {
		// Will later add support for azure server also
		throw 'Unknown LLM backend'
	}
	mayLog('response:', JSON.parse(response))
	validate_summary_response(response, db_rows, common_genes, ai_json)
	return JSON.parse(response)
}

function validate_summary_response(response: string, db_rows: DbRows[], common_genes: string[], dataset_json: any) {
	const response_type = JSON.parse(response)
	let html = ''
	if (response_type.html) html = response_type.html
	if (!response_type.term) html += 'term type is not present in summary output'

	const validated_summary_type: SummaryType = {
		// Initializing SummaryType
		term: ''
	}
	const term1_validity: ValidTerm = validate_term(response_type.term, db_rows, common_genes, dataset_json, html)
	if (term1_validity.invalid_html.length > 0) {
		html += term1_validity.invalid_html
	} else if (term1_validity.validated_term.length > 0) {
		validated_summary_type.term = term1_validity.validated_term
	}

	if (response_type.term2) {
		const term2_validity: ValidTerm = validate_term(response_type.term2, db_rows, common_genes, dataset_json, html)
		if (term2_validity.invalid_html.length > 0) {
			html += term2_validity.invalid_html
		} else if (term2_validity.validated_term.length > 0) {
			validated_summary_type.term2 = term2_validity.validated_term
		}
	}
	//if (response_type.simpleFilter) {
	//
	//}
}

function validate_term(term: string, db_rows: DbRows[], common_genes: string[], dataset_json: any, html: string) {
	mayLog('db_rows:', db_rows[0].values)
	const validated_row = db_rows.filter((row: DbRows) => row.name == term)
	const gene_hits = common_genes.filter(gene => gene == term)
	let invalid_html = ''
	let validated_term: string = ''
	if (validated_row.length == 0 && gene_hits.length == 0 && !html.includes('not found in database')) {
		// If the term is neither a field in dataset db nor a gene that means its a fake term given by the user or cooked up by the LLM. This should be reported on the client side.
		invalid_html = 'The term ' + term + ' was not found'

		// Check to see if the term is accidentally a key to a term (for e.g. Male instead of Sex), if yes append to error message
		for (const row of db_rows) {
			if (Object.keys(row.values).length > 0) {
				for (const key of Object.keys(row.values)) {
					if (row.values[key].value.label == term) {
						invalid_html += 'term ' + term + ' is a category of ' + row.name
					}
				}
			}
		}
	} else if (gene_hits.length > 0) {
		// If the term is a gene, check to see if the dataset supports geneExpression
		if (dataset_json.hasGeneExpression) {
			validated_term = term
		} else if (!html.includes('Dataset does not support gene expression')) {
			// Check to see if the LLM inserted the sentence. Many times it does not despite being in the system prompt, in such a case manually add this message to the error message
			invalid_html += ' Dataset does not support gene expression'
		}
	} else if (validated_row.length > 0) {
		validated_term = term
	}
	return { validated_term: validated_term, invalid_html: invalid_html } as ValidTerm
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
			if (jsondata.values && Object.keys(jsondata.values).length > 0) {
				for (const key of Object.keys(jsondata.values)) {
					const value = jsondata.values[key]
					const db_val: DbValue = { key: key, value: value }
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
