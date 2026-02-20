/**
 * Embedding Classifier Service
 * =============================
 *
 * Singleton wrapper around the embedding-based query classifier.
 * Loads the BAAI/bge-small-en-v1.5 model once at startup and provides
 * a fast classify() method (~50ms) that replaces the LLM-based
 * classification agent.
 *
 * Usage in termdb_chat.ts:
 *   import { getClassifier } from './embeddingClassifier.js'
 *   const clf = await getClassifier()
 *   const result = clf.classify(userPrompt)
 */

import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers'
import { ezFetch } from '#shared'
import type { LlmConfig } from '#types'
import { mayLog } from '#src/helpers.ts'

// ---------------------------------------------------------------------------
//  Numerical helpers (replacing numpy/sklearn)
// ---------------------------------------------------------------------------

function dot(a: number[], b: number[]): number {
	let s = 0
	for (let i = 0; i < a.length; i++) s += a[i] * b[i]
	return s
}

function norm(a: number[]): number {
	return Math.sqrt(dot(a, a))
}

function cosineSim(a: number[], b: number[]): number {
	const d = dot(a, b)
	const na = norm(a)
	const nb = norm(b)
	return na === 0 || nb === 0 ? 0 : d / (na * nb)
}

function argsort(arr: number[]): number[] {
	return arr
		.map((v, i) => ({ v, i }))
		.sort((a, b) => a.v - b.v)
		.map(x => x.i)
}

// ---------------------------------------------------------------------------
//  Query Augmentation
//  Priority: DGE > Survival > SampleScatter > Matrix > Summary(child-type)
// ---------------------------------------------------------------------------

const DGE_PATTERNS: RegExp[] = [
	/\bdifferential(ly)?\b/i,
	/\b(DE|DGE|GSEA)\b/,
	/\bvolcano\b/i,
	/\bMA plot\b/i,
	/\b(up|down)[-\s]?regulated\b/i,
	/\boverexpressed\b/i,
	/\bfold[- ]?change\b/i,
	/\benriched\b/i,
	/\bdysregulated\b/i,
	/\bactivated\b/i,
	/\bDE genes\b/,
	/\bdifferential expression\b/i,
	/\bdifferential gene expression\b/i,
	/\b(edgeR|limma|wilcoxon)\b/i,
	/\bgenes?.{0,15}(differ|change|significant)/i,
	/\b(top|most).{0,10}(upregulated|downregulated|overexpressed)\b/i
]

const SURVIVAL_PATTERNS: RegExp[] = [
	/\bsurvival\b/i,
	/\bkaplan[- ]?meier\b/i,
	/\b(KM|OS|EFS|PFS|DFS) (curve|plot|rate|stratif)/,
	/\bhazard ratio\b/i,
	/\bcox (regression|model|proportional)\b/i,
	/\blog[- ]?rank\b/i,
	/\b(overall|event[- ]?free|relapse[- ]?free|progression[- ]?free|disease[- ]?free) survival\b/i,
	/\btime[- ]?to[- ]?(event|relapse|death|progression)\b/i,
	/\b(mortality|death) (rate|curve|risk)\b/i,
	/\bmortal(ity)? curve\b/i,
	/\bsurvive longer\b/i,
	/\blive longer\b/i,
	/\bdie (earlier|sooner|faster)\b/i,
	/\brisk of (death|dying|relapse)\b/i,
	/\bprognos(is|tic)\b/i,
	/\bpredic.{0,5} (survival|outcome|death|mortality)/i,
	/\b(patient|overall) outcome\b/i,
	/\b(better|worse|poor) outcomes?\b/i,
	/\bcumulative incidence\b/i,
	/\bmedian survival\b/i,
	/\b\d+[- ]?year survival\b/i,
	/\bsurvival (rate|benefit|difference|advantage|curve|plot)\b/i,
	/\b(alive|living) at \d+\b/i,
	/\blife expectancy\b/i
]

