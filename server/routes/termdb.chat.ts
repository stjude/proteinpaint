import fs from 'fs'
import { ezFetch } from '#shared'
import { get_samples } from '#src/termdb.sql.js'
//import { createGenerator } from 'ts-json-schema-generator'
//import type { SchemaGenerator } from 'ts-json-schema-generator'
//import path from 'path'
import type { ChatRequest, ChatResponse, LlmConfig, RouteApi, DbRows, DbValue, ClassificationType } from '#types'
import { ChatPayload } from '#types/checkers'
import serverconfig from '../src/serverconfig.js'
import { mayLog } from '#src/helpers.ts'
import Database from 'better-sqlite3'
import { formatElapsedTime } from '#shared'

const num_filter_cutoff = 3 // The maximum number of filter terms that can be entered and parsed using the chatbot

/** Shared JSON Schema definitions for filter terms, used by DE, Summary, and Matrix agents. */
const FILTER_TERM_DEFINITIONS = {
	FilterTerm: {
		anyOf: [{ $ref: '#/definitions/CategoricalFilterTerm' }, { $ref: '#/definitions/NumericFilterTerm' }]
	},
	CategoricalFilterTerm: {
		type: 'object',
		properties: {
			term: { type: 'string', description: 'Name of categorical term' },
			category: { type: 'string', description: 'The category of the term' },
			join: {
				type: 'string',
				enum: ['and', 'or'],
				description:
					'join term to be used only when there is more than one filter term and should be placed from the 2nd filter term onwards describing how it connects to the previous term'
			}
		},
		required: ['term', 'category'],
		additionalProperties: false
	},
	NumericFilterTerm: {
		type: 'object',
		properties: {
			term: { type: 'string', description: 'Name of numeric term' },
			start: { type: 'number', description: 'start position (or lower limit) of numeric term' },
			stop: { type: 'number', description: 'stop position (or upper limit) of numeric term' },
			join: {
				type: 'string',
				enum: ['and', 'or'],
				description:
					'join term to be used only when there is more than one filter term and should be placed from the 2nd filter term onwards describing how it connects to the previous term'
			}
		},
		required: ['term'],
		additionalProperties: false
	}
}

/** Format few-shot training examples into a prompt string. */
function formatTrainingExamples(trainingData: { question: string; answer: any }[]): string {
	return trainingData
		.map(
			(td, i) =>
				'Example question' +
				(i + 1).toString() +
				': ' +
				td.question +
				' Example answer' +
				(i + 1).toString() +
				':' +
				JSON.stringify(td.answer)
		)
		.join(' ')
}

/** Shared natural language description of filter term types for LLM prompts. */
const FILTER_DESCRIPTION =
	'There are two kinds of filter variables: "Categorical" and "Numeric". ' +
	'"Categorical" variables are those variables which can have a fixed set of values e.g. gender, race. ' +
	'They are defined by the "CategoricalFilterTerm" which consists of "term" (a field from the sqlite3 db) and "category" (a value of the field from the sqlite db). ' +
	'"Numeric" variables are those which can have any numeric value. ' +
	'They are defined by "NumericFilterTerm" and contain the subfields "term" (a field from the sqlite3 db), ' +
	'"start" an optional filter which is defined when a lower cutoff is defined in the user input for the numeric variable and ' +
	'"stop" an optional filter which is defined when a higher cutoff is defined in the user input for the numeric variable. '

/** Extract gene names from user prompt that exist in the gene database. */
function extractGenesFromPrompt(prompt: string, genes_list: string[]): string[] {
	const words = prompt
		.replace(/[^a-zA-Z0-9\s]/g, '')
		.split(/\s+/)
		.map(str => str.toLowerCase())
	return words.filter(item => genes_list.includes(item))
}

/**
 * Resolve the appropriate chart childType based on the data categories of term and term2,
 * and an optional user-requested override from the LLM output.
 *
 * Returns { childType } on success, or { error } if the user requested an invalid chart type.
 * Also returns { bothNumeric: true } when both terms are numeric so the caller can
 * apply discretization for violin/boxplot.
 */

