import type { ChatRequest, ChatResponse, LlmConfig, RouteApi, QueryClassification } from '#types'
// import { ambiguousPoints } from '#types'
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
import { phrase2entity } from './chat/phrase2entity.ts'
import { inferTermObjFromEntity } from './chat/entity2termObj.ts'
import { resolveToTwTvs } from './chat/entity2twTvs.ts'
import { answerDataQueries } from './chat/dataQueries.ts'
import path from 'path'
import fs from 'fs'
import type { Phrase2EntityResult } from './chat/scaffoldTypes.ts'
import { resolveToPlotState } from './chat/scaffold2state.ts'

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

function getChatRelatedPlotTypes(supportedPlotTypes: string[] | undefined): string[] {
	if (!supportedPlotTypes) {
		mayLog(
			'Supported plot types list is undefined. Defaulting to empty list, which may lead to unsupported plot type errors downstream.'
		)
		return []
	}

	// check if it supports summary charts
	if (supportedPlotTypes.includes('dictionary')) {
		// summmary means it includes "boxplot", "violin", "barchart", "sampleScatter" as child types
		supportedPlotTypes.push('summary')
	}

	// check if it supports heirarchical clustering charts
	// TODO:
	if (supportedPlotTypes.includes('geneExpression')) {
		// || supportedPlotTypes.includes('proteomeAbundance') || supportedPlotTypes.includes('dnaMethylation'))
		supportedPlotTypes.push('hiercluster')
	}
	// check if it supports dge
	if (supportedPlotTypes.includes('DA')) {
		supportedPlotTypes.push('dge')
	}
	return supportedPlotTypes
}

function init({ genomes }) {
	return async (req, res) => {
		const q: ChatRequest = req.query
		try {
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw 'invalid dslabel'
			const aiFilesDir = serverconfig.binpath + '/../../dataset/ai/' + q.dslabel // This is the directory where the AI JSON files are stored for this dataset. This will use this as the base directory for resolving all agent file paths specified in the dataset JSON file.
			let agentFiles: string[] = []
			try {
				// Read dataset JSON file
				agentFiles = await fs.readdirSync(aiFilesDir).filter(file => file.endsWith('.json'))
			} catch (err: any) {
				if (err.code === 'ENOENT') throw new Error(`Directory not found: ${aiFilesDir}`)
				if (err.code === 'ENOTDIR') throw new Error(`Path is not a directory: ${aiFilesDir}`)
				throw err
			}

			const llm = serverconfig.llm
			if (!llm) throw 'serverconfig.llm is not configured'
			if (
				llm.provider !== 'SJ' &&
				llm.provider !== 'ollama' &&
				llm.provider !== 'huggingface' &&
				(llm.provider as string) !== 'azure'
			) {
				throw "llm.provider must be 'SJ', 'ollama', 'huggingface', or 'azure'"
			}

			// This toggles validation of LLM output. In this script, this will ALWAYS be false since we always want validation of LLM output,
			// only for testing we set this variable to true
			// const testing = false

			// Access the cohort key/label
			const rawFilter = typeof q.filter === 'string' ? JSON.parse(q.filter) : q.filter
			const filter: any = rawFilter && typeof rawFilter === 'object' ? rawFilter : {}
			const lst = Array.isArray(filter.lst) ? filter.lst : []
			const cohortFilter = lst.find((item: any) => item.tag === 'cohortFilter')
			const cohortKey = cohortFilter ? cohortFilter.tvs.values[0].key : ''
			const supportedPlotTypes = ds.cohort.termdb.q?.getSupportedChartTypes(req)?.[cohortKey]
			const chatSupportedPlotTypes = getChatRelatedPlotTypes(supportedPlotTypes)
			const genedb = serverconfig.tpmasterdir + '/' + genome.genedb.dbfile
			const _allowedTermTypes = getDsAllowedTermTypes(ds) as string[]
			const ai_output_json = await run_chat_pipeline(
				q.prompt,
				llm,
				ds,
				genedb,
				agentFiles,
				aiFilesDir,
				chatSupportedPlotTypes,
				_allowedTermTypes,
				genome
				// 	testing
			)
			mayLog('From init: Final AI output JSON:', JSON.stringify(ai_output_json))
			res.send(ai_output_json as ChatResponse)
		} catch (e: any) {
			if (e.stack) mayLog(e.stack)
			res.send({ error: e?.message || e })
		}
	}
}

