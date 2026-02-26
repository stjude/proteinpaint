import type { LlmConfig, PlotType } from '#types'
import { mayLog } from '#src/helpers.ts'
import { route_to_appropriate_llm_provider } from './routeAPIcall.ts'

/**
 * Determine the specific plot type for a query that has already been classified as 'plot'.
 *
 * @param user_prompt  The raw user query string.
 * @param llm          LLM configuration (provider, model names, API endpoint).
 * @returns            The specific plot type (e.g. 'summary', 'dge', 'survival', 'matrix', 'sampleScatter').
 */
export async function classifyPlotType(user_prompt: string, llm: LlmConfig): Promise<PlotType> {
	const prompt = `Classify the following data visualization query into exactly one of these plot types:
- "summary": bar chart, violin plot, box plot, or scatter plot comparing two variables or groups
- "dge": differential gene expression analysis (volcano plot, MA plot, fold change)
- "survival": survival curves, Kaplan-Meier, overall survival, event-free survival
- "matrix": heatmap, multi-gene expression matrix, or side-by-side comparison of multiple genes
- "sampleScatter": dimensionality reduction plot (UMAP, t-SNE, PCA)

Respond with ONLY one word from the list above.

Query: "${user_prompt}"
Plot type:`

	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelName)
	const plotType = response.trim().toLowerCase() as PlotType
	mayLog(`classifyPlotType: ${plotType}`)
	return plotType
}