type TermCategory = 'categorical' | 'float' | 'integer' | undefined

// Default chart type for each (normalized cat1, normalized cat2) combination
const CHILD_TYPE_DEFAULTS: Record<string, string> = {
	'categorical:undefined': 'barchart',
	'numeric:undefined': 'violin',
	'categorical:categorical': 'barchart',
	'numeric:categorical': 'violin',
	'categorical:numeric': 'violin',
	'numeric:numeric': 'sampleScatter'
}

// Overrides that are invalid (produce an error) for a given combination
const CHILD_TYPE_INVALID: Record<string, Set<string>> = {
	'categorical:undefined': new Set(['violin', 'boxplot', 'sampleScatter']),
	'categorical:categorical': new Set(['violin', 'boxplot', 'sampleScatter'])
}

function resolveChildType(
	cat1: TermCategory,
	cat2: TermCategory,
	llmChildType: string | undefined
): { childType?: string; error?: string; bothNumeric?: boolean } {
	const norm1 = cat1 == 'float' || cat1 == 'integer' ? 'numeric' : cat1 || 'undefined'
	const norm2 = cat2 == 'float' || cat2 == 'integer' ? 'numeric' : cat2 || 'undefined'
	const key = norm1 + ':' + norm2

	const defaultType = CHILD_TYPE_DEFAULTS[key]
	if (!defaultType) {
		// Unknown category combination — should not happen, fall back to barchart
		return { childType: 'barchart' }
	}
	const invalid = CHILD_TYPE_INVALID[key]

	if (llmChildType && invalid && invalid.has(llmChildType)) {
		return {
			error:
				'Invalid plot type supplied by the user: ' +
				llmChildType +
				'. For ' +
				key.replace(':', ' and ') +
				' variables the plot type should always be ' +
				defaultType
		}
	}

	return {
		childType: llmChildType || defaultType,
		bothNumeric: norm1 == 'numeric' && norm2 == 'numeric'
	}
}

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

			const llm = serverconfig.llm
			if (!llm) throw 'serverconfig.llm is not configured'
			if (llm.provider !== 'SJ' && llm.provider !== 'ollama') {
				throw "llm.provider must be 'SJ' or 'ollama'"
			}

			const dataset_db = serverconfig.tpmasterdir + '/' + ds.cohort.db.file
			const genedb = serverconfig.tpmasterdir + '/' + g.genedb.dbfile
			// Read dataset JSON file
			const dataset_json: any = await readJSONFile(serverconfig_ds_entries.aifiles)
			const testing = false // This toggles validation of LLM output. In this script, this will ALWAYS be false since we always want validation of LLM output, only for testing we this variable to true
			const ai_output_json = await run_chat_pipeline(
				q.prompt,
				llm,
				serverconfig.aiRoute,
				dataset_json,
				testing,
				dataset_db,
				genedb,
				ds
			)
			res.send(ai_output_json as ChatResponse)
		} catch (e: any) {
			if (e.stack) mayLog(e.stack)
			res.send({ error: e?.message || e })
		}
	}
}