const SAMPLESCATTER_PATTERNS: RegExp[] = [
	/\bt[- ]?SNE\b/i,
	/\bUMAP\b/i,
	/\bPCA\b/i,
	/\b(dimensionality|dimension) reduction\b/i,
	/\b2D (embedding|projection)\b/i,
	/\bsample (cluster|embedding|projection|neighborhood)\b/i,
	/\bcluster(ing)? (plot|visualization)\b/i,
	/\breduced dimension\b/i,
	/\bembedding (space|plot|colored|with)\b/i,
	/\boverlay.{0,20}(on the|on a).{0,10}(scatter|UMAP|t-?SNE|PCA)\b/i
]

const MATRIX_PATTERNS: RegExp[] = [
	/\bheatmap\b/i,
	/\bmatrix\b/i,
	/\bgrid\b/i,
	/\bside by side\b/i,
	/\blandscape\b/i,
	/\bmulti-?gene\b/i,
	/\bmultiple genes?\b/i,
	/\bper (sample|patient)\b/i,
	/\bexpression (of|for|levels).{0,30}(and|,).{0,30}(and|,)/i
]

const _GENE_TOKEN_RE = /\b[A-Z][A-Z0-9]{1,7}\b/g
const _GENE_NOISE = new Set([
	'THE',
	'AND',
	'FOR',
	'ALL',
	'NOT',
	'ARE',
	'RNA',
	'DNA',
	'AML',
	'DE',
	'DGE',
	'GSEA',
	'UMAP',
	'PCA',
	'MRD',
	'CNS',
	'BMI',
	'WBC',
	'RAS',
	'MAPK',
	'PI3K',
	'AKT',
	'JAK',
	'STAT',
	'SWI',
	'SNF',
	'DB',
	'SQL',
	'KM',
	'OS',
	'EFS',
	'PFS',
	'CR',
	'VS',
	'TNBC',
	'CAR',
	'High hyperdiploid',
	'ETV6-RUNX1',
	'BCR-ABL1',
	'KMT2A',
	'CRLF2',
	'B-other',
	'DUX4',
	'PAX5alt',
	'BCR-ABL1-like',
	'TCF3-PBX1',
	'Low hypodiploid',
	'ETV6-RUNX1-like',
	'MEF2D',
	'Near haploid',
	'PAX5 P80R',
	'iAMP21',
	'BCL2/MYC',
	'NUTM1',
	'ZNF384-like',
	'KMT2A-like',
	'TCF3-HLF',
	'IKZF1 N159Y'
])

function looksLikeMultiGene(query: string, minGenes = 3): boolean {
	const hits = query.match(_GENE_TOKEN_RE) || []
	return hits.filter(h => !_GENE_NOISE.has(h)).length >= minGenes
}

const SUMMARY_SCATTER_PATTERNS: RegExp[] = [
	/\b(correlate|correlation)\b/i,
	/\bagainst\b/i,
	/\b\w+ (vs|versus) \w+ expression\b/i,
	/\bscatter\s*plot\b/i,
	/\bplot \w+ expression against\b/i,
	/\bexpression.{0,20}(vs|versus|against)\b/i
]

const SUMMARY_VIOLIN_PATTERNS: RegExp[] = [
	/\bexpression (by|in|for|across|between)\b/i,
	/\bexpression levels? (by|in|for|of|across|between)\b/i,
	/\b\w+ expression (by|in|for|across|between)\b/i,
	/\bstratified by\b/i,
	/\bviolin\b/i,
	/\bboxplot\b/i,
	/\bexpression.{0,30}(group|subtype|category|cohort|phase|arm|race|sex|gender|age|diagnosis)\b/i,
	/\b(levels?|counts?) (for|by|in|across|between|stratified)\b/i
]

const SUMMARY_BARCHART_PATTERNS: RegExp[] = [
	/\bhow many\b/i,
	/\bwhat (is|are) the (count|number|total|mean|median|average|percentage|proportion|frequency)\b/i,
	/\bwhat percentage\b/i,
	/\blist all\b/i,
	/\bshow (the )?(count|number|total|frequency|percentage|proportion|distribution)\b/i,
	/\bcount of\b/i,
	/\bdescribe the (cohort|dataset|population|samples?|patients?)\b/i,
	/\bwho (are|is) in\b/i,
	/\bbreakdown\b/i,
	/\bdemographic\b/i,
	/\bsummarize\b/i,
	/\boverview\b/i,
	/\bcross-?tabulate\b/i,
	/\bratio of\b/i,
	/\bbar ?chart\b/i,
	/\bhistogram\b/i,
	/\bfrequency of\b/i,
	/\bdistribution of\b/i
]

