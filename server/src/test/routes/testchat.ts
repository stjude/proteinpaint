// This file defines a test route for the AI chatbot functionality. It reads test prompts and expected outputs from a JSON file for each dataset, runs the chatbot pipeline on the prompts, and compares the actual outputs to the expected outputs, logging any discrepancies.

// Test URL: http://localhost:3000/testchat
import serverconfig from '../../serverconfig.js'
import { getDsAllowedTermTypes } from '../../../routes/termdb.config.ts'
import { readJSONFile, getChatRelatedPlotTypes } from '../../../routes/chat/utils.ts' // getGenesetNames
import { run_chat_pipeline } from '../../../routes/termdb.chat3.ts'
import assert from 'node:assert/strict'
import path from 'path'
import fs from 'fs'

process.removeAllListeners('warning')

export default function setRoutes(app, basepath, genomes) {
	app.get(basepath + '/testchat', async (req, res) => {
		// URL parameters:
		// ?dataset=<label> - restrict testing to a specific dataset (e.g. ?dataset=TermdbTest)
		const datasetFilter = req.query.dslabel as string | undefined
		console.log('test chat page' + (datasetFilter ? ` (dslabel filter: ${datasetFilter})` : ''))
		const results: { dataset: string; num_errors: number }[] = []
		for (const genome of Object.values(genomes)) {
			if (!genome) {
				// This should not happen since we are iterating over Object.values(genomes), but just in case
				console.log('Genome is undefined, skipping')
				continue
			}

			for (const ds of Object.values((genome as any).datasets)) {
				if ((ds as any)?.queries?.chat) {
					const label = (ds as any).label
					if (datasetFilter && label !== datasetFilter) continue

					const rawFilter = typeof req.query.filter === 'string' ? JSON.parse(req.query.filter) : req.query.filter
					const filter: any = rawFilter && typeof rawFilter === 'object' ? rawFilter : {}
					const lst = Array.isArray(filter.lst) ? filter.lst : []
					const cohortFilter = lst.find((item: any) => item.tag === 'cohortFilter')
					const cohortKey = cohortFilter ? cohortFilter.tvs.values[0].key : ''
					const supportedPlotTypes = (ds as any).cohort.termdb.q?.getSupportedChartTypes(req)?.[cohortKey]
					const chatSupportedPlotTypes = getChatRelatedPlotTypes(supportedPlotTypes)
					console.log('\x1b[32m%s\x1b[0m', 'Testing chatbot for dataset: ' + label)
					const aiFilesDir = serverconfig.binpath + '/../../dataset/ai/' + label // This is the directory where the AI JSON files are stored for this dataset. This will use this as the base directory for resolving all agent file paths specified in the dataset JSON file.
					const num_errors = await test_chatbot_by_dataset(ds, genome, aiFilesDir, chatSupportedPlotTypes)
					if (num_errors == 0) {
						console.log(
							'\x1b[32m%s\x1b[0m',
							'Tests complete for ' + label + '. Number of failed prompts: ' + num_errors
						) // Show in green if all tests passed
					} else {
						console.log(
							'\x1b[31m%s\x1b[0m',
							'Tests complete for ' + label + '. Number of failed prompts: ' + num_errors
						) // Show in red if any of the tests failed
					}
					results.push({ dataset: label, num_errors: num_errors })
				}
			}
		}
		res.send(results)
	})
}

