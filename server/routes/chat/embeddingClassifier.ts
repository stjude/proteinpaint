/**
 * Hybrid Query Classifier
 * =======================
 *
 * Classifies user queries into plot categories (summary, dge, matrix,
 * sampleScatter, survival, resource) using a three-tier strategy:
 *
 * 1. **Explicit override** — regex patterns detect unambiguous chart-type
 *    keywords (e.g. "volcano plot", "UMAP", "heatmap") and return immediately.
 *
 * 2. **Embedding classifier** — a kNN classifier backed by a sentence-
 *    embedding model (local via transformers.js or remote via API) compares
 *    the query against labeled training examples using cosine similarity.
 *    The top-k neighbors vote (weighted by similarity) and the category
 *    with the highest total score wins. If the best neighbor's similarity
 *    meets a configurable threshold the result is returned (~50 ms latency).
 *
 * 3. **LLM fallback** — when the embedding confidence falls below the
 *    threshold, a small LLM (configured via `classifierModelName` in
 *    serverconfig) is prompted to classify the query. This handles
 *    ambiguous or out-of-distribution inputs that the embedding model
 *    is uncertain about.
 *
 * Training data is externalized into JSON files:
 *   - dataset/ai/defaultClassifierExamples.json — generic, dataset-agnostic examples
 *   - Per-dataset aifiles JSON — dataset-specific examples via `classifierExamples`
 *     and extracted from `Classification.TrainingData` entries
 *
 * Each dataset gets its own classifier instance (keyed by dataset label) fitted
 * with the merged generic + dataset-specific examples. The embedder (sentence
 * model) is shared across all datasets.
 *
 * Entry point: classifyHybrid() on the per-dataset EmbeddingClassifier
 * returned by getClassifier().
 *
 * Usage in termdb_chat2.ts:
 *   import { getClassifier } from './embeddingClassifier.js'
 *   const clf = await getClassifier(llm, dslabel, datasetJson, aiFilesDir)
 *   const result = await clf.classifyHybrid(userPrompt, llm)
 */

import path from 'path'
import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers'
import type { LlmConfig } from '#types'
import { mayLog } from '#src/helpers.ts'
import { readJSONFile, cosineSim, argsort } from './utils.ts'
import { route_to_appropriate_llm_provider, callSjEmbedding, callOllamaEmbedding } from './routeAPIcall.ts'

// ---------------------------------------------------------------------------
//  Query Augmentation (priority order — first match wins)
// ---------------------------------------------------------------------------

