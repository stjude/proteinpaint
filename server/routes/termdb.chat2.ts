//import { createGenerator } from 'ts-json-schema-generator'
//import type { SchemaGenerator } from 'ts-json-schema-generator'
//import path from 'path'
import type { ChatRequest, ChatResponse, LlmConfig, RouteApi, DbRows, DbValue, ClassificationType } from '#types'
import { ChatPayload } from '#types/checkers'
import { classifyQuery } from './chat/classify.ts'
import { readJSONFile } from './chat/utils.ts'
import { extract_DE_search_terms_from_query } from './chat/DEagent.ts'
import { extract_summary_terms } from './chat/summaryagent.ts'
import { extract_matrix_search_terms_from_query } from './chat/matrixagent.ts'
import { extract_samplescatter_terms_from_query } from './chat/samplescatteragent.ts'
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
