import type { ChatRequest, ChatResponse, LlmConfig, RouteApi, QueryClassification } from '#types'
import { ChatPayload } from '#types/checkers'
import { mayLog } from '#src/helpers.ts'
import { formatElapsedTime } from '#shared'
import { readJSONFile, parse_geneset_db } from './chat/utils.ts'
import { classifyQuery } from './chat/classify1.ts'
import { classifyPlotType } from './chat/plot.ts'
import { classifyNotPlot } from './chat/classify2.ts'
import { inferScaffold } from './chat/scaffold.ts'
import serverconfig from '../src/serverconfig.js'
import { getDsAllowedTermTypes } from './termdb.config.ts'
import { inferEntities } from './chat/phrase2entity.ts'
import path from 'path'
import fs from 'fs'
import { isSummaryScaffold } from './chat/scaffoldTypes.ts'

export const api: RouteApi = {
	endpoint: 'termdb/chat3',
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
		// console.log('Received request at /termdb/chat3 with query:', req.query)
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
			/*
* Old Stuff from Robin
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
aiFilesDir
)
*/

			// This toggles validation of LLM output. In this script, this will ALWAYS be false since we always want validation of LLM output,
			// only for testing we set this variable to true
			// const testing = false

			// Access the cohort key/label
			const filter = typeof q.filter === 'string' ? JSON.parse(q.filter) : q.filter
			const cohortFilter = filter.lst?.find((item: any) => item.tag === 'cohortFilter')
			const cohortKey = cohortFilter ? cohortFilter.tvs.values[0].key : ''
			const supportedChartTypes = ds.cohort.termdb.q?.getSupportedChartTypes(req)?.[cohortKey]
			const genedb = serverconfig.tpmasterdir + '/' + g.genedb.dbfile
			// console.log(`Supported chart types for ${cohortKey}:`, supportedChartTypes)
			// console.log('ds.cohort.termddb.allowedTermTypes:', ds.cohort.termdb.allowedTermTypes)
			const _allowedTermTypes = getDsAllowedTermTypes(ds) as string[]
			const ai_output_json = await run_chat_pipeline(
				q.prompt,
				llm,
				ds,
				genedb,
				agentFiles,
				aiFilesDir,
				supportedChartTypes,
				_allowedTermTypes
				// 	testing
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
	ds: any,
	genedb: string,
	agentFiles: string[],
	aiFilesDir: string,
	supportedChartTypes: string[],
	_allowedTermTypes: string[]
	// testing: boolean
) {
	// Read main.json file
	if (!fs.existsSync(path.join(aiFilesDir, 'main.json')))
		throw 'Main data file is not specified for dataset:' + ds.label
	const dataset_json: any = await readJSONFile(path.join(aiFilesDir, 'main.json'))

	// Plot vs Not-plot classification
	const time1 = new Date().valueOf()
	const class_response: QueryClassification = await classifyQuery(user_prompt, llm)
	mayLog('Time taken for classification:', formatElapsedTime(Date.now() - time1))

	let ai_output_json: any
	if (class_response.type == 'notplot') {
		// If Not-plot: Resource or None classification
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
		const time3 = new Date().valueOf()
		const plotType = await classifyPlotType(user_prompt, llm)
		mayLog('Time taken to classify plot type:', formatElapsedTime(Date.now() - time3))

		// As long as supported chart types is non-empty list
		if (!supportedChartTypes) {
			const errorMsg =
				'Supported chart types list is undefined. Please check the dataset configuration and ensure \
							  that getSupportedChartTypes is implemented correctly. Skipping chart type validation, but this may \
							  lead to unsupported chart type errors downstream.'
			console.warn(errorMsg)
			return
		}

		/* Special handling for summary chart types
// Every cohort by default supports summary charts unless 
// 'dictionary' is not in the supported chart type list
// */
		if (plotType === 'summary') {
			if (!supportedChartTypes.includes('dictionary')) {
				const log = 'Plot type: "' + plotType + '" is not supported.'
				ai_output_json = {
					type: 'text',
					text: log
				}
				console.log(log)
				return ai_output_json
			}
		} else {
			if (!supportedChartTypes.includes(plotType)) {
				const log = 'Plot type: "' + plotType + '" is not supported.'
				ai_output_json = {
					type: 'text',
					text: log
				}
				console.log(log)
				return ai_output_json
			}
		}

		// If valid plot type, figure out term types
		const time4 = new Date().valueOf()
		const scaffoldResult = await inferScaffold(user_prompt, plotType, llm)
		console.log('ScaffoldResult: ', scaffoldResult)
		mayLog('Time taken to infer scaffold:', formatElapsedTime(Date.now() - time4))

		if (!scaffoldResult)
			throw 'Scaffold result is empty or undefined, which is unexpected. Please check the inferScaffold agent for potential issues.'

		/* This function checks if the non-dictionary types mentioned in the scaffold result (e.g. gene names) are valid based
		 * on the corresponding db (e.g. genedb). If any invalid terms are found, it throws an error which is caught in the main
		 * function and returned as a text response to the user. This is an important validation step to ensure that downstream agents
		 * receive valid inputs and can function properly, and also to provide clear feedback to the user if they mention invalid terms.
		 */
		const genes_list = await parse_geneset_db(genedb)
		if (isSummaryScaffold(scaffoldResult)) {
			// Ensure all nondicttypes in the scaffold have corresponding data types.
			// For e.g. ("Show TP53" is invalid because its not clear what term type TP53 is, but "Show expression of TP53" is valid
			// because "expression of TP53" can be resolved to a GENE_EXPRESSION term type which is present in the dataset)
			// We are looking for gene terms against an exhaustive list of genes from a db, but we will need a similar approach for other
			// nondicttypes such as metabolites, genesets, etc.
			const term1 = await inferEntities(scaffoldResult.tw1, llm, genes_list, dataset_json)
			console.log('Validation result for term1:', term1)
			let term2, term3, filter
			if (scaffoldResult.tw2) {
				term2 = await inferEntities(scaffoldResult.tw2, llm, genes_list, dataset_json)
			}
			if (scaffoldResult.tw3) {
				term3 = await inferEntities(scaffoldResult.tw3, llm, genes_list, dataset_json)
			}
			if (scaffoldResult.filter) {
				filter = await inferEntities(scaffoldResult.filter, llm, genes_list, dataset_json)
			}
			console.log('Validation result for term2:', term2)
			console.log('Validation result for term3:', term3)
			console.log('Validation result for filter:', filter)
		}
		return
		// TODO: might need a validation step here to check if the scaffoldResult contains valid term types that
		// are present in the dataset and compatible with the plot type, and if not return an error message to the user.
		// This is a bit complex because it requires cross-referencing the inferred scaffold with the dataset's schema and allowed term types,
		//  but it would improve robustness.

		//const time5 = new Date().valueOf()
		//const entityResult = await inferEntities(scaffoldResult, llm)
		//mayLog('Time taken to infer entities:', formatElapsedTime(Date.now() - time5))

		// TODO: might need a validation step here to check if the scaffoldResult contains valid term types that

		//const time6 = new Date().valueOf()
		//const termObjResult = await inferTermObj(entityResult, allowedTermTypes, llm)
		//mayLog('Time taken to infer term objects:', formatElapsedTime(Date.now() - time6))

		return
	}
	return ai_output_json
}
