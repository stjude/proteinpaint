import type { ChatRequest, ChatResponse, LlmConfig, RouteApi, ClassificationType } from '#types'
import { ChatPayload } from '#types/checkers'
import { classifyQuery } from './chat/classify.ts'
import { readJSONFile } from './chat/utils.ts'
import { extract_DE_search_terms_from_query } from './chat/DEagent.ts'
import { extract_summary_terms } from './chat/summaryagent.ts'
import { extract_matrix_search_terms_from_query } from './chat/matrixagent.ts'
import { extract_samplescatter_terms_from_query } from './chat/samplescatteragent.ts'
import { parse_dataset_db, parse_geneset_db } from './chat/utils.ts'
import { extractResourceResponse } from './chat/resourceagent.ts'
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
			const dataset_json: any = await readJSONFile(serverconfig_ds_entries.aifiles)
			const testing = false // This toggles validation of LLM output. In this script, this will ALWAYS be false since we always want validation of LLM output, only for testing we set this variable to true
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

	// Parse the dataset DB upfront to extract categorical term values (e.g. molecular
	// subtype names). These are passed to the classifier so they aren't mistaken for
	// gene names in multi-gene detection, making the classifier dataset-agnostic.
	const dataset_db_output = await parse_dataset_db(dataset_db)

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
			ai_output_json = { type: 'html', html: `Unknown classification value: "${classResult}"` }
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
