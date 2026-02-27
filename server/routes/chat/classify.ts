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
	const prompt = `You are a classifier for a genomics/clinical dataset analysis tool. Classify the following user query into exactly one category.

- "plot": the query asks to visualize, explore, or retrieve data values from the dataset. This includes questions about gene expression, survival, mutations, clinical variables, subtypes, karyotypes, distributions, comparisons, or any question that would be answered by looking at the actual data (e.g. "What are the karyotypes of chr8?", "Show TP53 expression", "How many patients have subtype X?").
- "resource": the query asks for meta-information ABOUT the dataset itself — links, papers, documentation, citations, how to access or download the data, or background about the study. It does NOT include questions about data values or patterns in the data.
- "none": the query is unrelated to genomics, clinical data, or dataset analysis. This includes general knowledge questions, casual conversation, requests for images, or anything not about analyzing a scientific dataset.

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
