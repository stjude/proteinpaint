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

- "plot": the query asks to visualize, explore, retrieve, or ask questions about data values in the dataset, OR to modify an existing plot. This includes ANY question that can be answered by looking at the actual patient/sample data — such as gene expression, survival, mutations, clinical variables (age, sex, diagnosis, ancestry, etc.), subtypes, karyotypes, distributions, comparisons, ranges, counts, or plot modifications (change color, remove overlay, update filters, switch chart type). Examples: "What are the karyotypes of chr8?", "Show TP53 expression", "How many patients have subtype X?", "What's the age range of female patients?", "Remove the color from the t-SNE", "Color the UMAP by sex".
- "notplot": the query is NOT about the dataset's patient/sample data at all. This includes general knowledge questions, casual conversation, requests for meta-information about the dataset (links, papers, documentation), or anything not about analyzing or visualizing the data.

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
