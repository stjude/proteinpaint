// This will use an LLM agent to infer the term type from the user promp.

import type { LlmConfig } from '#types' // ,TermType
import { mayLog } from '#src/helpers.ts'
import { route_to_appropriate_llm_provider } from './routeAPIcall.ts'

export async function inferTermType(user_prompt: string, plotType: string, llm: LlmConfig): Promise<TermType> {
	const prompt = `You are a classifier. Given a user query about data visualization, respond with exactly one word from the list: summary, dge, survival, matrix, samplescatter, hiercluster, lollipop.

Definitions:
- summary: distribution, comparison, or relationship of one or two variables. This includes scatter plots comparing two variables (e.g. "variable A vs variable B"), violin plots, bar charts, and any query about expression distribution or group comparison. Use this when comparing a single variable across groups or subtypes (e.g. "Compare Asparaginase LC50 between CRLF2, DUX4, and MEF2D subtypes" — this is ONE variable filtered by subtypes, not multiple genes).
- dge: differential gene expression analysis (e.g. fold change, differentially expressed genes between groups)
- survival: survival or time-to-event analysis (e.g. Kaplan-Meier, overall survival, event-free survival)
- matrix: expression overview of two or more GENE NAMES displayed together (e.g. heatmap, expression landscape, expression matrix, side-by-side gene expression). The multiple items must be gene names (e.g. TP53, KRAS, CDKN2A) or can be displayed with clinical variables such as molecular subtype, diagnosis group, ancestry/race, gender/sex etc.
- samplescatter: ONLY for pre-built dimensionality reduction embeddings (UMAP, t-SNE, PCA). Maybe used for overlaying clinical variables or gene expression or geneset enrichment scores. Do NOT use this for scatter plots comparing two variables — those are summary.
- hiercluster: hierarchical clustering of genes, metabolites, or other numeric features across samples (e.g. "cluster these genes", "hierarchical clustering of TP53 KRAS BCR", "gene expression clustering", "cluster metabolites"). Use this when the user explicitly asks for clustering, dendrogram, or heatmap with clustering. The prompt should include the word "cluster" or "dendrogram" and/or explicitly describe clustering of multiple genes or features across samples.
- lollipop: lollipop plot showing mutation distribution along a gene or protein locus (e.g. "lollipop plot of TP53 mutations", "mutation distribution along KRAS"). Use this when the user explicitly asks for a lollipop plot or describes a plot with mutation positions along a gene or protein.

IMPORTANT: Your response must be exactly one word. Do not return chart type names like "violin", "box plot", or "bar chart". Return only: summary, dge, survival, matrix, samplescatter, hiercluster, or lollipop.    

Query: "${user_prompt}"
Classification:`
	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelName)
	const termType = response.trim().toLowerCase() as TermType
	mayLog(`inferTermType: ${termType}`)
	return termType
}