const AUGMENTATION_RULES: { prefix: string; patterns: RegExp[] }[] = [
	{
		prefix: 'Resource or information request',
		patterns: [
			/\b(link|url|website|web ?page|portal|web ?link)\b/i,
			/\b(paper|publication|article|manuscript|preprint|journal)\b/i,
			/\b(citation|cite|reference)\b/i,
			/\bhow (do|can|to) (I|we|users?).{0,20}(use|access|find|get|download|navigate)\b/i,
			/\bwhat is (this|the) (dataset|portal|study|cohort|data)\b/i,
			/\b(tell me about|describe|about this|overview of|background on) (this|the) (dataset|portal|study|cohort|data)\b/i,
			/\b(download|access) the data\b/i,
			/\bwhere (can|do) (I|we|users?).{0,20}(find|get|access|download)\b/i,
			/\bmore information about (this|the) (dataset|portal|study)\b/i
		]
	},
	{
		prefix: 'Differential gene expression analysis',
		patterns: [
			/\bdifferential(ly)?\b/i,
			/\b(DE|DGE|GSEA)\b/,
			/\b(volcano|MA plot)\b/i,
			/\b(up|down)[-\s]?regulated\b/i,
			/\b(overexpressed|enriched|dysregulated|activated)\b/i,
			/\bfold[- ]?change\b/i,
			/\bDE genes\b/,
			/\bdifferential (gene )?expression\b/i,
			/\b(edgeR|limma|wilcoxon)\b/i,
			/\bgenes?.{0,15}(differ|change|significant)/i,
			/\b(top|most).{0,10}(upregulated|downregulated|overexpressed)\b/i
		]
	},
	{
		prefix: 'Patient survival and outcome analysis',
		patterns: [
			/\b(survival|mortality|prognos(is|tic)|life expectancy)\b/i,
			/\bkaplan[- ]?meier\b/i,
			/\b(KM|OS|EFS|PFS|DFS) (curve|plot|rate|stratif)/,
			/\b(hazard ratio|log[- ]?rank|cumulative incidence|median survival)\b/i,
			/\bcox (regression|model|proportional)\b/i,
			/\b(overall|event[- ]?free|relapse[- ]?free|progression[- ]?free|disease[- ]?free) survival\b/i,
			/\btime[- ]?to[- ]?(event|relapse|death|progression)\b/i,
			/\b(mortality|death) (rate|curve|risk)\b/i,
			/\b(mortal(ity)? curve|survive longer|live longer)\b/i,
			/\bdie (earlier|sooner|faster)\b/i,
			/\brisk of (death|dying|relapse)\b/i,
			/\bpredic.{0,5} (survival|outcome|death|mortality)/i,
			/\b(patient|overall) outcome\b/i,
			/\b(better|worse|poor) outcomes?\b/i,
			/\b\d+[- ]?year survival\b/i,
			/\bsurvival (rate|benefit|difference|advantage|curve|plot)\b/i,
			/\b(alive|living) at \d+\b/i
		]
	},
	{
		prefix: 'Dimensionality reduction sample scatter plot',
		patterns: [
			/\b(t[- ]?SNE|UMAP|PCA)\b/i,
			/\b(dimensionality|dimension) reduction\b/i,
			/\b2D (embedding|projection)\b/i,
			/\bsample (cluster|embedding|projection|neighborhood)\b/i,
			/\bcluster(ing)? (plot|visualization)\b/i,
			/\b(reduced dimension|embedding (space|plot|colored|with))\b/i,
			/\boverlay.{0,20}(on the|on a).{0,10}(scatter|UMAP|t-?SNE|PCA)\b/i
		]
	},
	{
		prefix: 'Multi-gene expression matrix or heatmap',
		patterns: [
			/\b(heatmap|matrix|grid|landscape)\b/i,
			/\bside by side\b/i,
			/\b(multi-?gene|multiple genes?)\b/i,
			/\bper (sample|patient)\b/i,
			/\bexpression (of|for|levels).{0,30}(and|,).{0,30}(and|,)/i
		]
	},
	{
		prefix: 'Summary scatter plot comparing two variables',
		patterns: [
			/\b(correlate|correlation|against)\b/i,
			/\b\w+ (vs|versus) \w+ expression\b/i,
			/\bscatter\s*plot\b/i,
			/\b(plot \w+ expression against|expression.{0,20}(vs|versus|against))\b/i
		]
	},
	{
		prefix: 'Summary violin plot of expression by clinical group',
		patterns: [
			/\bexpression (levels? )?(by|in|for|of|across|between)\b/i,
			/\b\w+ expression (by|in|for|across|between)\b/i,
			/\b(stratified by|violin|boxplot)\b/i,
			/\bexpression.{0,30}(group|subtype|category|cohort|phase|arm|race|sex|gender|age|diagnosis)\b/i,
			/\b(levels?|counts?) (for|by|in|across|between|stratified)\b/i
		]
	},
	{
		prefix: 'Summary barchart of categorical distribution',
		patterns: [
			/\bhow many\b/i,
			/\bwhat (is|are) the (count|number|total|mean|median|average|percentage|proportion|frequency)\b/i,
			/\b(what percentage|list all|count of|ratio of|frequency of|distribution of)\b/i,
			/\bshow (the )?(count|number|total|frequency|percentage|proportion|distribution)\b/i,
			/\bdescribe the (cohort|dataset|population|samples?|patients?)\b/i,
			/\bwho (are|is) in\b/i,
			/\b(breakdown|demographic|summarize|overview|cross-?tabulate)\b/i,
			/\b(bar ?chart|histogram)\b/i
		]
	}
]

// Tokens matching the gene-name pattern that are NOT genes — prevents false
// positives in multi-gene detection. Kept generic (no dataset-specific terms).
const _GENE_TOKEN_RE = /\b[A-Z][A-Z0-9]{1,7}\b/g
const _GENE_NOISE = new Set([
	'THE',
	'AND',
	'FOR',
	'ALL',
	'NOT',
	'ARE',
	'VS',
	'CR', // common words
	'RNA',
	'DNA',
	'AML',
	'CNS',
	'BMI',
	'WBC',
	'MRD',
	'TNBC',
	'CAR', // clinical abbreviations
	'DE',
	'DGE',
	'GSEA',
	'UMAP',
	'PCA', // analysis terms
	'KM',
	'OS',
	'EFS',
	'PFS',
	'DFS', // survival abbreviations
	'DB',
	'SQL' // technical
])

