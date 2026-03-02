import { formatTrainingExamples } from './utils.ts'
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
	dataset_json: any
): Promise<{ type: 'none' } | { type: 'html'; html: string }> {
	const classification_ds = dataset_json.charts?.find((chart: any) => chart.type == 'Classification')
	const resources: { label: string; html: string }[] = dataset_json.resources ?? []

	const training_data =
		classification_ds?.TrainingData?.length > 0 ? formatTrainingExamples(classification_ds.TrainingData) : ''

	const resourceList = resources.map((r, i) => `  ${i}: "${r.label}"`).join('\n')

	const system_prompt =
		'I am an assistant that matches user questions to pre-defined resources for this data portal. ' +
		'The available resources are:\n' +
		resourceList +
		'\n' +
		'The final output must be ONLY a JSON object with NO extra comments, in this format: {"idx": <integer>}\n' +
		'where idx is the index of the best matching resource from the list above. ' +
		'If none of the resources match the question, return {"idx": -1}\n' +
		(classification_ds?.SystemPrompt ? classification_ds.SystemPrompt + '\n' : '') +
		(training_data ? 'Training data examples:\n' + training_data + '\n' : '') +
		'Question: {' +
		prompt +
		'} answer:'

	const response: string = await route_to_appropriate_llm_provider(
		system_prompt,
		llm,
		llm.classifierModelName ?? llm.modelName
	)
	let parsed: any
	try {
		parsed = JSON.parse(response)
	} catch {
		mayLog('resource.ts: LLM returned invalid JSON:', response)
		throw new Error(`resource.ts: LLM returned invalid JSON instead of {"idx": <integer>}`)
	}
	const idx = parsed?.idx

	// LLM explicitly said no match
	if (idx === -1) return { type: 'none' }

	// Valid resource index
	if (typeof idx === 'number' && idx >= 0 && idx < resources.length) {
		return { type: 'html', html: resources[idx].html }
	}

	// Invalid idx response from LLM  (e.g. an idx that is out of bounds, or not an integer)
	// This is different from the try-catch which captures if the llm returns invalid JSON
	// in a non idx: integer format
	mayLog('resource.ts: unexpected LLM response:', parsed)
	throw new Error(
		`resource.ts: LLM returned invalid idx=${JSON.stringify(idx)} (expected -1 or 0..${resources.length - 1})`
	)
}
