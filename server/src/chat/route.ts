import type { ChatRequest, ChatResponse, LlmConfig, QueryClassification, RouteApi, RoutePayload } from '#types'
import { mayLog } from '#src/helpers.ts'
import { formatElapsedTime } from '#shared'
import { readJSONFile, parse_geneset_db, getChatRelatedPlotTypes } from './utils.ts'
import { classifyQuery } from './classify1.ts'
import { classifyPlotType } from './plot.ts'
import { classifyNotPlot } from './classify2.ts'
import { inferScaffold } from './scaffold.ts'
import serverconfig from '#src/serverconfig.js'
import { getDsAllowedTermTypes } from '../routes/termdb.config.ts'
import { phrase2entity } from './phrase2entity.ts'
import { inferTermObjFromEntity } from './entity2termObj.ts'
import { resolveToTwTvs } from './entity2twTvs.ts'
import { answerDataQueries } from './dataQueries.ts'
import type { Scaffold, Phrase2EntityResult, SummaryScaffold, MsgToUser } from './scaffoldTypes.ts'
import { isMsgToUser } from './scaffoldTypes.ts'
import { resolveToPlotState } from './scaffold2state.ts'
import { runOmnisearch } from './search.ts'
import path from 'path'
import fs from 'fs'

const payload: RoutePayload = {
	init,
	request: { typeId: 'ChatRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'ChatResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/chat',
	methods: {
		get: payload,
		post: payload
	}
}

export function init({ genomes }) {
	return async (req, res) => {
		// omnisearch/cohortStr/usecase/treeFilter drive the mass omnisearch (see runOmnisearch); they are
		// not part of the AI chat ChatRequest payload, so read them via a local cast.
		const q: ChatRequest & {
			omnisearch?: boolean
			cohortStr?: string
			usecase?: any
			treeFilter?: any
		} = req.query
		try {
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw 'invalid dslabel'
			// Mass omnisearch: search dictionary variables and genes in a single request. Handled before
			// the ds.queries.chat gate because omnisearch is offered even for datasets that do not support
			// chat, and is deliberately independent of the AI chat pipeline (run_chat_pipeline).
			if (q.omnisearch) return res.send(await runOmnisearch(q, req, ds, genome))
			// check if ds supports termdb chat
			if (!ds.queries.chat) {
				return res.send({
					type: 'text',
					text: 'Only search functionality supported for this data. No chat functionality supported.'
				})
			}
			const overrideDir = path.join(process.cwd(), 'dataset', 'ai', q.dslabel)
			const aiFilesDir = fs.existsSync(overrideDir)
				? overrideDir
				: path.join(serverconfig.binpath, 'dataset', 'ai', q.dslabel) // This is the directory where the AI JSON files are stored for this dataset. This will use this as the base directory for resolving all agent file paths specified in the dataset JSON file.
			mayLog('Using AI files directory:', aiFilesDir)
			let agentFiles: string[] = []
			try {
				// Read dataset JSON file
				agentFiles = (await fs.promises.readdir(aiFilesDir)).filter(file => file.endsWith('.json'))
			} catch (err: any) {
				console.log({ overrideDir }, 'exists=', fs.existsSync(overrideDir))
				console.log('Chat directory Err:', err)
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
			let rawFilter: any
			if (typeof q.filter === 'string') {
				try {
					rawFilter = JSON.parse(q.filter)
				} catch (e) {
					throw new Error('Failed to parse filter JSON string: ' + e)
				}
			} else {
				rawFilter = q.filter
			}
			const filter: any = rawFilter && typeof rawFilter === 'object' ? rawFilter : {}
			const lst = Array.isArray(filter.lst) ? filter.lst : []
			const cohortFilter = lst.find((item: any) => item.tag === 'cohortFilter')
			const cohortKey = cohortFilter ? cohortFilter.tvs.values[0].key : ''
			const supportedPlotTypes = ds.cohort.termdb.q?.getSupportedChartTypes(req)?.[cohortKey]
			const chatSupportedPlotTypes = getChatRelatedPlotTypes(supportedPlotTypes)
			const genedb = path.join(serverconfig.tpmasterdir, genome.genedb.dbfile)
			const allowedTermTypes = getDsAllowedTermTypes(ds) as string[]
			const ai_output_json = await run_chat_pipeline(
				q.prompt,
				llm,
				ds,
				genedb,
				agentFiles,
				aiFilesDir,
				chatSupportedPlotTypes,
				allowedTermTypes,
				genome
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
	allowedTermTypes: string[],
	genome: any
	// testing: boolean
) {
	// Read main.json file
	if (!fs.existsSync(path.join(aiFilesDir, 'main.json')))
		throw 'Main data file is not specified for dataset:' + ds.label
	const dataset_json: any = await readJSONFile(path.join(aiFilesDir, 'main.json'))

	// Plot vs Not-plot classification
	const time1 = new Date().valueOf()
	const class_response: QueryClassification | MsgToUser = await classifyQuery(userPrompt, llm)
	mayLog('Time taken for classification:', formatElapsedTime(Date.now() - time1))
	if (isMsgToUser(class_response)) return class_response

	let ai_output_json: any
	if (class_response.type === 'notplot') {
		// If Not-plot: Resource or None classification
		const time2 = new Date().valueOf()
		const notPlotResult = await classifyNotPlot(userPrompt, llm, agentFiles, aiFilesDir) //, allowedTermTypes)
		mayLog('Time taken for classify2:', formatElapsedTime(Date.now() - time2))
		if (isMsgToUser(notPlotResult)) return notPlotResult

		if (notPlotResult.type === 'html') {
			ai_output_json = notPlotResult
		} else {
			ai_output_json = {
				type: 'text',
				text: 'Your query does not appear to be related to the available data visualizations. Please try rephrasing your question.'
			}
		}
	} else if (class_response.type === 'binaryQuery') {
		const answer = await answerDataQueries(userPrompt, llm, allowedTermTypes)
		if (!answer) throw "Couldn't decide if this is data related query!"
		mayLog('Data Binary Query: ', answer)
		ai_output_json = answer
	} else if (class_response.type === 'plot') {
		let time = new Date().valueOf()
		const plotType = await classifyPlotType(userPrompt, llm)
		mayLog('Time taken to classify plot type:', formatElapsedTime(Date.now() - time))
		if (isMsgToUser(plotType)) return plotType
		// Check if the classified plot type is supported by this dataset
		if (!supportedPlotTypes.map(s => s.toLowerCase()).includes(plotType.toLowerCase())) {
			const log = 'Plot type: "' + plotType + '" is not supported.'
			ai_output_json = {
				type: 'text',
				text: log
			}
			mayLog(log)
			return ai_output_json
		}

		const genes_list = await parse_geneset_db(genedb)

		// If supported plot type, figure out the scaffold according to the plot type
		mayLog('#################################################')
		mayLog('####### First phase: Infer Plot Scaffolds #######')
		mayLog('#################################################')
		time = new Date().valueOf()
		const dataset_db = serverconfig.tpmasterdir + '/' + ds.cohort.db.file
		const scaffoldResult = await inferScaffold(
			userPrompt,
			plotType,
			llm,
			genome,
			genes_list,
			allowedTermTypes,
			dataset_json,
			ds,
			dataset_db
		)
		if (!scaffoldResult)
			throw 'Scaffold result is empty or undefined, which is unexpected. Please check the inferScaffold agent for potential issues.'
		mayLog('ScaffoldResult: ', scaffoldResult)
		if (
			(plotType === 'hiercluster' && 'plot' in scaffoldResult && scaffoldResult.type === 'plot') ||
			('text' in scaffoldResult && scaffoldResult.type === 'text')
		) {
			// In case of geneExpression clustering, the plot state is generated through a single LLM call and invoking downstream steps is not necessary.
			return scaffoldResult
		}
		mayLog('Time taken to infer scaffold:', formatElapsedTime(Date.now() - time))

		if ('type' in scaffoldResult && scaffoldResult.type === 'text') {
			return scaffoldResult // Return msg/error
		}

		const subplotType =
			(scaffoldResult as Scaffold).plotType === 'summary' ? (scaffoldResult as SummaryScaffold).chartType : undefined

		mayLog('#################################################')
		mayLog("####### Second phase: From Scaffolds's phrases infer Entities #######")
		mayLog('#################################################')
		time = new Date().valueOf()
		const phrase2entityResult = await phrase2entity(
			scaffoldResult as Scaffold,
			plotType,
			llm,
			genes_list,
			dataset_json,
			ds,
			genome,
			dataset_db
		)
		mayLog('Time taken to phrase 2 entity:', formatElapsedTime(Date.now() - time))
		if (('type' in phrase2entityResult && phrase2entityResult.type === 'text') || plotType === 'genomeBrowser') {
			return phrase2entityResult // Return msg/error
		}
		mayLog(phrase2entityResult)

		mayLog('#################################################')
		mayLog('####### Third phase: From Entities infer Term Objects #######')
		mayLog('#################################################')
		time = new Date().valueOf()
		const termObj = await inferTermObjFromEntity(
			phrase2entityResult as Phrase2EntityResult,
			plotType,
			llm,
			dataset_db,
			genes_list,
			genome
		)
		mayLog('Time taken to infer term objects:', formatElapsedTime(Date.now() - time))
		if (isMsgToUser(termObj)) {
			return termObj // Return msg/error to client for display
		}
		mayLog('Inferred termObj from entity:', JSON.stringify(termObj))

		mayLog('#################################################')
		mayLog('####### Fourth phase: From Term Objects to TwTvs Objects #######')
		mayLog('#################################################')
		time = new Date().valueOf()
		const twTvsObj = await resolveToTwTvs(termObj, plotType, llm, dataset_db, genome)
		mayLog('Time taken to resolve to TwTvs object from termObj:', formatElapsedTime(Date.now() - time))
		if ('type' in twTvsObj && twTvsObj.type === 'text') {
			return twTvsObj // Return msg/error
		}
		mayLog('twTvsObj:', twTvsObj)

		mayLog('#################################################')
		mayLog('####### Fifth/Final phase: From TwTvs Objects to Plot States #######')
		mayLog('#################################################')
		time = new Date().valueOf()
		ai_output_json = await resolveToPlotState(twTvsObj, plotType, ds, subplotType)
		mayLog('Time taken to resolve to plot state:', formatElapsedTime(Date.now() - time))
		// TODO: might need a validation step here to check if the scaffoldResult contains valid term types that
		// are present in the dataset and compatible with the plot type, and if not return an error message to the user.
		// This is a bit complex because it requires cross-referencing the inferred scaffold with the dataset's schema and allowed term types,
		//  but it would improve robustness.
	}
	return ai_output_json
}