export async function test_chatbot_by_dataset(
	ds: any,
	genome: any,
	aiFilesDir: string,
	chatSupportedPlotTypes: string[]
): Promise<number> {
	// const testing = false // This causes raw LLM output to be sent by the agent
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
	if (llm.provider !== 'SJ' && llm.provider !== 'ollama' && llm.provider !== 'azure') {
		throw "llm.provider must be 'SJ' or 'ollama' or 'azure'"
	}
	let num_errors = 0 // Number of errors encountered across all prompts for this dataset
	// Read test data from separate test.json file
	if (!fs.existsSync(path.join(aiFilesDir, 'test.json')))
		throw 'Test data file is not specified for dataset:' + ds.label
	const testData = await readJSONFile(path.join(aiFilesDir, 'test.json'))

	const genedb = (genome as any).genedb.db
	const allowedTermTypes = getDsAllowedTermTypes(ds) as string[]
	//console.log("dataset_json:", dataset_json)
	for (const test_data of testData) {
		// const genesetNames = getGenesetNames(genome)
		//console.log("Test question:", test_data.question)

		const test_result = await run_chat_pipeline(
			test_data.question,
			llm,
			ds,
			genedb,
			agentFiles,
			aiFilesDir,
			chatSupportedPlotTypes,
			allowedTermTypes,
			genome
		)
		if (test_result.type == test_data.PPoutput.type) {
			// Only proceed further if the type of the LLM output matches the expected type. Otherwise its a classification agent error.
			if (test_result.type == 'html') {
				// Resource request
				try {
					assert.deepStrictEqual(test_result.html, test_data.PPoutput.html)
				} catch (err) {
					console.log(
						'\x1b[31m%s\x1b[0m',
						'Prompt: ' +
							test_data.question +
							' Invalid terms do not match (but probably ok): Actual LLM response: ' +
							test_result.html +
							' Expected LLM Response: ' +
							test_data.PPoutput.html +
							' Error: ' +
							err
					)
					num_errors += 1
				}
			} else if (test_result.type == 'text') {
				// Displaying error for e.g. invalid dictionary items. This may not be reproducible since invalid dictionary items have no context in DB.
				try {
					assert.deepStrictEqual(test_result.text, test_data.PPoutput.text)
				} catch (err) {
					// err.message contains a string diff you can search
					if (test_result.text.includes('invalid') && test_data.PPoutput.text.includes('invalid')) {
						console.log(
							'Prompt: ' +
								test_data.question +
								' Invalid terms do not match (but probably ok): Actual LLM response: ' +
								test_result.text +
								' Expected LLM Response: ' +
								test_data.PPoutput.text
						)
					} else {
						console.log(
							'\x1b[31m%s\x1b[0m',
							'Prompt: ' +
								test_data.question +
								' Unknown error : Actual LLM response: ' +
								test_result.text +
								' Expected LLM Response: ' +
								test_data.PPoutput.text +
								' Error: ' +
								err
						)
						num_errors += 1
					}
				}
			} else if (test_result.type == 'plot') {
				if (test_result.plot.chartType == test_data.PPoutput.plot.chartType) {
					try {
						assert.deepStrictEqual(test_result.plot, test_data.PPoutput.plot)
					} catch (err) {
						console.log(
							'\x1b[31m%s\x1b[0m',
							'Prompt: ' +
								test_data.question +
								' ' +
								test_result.plot.chartType +
								' output did not match: Actual LLM response: ' +
								JSON.stringify(test_result.plot) +
								' Expected LLM Response: ' +
								JSON.stringify(test_data.PPoutput.plot) +
								' Error: ' +
								err
						)
						num_errors += 1
					}
				} else {
					console.log(
						'\x1b[31m%s\x1b[0m',
						'Prompt: ' +
							test_data.question +
							' plot type does not match: Actual LLM plot: ' +
							test_result.plot.chartType +
							' Expected LLM plot: ' +
							test_data.PPoutput.plot.chartType
					)
					num_errors += 1
				}
			} else if (test_result.type == 'resource') {
				try {
					assert.deepStrictEqual(test_result.plot, test_data.PPoutput.plot)
				} catch (err) {
					console.log(
						'\x1b[31m%s\x1b[0m',
						'Prompt: ' +
							test_data.question +
							' Resource agent output did not match: Actual LLM response: ' +
							JSON.stringify(test_result.plot) +
							' Expected LLM Response: ' +
							JSON.stringify(test_data.PPoutput.plot) +
							' Error: ' +
							err
					)
					num_errors += 1
				}
			} else {
				console.log('\x1b[31m%s\x1b[0m', 'Unknown type for prompt:' + test_data.question)
				num_errors += 1
			}
		} else {
			console.log(
				'\x1b[31m%s\x1b[0m',
				'Prompt: ' +
					test_data.question +
					' Classification type error: Actual LLM response: ' +
					test_result.type +
					' Expected LLM response: ' +
					test_data.PPoutput.type
			)
			num_errors += 1
		}
	}
	return num_errors
}
