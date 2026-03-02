import { formatTrainingExamples, safeParseLlmJson } from './utils.ts'
import { route_to_appropriate_llm_provider } from './routeAPIcall.ts'
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
	const parsed = safeParseLlmJson(response)

	const idx = typeof parsed?.idx === 'number' ? parsed.idx : -1
	if (idx >= 0 && idx < resources.length) {
		return { type: 'html', html: resources[idx].html }
	}

	return { type: 'none' }
}
