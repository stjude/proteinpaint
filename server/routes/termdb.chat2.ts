import type { ChatRequest, ChatResponse, LlmConfig, RouteApi, QueryClassification } from '#types'
import { ChatPayload } from '#types/checkers'
import { classifyQuery } from './chat/classify1.ts'
import { classifyNotPlot } from './chat/classify2.ts'
import { classifyPlotType } from './chat/plot.ts'
import { readJSONFile } from './chat/utils.ts'
import { extract_DE_search_terms_from_query } from './chat/DEagent.ts'
import { extract_summary_terms } from './chat/summaryagent.ts'
import { extract_matrix_search_terms_from_query } from './chat/matrixagent.ts'
import { extract_samplescatter_terms_from_query } from './chat/samplescatteragent.ts'
import { extract_hiercluster_terms_from_query } from './chat/hierclusteragent.ts'
import { extractGenesFromPrompt, parse_dataset_db, parse_geneset_db, getGenesetNames } from './chat/utils.ts'
import serverconfig from '../src/serverconfig.js'
import { mayLog } from '#src/helpers.ts'
import { formatElapsedTime } from '#shared'

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
			const aiFilesPath = serverconfig_ds_entries.aifiles
			const dataset_json: any = await readJSONFile(aiFilesPath)
			const testing = false // This toggles validation of LLM output. In this script, this will ALWAYS be false since we always want validation of LLM output, only for testing we set this variable to true
			const genesetNames = getGenesetNames(g)
			const ai_output_json = await run_chat_pipeline(
				q.prompt,
				llm,
				dataset_json,
				testing,
				dataset_db,
				genedb,
				ds,
				genesetNames
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
	dataset_json: any,
	testing: boolean,
	dataset_db: string,
	genedb: string,
	ds: any,
	genesetNames: string[] = []
) {
	const time1 = new Date().valueOf()

	const class_response: QueryClassification = await classifyQuery(user_prompt, llm)
	let ai_output_json: any
	mayLog('Time taken for classification:', formatElapsedTime(Date.now() - time1))
	if (class_response.type == 'notplot') {
		const time2 = new Date().valueOf()
		const notPlotResult = await classifyNotPlot(user_prompt, llm, dataset_json)
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
		const genes_list = await parse_geneset_db(genedb) // gene_list should always be populated irrespective of whether the dataset has gene expression data, since even if its missing gene expression data, the gene list can still be useful for validating gene mentions in the user query and providing additional context to the LLM. If the dataset does not have gene expression data, the gene list can still be used for telling the user that gene expression is not supported.
		const relevant_genes = extractGenesFromPrompt(user_prompt, genes_list)
		const classResult = await classifyPlotType(user_prompt, llm, relevant_genes)
		const dataset_db_output = await parse_dataset_db(dataset_db)
		if (classResult == 'summary') {
			const time1 = new Date().valueOf()
			ai_output_json = await extract_summary_terms(
				user_prompt,
				llm,
				dataset_db_output,
				dataset_json,
				genes_list,
				ds,
				testing,
				genesetNames
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
			ai_output_json = { type: 'text', text: 'survival agent has not been implemented yet' }
		} else if (classResult == 'matrix') {
			const time1 = new Date().valueOf()
			ai_output_json = await extract_matrix_search_terms_from_query(
				user_prompt,
				llm,
				dataset_db_output,
				dataset_json,
				genes_list,
				ds,
				testing,
				genesetNames
			)
			mayLog('Time taken for matrix agent:', formatElapsedTime(Date.now() - time1))
		} else if (classResult == 'samplescatter') {
			const time1 = new Date().valueOf()
			ai_output_json = await extract_samplescatter_terms_from_query(
				user_prompt,
				llm,
				dataset_db_output,
				dataset_json,
				genes_list,
				ds,
				testing,
				genesetNames
			)
			mayLog('Time taken for sampleScatter agent:', formatElapsedTime(Date.now() - time1))
		} else if (classResult == 'hiercluster') {
			const time1 = new Date().valueOf()
			ai_output_json = await extract_hiercluster_terms_from_query(
				user_prompt,
				llm,
				dataset_db_output,
				dataset_json,
				genes_list,
				ds,
				testing,
				genesetNames
			)
			mayLog('Time taken for hierCluster agent:', formatElapsedTime(Date.now() - time1))
		} else if (classResult == 'lollipop') {
			ai_output_json = {
				type: 'text',
				text: 'This is a gene mutation prompt. But, lollipop agent has not been implemented yet'
			}
		} else if (classResult == 'ambiguous_gene_name') {
			ai_output_json = {
				type: 'text',
				text: 'Your query includes a gene name, but it is not clear which feature of the gene you are referring to (e.g. expression, mutation, etc.). Please rephrase your question to clarify what information you are seeking about the gene.'
			}
		} else {
			// Will define all other agents later as desired
			ai_output_json = { type: 'text', text: 'Unknown classification value' }
		}
	} else {
		// Should not happen
		ai_output_json = { type: 'text', text: 'Unknown classification type' }
	}
	return ai_output_json
}