function looksLikeMultiGene(query: string, minGenes = 3, datasetNoise?: Set<string>): boolean {
	const hits = query.match(_GENE_TOKEN_RE) || []
	return hits.filter(h => !_GENE_NOISE.has(h) && !datasetNoise?.has(h)).length >= minGenes
}

function augmentQuery(query: string, datasetNoise?: Set<string>): string {
	for (const rule of AUGMENTATION_RULES) {
		if (rule.patterns.some(p => p.test(query))) return rule.prefix + ': ' + query
		// Multi-gene heuristic piggybacks on the matrix rule
		if (rule.prefix.includes('matrix') && looksLikeMultiGene(query, 3, datasetNoise)) return rule.prefix + ': ' + query
	}
	return query
}

// ---------------------------------------------------------------------------
//  Training Data — loaded from external JSON files
// ---------------------------------------------------------------------------

/** Maps aifiles chart type names to classifier category names. */
const CHART_TYPE_TO_CATEGORY: Record<string, string> = {
	Classification: 'resource',
	Summary: 'summary',
	DE: 'dge',
	Matrix: 'matrix',
	sampleScatter: 'sampleScatter',
	survival: 'survival'
}

/**
 * Load and merge training examples from the generic default file and
 * optional per-dataset sources (classifierExamples + Classification.TrainingData).
 *
 * Categories are determined by the union of:
 *   1. Categories present in the default examples
 *   2. Categories defined in datasetJson.classifierExamples
 *   3. Categories derived from datasetJson.charts[].type
 *
 * If the dataset declares supported chart types, the final set is filtered
 * to only those categories the dataset actually supports.
 */
export async function loadTrainingExamples(
	defaultExamplesPath: string,
	datasetJson?: any
): Promise<Record<string, string[]>> {
	// 1. Load generic default examples
	let base: Record<string, string[]> = {}
	try {
		base = await readJSONFile(defaultExamplesPath)
	} catch (e: any) {
		mayLog(`Warning: could not load default classifier examples from ${defaultExamplesPath}: ${e.message}`)
	}

	if (!datasetJson) return base

	// 2. Determine which categories this dataset supports (from charts array)
	const supportedCategories = new Set<string>()
	const charts: { type: string }[] = datasetJson.charts ?? []
	for (const chart of charts) {
		const cat = CHART_TYPE_TO_CATEGORY[chart.type]
		if (cat) supportedCategories.add(cat)
	}

	// 3. Merge dataset-specific classifierExamples
	const dsExamples: Record<string, string[]> = datasetJson.classifierExamples ?? {}
	for (const cat of Object.keys(dsExamples)) {
		supportedCategories.add(cat)
	}

	// 4. Extract classifier examples from Classification.TrainingData
	//    Each entry maps a question to a plot type (or html for resource).
	const classificationChart = charts.find((c: any) => c.type === 'Classification') as any
	const classificationTraining: { question: string; answer: any }[] = classificationChart?.TrainingData ?? []
	const extractedExamples: Record<string, string[]> = {}
	for (const entry of classificationTraining) {
		if (!entry.question) continue
		let cat: string
		if (entry.answer?.type === 'resource') {
			cat = 'resource'
		} else if (entry.answer?.plot) {
			cat = CHART_TYPE_TO_CATEGORY[entry.answer.plot] ?? entry.answer.plot.toLowerCase()
		} else {
			continue
		}
		if (!extractedExamples[cat]) extractedExamples[cat] = []
		extractedExamples[cat].push(entry.question)
	}

	// 5. Merge all sources: base + extracted + dataset-specific
	const merged: Record<string, string[]> = {}

	// If dataset declares supported categories, filter base to those only.
	// If no charts declared, include all base categories (backward compat).
	const filterBase = supportedCategories.size > 0
	for (const [cat, examples] of Object.entries(base)) {
		if (filterBase && !supportedCategories.has(cat)) continue
		merged[cat] = [...examples]
	}

	// Add extracted examples from Classification.TrainingData
	for (const [cat, examples] of Object.entries(extractedExamples)) {
		if (!merged[cat]) merged[cat] = []
		merged[cat].push(...examples)
	}

	// Add dataset-specific classifierExamples (highest priority, appended last)
	for (const [cat, examples] of Object.entries(dsExamples)) {
		if (!merged[cat]) merged[cat] = []
		merged[cat].push(...examples)
	}

	// Deduplicate within each category
	for (const cat of Object.keys(merged)) {
		merged[cat] = [...new Set(merged[cat])]
	}

	return merged
}

