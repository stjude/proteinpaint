import fs from 'fs'
import { ezFetch } from '#shared'
import { get_samples } from '#src/termdb.sql.js'
//import { createGenerator } from 'ts-json-schema-generator'
//import type { SchemaGenerator } from 'ts-json-schema-generator'
//import path from 'path'
import type { ChatRequest, ChatResponse, RouteApi, DbRows, DbValue, ClassificationType } from '#types'
import { ChatPayload } from '#types/checkers'
import serverconfig from '../src/serverconfig.js'
import { mayLog } from '#src/helpers.ts'
import Database from 'better-sqlite3'
import { formatElapsedTime } from '#shared'

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

			const dataset_db = serverconfig.tpmasterdir + '/' + ds.cohort.db.file
			const genedb = serverconfig.tpmasterdir + '/' + g.genedb.dbfile
			// Read dataset JSON file
			const dataset_json: any = await readJSONFile(serverconfig_ds_entries.aifiles)
			const time1 = new Date().valueOf()
			const class_response: ClassificationType = await classify_query_by_dataset_type(
				q.prompt,
				comp_model_name,
				serverconfig.llm_backend,
				apilink,
				serverconfig.aiRoute,
				dataset_json
			)
			let ai_output_json: any
			mayLog('Time taken for classification:', formatElapsedTime(Date.now() - time1))
			if (class_response.type == 'html') {
				ai_output_json = class_response
			} else if (class_response.type == 'plot') {
				const classResult = class_response.plot
				mayLog('classResult:', classResult)
				//let ai_output_data: any
				if (classResult == 'summary') {
					const time1 = new Date().valueOf()
					ai_output_json = await extract_summary_terms(
						q.prompt,
						serverconfig.llm_backend,
						comp_model_name,
						apilink,
						dataset_db,
						dataset_json,
						genedb,
						ds
					)
					mayLog('Time taken for summary agent:', formatElapsedTime(Date.now() - time1))
				} else if (classResult == 'dge') {
					const time1 = new Date().valueOf()
					ai_output_json = await extract_DE_search_terms_from_query(
						q.prompt,
						serverconfig.llm_backend,
						comp_model_name,
						apilink,
						dataset_db,
						dataset_json,
						ds
					)
					mayLog('Time taken for DE agent:', formatElapsedTime(Date.now() - time1))
				} else {
					// Will define all other agents later as desired
					ai_output_json = { type: 'html', html: 'Unknown classification value' }
				}
			} else {
				// Should not happen
				ai_output_json = {
					type: 'html',
					html: 'Unknown classification type'
				}
			}
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
		throw 'Ollama API request failed:' + error
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
		if (response.outputs && response.outputs[0] && response.outputs[0].generated_text) {
			const result = response.outputs[0].generated_text
			return result
		} else {
			throw 'Error: Received an unexpected response format:' + response
		}
	} catch (error) {
		throw 'SJ API request failed:' + error
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
	aiRoute: string,
	dataset_json: any
) {
	const data = await readJSONFile(aiRoute)
	let contents = data['general'] // The general description should be right at the top of the system prompt
	for (const key of Object.keys(data)) {
		// Add descriptions of all other agents after the general description
		if (key != 'general') {
			contents += data[key]
		}
	}
	// Parse out training data from the dataset JSON and add it to a string
	const classification_ds = dataset_json.charts.filter((chart: any) => chart.type == 'Classification')
	let train_iter = 0
	let training_data = ''
	if (classification_ds.length > 0 && classification_ds[0].TrainingData.length > 0) {
		contents += classification_ds.SystemPrompt
		for (const train_data of classification_ds[0].TrainingData) {
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
	}

	//const SchemaConfig = {
	//    path: path.resolve('#types'),
	//    // Path to your tsconfig (required for proper type resolution)
	//    tsconfig: path.resolve(serverconfig.binpath, '../tsconfig.json'),
	//    // Name of the exported type we want to convert
	//    type: 'ClassificationType',
	//    // Only expose exported symbols (default)
	//    expose: 'export' as 'export' | 'all' | 'none' | undefined,
	//    // Put the whole schema under a top‑level $ref (optional but convenient)
	//    topRef: true,
	//    // Turn off type‑checking for speed (set to true if you want full checks)
	//    skipTypeCheck: true
	//}
	//const generator: SchemaGenerator = createGenerator(SchemaConfig)
	//const StringifiedSchema = JSON.stringify(generator.createSchema(SchemaConfig.type)) // This will be generated at server startup later
	//mayLog("StringifiedSchema:", StringifiedSchema)

	const template =
		contents + ' training data is as follows:' + training_data + ' Question: {' + user_prompt + '} Answer: {answer}'

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
	mayLog('response:', response)
	return JSON.parse(response)
}

async function extract_DE_search_terms_from_query(
	prompt: string,
	llm_backend_type: string,
	comp_model_name: string,
	apilink: string,
	dataset_db: string,
	dataset_json: any,
	ds: any
) {
	if (dataset_json.hasDE) {
		const rag_docs = await parse_dataset_db(dataset_db)
		//mayLog('rag_docs:', rag_docs)
		//mayLog('prompt:', prompt)
		//mayLog('llm_backend_type:', llm_backend_type)
		//mayLog('comp_model_name:', comp_model_name)
		//mayLog('genedb:', genedb)
		//mayLog('ds:', ds)

		//const SchemaConfig = {
		//    path: path.resolve('#types'),
		//    // Path to your tsconfig (required for proper type resolution)
		//    tsconfig: path.resolve(serverconfig.binpath, '../tsconfig.json'),
		//    // Name of the exported type we want to convert
		//    type: 'DEType',
		//    // Only expose exported symbols (default)
		//    expose: 'export' as 'export' | 'all' | 'none' | undefined,
		//    // Put the whole schema under a top‑level $ref (optional but convenient)
		//    topRef: true,
		//    // Turn off type‑checking for speed (set to true if you want full checks)
		//    skipTypeCheck: true
		//}
		//const generator: SchemaGenerator = createGenerator(SchemaConfig)
		//const StringifiedSchema = JSON.stringify(generator.createSchema(SchemaConfig.type)) // This commented out code generates the JSON schema below
		const StringifiedSchema =
			'{"$schema":"http://json-schema.org/draft-07/schema#","$ref":"#/definitions/DEType","definitions":{"DEType":{"type":"object","properties":{"group1":{"type":"array","items":{"$ref":"#/definitions/FilterTerm"}},"group2":{"type":"array","items":{"$ref":"#/definitions/FilterTerm"}},"name1":{"type":"string"},"name2":{"type":"string"},"method":{"type":"string","enum":["edgeR","limma","wilcoxon"]}},"required":["group1","group2","name1","name2"],"additionalProperties":false},"FilterTerm":{"anyOf":[{"$ref":"#/definitions/CategoricalFilterTerm"},{"$ref":"#/definitions/NumericFilterTerm"}]},"CategoricalFilterTerm":{"type":"object","properties":{"term":{"type":"string"},"category":{"type":"string"}},"required":["term","category"],"additionalProperties":false},"NumericFilterTerm":{"type":"object","properties":{"term":{"type":"string"},"start":{"type":"number"},"stop":{"type":"number"}},"required":["term"],"additionalProperties":false}}}'
		//mayLog('StringifiedSchema:', StringifiedSchema)

		// Parse out training data from the dataset JSON and add it to a string
		const DE_ds = dataset_json.charts.filter((chart: any) => chart.type == 'DE')
		if (DE_ds.length == 0) throw 'DE information not present in dataset file'
		if (DE_ds[0].TrainingData.length == 0) throw 'no training data provided for DE agent'

		let train_iter = 0
		let training_data = ''
		for (const train_data of DE_ds[0].TrainingData) {
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

		const system_prompt =
			'I am an assistant that extracts the groups from the user prompt to carry out differential gene expression. The final output must be in the following JSON with NO extra comments. The schema is as follows: ' +
			StringifiedSchema +
			' . "group1" and "group2" fields are compulsory. Both "group1" and "group2" consist of an array of filter variables. There are two kinds of filter variables: "Categorical" and "Numeric". "Categorical" variables are those variables which can have a fixed set of values e.g. gender, race. They are defined by the "CategoricalFilterTerm" which consists of "term" (a field from the sqlite3 db)  and "category" (a value of the field from the sqlite db).  "Numeric" variables are those which can have any numeric value. They are defined by "NumericFilterTerm" and contain  the subfields "term" (a field from the sqlite3 db), "start" an optional filter which is defined when a lower cutoff is defined in the user input for the numeric variable and "stop" an optional filter which is defined when a higher cutoff is defined in the user input for the numeric variable. ' +
			DE_ds.SystemPrompt +
			'The sqlite db in plain language is as follows:\n' +
			rag_docs.join(',') +
			' training data is as follows:' +
			training_data +
			' Question: {' +
			prompt +
			'} answer:'
		//mayLog("system_prompt:", system_prompt)

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
		return await validate_DE_response(response, ds)
	} else {
		return { type: 'html', html: 'Differential gene expression not supported for this dataset' }
	}
}

async function validate_DE_response(response: string, ds: any) {
	const response_type = JSON.parse(response)
	let html = ''
	let group1: any
	let samples1lst: any
	if (!response_type.group1) {
		html += 'group1 not present in DE output'
	} else {
		// Validate filter terms
		const validated_filters = validate_filter(response_type.group1, ds)
		if (validated_filters.html.length > 0) {
			html += validated_filters.html
		} else {
			const samples1 = await get_samples({ filter: validated_filters.simplefilter }, ds, true) // true is to bypass permission check
			samples1lst = samples1.map((item: any) => ({
				sampleId: item.id,
				sample: item.name
			}))
			//mayLog("response_type.name1:", response_type.name1)
			group1 = {
				name: 'group1', //response_type.name1, // For some prompts when the AI generated name is added, it throws a UI error
				in: true,
				values: samples1lst
			}
		}
	}
	let group2: any
	let samples2lst: any
	if (!response_type.group2) {
		html += 'group2 not present in DE output'
	} else {
		const validated_filters = validate_filter(response_type.group2, ds)
		if (validated_filters.html.length > 0) {
			html += validated_filters.html
		} else {
			const samples2 = await get_samples({ filter: validated_filters.simplefilter }, ds, true) // true is to bypass permission check
			samples2lst = samples2.map((item: any) => ({
				sampleId: item.id,
				sample: item.name
			}))
			//mayLog("response_type.name2:", response_type.name2)
			group2 = {
				name: 'group2', //response_type.name2, // For some prompts when the AI generated name is added, it throws a UI error
				in: true,
				values: samples2lst
			}
		}
	}
	if (html.length > 0) {
		return { type: 'html', html: html }
	} else {
		const pp_plot_json: any = { childType: 'volcano', termType: 'geneExpression', chartType: 'differentialAnalysis' }
		const groups = [group1, group2]
		const tw = {
			q: {
				groups
			},
			term: {
				name: response_type.name1 + ' vs ' + response_type.name2, // Hardcoding name of custom term here for now
				type: 'samplelst',
				values: {
					group1: {
						color: 'purple',
						key: response_type.name1,
						label: response_type.name1,
						list: samples1lst
					},
					group2: {
						color: 'blue',
						key: response_type.name2,
						label: response_type.name2,
						list: samples2lst
					}
				}
			}
		}
		pp_plot_json.state = {
			customTerms: [
				{
					name: response_type.name1 + ' vs ' + response_type.name2,
					tw: tw
				}
			],
			groups: groups
		}
		pp_plot_json.samplelst = { groups }
		pp_plot_json.tw = tw
		return { type: 'plot', plot: pp_plot_json }
	}
}

async function extract_summary_terms(
	prompt: string,
	llm_backend_type: string,
	comp_model_name: string,
	apilink: string,
	dataset_db: string,
	dataset_json: any,
	genedb: string,
	ds: any
) {
	const rag_docs = await parse_dataset_db(dataset_db)
	//mayLog('rag_docs:', rag_docs)
	const genes_list = await parse_geneset_db(genedb)
	//mayLog("genes_list:", genes_list)

	//const SchemaConfig = {
	//    path: path.resolve('#types'),
	//    // Path to your tsconfig (required for proper type resolution)
	//    tsconfig: path.resolve(serverconfig.binpath, '../tsconfig.json'),
	//    // Name of the exported type we want to convert
	//    type: 'SummaryType',
	//    // Only expose exported symbols (default)
	//    expose: 'export' as 'export' | 'all' | 'none' | undefined,
	//    // Put the whole schema under a top‑level $ref (optional but convenient)
	//    topRef: true,
	//    // Turn off type‑checking for speed (set to true if you want full checks)
	//    skipTypeCheck: true
	//}
	//const generator: SchemaGenerator = createGenerator(SchemaConfig)
	//const StringifiedSchema = JSON.stringify(generator.createSchema(SchemaConfig.type)) // This will be generated at server startup later
	//mayLog("StringifiedSchema:", StringifiedSchema)

	const StringifiedSchema =
		'{"$schema":"http://json-schema.org/draft-07/schema#","$ref":"#/definitions/SummaryType","definitions":{"SummaryType":{"type":"object","properties":{"term":{"type":"string"},"term2":{"type":"string"},"simpleFilter":{"type":"array","items":{"$ref":"#/definitions/FilterTerm"}}},"required":["term","simpleFilter"],"additionalProperties":false},"FilterTerm":{"anyOf":[{"$ref":"#/definitions/CategoricalFilterTerm"},{"$ref":"#/definitions/NumericFilterTerm"}]},"CategoricalFilterTerm":{"type":"object","properties":{"term":{"type":"string"},"category":{"type":"string"}},"required":["term","category"],"additionalProperties":false},"NumericFilterTerm":{"type":"object","properties":{"term":{"type":"string"},"start":{"type":"number"},"stop":{"type":"number"}},"required":["term"],"additionalProperties":false}}}' // Make sure if there is any change in SummaryType, update this JSON schema
	const words = prompt
		.replace(/[^a-zA-Z0-9\s]/g, '')
		.split(/\s+/)
		.map(str => str.toLowerCase()) // Keep only letters, numbers, and whitespace and then split on whitespace and convert to lowercase
	const common_genes = words.filter(item => genes_list.includes(item)) // The reason behind showing common genes that are actually present in the genedb is because otherwise showing ~20000 genes would increase the number of tokens significantly and may cause the LLM to loose context. Much easier to parse out relevant genes from the user prompt.

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
		' term and term2 (if present) should ONLY contain names of the fields from the sqlite db. The "simpleFilter" field is optional and should contain an array of JSON terms with which the dataset will be filtered. A variable simultaneously CANNOT be part of both "term"/"term2" and "simpleFilter". There are two kinds of filter variables: "Categorical" and "Numeric". "Categorical" variables are those variables which can have a fixed set of values e.g. gender, race. They are defined by the "CategoricalFilterTerm" which consists of "term" (a field from the sqlite3 db)  and "category" (a value of the field from the sqlite db).  "Numeric" variables are those which can have any numeric value. They are defined by "NumericFilterTerm" and contain  the subfields "term" (a field from the sqlite3 db), "start" an optional filter which is defined when a lower cutoff is defined in the user input for the numeric variable and "stop" an optional filter which is defined when a higher cutoff is defined in the user input for the numeric variable. ' +
		summary_ds.SystemPrompt +
		rag_docs.join(',') +
		' training data is as follows:' +
		training_data

	if (dataset_json.hasGeneExpression) {
		// If dataset has geneExpression data
		if (common_genes.length > 0) {
			system_prompt += '\n List of relevant genes are as follows (separated by comma(,)):' + common_genes.join(',')
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
	//mayLog('response:', JSON.parse(response))
	return validate_summary_response(response, common_genes, dataset_json, ds)
}

function validate_summary_response(response: string, common_genes: string[], dataset_json: any, ds: any) {
	const response_type = JSON.parse(response)
	const pp_plot_json: any = { chartType: 'summary' }
	let html = ''
	if (response_type.html) html = response_type.html
	if (!response_type.term) html += 'term type is not present in summary output'
	const term1_validation = validate_term(response_type.term, common_genes, dataset_json, ds)
	if (term1_validation.html.length > 0) {
		html += term1_validation.html
	} else {
		pp_plot_json.term = term1_validation.term_type
	}

	if (response_type.term2) {
		const term2_validation = validate_term(response_type.term2, common_genes, dataset_json, ds)
		if (term2_validation.html.length > 0) {
			html += term2_validation.html
		} else {
			pp_plot_json.term2 = term2_validation.term_type
		}
	}

	if (response_type.simpleFilter && response_type.simpleFilter.length > 0) {
		const validated_filters = validate_filter(response_type.simpleFilter, ds)
		if (validated_filters.html.length > 0) {
			html += validated_filters.html
		} else {
			pp_plot_json.filter = validated_filters.simplefilter
		}
	}

	if (html.length > 0) {
		return { type: 'html', html: html }
	} else {
		return { type: 'plot', plot: pp_plot_json }
	}
}

function validate_term(response_term: string, common_genes: string[], dataset_json: any, ds: any) {
	let html = ''
	let term_type: any
	const term: any = ds.cohort.termdb.q.termjsonByOneid(response_term)
	if (!term) {
		const gene_hits = common_genes.filter(gene => gene == response_term.toLowerCase())
		if (gene_hits.length == 0) {
			// Neither a clinical term nor a gene
			html += 'invalid term id:' + response_term
		} else {
			if (dataset_json.hasGeneExpression) {
				// Check to see if dataset support gene expression
				term_type = { term: { gene: response_term.toUpperCase(), type: 'geneExpression' } }
			} else {
				html += 'Dataset does not support gene expression'
			}
		}
	} else {
		term_type = { id: term.id }
	}
	return { term_type: term_type, html: html }
}

function validate_filter(filters: any, ds: any): any {
	if (!Array.isArray(filters)) throw 'filter is not array'
	let invalid_html = ''
	const localfilter = { type: 'tvslst', in: true, join: '', lst: [] as any[] }
	if (filters.length > 1) localfilter.join = 'and' // For now hardcoding join as 'and' if number of filter terms > 1. Will later implement more comprehensive logic
	for (const f of filters) {
		const term = ds.cohort.termdb.q.termjsonByOneid(f.term)
		if (!term) {
			invalid_html += 'invalid filter id:' + f.term
		} else {
			if (term.type == 'categorical') {
				let cat: any
				for (const ck in term.values) {
					if (ck == f.category) cat = ck
					else if (term.values[ck].label == f.category) cat = ck
				}
				if (!cat) invalid_html += 'invalid category from ' + JSON.stringify(f)
				// term and category validated
				localfilter.lst.push({
					type: 'tvs',
					tvs: {
						term,
						values: [{ key: cat }]
					}
				})
			} else if (term.type == 'float' || term.type == 'integer') {
				const numeric: any = {
					type: 'tvs',
					tvs: {
						term,
						ranges: []
					}
				}
				const range: any = {}
				if (f.start && !f.stop) {
					range.start = Number(f.start)
					range.stopunbounded = true
				} else if (f.stop && !f.start) {
					range.stop = Number(f.stop)
					range.startunbounded = true
				} else if (f.start && f.stop) {
					range.start = Number(f.start)
					range.stop = Number(f.stop)
				} else {
					invalid_html += 'Neither greater or lesser defined'
				}
				numeric.tvs.ranges.push(range)
				localfilter.lst.push(numeric)
			}
		}
	}
	return { simplefilter: localfilter, html: invalid_html }
}

async function parse_geneset_db(genedb: string) {
	let genes_list: string[] = []
	const db = new Database(genedb)
	try {
		// Query the database
		const desc_rows = db.prepare('SELECT name from codingGenes').all()
		desc_rows.forEach((row: any) => {
			genes_list.push(row.name)
		})
		genes_list = genes_list.map(str => str.toLowerCase()) // Converting to lowercase
	} catch (error) {
		throw 'Could not parse geneDB' + error
	} finally {
		db.close()
	}
	return genes_list
}

async function parse_dataset_db(dataset_db: string) {
	const db = new Database(dataset_db)
	const rag_docs: string[] = []
	try {
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
	} catch (error) {
		throw 'Error in parsing dataset DB:' + error
	} finally {
		db.close()
	}
	return rag_docs
}

function parse_db_rows(db_row: DbRows) {
	let output_string: string =
		'Name of the field is:"' +
		db_row.name +
		'". This field is of the type:' +
		db_row.term_type +
		'. Description: ' +
		db_row.description

	if (db_row.values.length > 0) {
		output_string += 'This field contains the following possible values.'
		for (const value of db_row.values) {
			if (value.value && value.value.label) {
				output_string += 'The key is "' + value.key + '" and the label is "' + value.value.label + '".'
			}
		}
	}
	return output_string
}