function matchesAny(query: string, patterns: RegExp[]): boolean {
	return patterns.some(p => p.test(query))
}

function augmentQuery(query: string): string {
	if (matchesAny(query, DGE_PATTERNS)) return 'Differential gene expression analysis: ' + query
	if (matchesAny(query, SURVIVAL_PATTERNS)) return 'Patient survival and outcome analysis: ' + query
	if (matchesAny(query, SAMPLESCATTER_PATTERNS)) return 'Dimensionality reduction sample scatter plot: ' + query
	if (matchesAny(query, MATRIX_PATTERNS) || looksLikeMultiGene(query))
		return 'Multi-gene expression matrix or heatmap: ' + query
	if (matchesAny(query, SUMMARY_SCATTER_PATTERNS)) return 'Summary scatter plot comparing two variables: ' + query
	if (matchesAny(query, SUMMARY_VIOLIN_PATTERNS)) return 'Summary violin plot of expression by clinical group: ' + query
	if (matchesAny(query, SUMMARY_BARCHART_PATTERNS)) return 'Summary barchart of categorical distribution: ' + query
	return query
}

// ---------------------------------------------------------------------------
//  Training Data
// ---------------------------------------------------------------------------

const CATEGORY_EXAMPLES: Record<string, string[]> = {
	summary: [
		// --- violin ---
		'Show TP53 expression by sex',
		'Compare MYC expression between molecular subtypes',
		'Show CDKN2A expression for KMT2A and DUX4 patients',
		'Show TP53 expression in males and females',
		'Plot PAX5 expression across each molecular subtype',
		'Show IKZF1 expression for BCR-ABL1 and TCF3-HLF samples',
		'What is the average RUNX1 expression in the KMT2A subtype',
		'Show NOTCH1 expression for DUX4 patients',
		'Compare Bortezomib LC50 between molecular subtypes',
		'Show Asparaginase LC50 by sex',
		'Compare Prednisolone LC50 between KMT2A and High hyperdiploid',
		'Show Bortezomib LC50 for male and female patients',
		'What is the median expression of FLT3 in this cohort',
		'Show GATA3 expression for patients under age 10',
		'Plot CEBPA expression levels across ancestry groups',
		'Display ERG expression in the PAX5alt subgroup',
		'Show drug sensitivity by molecular subtype',
		'Compare Asparaginase LC50 between DUX4 and CRLF2',
		'Show TP53 expression by ancestry',
		'Show MYC expression for patients over age 15',
		'Show ABL1 expression levels for BCR-ABL1 patients',
		'is tmem181 overexpressed in men',
		'compare tp53 expression between genders',
		'Show correlation between age and gender for KMT2A subtype',
		// --- scatter ---
		'Plot TP53 expression against MYC expression',
		'Correlate Bortezomib LC50 and Asparaginase LC50',
		'Show scatter plot of TP53 vs NRAS expression',
		'Plot CDKN2A expression against age',
		'Compare TP53 expression vs age using a scatter plot',
		'Correlate MYC and BCL2 expression',
		'Plot drug sensitivity against age',
		// --- barchart ---
		'How many patients are in each molecular subtype',
		'Show the distribution of molecular subtypes',
		'How many males and females are in this cohort',
		'What is the breakdown of ancestry in this dataset',
		'Show the age distribution for this cohort',
		'What percentage of patients are in the KMT2A subtype',
		'Cross-tabulate sex and molecular subtype',
		'Show the frequency of each ancestry group',
		'How many patients have the DUX4 subtype',
		'Show sample counts per molecular subtype',
		'What is the ratio of male to female patients',
		'Show the distribution of age at diagnosis',
		'Cross-tabulate ancestry and molecular subtype',
		'Show the number of patients in each subtype by sex',
		'What percentage of patients are male',
		'Show the breakdown of subtypes for patients under age 10',
		'How many BCR-ABL1 patients are in this cohort',
		'Display the distribution of Bortezomib LC50 values',
		'Show the percentage of each ancestry group by subtype',
		'Show ancestry for MEF2D and TCF3-PBX1 subtypes',
		// --- general ---
		'Show all molecular subtypes of leukemia',
		'List the clinical variables available',
		'What are the available subtypes in this cohort',
		'Summarize the clinical characteristics of the cohort',
		'Show summary of all molecular subtypes for patients with age from 10 to 40 years'
	],

	dge: [
		'Which genes are upregulated in KMT2A vs DUX4',
		'Show differential gene expression between males and females',
		'Run DE between BCR-ABL1 and TCF3-HLF subtypes',
		'Which genes are overexpressed in males compared to females',
		'Show volcano plot between men and women',
		'Which genes are the most upregulated between DUX4 and PAX5alt',
		'Run DGE analysis for KMT2A vs High hyperdiploid',
		'What are the most downregulated genes between CRLF2 and MEF2D',
		'Generate a volcano plot comparing DUX4 and NUTM1',
		'Show DE between patients under 10 and over 15',
		'Do differential gene expression for TCF3-HLF and TCF3-PBX1',
		'Which pathways are enriched between KMT2A and DUX4',
		'Run GSEA comparing BCR-ABL1 vs all other subtypes',
		'Which genes are differentially expressed between male and female patients',
		'Show DE between sensitive and resistant samples to Bortezomib',
		'Compare transcriptome differences between sensitive and resistant samples to Asparaginase in BCR-ABL1',
		'What are the top 50 DE genes between KMT2A and DUX4',
		'Run differential expression for BCR-ABL1 vs CRLF2',
		'Show volcano plot for male vs female patients in the DUX4 subtype',
		'Which genes have the largest fold change between KMT2A and High hyperdiploid',
		'Compare gene expression profiles between DUX4 and PAX5alt',
		'Show DE between men with age greater than 30 and women with age less than 50',
		'What are the most significant DE genes between TCF3-HLF and NUTM1',
		'Show volcano plot between men and women using wilcoxon method',
		'Which transcription factors are differentially expressed between subtypes',
		'Find upregulated genes in KMT2A compared to DUX4',
		'Show differential gene expression between TCF3-HLF NUTM1 and DUX4 PAX5alt',
		'Run differential gene expression analysis for males vs females using limma',
		'Compare gene expression between drug sensitive and drug resistant patients',
		'Run DGE between patients of European and African ancestry',
		'Show differentially expressed genes between BCR-ABL1 and all other patients',
		'What are the top DE genes between KMT2A and CRLF2',
		'Which kinase genes are overexpressed in KMT2A compared to DUX4',
		'Run DE analysis comparing patients under 5 vs over 10',
		'Show differentially expressed genes between Bortezomib sensitive and resistant',
		'Which cell cycle genes are dysregulated between KMT2A and High hyperdiploid',
		'Run DE between Asparaginase sensitive and resistant samples using edgeR',
		'Show differentially expressed genes with adjusted p-value below 0.01',
		'Which immune genes are upregulated in BCR-ABL1 vs DUX4',
		'Show top 100 differentially expressed genes sorted by p-value',
		'Compare expression between Prednisolone sensitive and resistant patients',
		'Run differential gene expression analysis for BCR-ABL1 vs TCF3-PBX1',
		'Which genes are housekeeping genes between male and female',
		'What genes are significantly different between KMT2A and MEF2D',
		'Run GSEA for hallmark gene sets between drug sensitive and resistant',
		'Compare transcriptomes between DUX4 and CRLF2 subtypes',
		'Which signaling pathways are activated in BCR-ABL1 compared to DUX4'
	],

	survival: [
		'Compare survival rates between KMT2A and DUX4',
		'Do patients with BCR-ABL1 have lower survival rates than other subtypes',
		'Show Kaplan-Meier curve for males vs females',
		'What is the hazard ratio for KMT2A vs DUX4',
		'Is there a survival difference between males and females',
		'Run Cox regression with age and molecular subtype as covariates',
		'Show time to event analysis for the BCR-ABL1 subtype',
		'Does Bortezomib sensitivity affect patient survival',
		'Compare overall survival between molecular subtypes',
		'What is the median survival for TCF3-HLF patients',
		'Does the treatment improve patient outcomes',
		'Do patients with DUX4 subtype survive longer than KMT2A',
		'Is there a difference in mortality between the subtypes',
		'Are outcomes better for patients under age 10',
		'Show Kaplan-Meier for BCR-ABL1 vs TCF3-PBX1 patients',
		'What is the 5-year event-free survival for DUX4',
		'Compare relapse-free survival between KMT2A and High hyperdiploid',
		'Does IKZF1 deletion affect overall survival',
		'Plot survival by molecular subtype',
		'Is there a survival benefit for drug-sensitive patients',
		'Show OS curves stratified by molecular subtype',
		'What is the 10-year survival rate for DUX4 patients',
		'Compare progression-free survival across subtypes',
		'Is there a survival advantage for patients under age 5',
		'Show time to relapse for KMT2A vs DUX4',
		'Do patients with low Bortezomib LC50 survive longer',
		'Run log-rank test comparing survival by sex',
		'What is the median event-free survival for the entire cohort',
		'Show cumulative incidence of relapse by molecular subtype',
		'Is TP53 associated with worse prognosis',
		'Compare disease-free survival between BCR-ABL1 and DUX4',
		'What is the probability of survival at 3 years for KMT2A patients',
		'Plot overall survival by age group',
		'Do females have better outcomes than males in this cohort',
		'Show Kaplan-Meier for patients with and without IKZF1 deletions',
		'Does achieving complete remission predict long-term survival',
		'Compare survival between patients who relapsed early vs late',
		'Is there a difference in time to death between the treatment protocols',
		'Show event-free survival for patients with KMT2A rearrangements',
		'What is the hazard ratio for BCR-ABL1 vs other subtypes',
		'Plot survival curves for each molecular subtype',
		'Run multivariate Cox model adjusting for age sex and subtype',
		'Are there any differences in survival based on ancestry',
		'Does drug resistance status affect long-term outcomes',
		'Show cumulative incidence curves for treatment-related mortality',
		'Is age at diagnosis a prognostic factor',
		'Compare time to progression between drug-sensitive and resistant patients',
		'What is the overall survival for patients over 15'
	],

	matrix: [
		'Show a matrix of TP53 KRAS and NRAS',
		'Show a heatmap of TP53 and RB1 with molecular subtype and sex',
		'Show TP53 MYC and BCL2 for male patients in a matrix',
		'Create a matrix with molecular subtype sex and TP53',
		'Show me a heatmap of the top expressed genes',
		'Display TP53 and PAX5 with sex and ancestry in a grid',
		'Show the expression of TP53 CDKN2A and IKZF1 across all samples',
		'Create a matrix of molecular subtype sex and ancestry',
		'Show TP53 and PAX5 for KMT2A and DUX4 subtypes in a matrix',
		'Show a matrix of TP53 NRAS KRAS with molecular subtype for patients under 20',
		'Show CDKN2A and IKZF1 with sex and ancestry in a grid',
		'Create a heatmap showing TP53 PAX5 and CDKN2A',
		'Show a matrix of the top genes across all samples',
		'Display TP53 and NRAS with molecular subtype annotation',
		'Create a matrix of CDKN2A IKZF1 and PAX5 with molecular subtype',
		'Show a heatmap of multiple genes across samples',
		'Show TP53 CDKN2A and NRAS by sex in a matrix',
		'Create a matrix with TP53 and molecular subtype annotation',
		'Show a heatmap of all genes in the KMT2A subtype',
		'Display IKZF1 and CDKN2A expression across subtypes in a grid',
		'Show a matrix of TP53 RB1 and CDKN2A for female patients',
		'Create a heatmap with TP53 PAX5 and IKZF1 annotated by ancestry',
		'Show the gene landscape across all molecular subtypes',
		'Display a matrix of TP53 and NRAS for DUX4 patients',
		'Create a matrix showing co-expression of TP53 and KRAS',
		'Show a heatmap of DNA repair genes',
		'Display the matrix with molecular subtype and sex overlays',
		'Create a matrix of NRAS and KRAS by subtype',
		'Show a heatmap of the most variable genes',
		'Display a matrix for kinase genes across the cohort',
		'Create a matrix of TP53 with ancestry annotation',
		'Show a matrix of TP53 IKZF1 and CDKN2A for patients under 10',
		'Show a heatmap of cell cycle genes',
		'Display PAX5 across molecular subtypes in a matrix',
		'Create a matrix with genes and drug sensitivity annotations',
		'Show a heatmap of transcription factor genes',
		'Display TP53 PAX5 CDKN2A and IKZF1 in a matrix',
		'Create a matrix of all highly expressed genes in this cohort',
		'Show a matrix of TP53 and NRAS for BCR-ABL1 vs DUX4',
		'Display a heatmap of leukemia driver genes',
		'Create a matrix showing gene and clinical variable associations',
		'Show a heatmap of pathway genes across samples',
		'Display a matrix of tumor suppressor genes',
		'Show TP53 CDKN2A NRAS KRAS with sex and subtype in a matrix',
		'Create a matrix of chromatin remodeling genes',
		'Show the gene expression landscape of signaling pathway genes',
		'Display a heatmap of TP53 and RAS pathway genes for male patients',
		'Show a matrix comparing expression patterns between KMT2A and DUX4',
		'Create a multi-gene expression grid with sex and subtype overlays'
	],

	sampleScatter: [
		'Show me the t-SNE plot',
		'Color the UMAP by molecular subtype',
		'Show t-SNE colored by TP53 expression',
		'Divide the t-SNE by sex',
		'Show UMAP with ancestry as shape',
		'Remove color from t-SNE',
		'Display the UMAP embedding',
		'Color the t-SNE by molecular subtype',
		'Show dimensionality reduction plot',
		'Split the UMAP into panels by molecular subtype',
		'Show me the transcriptome t-SNE',
		'Color the t-SNE by ancestry',
		'Show UMAP colored by MYC expression',
		'Split the t-SNE into panels by sex',
		'Change the UMAP color to molecular subtype',
		'Overlay TP53 expression on the UMAP',
		'Show the transcriptome UMAP',
		'Display t-SNE with molecular subtypes labeled',
		'Color the UMAP by age',
		'Remove the overlay from the UMAP',
		'Show t-SNE colored by sex',
		'Display UMAP grouped by molecular subtype',
		'Show the 2D embedding of the transcriptome data',
		'Color the scatter plot by molecular subtype',
		'Show the t-SNE for just the KMT2A samples',
		'Display UMAP with ancestry annotation',
		'Show t-SNE with Bortezomib LC50 as color',
		'Split the UMAP by molecular subtype',
		'Show t-SNE colored by Asparaginase LC50',
		'Display the UMAP colored by drug sensitivity',
		'Show UMAP for the BCR-ABL1 samples only',
		'Color the t-SNE by CDKN2A expression',
		'Show t-SNE colored by sex for patients under 20',
		'Display t-SNE with drug sensitivity overlay',
		'Change the UMAP coloring to ancestry',
		'Show dimensionality reduction colored by molecular subtype',
		'Split the t-SNE by sex and color by subtype',
		'Display the UMAP with subtype labels',
		'Show t-SNE for DUX4 patients only',
		'Color the UMAP by PAX5 expression',
		'Show the t-SNE without any annotations',
		'Display UMAP with KMT2A patients highlighted',
		'Show UMAP colored by IKZF1 expression',
		'Split UMAP into panels by ancestry',
		'Color t-SNE by Prednisolone LC50',
		'Show the sample scatter plot by molecular subtype',
		'Remove all overlays from the UMAP',
		'Show UMAP colored by sex and shaped by ancestry',
		'Show t-SNE divided by molecular subtype and colored by age'
	]
}