// Explicit chart type overrides — bypass embedding when the user
// unambiguously names a chart type or visualization keyword.
const EXPLICIT_OVERRIDES: { category: string; patterns: RegExp[] }[] = [
	{ category: 'dge', patterns: [/\bvolcano\s*(plot|chart)?\b/i] },
	{ category: 'sampleScatter', patterns: [/\bt[- ]?SNE\b/i, /\bUMAP\b/i, /\bPCA\b/i] },
	{ category: 'matrix', patterns: [/\bheatmap\b/i, /\bmatrix\b/i] },
	{
		category: 'summary',
		patterns: [/\bviolin\s*(plot|chart)?\b/i, /\bbox\s*plot\b/i, /\bbar\s*chart\b/i, /\bscatter\s*plot\b/i]
	}
]

function getExplicitOverride(query: string): string | null {
	for (const { patterns, category } of EXPLICIT_OVERRIDES) {
		if (patterns.some(p => p.test(query))) return category
	}
	return null
}

export interface ClassifyResult {
	query: string
	category: string
	confidence: number
	all_scores: Record<string, number>
	above_threshold: boolean
}

// Embedder interface & implementations

export interface Embedder {
	init(): Promise<void>
	embed(texts: string[]): Promise<number[][]>
}

class LocalEmbedder implements Embedder {
	private extractor: FeatureExtractionPipeline | null = null
	private modelName: string

	constructor(modelName = 'Xenova/bge-small-en-v1.5') {
		this.modelName = modelName
	}

	async init(): Promise<void> {
		if (!this.extractor) {
			this.extractor = (await pipeline('feature-extraction', this.modelName)) as FeatureExtractionPipeline
		}
	}

	async embed(texts: string[]): Promise<number[][]> {
		if (!this.extractor) throw new Error('Embedder not initialized — call init() first')
		const output = await this.extractor(texts, { pooling: 'cls', normalize: true })
		return output.tolist() as number[][]
	}
}

class ApiEmbedder implements Embedder {
	private provider: string
	private modelName: string
	private api: string

	constructor(provider: string, modelName: string, api: string) {
		this.provider = provider
		this.modelName = modelName
		this.api = api
	}

	async init(): Promise<void> {
		// No-op for API — nothing to preload
	}

	async embed(texts: string[]): Promise<number[][]> {
		if (this.provider === 'SJ') {
			return await callSjEmbedding(texts, this.modelName, this.api)
		} else if (this.provider === 'ollama') {
			return await callOllamaEmbedding(texts, this.modelName, this.api)
		}
		throw new Error('Unknown embedding provider: ' + this.provider)
	}
}

export class EmbeddingClassifier {
	private embedder: Embedder
	threshold: number
	private k: number
	private categories: string[] = []
	private allEmbeddings: number[][] = []
	private allLabels: string[] = []

	constructor(embedder: Embedder, threshold = 0.9, k = 5) {
		this.embedder = embedder
		this.threshold = threshold
		this.k = k
	}

	async fit(categoryExamples: Record<string, string[]>): Promise<void> {
		const t0 = performance.now()
		this.categories = Object.keys(categoryExamples)

		const allTexts: string[] = []
		const allLabels: string[] = []
		for (const [cat, examples] of Object.entries(categoryExamples)) {
			for (const q of examples) {
				allTexts.push(augmentQuery(q))
				allLabels.push(cat)
			}
		}

		this.allEmbeddings = await this.embedder.embed(allTexts)
		this.allLabels = allLabels

		const elapsed = ((performance.now() - t0) / 1000).toFixed(2)
		const dim = this.allEmbeddings[0]?.length ?? 0
		mayLog(
			`EmbeddingClassifier.fit: ${allLabels.length} examples, ${this.categories.length} categories, dim=${dim}, ${elapsed}s`
		)
	}

	async classify(query: string, datasetNoise?: Set<string>): Promise<ClassifyResult> {
		const augmented = augmentQuery(query, datasetNoise)
		const [qEmb] = await this.embedder.embed([augmented])
		return this.classifyFromEmbedding(query, qEmb)
	}

