// Test URL: http://localhost:3000/testchat
import serverconfig from '../../serverconfig.js'
import { readJSONFile } from '../../../routes/chat/utils.ts'
import { run_chat_pipeline } from '../../../routes/termdb.chat2.ts'
import assert from 'node:assert/strict'

process.removeAllListeners('warning')

const testing = false // This causes raw LLM output to be sent by the agent
const llm = serverconfig.llm
if (!llm) throw 'serverconfig.llm is not configured'
if (llm.provider !== 'SJ' && llm.provider !== 'ollama') {
	throw "llm.provider must be 'SJ' or 'ollama'"
}

export default function setRoutes(app, basepath, genomes) {
	app.get(basepath + '/testchat', async () => {
		// (req.res) not currently used
		console.log('test chat page')
		for (const genome of Object.values(genomes)) {
			for (const ds of Object.values((genome as any).datasets)) {
				if ((ds as any)?.queries?.chat) {
					console.log('Testing chatbot for dataset: ' + (ds as any).label)
					const num_errors = await test_chatbot_by_dataset(ds)
					console.log('Tests complete for ' + (ds as any).label + '. Number of failed prompts: ' + num_errors)
				}
			}
		}
	})
}

export async function test_chatbot_by_dataset(ds: any): Promise<number> {
	let num_errors = 0
	// Check to see if the dataset supports the AI chatbot
	if (!(ds as any)?.queries?.chat.aifiles) throw 'AI dataset JSON file is missing for dataset:' + ds.label
	const aifiles = (ds as any)?.queries?.chat.aifiles
	const dataset_json = await readJSONFile(aifiles) // Read AI JSON data file
	//console.log("dataset_json:", dataset_json)
	for (const test_data of dataset_json.TestData) {
		//console.log("Test question:", test_data.question)
		const test_result = await run_chat_pipeline(
			test_data.question,
			llm,
			serverconfig.aiRoute,
			dataset_json,
			testing, // This is not needed anymore, need to be deprecated
			serverconfig.tpmasterdir + '/' + dataset_json.db,
			serverconfig.tpmasterdir + '/' + dataset_json.genedb,
			ds
		)
		if (test_result.type == test_data.PPoutput.type) {
			// Only proceed further if the type of the LLM output matches the expected type. Otherwise its a classification agent error.
			if (test_result.type == 'html') {
				// Resource request
				try {
					assert.deepStrictEqual(test_result.html, test_data.PPoutput.html)
				} catch (err) {
					console.log(
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
				console.log('Unknown type for prompt:' + test_data.question)
				num_errors += 1
			}
		} else {
			console.log(
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
