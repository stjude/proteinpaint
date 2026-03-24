//import { formatTrainingExamples } from './utils.ts'
import { readJSONFile } from './utils.ts'
import { route_to_appropriate_llm_provider } from './routeAPIcall.ts'
import { mayLog } from '#src/helpers.ts'
import type { LlmConfig } from '#types'

/**
 * Ask the LLM to select a resource index from the dataset's `resources` array.
 * Returns the pre-authored HTML for the matched resource, or { type: 'none' }
 * if the LLM finds no matching resource.
 *
 * Callers (classify2) are responsible for checking that resources exist before
 * calling this function.
 */
export async function extractResourceResponse(
	prompt: string,
	llm: LlmConfig,
	aiFilesDir: string
): Promise<{ type: 'none' } | { type: 'html'; html: string }> {
	//const classification_ds = dataset_json.charts?.find((chart: any) => chart.type == 'Classification')
	const resources: { label: string; html: string }[] =
		(await readJSONFile(aiFilesDir + '/resources.json'))?.Resources ?? []

	//const training_data =
	//    classification_ds?.TrainingData?.length > 0 ? formatTrainingExamples(classification_ds.TrainingData) : ''

	const resourceList = resources.map((r, i) => `  ${i}: "${r.label}"`).join('\n')

	const system_prompt =
		'I am an assistant that matches user questions to pre-defined resources for this data portal. ' +
		'The available resources are:\n' +
		resourceList +
		'\n' +
		'IMPORTANT: Return -1 unless the query is clearly and specifically asking about one of the resources listed above. ' +
		'The query must explicitly reference documentation, publications, papers, data access, citations, or background information. ' +
		'Random text, numbers, gibberish, single words, vague phrases, or anything that does not clearly ask about a specific resource must return -1.\n' +
		'Respond with ONLY a single integer: the index of the best matching resource, or -1 if none match.\n' +
		'Question: {' +
		prompt +
		'} answer:'

	const response: string = await route_to_appropriate_llm_provider(
		system_prompt,
		llm,
		llm.classifierModelName ?? llm.modelName
	)
	const idx = parseInt(response.trim())

	// LLM returned something that isn't a number
	if (isNaN(idx)) {
		mayLog('resource.ts: LLM returned non-integer response:', response)
		throw new Error(`resource.ts: LLM returned "${response.trim()}" (expected an integer)`)
	}

	// LLM explicitly said no match
	if (idx === -1) return { type: 'none' }

	// Valid resource index
	if (idx >= 0 && idx < resources.length) {
		return { type: 'html', html: resources[idx].html }
	}

	// Integer but out of bounds
	mayLog('resource.ts: LLM returned out-of-bounds index:', idx)
	throw new Error(`resource.ts: LLM returned idx=${idx} (expected -1 or 0..${resources.length - 1})`)
}
