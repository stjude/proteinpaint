// Syntax: cd ~/sjpp && npx tsx proteinpaint/server/utils/test/chatbot.ts

import { readJSONFile, run_chat_pipeline } from '../../routes/termdb.chat.ts'
import serverconfig from '../../src/serverconfig.js'

const testing = true // This causes raw LLM output to be sent by the agent
let apilink: string
let comp_model_name: string
if (serverconfig.llm_backend == 'SJ') {
	apilink = serverconfig.sj_apilink
	comp_model_name = serverconfig.sj_comp_model_name
} else if (serverconfig.llm_backend == 'ollama') {
	apilink = serverconfig.ollama_apilink
	comp_model_name = serverconfig.ollama_comp_model_name
} else {
	throw "llm_backend either needs to be 'SJ' or 'ollama'" // Currently only 'SJ' and 'ollama' LLM backends are supported
}

for (const genome of serverconfig.genomes) {
	for (const dataset of genome.datasets) {
		if (dataset.aifiles) {
			// Check to see if the dataset supports the AI chatbot
			//console.log("dataset:", dataset.aifiles)
			const dataset_json = await readJSONFile(dataset.aifiles) // Read AI JSON data file
			//console.log("dataset_json:", dataset_json)
			const ds = null // Not needed for testing
			for (const test_data of dataset_json.TestData) {
				const test_result = await run_chat_pipeline(
					test_data.question,
					comp_model_name,
					serverconfig.llm_backend,
					serverconfig.aiRoute,
					dataset_json,
					testing,
					apilink,
					serverconfig.tpmasterdir + '/' + dataset_json.db,
					serverconfig.tpmasterdir + '/' + dataset_json.genedb,
					ds
				)
				console.log('test_result:', test_result)
			}
		}
	}
}