	private classifyFromEmbedding(query: string, qEmb: number[]): ClassifyResult {
		const sims = this.allEmbeddings.map(row => cosineSim(qEmb, row))
		const sortedIdx = argsort(sims)
		const topKIdx = sortedIdx.slice(-this.k).reverse()
		const topKLabels = topKIdx.map(i => this.allLabels[i])
		const topKSims = topKIdx.map(i => sims[i])

		const vote: Record<string, number> = {}
		for (let i = 0; i < topKLabels.length; i++) {
			vote[topKLabels[i]] = (vote[topKLabels[i]] ?? 0) + topKSims[i]
		}
		const bestCat = Object.entries(vote).reduce((a, b) => (b[1] > a[1] ? b : a))[0]
		const bestScore = topKSims[0]
		const above = bestScore >= this.threshold

		const allScores: Record<string, number> = {}
		for (const cat of this.categories) {
			allScores[cat] = Math.round((vote[cat] ?? 0) * 10000) / 10000
		}

		return {
			query,
			category: above ? bestCat : 'none',
			confidence: Math.round(bestScore * 10000) / 10000,
			all_scores: allScores,
			above_threshold: above
		}
	}

	/**
	 * Hybrid classification: tries the embedding classifier first, falls back
	 * to the LLM if the confidence is below the threshold.
	 *
	 * This mirrors the hybrid_router.py approach from the Python demo.
	 */
	async classifyHybrid(query: string, llm: LlmConfig, datasetNoise?: Set<string>): Promise<ClassifyResult> {
		// Check for explicit chart type keywords first — these always win.
		const override = getExplicitOverride(query)
		if (override) {
			mayLog(`Hybrid router: explicit chart type override → ${override}`)
			return {
				query,
				category: override,
				confidence: 1.0,
				all_scores: {},
				above_threshold: true
			}
		}

		const embeddingResult = await this.classify(query, datasetNoise)

		if (embeddingResult.above_threshold) {
			mayLog(
				`Hybrid router: embedding confident (${embeddingResult.confidence.toFixed(4)}), ` +
					`category=${embeddingResult.category}`
			)
			return embeddingResult
		}

		// Below threshold — fall back to LLM
		const classifierModel = llm.classifierModelName ?? llm.modelName
		mayLog(
			`Hybrid router: embedding uncertain (${embeddingResult.confidence.toFixed(4)}), ` +
				`falling back to LLM (${llm.provider}/${classifierModel})`
		)

		try {
			const llmResult = await classifyViaLlm(query, llm)
			// Prefer .plot field; fall back to .type if it looks like a category name
			// (some smaller LLMs return {"type":"resource"} instead of {"type":"plot","plot":"resource"})
			const llmCategory = llmResult.plot ?? (this.categories.includes(llmResult.type) ? llmResult.type : 'none')
			mayLog(`Hybrid router: LLM fallback returned category=${llmCategory}`)

			return {
				query,
				category: llmCategory,
				confidence: embeddingResult.confidence,
				all_scores: embeddingResult.all_scores,
				above_threshold: false // was below embedding threshold, resolved by LLM
			}
		} catch (e: any) {
			mayLog(`Hybrid router: LLM fallback failed (${e?.message || e}), returning 'none'`)
			return embeddingResult // return the below-threshold embedding result as-is
		}
	}
}

// LLM Fallback — used by classifyHybrid when embedding is uncertain

