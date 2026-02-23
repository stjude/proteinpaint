//import { createGenerator } from 'ts-json-schema-generator'
//import type { SchemaGenerator } from 'ts-json-schema-generator'
//import path from 'path'
import type { ChatRequest, ChatResponse, LlmConfig, RouteApi, DbRows, DbValue, ClassificationType } from '#types'
import { ChatPayload } from '#types/checkers'
import { classifyQuery } from './chat/classify.ts'
import { readJSONFile } from './chat/utils.ts'
import { extract_DE_search_terms_from_query } from './chat/DEagent.ts'
import { extractResourceResponse } from './chat/resource.ts'
import serverconfig from '../src/serverconfig.js'
import { mayLog } from '#src/helpers.ts'
import Database from 'better-sqlite3'
import { formatElapsedTime } from '#shared'

/**
 * Linguistic patterns indicating a follow-up modification to an existing chart.
 * Only checked when activePlotConfig is present in the request.
 * Conservative by design — only fire on clear references to the current chart.
 */
const FOLLOWUP_PATTERNS: RegExp[] = [
	/\b(this|the) (chart|plot|graph|figure|visualization|scatter|heatmap|matrix|volcano)\b/i,
	/\b(change|update|modify|adjust|edit) (it|this|the (chart|plot|graph))\b/i,
	/\bmake (it|this|the (chart|plot))\b/i,
	/\bfilter (it|this)\b/i,
	/\bnow (filter|color|colour|show|highlight|add|change|update|use)\b/i,
	/\b(instead|rather than)\b/i,
	/\b(also show|also include|add to (this|it|the (chart|plot)))\b/i,
	/\b(color|colour) (it|this|by)\b/i,
	/\boverlay (it|this|on (the|this) (chart|plot))\b/i
]

/**
 * Resolve the appropriate chart childType based on the data categories of term and term2,
 * and an optional user-requested override from the LLM output.
 *
 * Returns { childType } on success, or { error } if the user requested an invalid chart type.
 * Also returns { bothNumeric: true } when both terms are numeric so the caller can
 * apply discretization for violin/boxplot.
 */

