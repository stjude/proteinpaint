/**
 * Determines whether a user prompt that mentions gene names is ambiguous
 * because it does not specify a gene feature (e.g. gene expression,
 * DNA methylation, gene variant/mutation).
 *
 * For example, "Show TP53" is ambiguous because it is unclear whether
 * the user wants gene expression, mutations, methylation, etc.
 * But "Show TP53 expression" is not ambiguous.
 */

// Keywords that indicate the user has specified a gene feature.
// Organized by feature category for clarity.
const GENE_FEATURE_KEYWORDS: string[] = [
	// Gene expression
	'expression',
	'expressed',
	'rna',
	'rnaseq',
	'mrna',
	'transcription',
	'transcript',
	'transcriptome',
	'fpkm',
	'rpkm',
	'tpm',
	'counts',
	'gene expression',
	'upregulated',
	'downregulated',
	'upregulate',
	'downregulate',
	'overexpressed',
	'overexpress',
	'underexpressed',
	'underexpress',
	// DNA methylation
	'methylation',
	'methylated',
	'unmethylated',
	'dnme',
	'cpg',
	'epigenetic',
	// Gene variant / mutation
	'variant',
	'variants',
	'mutation',
	'mutations',
	'mutated',
	'mutant',
	'snv',
	'snp',
	'indel',
	'deletion',
	'insertion',
	'fusion',
	'cnv',
	'copy number',
	'lollipop',
	'truncation',
	'frameshift',
	'missense',
	'nonsense',
	'splice',
	'knockout',
	'knockoff',
	'gain',
	'loss',
	// Differential expression
	'differential',
	'fold change',
	'differentially expressed',
	'dge',
	'de analysis'
]

const DIAGNOSIS_GROUP_KEYWORDS: string[] = ['subtype', 'diagnosis group', 'group', 'category', 'class', 'cluster'] // Keywords that indicate the user may be referring to a diagnosis group/subtype named after a gene rather than the gene itself. This is relevant for datasets where some diagnosis groups are named after genes (e.g. "MEF2D"), which can create ambiguity if the user prompt includes the gene name but does not specify whether they are referring to the gene or the subtype.

/**
 * Returns true if the prompt contains gene names but does NOT specify
 * which gene feature the user is interested in, making it ambiguous.
 *
 * @param user_prompt     The raw user query string.
 * @param relevant_genes  Gene names extracted from the prompt (already validated against gene DB).
 * @param dataset_json    The dataset JSON which may contain an "ExcludedKeywords" list of gene names that are also used as diagnosis group names (e.g. "MEF2D" could be a gene or a subtype name). If the prompt contains an excluded keyword and does not contain any diagnosis group keywords, we should treat this as an ambiguous prompt and ask the user to clarify whether they are referring to the gene or the diagnosis group.
 * @returns               empty string if user prompt is not ambiguous. If user prompt is ambiguous, returns a message prompting the user to clarify their question.
 */

export function determineAmbiguousGenePrompt(user_prompt: string, relevant_genes: string[], dataset_json: any): string {
	if (relevant_genes.length === 0) return ''
	// Remove gene names from the prompt so they don't accidentally match keywords
	// (e.g. a gene named "EXPRESSION" shouldn't count as a feature keyword)
	let promptWithoutGenes = user_prompt.toLowerCase()

	const exclude_keywords: string[] = dataset_json?.ExcludedKeywords ?? []
	if (exclude_keywords.length > 0) {
		const gene_group_intersection = exclude_keywords.filter(x => relevant_genes.includes(x.toLowerCase()))
		if (gene_group_intersection.length > 0) {
			// If any of the relevant genes are in the excluded keywords list its possible the user is referring to a diagnosis group (named after a gene) rather than the gene itself. If the prompt contains words like "subtype", "diagnosis group", "group", "category", "class", "cluster" then we can infer the user is likely referring to a diagnosis group rather than the gene itself. If not, we should still treat this as an ambiguous gene/diagnosis group prompt and ask the user to clarify.
			// Check if any gene feature keyword is present in the remaining prompt
			for (const keyword of DIAGNOSIS_GROUP_KEYWORDS) {
				if (promptWithoutGenes.includes(keyword)) {
					return ''
				}
			}
		}
	}

	for (const gene of relevant_genes) {
		const escaped = gene.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
		promptWithoutGenes = promptWithoutGenes.replace(new RegExp(escaped, 'g'), '')
	}

	// Check if any gene feature keyword is present in the remaining prompt
	for (const keyword of GENE_FEATURE_KEYWORDS) {
		if (promptWithoutGenes.includes(keyword)) {
			return ''
		}
	}

	// Gene names found but no feature keyword — prompt is ambiguous
	return (
		'Your query includes gene names (' +
		relevant_genes.join(', ') +
		'), but it is not clear which feature of the gene you are referring to (e.g. expression, methylation, mutation, etc.). Please rephrase your question to clarify what information you are seeking about the gene.'
	)
}
