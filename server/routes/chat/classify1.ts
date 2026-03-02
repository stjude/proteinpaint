import type { LlmConfig, QueryClassification } from '#types'
import { mayLog } from '#src/helpers.ts'
import { route_to_appropriate_llm_provider } from './routeAPIcall.ts'

/**
 * Classify a user query as either plot-related or not using a small LLM.
 *
 * @param user_prompt  The raw user query string.
 * @param llm          LLM configuration (provider, model names, API endpoint).
 * @returns            'plot' | 'notplot'
 */
export async function classifyQuery(user_prompt: string, llm: LlmConfig): Promise<QueryClassification> {
	const prompt = `You are a classifier for a genomics/clinical dataset analysis tool. Classify the following user query into exactly one category.

- "plot": the query asks to visualize, explore, or retrieve data values from the dataset. This includes questions about gene expression, survival, mutations, clinical variables, subtypes, karyotypes, distributions, comparisons, or any question that would be answered by looking at the actual data (e.g. "What are the karyotypes of chr8?", "Show TP53 expression", "How many patients have subtype X?").
- "notplot": the query is NOT asking to visualize or analyze dataset values. This includes general knowledge questions, casual conversation, requests for meta-information about the dataset (links, papers, documentation), or anything not about analyzing data.

Respond with ONLY one word: plot or notplot

Query: "${user_prompt}"
Category:`

	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelName)
	const category = response.trim().toLowerCase()
	mayLog(`classifyQuery: "${category}"`)

	if (category === 'plot') return { type: 'plot' }
	if (category === 'notplot') return { type: 'notplot' }

	mayLog('classify1.ts: unexpected LLM response:', response)
	throw new Error(`classify1.ts: LLM returned "${category}" (expected "plot" or "notplot")`)
}