export async function run_chat_pipeline(
	userPrompt: string,
	llm: LlmConfig,
	ds: any,
	genedb: string,
	agentFiles: string[],
	aiFilesDir: string,
	supportedPlotTypes: string[],
	_allowedTermTypes: string[],
	genome: any
	// testing: boolean
) {
	// Read main.json file
	if (!fs.existsSync(path.join(aiFilesDir, 'main.json')))
		throw 'Main data file is not specified for dataset:' + ds.label
	const dataset_json: any = await readJSONFile(path.join(aiFilesDir, 'main.json'))

	// Plot vs Not-plot classification
	const time1 = new Date().valueOf()
	const class_response: QueryClassification = await classifyQuery(userPrompt, llm)
	mayLog('Time taken for classification:', formatElapsedTime(Date.now() - time1))

	let ai_output_json: any
	if (class_response.type === 'notplot') {
		// If Not-plot: Resource or None classification
		const time2 = new Date().valueOf()
		const notPlotResult = await classifyNotPlot(userPrompt, llm, agentFiles, aiFilesDir) //, _allowedTermTypes)
		mayLog('Time taken for classify2:', formatElapsedTime(Date.now() - time2))

		if (notPlotResult.type === 'html') {
			ai_output_json = notPlotResult
		} else {
			ai_output_json = {
				type: 'text',
				text: 'Your query does not appear to be related to the available data visualizations. Please try rephrasing your question.'
			}
		}
	} else if (class_response.type === 'binaryQuery') {
		const answer = await answerDataQueries(userPrompt, llm, _allowedTermTypes)
		if (!answer) throw "Couldn't decide if this is data related query!"
		mayLog('Data Binary Query: ', answer)
		ai_output_json = answer
	} else if (class_response.type === 'plot') {
		let time = new Date().valueOf()
		const plotType = await classifyPlotType(userPrompt, llm)
		mayLog('Time taken to classify plot type:', formatElapsedTime(Date.now() - time))

		// Check if the classified plot type is supported by this dataset
		if (!supportedPlotTypes.includes(plotType)) {
			const log = 'Plot type: "' + plotType + '" is not supported.'
			ai_output_json = {
				type: 'text',
				text: log
			}
			mayLog(log)
			return ai_output_json
		}

		// If supported plot type, figure out the scaffold according to the plot type
		mayLog('####### First phase: Infer Plot Scaffolds #######')
		mayLog('#################################################')
		time = new Date().valueOf()
		const scaffoldResult = await inferScaffold(userPrompt, plotType, llm)
		mayLog('ScaffoldResult: ', scaffoldResult)
		mayLog('Time taken to infer scaffold:', formatElapsedTime(Date.now() - time))

		if (!scaffoldResult)
			throw 'Scaffold result is empty or undefined, which is unexpected. Please check the inferScaffold agent for potential issues.'
		const subplotType = scaffoldResult.plotType === 'summary' ? scaffoldResult.chartType : undefined

		mayLog('#################################################')
		mayLog("####### Second phase: From Scaffolds's phrases infer Entities #######")
		mayLog('#################################################')
		const genes_list = await parse_geneset_db(genedb)
		time = new Date().valueOf()
		const phrase2entityResult = await phrase2entity(scaffoldResult, plotType, llm, genes_list, dataset_json, ds, genome)
		mayLog('Time taken to phrase 2 entity:', formatElapsedTime(Date.now() - time))
		if ('type' in phrase2entityResult && phrase2entityResult.type === 'text') {
			return phrase2entityResult // Return msg/error
		}
		mayLog(phrase2entityResult)

		mayLog('#################################################')
		mayLog('####### Third phase: From Entities infer Term Objects #######')
		mayLog('#################################################')
		const dataset_db = serverconfig.tpmasterdir + '/' + ds.cohort.db.file
		time = new Date().valueOf()
		const termObj = await inferTermObjFromEntity(
			phrase2entityResult as Phrase2EntityResult,
			plotType,
			llm,
			dataset_db,
			genes_list
		)
		mayLog('Time taken to infer term objects:', formatElapsedTime(Date.now() - time))
		mayLog('Inferred termObj from entity:', JSON.stringify(termObj))

		mayLog('#################################################')
		mayLog('####### Fourth phase: From Term Objects to TwTvs Objects #######')
		mayLog('#################################################')
		time = new Date().valueOf()
		const twTvsObj = await resolveToTwTvs(termObj, plotType, llm, dataset_db)
		mayLog('Time taken to resolve to TwTvs object from termObj:', formatElapsedTime(Date.now() - time))
		if ('type' in twTvsObj && twTvsObj.type === 'text') {
			return twTvsObj // Return msg/error
		}
		mayLog('twTvsObj:', twTvsObj)

		mayLog('#################################################')
		mayLog('####### Fifth/Final phase: From TwTvs Objects to Plot States #######')
		mayLog('#################################################')
		time = new Date().valueOf()
		ai_output_json = resolveToPlotState(twTvsObj, plotType, subplotType)
		mayLog('Time taken to resolve to plot state:', formatElapsedTime(Date.now() - time))
		// TODO: might need a validation step here to check if the scaffoldResult contains valid term types that
		// are present in the dataset and compatible with the plot type, and if not return an error message to the user.
		// This is a bit complex because it requires cross-referencing the inferred scaffold with the dataset's schema and allowed term types,
		//  but it would improve robustness.
	}
	return ai_output_json
}
