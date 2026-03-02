import type { LlmConfig } from '#types'
import { mayLog } from '#src/helpers.ts'
import { extractResourceResponse } from './resource.ts'

/**
 * Second-stage classifier for "notplot" queries. Checks whether the dataset
 * has resources available. If no resources exist, returns { type: 'none' }.
 * If resources exist, delegates to resource.ts which returns either the
 * matched resource HTML or { type: 'none' }.
 *
 * @param user_prompt   The raw user query string.
 * @param llm           LLM configuration.
 * @param dataset_json  The dataset's AI JSON configuration.
 * @returns             { type: 'none' } | { type: 'html', html: string }
 */
export async function classifyNotPlot(
	user_prompt: string,
	llm: LlmConfig,
	dataset_json: any
): Promise<{ type: 'none' } | { type: 'html'; html: string }> {
	const resources = dataset_json.resources ?? []
	if (resources.length === 0) {
		mayLog('classify2: no resources configured for this dataset')
		return { type: 'none' }
	}

	mayLog('classify2: dataset has resources, delegating to resource agent')
	return await extractResourceResponse(user_prompt, llm, dataset_json)
}