export async function run_chat_pipeline(
	user_prompt: string,
	llm: LlmConfig,
	aiRoute: string,
	dataset_json: any,
	testing: boolean,
	dataset_db: string,
	genedb: string,
	ds: any
) {
	const time1 = new Date().valueOf()
	const class_response: ClassificationType = await classify_query_by_dataset_type(
		user_prompt,
		llm,
		aiRoute,
		dataset_json,
		testing
	)
	let ai_output_json: any
	mayLog('Time taken for classification:', formatElapsedTime(Date.now() - time1))
	if (class_response.type == 'html') {
		ai_output_json = class_response
	} else if (class_response.type == 'plot') {
		const classResult = class_response.plot
		mayLog('classResult:', classResult)
		// Parse DBs once and pass to whichever agent runs
		const dataset_db_output = await parse_dataset_db(dataset_db)
		const genes_list = dataset_json.hasGeneExpression ? await parse_geneset_db(genedb) : []
		if (classResult == 'summary') {
			const time1 = new Date().valueOf()
			ai_output_json = await extract_summary_terms(
				user_prompt,
				llm,
				dataset_db_output,
				dataset_json,
				genes_list,
				ds,
				testing
			)
			mayLog('Time taken for summary agent:', formatElapsedTime(Date.now() - time1))
		} else if (classResult == 'dge') {
			const time1 = new Date().valueOf()
			ai_output_json = await extract_DE_search_terms_from_query(
				user_prompt,
				llm,
				dataset_db_output,
				dataset_json,
				ds,
				testing
			)
			mayLog('Time taken for DE agent:', formatElapsedTime(Date.now() - time1))
		} else if (classResult == 'survival') {
			ai_output_json = { type: 'html', html: 'survival agent has not been implemented yet' }
		} else if (classResult == 'matrix') {
			const time1 = new Date().valueOf()
			ai_output_json = await extract_matrix_search_terms_from_query(
				user_prompt,
				llm,
				dataset_db_output,
				dataset_json,
				genes_list,
				ds,
				testing
			)
			mayLog('Time taken for matrix agent:', formatElapsedTime(Date.now() - time1))
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
	return ai_output_json
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

async function route_to_appropriate_llm_provider(template: string, llm: LlmConfig): Promise<string> {
	let response: string
	if (llm.provider == 'SJ') {
		// Local SJ server
		response = await call_sj_llm(template, llm.modelName, llm.api)
	} else if (llm.provider == 'ollama') {
		// Ollama server
		response = await call_ollama(template, llm.modelName, llm.api)
	} else {
		// Will later add support for azure server also
		throw 'Unknown LLM provider'
	}
	return response
}

function checkField(sentence: string) {
	if (!sentence) return ''
	else return sentence
}

export async function readJSONFile(file: string) {
	const json_file = await fs.promises.readFile(file)
	return JSON.parse(json_file.toString())
}

async function classify_query_by_dataset_type(
	user_prompt: string,
	llm: LlmConfig,
	aiRoute: string,
	dataset_json: any,
	testing: boolean
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
	const classification_ds = dataset_json.charts.find((chart: any) => chart.type == 'Classification')
	if (!classification_ds) throw 'Classification information is not present in the dataset file.'
	if (classification_ds.TrainingData.length == 0) throw 'No training data is provided for the classification agent.'
	let training_data = ''
	if (classification_ds && classification_ds.TrainingData.length > 0) {
		contents += checkField(dataset_json.DatasetPrompt) + checkField(classification_ds.SystemPrompt)
		training_data = formatTrainingExamples(classification_ds.TrainingData)
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
	//const Schema = JSON.stringify(generator.createSchema(SchemaConfig.type)) // This will be generated at server startup later
	//mayLog("ClassificationType StringifiedSchema:", Schema)

	const template =
		contents + ' training data is as follows:' + training_data + ' Question: {' + user_prompt + '} Answer: {answer}'

	const response: string = await route_to_appropriate_llm_provider(template, llm)
	if (testing) {
		return { action: 'html', response: JSON.parse(response) }
	} else {
		return JSON.parse(response)
	}
}

async function extract_DE_search_terms_from_query(
	prompt: string,
	llm: LlmConfig,
	dataset_db_output: { db_rows: DbRows[]; rag_docs: string[] },
	dataset_json: any,
	ds: any,
	testing: boolean
) {
	if (dataset_json.hasDE) {
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
		//const Schema = generator.createSchema(SchemaConfig.type) // This commented out code generates the JSON schema below
		const Schema = {
			$schema: 'http://json-schema.org/draft-07/schema#',
			$ref: '#/definitions/DEType',
			definitions: {
				DEType: {
					type: 'object',
					properties: {
						group1: {
							type: 'array',
							items: { $ref: '#/definitions/FilterTerm' },
							description: 'Name of group1 which is an array of filter terms'
						},
						group2: {
							type: 'array',
							items: { $ref: '#/definitions/FilterTerm' },
							description: 'Name of group2 which is an array of filter terms'
						},
						method: {
							type: 'string',
							enum: ['edgeR', 'limma', 'wilcoxon'],
							description: 'Method used for carrying out differential gene expression analysis'
						}
					},
					required: ['group1', 'group2'],
					additionalProperties: false
				},
				...FILTER_TERM_DEFINITIONS
			}
		} // This JSON schema is generated by ts-json-schema-generator. When DEType is updated, please update this schema by uncommenting the above code and running it locally
		//mayLog('DEType Schema:', JSON.stringify(Schema))

		// Parse out training data from the dataset JSON and add it to a string
		const DE_ds = dataset_json.charts.find((chart: any) => chart.type == 'DE')
		if (!DE_ds) throw 'DE information is not present in the dataset file.'
		if (DE_ds.TrainingData.length == 0) throw 'No training data is provided for the DE agent.'

		const training_data = formatTrainingExamples(DE_ds.TrainingData)

		const system_prompt =
			'I am an assistant that extracts the groups from the user prompt to carry out differential gene expression. The final output must be in the following JSON with NO extra comments. The schema is as follows: ' +
			JSON.stringify(Schema) +
			' . "group1" and "group2" fields are compulsory. Both "group1" and "group2" consist of an array of filter variables. ' +
			FILTER_DESCRIPTION +
			checkField(dataset_json.DatasetPrompt) +
			checkField(DE_ds.SystemPrompt) +
			'The sqlite db in plain language is as follows:\n' +
			dataset_db_output.rag_docs.join(',') +
			' training data is as follows:' +
			training_data +
			' Question: {' +
			prompt +
			'} answer:'

		const response: string = await route_to_appropriate_llm_provider(system_prompt, llm)
		if (testing) {
			// When testing, send raw LLM response
			return { action: 'dge', response: JSON.parse(response) }
		} else {
			// In actual production (inside PP) send LLM output for validation
			return await validate_DE_response(response, ds, dataset_db_output.db_rows)
		}
	} else {
		return { type: 'html', html: 'Differential gene expression not supported for this dataset' }
	}
}

async function validate_DE_response(response: string, ds: any, db_rows: DbRows[]) {
	const response_type = JSON.parse(response)
	let html = ''
	let group1: any
	let samples1lst: any
	const name1 = generate_group_name(response_type.group1, db_rows)
	if (!response_type.group1) {
		html += 'group1 not present in DE output'
	} else {
		// Validate filter terms
		const validated_filters = validate_filter(response_type.group1, ds, name1)
		if (validated_filters.html.length > 0) {
			html += validated_filters.html
		} else {
			const samples1 = await get_samples({ filter: validated_filters.simplefilter }, ds, true) // true is to bypass permission check
			samples1lst = samples1.map((item: any) => ({
				sampleId: item.id,
				sample: item.name
			}))
			group1 = {
				name: name1,
				in: true,
				values: samples1lst
			}
		}
	}
	let group2: any
	let samples2lst: any
	const name2 = generate_group_name(response_type.group2, db_rows)
	if (!response_type.group2) {
		html += 'group2 not present in DE output'
	} else {
		const validated_filters = validate_filter(response_type.group2, ds, name2)
		if (validated_filters.html.length > 0) {
			html += validated_filters.html
		} else {
			const samples2 = await get_samples({ filter: validated_filters.simplefilter }, ds, true) // true is to bypass permission check
			samples2lst = samples2.map((item: any) => ({
				sampleId: item.id,
				sample: item.name
			}))
			group2 = {
				name: name2,
				in: true,
				values: samples2lst
			}
		}
	}

	// Parse DE method from LLM output
	let settings: any
	if (response_type.method) {
		if (response_type.method == 'edgeR' || response_type.method == 'limma' || response_type.method == 'wilcoxon') {
			settings = { volcano: { method: response_type.method } }
		} else {
			html += 'Unknown DE method: ' + response_type.method
		}
	}

	if (html.length > 0) {
		html = removeLastOccurrence(
			html,
			'For now, the maximum number of filter terms supported through the chatbot is ' + num_filter_cutoff // Remove duplicated statements in error message
		)
		return { type: 'html', html: html }
	} else {
		const pp_plot_json: any = { childType: 'volcano', termType: 'geneExpression', chartType: 'differentialAnalysis' }
		const groups = [group1, group2]
		const tw = {
			q: {
				groups
			},
			term: {
				name: name1 + ' vs ' + name2,
				type: 'samplelst',
				values: {
					[name1]: {
						color: 'purple',
						key: name1,
						label: name1,
						list: samples1lst
					},
					[name2]: {
						color: 'blue',
						key: name2,
						label: name2,
						list: samples2lst
					}
				}
			}
		}
		pp_plot_json.state = {
			customTerms: [
				{
					name: name1 + ' vs ' + name2,
					tw: tw
				}
			],
			groups: groups
		}
		pp_plot_json.samplelst = { groups }
		pp_plot_json.tw = tw
		pp_plot_json.settings = settings
		return { type: 'plot', plot: pp_plot_json }
	}
}

function generate_group_name(filters: any[], db_rows: DbRows[]): string {
	let name = ''
	let iter = 0
	for (const filter of filters) {
		if (iter > 0 && !filter.join) {
			// Sometimes the LLM misses join terms. In such cases, hardcoding & operator
			name += '&'
		}
		if (filter.join && filter.join == 'and') {
			name += '&'
		}
		if (filter.join && filter.join == 'or') {
			name += '|'
		}
		if (filter.category) {
			// Categorical variable
			name += find_label(filter, db_rows)
		}
		if (filter.start) {
			// Integer or float variable
			name += filter.term + '>=' + filter.start.toString()
		}
		if (filter.stop) {
			// Integer or float variable
			name += filter.term + '<=' + filter.stop.toString()
		}
		iter += 1
	}
	return name
}

function find_label(filter: any, db_rows: DbRows[]): string {
	let label = ''
	for (const row of db_rows) {
		if (row.name == filter.term) {
			for (const value of row.values) {
				if (value.value && value.value.label && filter.category == value.key) {
					label = value.value.label
					break
				}
			}
			break
		}
	}
	return label
}

async function extract_summary_terms(
	prompt: string,
	llm: LlmConfig,
	dataset_db_output: { db_rows: DbRows[]; rag_docs: string[] },
	dataset_json: any,
	genes_list: string[],
	ds: any,
	testing: boolean
) {
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
	//const Schema = JSON.stringify(generator.createSchema(SchemaConfig.type)) // This will be generated at server startup later
	const Schema = {
		$schema: 'http://json-schema.org/draft-07/schema#',
		$ref: '#/definitions/SummaryType',
		definitions: {
			SummaryType: {
				type: 'object',
				properties: {
					term: { type: 'string', description: 'Name of 1st term' },
					term2: { type: 'string', description: 'Name of 2nd term' },
					simpleFilter: {
						type: 'array',
						items: { $ref: '#/definitions/FilterTerm' },
						description: 'Optional simple filter terms'
					},
					childType: {
						type: 'string',
						enum: ['violin', 'boxplot', 'sampleScatter', 'barchart'],
						description:
							'Optional explicit child type requested by the user. If omitted, the logic of the data types picks the child type.'
					}
				},
				required: ['term', 'simpleFilter'],
				additionalProperties: false
			},
			...FILTER_TERM_DEFINITIONS
		}
	} // This JSON schema is generated by ts-json-schema-generator. When SummaryType is updated, please update this schema by uncommenting the above code and running it locally

	const common_genes = extractGenesFromPrompt(prompt, genes_list)

	// Parse out training data from the dataset JSON and add it to a string
	const summary_ds = dataset_json.charts.find((chart: any) => chart.type == 'Summary')
	if (!summary_ds) throw 'Summary information is not present in the dataset file.'
	if (summary_ds.TrainingData.length == 0) throw 'No training data is provided for the summary agent.'

	const training_data = formatTrainingExamples(summary_ds.TrainingData)

	let system_prompt =
		'I am an assistant that extracts the summary terms from user query. The final output must be in the following JSON format with NO extra comments. The JSON schema is as follows: ' +
		JSON.stringify(Schema) +
		' term and term2 (if present) should ONLY contain names of the fields from the sqlite db. The "simpleFilter" field is optional and should contain an array of JSON terms with which the dataset will be filtered. ' +
		FILTER_DESCRIPTION +
		checkField(dataset_json.DatasetPrompt) +
		checkField(summary_ds.SystemPrompt) +
		'\n The DB content is as follows: ' +
		dataset_db_output.rag_docs.join(',') +
		' training data is as follows:' +
		training_data

	if (dataset_json.hasGeneExpression) {
		// If dataset has geneExpression data
		if (common_genes.length > 0) {
			system_prompt += '\n List of relevant genes are as follows (separated by comma(,)):' + common_genes.join(',')
		}
	}

	system_prompt += ' Question: {' + prompt + '} answer:'

	const response: string = await route_to_appropriate_llm_provider(system_prompt, llm)
	if (testing) {
		// When testing, send raw LLM response
		return { action: 'summary', response: JSON.parse(response) }
	} else {
		// In actual production (inside PP) send LLM output for validation
		return validate_summary_response(response, common_genes, dataset_json, ds)
	}
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
		if (term1_validation.category == 'float' || term1_validation.category == 'integer') {
			pp_plot_json.term.q = { mode: 'continuous' }
		}
		pp_plot_json.category = term1_validation.category
	}

	if (response_type.term2) {
		const term2_validation = validate_term(response_type.term2, common_genes, dataset_json, ds)
		if (term2_validation.html.length > 0) {
			html += term2_validation.html
		} else {
			pp_plot_json.term2 = term2_validation.term_type
			if (term2_validation.category == 'float' || term2_validation.category == 'integer') {
				pp_plot_json.term2.q = { mode: 'continuous' }
			}
			pp_plot_json.category2 = term2_validation.category
		}
	}

	/** Based on data types of term and term2, decide the most appropriate chart type.
	 *  The user can override the default by explicitly mentioning a chart type in their prompt,
	 *  which the LLM parses into the "childType" field. Invalid overrides produce an error. */
	const llmChildType =
		response_type.childType && ['violin', 'boxplot', 'sampleScatter', 'barchart'].includes(response_type.childType)
			? response_type.childType
			: undefined
	const resolved = resolveChildType(pp_plot_json.category, pp_plot_json.category2, llmChildType)
	if (resolved.error) {
		html += resolved.error
	} else {
		pp_plot_json.childType = resolved.childType
		// For two numeric variables displayed as violin/boxplot, discretize term2
		if (resolved.bothNumeric && (resolved.childType == 'violin' || resolved.childType == 'boxplot')) {
			pp_plot_json.term2.q = { mode: 'discrete' }
		}
	}

	delete pp_plot_json.category
	if (pp_plot_json.category2) delete pp_plot_json.category2

	if (response_type.simpleFilter && response_type.simpleFilter.length > 0) {
		const validated_filters = validate_filter(response_type.simpleFilter, ds, '')
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

async function extract_matrix_search_terms_from_query(
	prompt: string,
	llm: LlmConfig,
	dataset_db_output: { db_rows: DbRows[]; rag_docs: string[] },
	dataset_json: any,
	genes_list: string[],
	ds: any,
	testing: boolean
) {
	const Schema = {
		$schema: 'http://json-schema.org/draft-07/schema#',
		$ref: '#/definitions/MatrixType',
		definitions: {
			MatrixType: {
				type: 'object',
				properties: {
					terms: {
						type: 'array',
						items: { type: 'string' },
						description: 'Names of dictionary/clinical terms to include as rows in the matrix'
					},
					geneNames: {
						type: 'array',
						items: { type: 'string' },
						description: 'Names of genes to include as gene variant rows in the matrix'
					},
					simpleFilter: {
						type: 'array',
						items: { $ref: '#/definitions/FilterTerm' },
						description: 'Optional simple filter terms to restrict the sample set'
					}
				},
				additionalProperties: false
			},
			...FILTER_TERM_DEFINITIONS
		}
	}

	const common_genes = extractGenesFromPrompt(prompt, genes_list)

	// Parse out training data from the dataset JSON
	const matrix_ds = dataset_json.charts.filter((chart: any) => chart.type == 'Matrix')
	console.log('matrix_ds', matrix_ds)
	console.log('dataset_json.charts', dataset_json.charts)
	if (matrix_ds.length == 0) throw 'Matrix information is not present in the dataset file.'
	if (matrix_ds[0].TrainingData.length == 0) throw 'No training data is provided for the matrix agent.'

	const training_data = formatTrainingExamples(matrix_ds[0].TrainingData)

	let system_prompt =
		'I am an assistant that extracts terms and gene names from the user query to create a matrix plot. A matrix plot displays multiple genes and/or clinical variables across samples in a grid layout. The final output must be in the following JSON format with NO extra comments. The JSON schema is as follows: ' +
		JSON.stringify(Schema) +
		' The "terms" field should ONLY contain names of clinical/dictionary fields from the sqlite db. The "geneNames" field should ONLY contain gene names. At least one of "terms" or "geneNames" must be provided. The "simpleFilter" field is optional and should contain an array of JSON terms with which the dataset will be filtered. ' +
		FILTER_DESCRIPTION +
		checkField(dataset_json.DatasetPrompt) +
		checkField(matrix_ds[0].SystemPrompt) +
		'\n The DB content is as follows: ' +
		dataset_db_output.rag_docs.join(',') +
		' training data is as follows:' +
		training_data

	if (dataset_json.hasGeneExpression && common_genes.length > 0) {
		system_prompt += '\n List of relevant genes are as follows (separated by comma(,)):' + common_genes.join(',')
	}

	system_prompt += ' Question: {' + prompt + '} answer:'

	const response: string = await route_to_appropriate_llm_provider(system_prompt, llm)
	if (testing) {
		return { action: 'matrix', response: JSON.parse(response) }
	} else {
		return validate_matrix_response(response, common_genes, dataset_json, ds)
	}
}

function validate_matrix_response(response: string, common_genes: string[], dataset_json: any, ds: any) {
	const response_type = JSON.parse(response)
	const pp_plot_json: any = { chartType: 'matrix' }
	let html = ''

	if (response_type.html) html = response_type.html

	// Must have at least one of terms or geneNames
	if (
		(!response_type.terms || response_type.terms.length == 0) &&
		(!response_type.geneNames || response_type.geneNames.length == 0)
	) {
		html += 'At least one clinical term or gene name is required for a matrix plot'
	}

	// Validate dictionary terms — use shorthand { id } at tw top level
	const twLst: any[] = []
	if (response_type.terms && Array.isArray(response_type.terms)) {
		for (const t of response_type.terms) {
			const term: any = ds.cohort.termdb.q.termjsonByOneid(t)
			if (!term) {
				html += 'invalid term id:' + t + ' '
			} else {
				twLst.push({ id: term.id })
			}
		}
	}

	// Validate gene names — use geneExpression type for datasets with expression data,
	// fall back to geneVariant for datasets with mutation data
	if (response_type.geneNames && Array.isArray(response_type.geneNames)) {
		for (const g of response_type.geneNames) {
			const gene_hits = common_genes.filter(gene => gene == g.toLowerCase())
			if (gene_hits.length == 0) {
				html += 'invalid gene name:' + g + ' '
			} else {
				const geneName = g.toUpperCase()
				if (dataset_json.hasGeneExpression) {
					twLst.push({ term: { gene: geneName, type: 'geneExpression' } })
				} else {
					twLst.push({ term: { gene: geneName, name: geneName, type: 'geneVariant' } })
				}
			}
		}
	}

	// Validate filters
	if (response_type.simpleFilter && response_type.simpleFilter.length > 0) {
		const validated_filters = validate_filter(response_type.simpleFilter, ds, '')
		if (validated_filters.html.length > 0) {
			html += validated_filters.html
		} else {
			pp_plot_json.filter = validated_filters.simplefilter
		}
	}

	if (html.length > 0) {
		return { type: 'html', html: html }
	} else {
		// Structure as termgroups matching what matrix.js expects:
		// termgroups: [{ name: '', lst: [ { term: {...} }, ... ] }]
		pp_plot_json.termgroups = [{ name: '', lst: twLst }]
		return { type: 'plot', plot: pp_plot_json }
	}
}

function validate_term(response_term: string, common_genes: string[], dataset_json: any, ds: any) {
	let html = ''
	let term_type: any
	let category: string = ''
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
				category = 'float'
			} else {
				html += 'Dataset does not support gene expression'
			}
		}
	} else {
		term_type = { id: term.id }
		category = term.type
	}
	return { term_type: term_type, html: html, category: category }
}

function countOccurrences(str: string, word: string): number {
	if (word === '') return 0 // avoid infinite loops
	let count = 0
	let pos = 0

	while ((pos = str.indexOf(word, pos)) !== -1) {
		count++
		pos += word.length // move past this match
	}
	return count
}

function removeLastOccurrence(str: string, word: string): string {
	const index = str.lastIndexOf(word)
	if (index === -1) return str // word not found

	const occurrences = countOccurrences(str, word)
	if (occurrences === 1) {
		return str
	} else {
		// Slice out the word and concatenate the surrounding parts
		return str.slice(0, index) + str.slice(index + word.length)
	}
}

function validate_filter(filters: any[], ds: any, group_name: string): any {
	if (!Array.isArray(filters)) throw 'filter is not array'

	let filter_result: any = { html: '' }
	if (filters.length <= 2) {
		// If number of filter terms <=2 then simply a single iteration of generate_filter_term() is sufficient
		filter_result = generate_filter_term(filters, ds)
	} else {
		if (filters.length > num_filter_cutoff) {
			filter_result.html =
				'For now, the maximum number of filter terms supported through the chatbot is ' + num_filter_cutoff
			if (group_name.length > 0) {
				// Group name is blank for summary filter, this is case for groups
				filter_result.html += ' . The number of filter terms for group ' + group_name + ' is ' + filters.length + '\n' // Added temporary logic to restrict the number of filter terms to num_filter_cutoff.
			} else {
				// For summary filter prompts which do not have a group
				filter_result.html += 'The number of filter terms for this query is ' + filters.length
			}
		} else {
			// When number of filter terms is greater than 2, then in each iteration the first two terms are taken and a filter object is created which is passed in the following iteration as a filter term
			for (let i = 0; i < filters.length - 1; i++) {
				const filter_lst = [] as any[]
				if (i == 0) {
					filter_lst.push(filters[i])
				} else {
					filter_lst.push(filter_result.simplefilter)
				}
				filter_lst.push(filters[i + 1])
				filter_result = generate_filter_term(filter_lst, ds)
			}
		}
	}
	return { simplefilter: filter_result.simplefilter, html: filter_result.html }
}

function generate_filter_term(filters: any, ds: any) {
	let invalid_html = ''
	const localfilter: any = { type: 'tvslst', in: true, lst: [] as any[] }
	for (const f of filters) {
		if (f.type == 'tvslst') {
			localfilter.lst.push(f)
		} else {
			const term = ds.cohort.termdb.q.termjsonByOneid(f.term)
			if (!term) {
				invalid_html += 'invalid filter id:' + f.term
			} else {
				if (f.join) {
					localfilter.join = f.join
				}
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
	}
	if (filters.length > 1 && !localfilter.join) {
		localfilter.join = 'and' // Hardcoding and when the LLM is not able to detect the connection
		//invalid_html += 'Connection (and/or) between the filter terms is not clear, please try to rephrase your question'
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
	const db_rows: DbRows[] = []
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
	return { db_rows: db_rows, rag_docs: rag_docs }
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