async function classifyViaLlm(
	userPrompt: string,
	llm: LlmConfig
): Promise<{ type: string; plot?: string; html?: string }> {
	const template = `Classify the following user query into exactly one category. Respond with ONLY a JSON object, no explanation.

Categories:
- "summary": Clinical data plots — distributions, bar charts, violin plots, boxplots, scatter plots of 1-2 variables. Queries about counts, percentages, expression by group, or correlating two variables.
- "dge": Differential gene expression — comparing gene expression between two groups. Keywords: upregulated, downregulated, DE, DGE, volcano plot, fold change, differential expression.
- "matrix": Multi-gene heatmap/matrix — displaying 3+ genes or variables across samples in a grid. Keywords: heatmap, matrix, landscape, multiple genes.
- "sampleScatter": Dimensionality reduction plots — t-SNE, UMAP, PCA embeddings with optional overlays. Keywords: t-SNE, UMAP, PCA, clustering, embedding.
- "survival": Survival/outcome analysis — Kaplan-Meier curves, hazard ratios, time-to-event. Keywords: survival, Kaplan-Meier, hazard ratio, prognosis, outcomes.
- "resource": Requests for links, papers, publications, portal info, citations, data access, or background about the study/cohort/dataset. Keywords: link, URL, paper, publication, cite, portal, about, download, access.

Examples:
Q: "Show TP53 expression by sex" → {"type":"plot","plot":"summary"}
Q: "How many patients in each subtype" → {"type":"plot","plot":"summary"}
Q: "Which genes are upregulated in KMT2A vs DUX4" → {"type":"plot","plot":"dge"}
Q: "Show a heatmap of TP53 KRAS and NRAS" → {"type":"plot","plot":"matrix"}
Q: "Color the UMAP by molecular subtype" → {"type":"plot","plot":"sampleScatter"}
Q: "Compare survival rates between KMT2A and DUX4" → {"type":"plot","plot":"survival"}
Q: "Where can I find the paper for this dataset" → {"type":"plot","plot":"resource"}
Q: "Show me the link to the portal" → {"type":"plot","plot":"resource"}

Q: "${userPrompt}" →`

	const response = await route_to_appropriate_llm_provider(template, llm, llm.classifierModelName)
	mayLog('LLM fallback raw response:', response)

	// route_to_appropriate_llm_provider already extracts JSON from the raw
	// LLM response, so we can parse directly.
	return JSON.parse(response)
}

// Singletons — initialized once, reused across all requests

let embedderInstance: Embedder | null = null
let embedderInitPromise: Promise<Embedder> | null = null

/**
 * Get the singleton Embedder, initializing on first call.
 * Safe to call concurrently — only one init runs.
 *
 * Uses llm.embeddingModelAccess to choose between:
 *   - "local" (default): loads model via transformers.js in-process
 *   - "api": calls the configured SJ/Ollama embedding API endpoint
 */
export async function getEmbedder(llm: LlmConfig): Promise<Embedder> {
	if (embedderInstance) return embedderInstance

	if (!embedderInitPromise) {
		embedderInitPromise = (async () => {
			const access = llm.embeddingModelAccess ?? 'local'
			let embedder: Embedder

			if (access === 'api') {
				mayLog(`Embedder: using API (${llm.provider}/${llm.embeddingModelName})`)
				embedder = new ApiEmbedder(llm.provider, llm.embeddingModelName, llm.api)
			} else {
				mayLog(`Embedder: using local (${llm.embeddingModelName})`)
				embedder = new LocalEmbedder(llm.embeddingModelName)
			}

			await embedder.init()
			embedderInstance = embedder
			return embedder
		})()
	}

	return embedderInitPromise
}

const classifierCache = new Map<string, EmbeddingClassifier>()
const classifierInitPromises = new Map<string, Promise<EmbeddingClassifier>>()

/**
 * Get a per-dataset EmbeddingClassifier, initializing on first call for each dataset.
 * Safe to call concurrently — only one init runs per dataset.
 * The embedder (sentence model) is shared across all datasets.
 *
 * @param llm             - LLM configuration from serverconfig.json
 * @param datasetLabel    - Unique dataset identifier (used as cache key)
 * @param datasetJson     - Dataset AI config (from aifiles JSON), used for
 *                          per-dataset classifierExamples and chart types
 * @param aiFilesDir      - Directory containing the aifiles (used to resolve
 *                          defaultClassifierExamples.json)
 * @param threshold       - OOD rejection threshold (default 0.9)
 */
export async function getClassifier(
	llm: LlmConfig,
	datasetLabel: string,
	datasetJson: any,
	aiFilesDir: string,
	threshold = 0.9
): Promise<EmbeddingClassifier> {
	const cached = classifierCache.get(datasetLabel)
	if (cached) return cached

	let pending = classifierInitPromises.get(datasetLabel)
	if (!pending) {
		pending = (async () => {
			const embedder = await getEmbedder(llm)
			const defaultExamplesPath = path.join(aiFilesDir, 'defaultClassifierExamples.json')
			const trainingExamples = await loadTrainingExamples(defaultExamplesPath, datasetJson)
			const clf = new EmbeddingClassifier(embedder, threshold)
			await clf.fit(trainingExamples)
			classifierCache.set(datasetLabel, clf)
			classifierInitPromises.delete(datasetLabel)
			mayLog(`EmbeddingClassifier[${datasetLabel}]: ready`)
			return clf
		})()
		classifierInitPromises.set(datasetLabel, pending)
	}

	return pending
}
