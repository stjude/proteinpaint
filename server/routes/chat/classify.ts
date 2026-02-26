import type { LlmConfig, QueryClassification } from '#types'
import { mayLog } from '#src/helpers.ts'
import { route_to_appropriate_llm_provider } from './routeAPIcall.ts'

/**
 * Classify a user query into one of three top-level categories using a small LLM.
 *
 * @param user_prompt  The raw user query string.
 * @param llm          LLM configuration (provider, model names, API endpoint).
 * @returns            'none' | 'resource' | 'plot'
 */
export async function classifyQuery(user_prompt: string, llm: LlmConfig): Promise<QueryClassification> {
	const prompt = `Classify the following user query into exactly one of these categories:
- "none": the query is not related to data visualization or dataset analysis
- "resource": the query asks for information, links, documentation, or background about the dataset
- "plot": the query asks for a data visualization or statistical analysis

Respond with ONLY one word: none, resource, or plot

Query: "${user_prompt}"
Category:`

	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelName)
	const category = response.trim().toLowerCase()
	mayLog(`classifyQuery: "${category}"`)

	if (category === 'resource') return { type: 'resource' }
	if (category === 'plot') return { type: 'plot' }
	return { type: 'none' }
}