// ---------------------------------------------------------------------------
//  Explicit chart type overrides — bypass embedding when the user
//  unambiguously names a chart type or visualization keyword.
// ---------------------------------------------------------------------------

const EXPLICIT_OVERRIDES: { patterns: RegExp[]; category: string }[] = [
	{
		category: 'dge',
		patterns: [/\bvolcano\s*(plot|chart)?\b/i]
	},
	{
		category: 'sampleScatter',
		patterns: [/\bt[- ]?SNE\b/i, /\bUMAP\b/i, /\bPCA\b/i]
	},
	{
		category: 'matrix',
		patterns: [/\bheatmap\b/i, /\bmatrix\b/i]
	},
	{
		// explicit summary sub-types — user names the chart directly
		category: 'summary',
		patterns: [
			/\bviolin\s*(plot|chart)?\b/i,
			/\bbox\s*plot\b/i,
			/\bbar\s*chart\b/i,
			/\bhistogram\b/i,
			/\bscatter\s*plot\b/i
		]
	}
]

function getExplicitOverride(query: string): string | null {
	for (const { patterns, category } of EXPLICIT_OVERRIDES) {
		if (patterns.some(p => p.test(query))) return category
	}
	return null
}

// ---------------------------------------------------------------------------
//  Embedder & Classifier
// ---------------------------------------------------------------------------

