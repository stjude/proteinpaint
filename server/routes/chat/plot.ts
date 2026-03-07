import type { LlmConfig, PlotType } from '#types'
import { mayLog } from '#src/helpers.ts'
import { route_to_appropriate_llm_provider } from './routeAPIcall.ts'

/**
 * Determine the specific plot type for a query that has already been classified as 'plot'.
 *
 * @param user_prompt  The raw user query string.
 * @param llm          LLM configuration (provider, model names, API endpoint).
 * @returns            The specific plot type (e.g. 'summary', 'dge', 'survival', 'matrix', 'samplescatter').
 */
export async function classifyPlotType(user_prompt: string, llm: LlmConfig): Promise<PlotType> {
	mayLog('classifyPlotType called with prompt:', user_prompt)
	const prompt = `You are a classifier. Given a user query about data visualization, respond with exactly one word from this list: summary, dge, survival, matrix, samplescatter

Definitions:
- summary: distribution, comparison, or relationship of one or two variables. This includes scatter plots comparing two variables (e.g. "variable A vs variable B"), violin plots, bar charts, and any query about expression distribution or group comparison. Use this when comparing a single variable across groups or subtypes (e.g. "Compare Asparaginase LC50 between CRLF2, DUX4, and MEF2D subtypes" — this is ONE variable filtered by subtypes, not multiple genes).
- dge: differential gene expression analysis (e.g. fold change, differentially expressed genes between groups)
- survival: survival or time-to-event analysis (e.g. Kaplan-Meier, overall survival, event-free survival)
- matrix: expression overview of two or more GENE NAMES displayed together (e.g. heatmap, expression landscape, expression matrix, side-by-side gene expression). The multiple items must be gene names (e.g. TP53, KRAS, CDKN2A) or can be displayed with clinical variables such as molecular subtype, diagnosis group, ancestry/race, gender/sex etc.
- samplescatter: ONLY for pre-built dimensionality reduction embeddings (UMAP, t-SNE, PCA). Maybe used for overlaying clinical variables or gene expression or geneset enrichment scores. Do NOT use this for scatter plots comparing two variables — those are summary.

IMPORTANT: Your response must be exactly one word. Do not return chart type names like "violin", "box plot", or "bar chart". Return only: summary, dge, survival, matrix, or samplescatter.

Query: "${user_prompt}"
Classification:`

	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelName)
	const plotType = response.trim().toLowerCase() as PlotType
	mayLog(`classifyPlotType: ${plotType}`)
	return plotType
}