export const api: RouteApi = {
	endpoint: 'termdb/chat2',
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
				ds,
				q.activePlotId,
				q.activePlotConfig
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
	ds: any,
	activePlotId?: string,
	activePlotConfig?: Record<string, any>
) {
	const time1 = new Date().valueOf()

	// Parse the dataset DB upfront to extract categorical term values (e.g. molecular
	// subtype names). These are passed to the classifier so they aren't mistaken for
	// gene names in multi-gene detection, making the classifier dataset-agnostic.
	const dataset_db_output = await parse_dataset_db(dataset_db)

	// Follow-up detection: if the user has an active plot and the query references it,
	// skip the classifier and modify the existing chart directly.
	if (activePlotId && activePlotConfig && FOLLOWUP_PATTERNS.some(p => p.test(user_prompt))) {
		mayLog(`Follow-up detected for plot ${activePlotId} (chartType: ${activePlotConfig.chartType})`)
		const time2 = new Date().valueOf()
		const genes_list = dataset_json.hasGeneExpression ? await parse_geneset_db(genedb) : []
		const followup_result = await handle_followup(
			user_prompt,
			activePlotId,
			activePlotConfig,
			llm,
			dataset_db_output,
			dataset_json,
			genes_list,
			ds,
			testing
		)
		if (followup_result) {
			mayLog('Time taken for follow-up agent:', formatElapsedTime(Date.now() - time2))
			return followup_result
		}
		mayLog('Follow-up handler returned null, falling through to normal pipeline')
	}
	const datasetNoise = new Set(
		dataset_db_output.db_rows
			.filter(row => row.term_type === 'categorical')
			.flatMap(row => row.values.map(v => v.key.toUpperCase()))
	)

	const class_response: ClassificationType = await classifyQuery(user_prompt, llm, datasetNoise, dataset_json)
	let ai_output_json: any
	mayLog('Time taken for classification:', formatElapsedTime(Date.now() - time1))
	if (class_response.type == 'html') {
		ai_output_json = class_response
	} else if (class_response.type == 'plot') {
		const classResult = class_response.plot
		mayLog('classResult:', classResult)
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
		} else if (classResult == 'resource') {
			const time1 = new Date().valueOf()
			ai_output_json = await extractResourceResponse(user_prompt, llm, dataset_json)
			mayLog('Time taken for resource agent:', formatElapsedTime(Date.now() - time1))
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
		} else if (classResult == 'sampleScatter') {
			const time1 = new Date().valueOf()
			ai_output_json = await extract_samplescatter_terms_from_query(
				user_prompt,
				llm,
				dataset_db_output,
				dataset_json,
				genes_list,
				ds,
				testing
			)
			mayLog('Time taken for sampleScatter agent:', formatElapsedTime(Date.now() - time1))
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

/** Produces a short human-readable description of a plot config for injecting into follow-up prompts. */
function describeConfig(config: any): string {
	const parts: string[] = []
	if (config.name) parts.push(`"${config.name}"`)
	if (config.term?.id) parts.push(`x: ${config.term.id}`)
	if (config.term2?.id) parts.push(`y: ${config.term2.id}`)
	if (config.colorTW?.term?.id) parts.push(`color: ${config.colorTW.term.id}`)
	if (config.shapeTW?.term?.id) parts.push(`shape: ${config.shapeTW.term.id}`)
	if (config.term0?.term?.id) parts.push(`divide: ${config.term0.term.id}`)
	return parts.join(', ') || config.chartType || 'unknown'
}

/**
 * Handle a follow-up modification to an existing chart.
 * Augments the user prompt with the current config context and re-runs the
 * appropriate agent, then returns a plot_edit response to update in place.
 * Returns null if the chart type is unrecognised, falling through to normal pipeline.
 */
async function handle_followup(
	user_prompt: string,
	activePlotId: string,
	activePlotConfig: Record<string, any>,
	llm: LlmConfig,
	dataset_db_output: { db_rows: DbRows[]; rag_docs: string[] },
	dataset_json: any,
	genes_list: string[],
	ds: any,
	testing: boolean
): Promise<{ type: 'plot_edit'; plotId: string; plot: object } | null> {
	const chartType: string = activePlotConfig.chartType ?? ''
	const description = describeConfig(activePlotConfig)
	const augmented_prompt = `Modify the existing ${chartType} chart (${description}) to: ${user_prompt}`
	mayLog(`Follow-up augmented prompt: "${augmented_prompt}"`)

	const SUMMARY_TYPES = new Set(['summary', 'violin', 'barchart', 'boxplot'])

	let plot: object | null = null
	if (SUMMARY_TYPES.has(chartType)) {
		plot = await extract_summary_terms(augmented_prompt, llm, dataset_db_output, dataset_json, genes_list, ds, testing)
	} else if (chartType === 'dge') {
		plot = await extract_DE_search_terms_from_query(augmented_prompt, llm, dataset_db_output, dataset_json, ds, testing)
	} else if (chartType === 'matrix') {
		plot = await extract_matrix_search_terms_from_query(
			augmented_prompt,
			llm,
			dataset_db_output,
			dataset_json,
			genes_list,
			ds,
			testing
		)
	} else if (chartType === 'sampleScatter') {
		plot = await extract_samplescatter_terms_from_query(
			augmented_prompt,
			llm,
			dataset_db_output,
			dataset_json,
			genes_list,
			ds,
			testing
		)
	} else {
		return null
	}

	if (!plot) return null
	return { type: 'plot_edit', plotId: activePlotId, plot }
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
		return { action: 'matrix', response: safeParseLlmJson(response) }
	} else {
		return validate_matrix_response(response, common_genes, dataset_json, ds)
	}
}

function validate_matrix_response(response: string, common_genes: string[], dataset_json: any, ds: any) {
	const response_type = safeParseLlmJson(response)
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

async function extract_samplescatter_terms_from_query(
	prompt: string,
	llm: LlmConfig,
	dataset_db_output: { db_rows: DbRows[]; rag_docs: string[] },
	dataset_json: any,
	genes_list: string[],
	ds: any,
	testing: boolean
) {
	if (!dataset_json.prebuiltPlots || dataset_json.prebuiltPlots.length == 0) {
		return { type: 'html', html: 'No pre-built scatter plots (t-SNE/UMAP) are available for this dataset' }
	}

	const Schema = {
		$schema: 'http://json-schema.org/draft-07/schema#',
		$ref: '#/definitions/SampleScatterType',
		definitions: {
			SampleScatterType: {
				type: 'object',
				properties: {
					plotName: {
						type: 'string',
						description: 'Name of the pre-built scatter plot to display'
					},
					colorTW: {
						type: ['string', 'null'],
						description:
							'Term name or gene name to overlay as color on the scatter plot. Set to null to remove the color overlay.'
					},
					shapeTW: {
						type: ['string', 'null'],
						description:
							'Term name or gene name to overlay as shape on the scatter plot. Set to null to remove the shape overlay.'
					},
					term0: {
						type: ['string', 'null'],
						description:
							'Term name to use for Z/Divide which splits the plot into panels. Set to null to remove the divide overlay.'
					},
					simpleFilter: {
						type: 'array',
						items: { $ref: '#/definitions/FilterTerm' },
						description: 'Optional simple filter terms to restrict the sample set'
					}
				},
				required: ['plotName'],
				additionalProperties: false
			},
			...FILTER_TERM_DEFINITIONS
		}
	}

	const common_genes = extractGenesFromPrompt(prompt, genes_list)

	// Parse out training data from the dataset JSON
	const scatter_ds = dataset_json.charts.find((chart: any) => chart.type == 'sampleScatter')
	if (!scatter_ds) throw 'sampleScatter information is not present in the dataset file.'
	if (scatter_ds.TrainingData.length == 0) throw 'No training data is provided for the sampleScatter agent.'

	const training_data = formatTrainingExamples(scatter_ds.TrainingData)

	const plotNames = dataset_json.prebuiltPlots.map((p: any) => p.name).join(', ')

	let system_prompt =
		'I am an assistant that extracts overlay parameters for pre-built scatter plots (t-SNE/UMAP). The final output must be in the following JSON format with NO extra comments. The JSON schema is as follows: ' +
		JSON.stringify(Schema) +
		' The available pre-built plots are: ' +
		plotNames +
		'. The "plotName" field must match one of these exactly. ' +
		'The "colorTW", "shapeTW", and "term0" fields should contain names of clinical fields from the sqlite db OR gene names. ' +
		'To remove an overlay, set the corresponding field to null explicitly. If the user does not mention a particular overlay, do NOT include that field in the output (omit it entirely). ' +
		'Only include "colorTW", "shapeTW", or "term0" if the user explicitly mentions coloring, shaping, or dividing. ' +
		FILTER_DESCRIPTION +
		checkField(dataset_json.DatasetPrompt) +
		checkField(scatter_ds.SystemPrompt) +
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
		return { action: 'sampleScatter', response: safeParseLlmJson(response) }
	} else {
		return validate_samplescatter_response(response, common_genes, dataset_json, ds)
	}
}

function validate_samplescatter_response(response: string, common_genes: string[], dataset_json: any, ds: any) {
	const response_type = safeParseLlmJson(response)
	let html = ''

	if (response_type.html) html = response_type.html

	// Validate plotName against prebuiltPlots
	if (!response_type.plotName) {
		html += 'plotName is required for sample scatter output'
	} else {
		const matchedPlot = dataset_json.prebuiltPlots.find(
			(p: any) => p.name.toLowerCase() == response_type.plotName.toLowerCase()
		)
		if (!matchedPlot) {
			const availablePlots = dataset_json.prebuiltPlots.map((p: any) => p.name).join(', ')
			html += 'Unknown plot name: ' + response_type.plotName + '. Available plots are: ' + availablePlots
		}
	}

	const pp_plot_json: any = {
		chartType: 'sampleScatter',
		name: response_type.plotName
	}

	// Helper to validate an overlay term (color, shape, or divide)
	const validateOverlayTerm = (termName: string | null | undefined, fieldKey: string) => {
		if (termName === null) {
			// Explicit null means remove the overlay
			pp_plot_json[fieldKey] = null
			return
		}
		if (termName === undefined) {
			// Not mentioned, don't include in output
			return
		}
		const termValidation = validate_term(termName, common_genes, dataset_json, ds)
		if (termValidation.html.length > 0) {
			html += termValidation.html
		} else {
			const tw: any = { ...termValidation.term_type }
			if (termValidation.category == 'float' || termValidation.category == 'integer') {
				tw.q = { mode: 'continuous' }
			}
			pp_plot_json[fieldKey] = tw
		}
	}

	validateOverlayTerm(response_type.colorTW, 'colorTW')
	validateOverlayTerm(response_type.shapeTW, 'shapeTW')
	validateOverlayTerm(response_type.term0, 'term0')

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
		return { type: 'plot', plot: pp_plot_json }
	}
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