export interface ClassifyResult {
	query: string
	category: string
	confidence: number
	all_scores: Record<string, number>
	above_threshold: boolean
}

class SentenceTransformerEmbedder {
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

export class EmbeddingClassifier {
	private embedder: SentenceTransformerEmbedder
	threshold: number
	private k: number
	private categories: string[] = []
	private allEmbeddings: number[][] = []
	private allLabels: string[] = []

	constructor(embedder: SentenceTransformerEmbedder, threshold = 0.9, k = 5) {
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

	async classify(query: string): Promise<ClassifyResult> {
		const augmented = augmentQuery(query)
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
	async classifyHybrid(query: string, llm: LlmConfig): Promise<ClassifyResult> {
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

		const embeddingResult = await this.classify(query)

		if (embeddingResult.above_threshold) {
			mayLog(
				`Hybrid router: embedding confident (${embeddingResult.confidence.toFixed(4)}), ` +
					`category=${embeddingResult.category}`
			)
			return embeddingResult
		}

		// Below threshold — fall back to LLM
		mayLog(
			`Hybrid router: embedding uncertain (${embeddingResult.confidence.toFixed(4)}), ` +
				`falling back to LLM (${llm.provider}/${llm.modelName})`
		)

		try {
			const llmResult = await classifyViaLlm(query, llm)
			const llmCategory = llmResult.plot ?? 'none'
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

// ---------------------------------------------------------------------------
//  LLM Fallback — used by classifyHybrid when embedding is uncertain
// ---------------------------------------------------------------------------

async function classifyViaLlm(
	userPrompt: string,
	llm: LlmConfig
): Promise<{ type: string; plot?: string; html?: string }> {
	// Lean prompt — just the category definitions and a few examples each.
	// This replaces the old approach of sending the entire aiRoute + dataset prompt
	// + all training examples, which could be thousands of tokens.
	const template = `Classify the following user query into exactly one category. Respond with ONLY a JSON object, no explanation.

Categories:
- "summary": Clinical data plots — distributions, bar charts, violin plots, boxplots, scatter plots of 1-2 variables. Queries about counts, percentages, expression by group, or correlating two variables.
- "dge": Differential gene expression — comparing gene expression between two groups. Keywords: upregulated, downregulated, DE, DGE, volcano plot, fold change, differential expression.
- "matrix": Multi-gene heatmap/matrix — displaying 3+ genes or variables across samples in a grid. Keywords: heatmap, matrix, landscape, multiple genes.
- "sampleScatter": Dimensionality reduction plots — t-SNE, UMAP, PCA embeddings with optional overlays. Keywords: t-SNE, UMAP, PCA, clustering, embedding.
- "survival": Survival/outcome analysis — Kaplan-Meier curves, hazard ratios, time-to-event. Keywords: survival, Kaplan-Meier, hazard ratio, prognosis, outcomes.

Examples:
Q: "Show TP53 expression by sex" → {"type":"plot","plot":"summary"}
Q: "How many patients in each subtype" → {"type":"plot","plot":"summary"}
Q: "Which genes are upregulated in KMT2A vs DUX4" → {"type":"plot","plot":"dge"}
Q: "Show a heatmap of TP53 KRAS and NRAS" → {"type":"plot","plot":"matrix"}
Q: "Color the UMAP by molecular subtype" → {"type":"plot","plot":"sampleScatter"}
Q: "Compare survival rates between KMT2A and DUX4" → {"type":"plot","plot":"survival"}

Q: "${userPrompt}" →`

	const response = await routeToLlm(template, llm)
	mayLog('LLM fallback raw response:', response)

	// LLMs often wrap JSON in markdown fences and/or append explanations.
	// Extract the first balanced JSON object from the response.
	return JSON.parse(extractJson(response))
}

/** Extract the first balanced JSON object or array from a string. */
function extractJson(text: string): string {
	const start = text.search(/[[{]/)
	if (start === -1) return text
	const open = text[start]
	const close = open === '{' ? '}' : ']'
	let depth = 0
	for (let i = start; i < text.length; i++) {
		if (text[i] === open) depth++
		else if (text[i] === close) depth--
		if (depth === 0) return text.slice(start, i + 1)
	}
	return text
}

async function routeToLlm(prompt: string, llm: LlmConfig): Promise<string> {
	let response: string
	if (llm.provider === 'SJ') {
		response = await callSjLlm(prompt, llm.modelName, llm.api)
	} else if (llm.provider === 'ollama') {
		response = await callOllama(prompt, llm.modelName, llm.api)
	} else {
		throw 'Unknown LLM provider: ' + llm.provider
	}
	return extractJson(response)
}

async function callOllama(prompt: string, modelName: string, apilink: string): Promise<string> {
	const result = await ezFetch(apilink + '/api/chat', {
		method: 'POST',
		body: {
			model: modelName,
			messages: [{ role: 'user', content: prompt }],
			raw: false,
			stream: false,
			keep_alive: 15,
			options: { top_p: 0.95, temperature: 0.01, num_ctx: 10000 }
		},
		headers: { 'Content-Type': 'application/json' },
		timeout: { request: 200000 }
	})
	if (result?.message?.content?.length > 0) return result.message.content
	throw 'Unexpected response format from Ollama'
}

async function callSjLlm(prompt: string, modelName: string, apilink: string): Promise<string> {
	const response = await ezFetch(apilink, {
		method: 'POST',
		body: {
			inputs: [
				{
					model_name: modelName,
					inputs: { text: prompt, max_new_tokens: 512, temperature: 0.01, top_p: 0.95 }
				}
			]
		},
		headers: { 'Content-Type': 'application/json' },
		timeout: { request: 200000 }
	})
	if (response?.outputs?.[0]?.generated_text) return response.outputs[0].generated_text
	throw 'Unexpected response format from SJ LLM'
}

// ---------------------------------------------------------------------------
//  Singleton — initialized once, reused across all requests
// ---------------------------------------------------------------------------

let classifierInstance: EmbeddingClassifier | null = null
let initPromise: Promise<EmbeddingClassifier> | null = null

/**
 * Get the singleton EmbeddingClassifier, initializing on first call.
 * Safe to call concurrently — only one init runs.
 *
 * @param threshold - OOD rejection threshold (default 0.9, tune via demo script)
 */
export async function getClassifier(threshold = 0.9): Promise<EmbeddingClassifier> {
	if (classifierInstance) return classifierInstance

	// Prevent duplicate init if called concurrently during startup
	if (!initPromise) {
		initPromise = (async () => {
			mayLog('EmbeddingClassifier: loading model...')
			const embedder = new SentenceTransformerEmbedder()
			await embedder.init()
			const clf = new EmbeddingClassifier(embedder, threshold)
			await clf.fit(CATEGORY_EXAMPLES)
			classifierInstance = clf
			mayLog('EmbeddingClassifier: ready')
			return clf
		})()
	}

	return initPromise
}
