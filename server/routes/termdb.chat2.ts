import type { ChatRequest, ChatResponse, LlmConfig, RouteApi, QueryClassification, GeneDataTypeResult } from '#types'
import { ChatPayload } from '#types/checkers'
import { classifyQuery } from './chat/classify1.ts'
import { classifyNotPlot } from './chat/classify2.ts'
import { classifyPlotType } from './chat/plot.ts'
import { extract_DE_search_terms_from_query } from './chat/DEagent.ts'
import { determineAmbiguousGenePrompt } from './chat/ambiguousgeneagent.ts'
import { extract_summary_terms } from './chat/summaryagent.ts'
import { extract_matrix_search_terms_from_query } from './chat/matrixagent.ts'
import { extract_samplescatter_terms_from_query } from './chat/samplescatteragent.ts'
import { extract_hiercluster_terms_from_query } from './chat/hierclusteragent.ts'
import { classifyGeneDataType } from './chat/genedatatypeagent.ts'
import {
	extractGenesFromPrompt,
	parse_dataset_db,
	parse_geneset_db,
	getGenesetNames,
	readJSONFile
} from './chat/utils.ts'
import serverconfig from '../src/serverconfig.js'
import { mayLog } from '#src/helpers.ts'
import { formatElapsedTime } from '#shared'
import path from 'path'
import fs from 'fs'

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
			const aiFilesDir = serverconfig.binpath + '/../../dataset/ai/' + q.dslabel // This is the directory where the AI JSON files are stored for this dataset. This will use this as the base directory for resolving all agent file paths specified in the dataset JSON file.
			let agentFiles: string[] = []
			try {
				// Read dataset JSON file
				agentFiles = fs.readdirSync(aiFilesDir).filter(file => file.endsWith('.json'))
			} catch (err: any) {
				if (err.code === 'ENOENT') throw new Error(`Directory not found: ${aiFilesDir}`)
				if (err.code === 'ENOTDIR') throw new Error(`Path is not a directory: ${aiFilesDir}`)
				throw err
			}

			const llm = serverconfig.llm
			if (!llm) throw 'serverconfig.llm is not configured'
			if (llm.provider !== 'SJ' && llm.provider !== 'ollama') {
				throw "llm.provider must be 'SJ' or 'ollama'"
			}
			const dataset_db = serverconfig.tpmasterdir + '/' + ds.cohort.db.file
			const genedb = serverconfig.tpmasterdir + '/' + g.genedb.dbfile
			const testing = false // This toggles validation of LLM output. In this script, this will ALWAYS be false since we always want validation of LLM output, only for testing we set this variable to true
			const genesetNames = getGenesetNames(g)
			const ai_output_json = await run_chat_pipeline(
				q.prompt,
				llm,
				testing,
				dataset_db,
				genedb,
				ds,
				genesetNames,
				agentFiles,
				aiFilesDir,
				g
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
	testing: boolean,
	dataset_db: string,
	genedb: string,
	ds: any,
	genesetNames: string[] = [],
	agentFiles: string[],
	aiFilesDir: string,
	genome: any
) {
	// Read main.json file
	if (!fs.existsSync(path.join(aiFilesDir, 'main.json')))
		throw 'Main data file is not specified for dataset:' + ds.label
	const dataset_json: any = await readJSONFile(path.join(aiFilesDir, 'main.json'))
	const time1 = new Date().valueOf()
	const class_response: QueryClassification = await classifyQuery(user_prompt, llm)
	let ai_output_json: any
	mayLog('Time taken for classification:', formatElapsedTime(Date.now() - time1))
	if (class_response.type == 'notplot') {
		const time2 = new Date().valueOf()
		const notPlotResult = await classifyNotPlot(user_prompt, llm, agentFiles, aiFilesDir)
		mayLog('Time taken for classify2:', formatElapsedTime(Date.now() - time2))
		if (notPlotResult.type == 'html') {
			ai_output_json = notPlotResult
		} else {
			ai_output_json = {
				type: 'text',
				text: 'Your query does not appear to be related to the available data visualizations. Please try rephrasing your question.'
			}
		}
	} else if (class_response.type == 'plot') {
		let geneFeatures: GeneDataTypeResult[] = [] // This will hold the specific gene features (e.g. expression, mutation, etc.) that are relevant to the user prompt, which can be used by downstream agents to determine which data to pull and how to interpret it. For example, if the user prompt is "Show me the expression of TP53", then we want to classify that the relevant gene feature is "expression". Or if the user prompt is "Show me TP53 mutations", then we want to classify that the relevant gene feature is "mutation". This is important for correctly interpreting the user's intent and providing accurate responses.
		const genes_list = await parse_geneset_db(genedb) // gene_list should always be populated irrespective of whether the dataset has gene expression data, since even if its missing gene expression data, the gene list can still be useful for validating gene mentions in the user query and providing additional context to the LLM. If the dataset does not have gene expression data, the gene list can still be used for telling the user that gene expression is not supported.
		const relevant_genes = extractGenesFromPrompt(user_prompt, genes_list)
		if (relevant_genes.length > 0) {
			const AmbiguousGeneMessage = determineAmbiguousGenePrompt(user_prompt, relevant_genes, dataset_json) // for e.g. classifying prompts such as "Show TP53". In this prompt its not clear which feature (gene expression, mutation, etc.) of TP53 the user is referring to, so we want to classify this as an "ambiguous_gene_prompt" plot type and prompt the user to clarify their question.
			if (AmbiguousGeneMessage.length > 0) {
				return {
					type: 'text',
					text: AmbiguousGeneMessage
				}
			}
			const geneDataTypeMessage: GeneDataTypeResult[] | string = await classifyGeneDataType(
				user_prompt,
				llm,
				relevant_genes,
				dataset_json
			)
			if (typeof geneDataTypeMessage === 'string' || geneDataTypeMessage instanceof String) {
				if (geneDataTypeMessage.length > 0) {
					// This shows error is any of the genes are missing relevant features
					return {
						type: 'text',
						text: geneDataTypeMessage
					}
				} else {
					// Should not happen
					throw 'classifyGeneDataType agent returned an empty string, which is unexpected.'
				}
			} else if (Array.isArray(geneDataTypeMessage)) {
				geneFeatures = geneDataTypeMessage
			} else {
				throw 'geneDataTypeMessage has unknown data type returned from classifyGeneDataType agent'
			}
		}
		const classResult = await classifyPlotType(user_prompt, llm)
		const dataset_db_output = await parse_dataset_db(dataset_db)
		if (classResult == 'summary') {
			const time1 = new Date().valueOf()
			ai_output_json = await extract_summary_terms(
				user_prompt,
				llm,
				dataset_db_output,
				dataset_json,
				ds,
				testing,
				genesetNames,
				geneFeatures,
				aiFilesDir
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
				testing,
				aiFilesDir
			)
			mayLog('Time taken for DE agent:', formatElapsedTime(Date.now() - time1))
		} else if (classResult == 'survival') {
			ai_output_json = { type: 'text', text: 'survival agent has not been implemented yet' }
		} else if (classResult == 'matrix') {
			const time1 = new Date().valueOf()
			ai_output_json = await extract_matrix_search_terms_from_query(
				user_prompt,
				llm,
				dataset_db_output,
				dataset_json,
				ds,
				testing,
				genesetNames,
				geneFeatures,
				aiFilesDir
			)
			mayLog('Time taken for matrix agent:', formatElapsedTime(Date.now() - time1))
		} else if (classResult == 'samplescatter') {
			const time1 = new Date().valueOf()
			ai_output_json = await extract_samplescatter_terms_from_query(
				user_prompt,
				llm,
				dataset_db_output,
				dataset_json,
				ds,
				testing,
				genesetNames,
				geneFeatures,
				aiFilesDir
			)
			mayLog('Time taken for sampleScatter agent:', formatElapsedTime(Date.now() - time1))
		} else if (classResult == 'hiercluster') {
			const time1 = new Date().valueOf()
			ai_output_json = await extract_hiercluster_terms_from_query(
				user_prompt,
				llm,
				dataset_db_output,
				dataset_json,
				ds,
				testing,
				genesetNames,
				geneFeatures,
				aiFilesDir,
				genome
			)
			mayLog('Time taken for hierCluster agent:', formatElapsedTime(Date.now() - time1))
		} else if (classResult == 'lollipop') {
			ai_output_json = {
				type: 'text',
				text: 'This is a gene mutation prompt. But, lollipop agent has not been implemented yet'
			}
		} else {
			// Will define all other agents later as desired
			ai_output_json = { type: 'text', text: 'Unknown classification value' }
		}
	} else {
		// Should not happen
		ai_output_json = { type: 'text', text: 'Unknown classification type' }
	}
	//mayLog('Final AI output JSON:', JSON.stringify(ai_output_json))
	return ai_output_json
}
