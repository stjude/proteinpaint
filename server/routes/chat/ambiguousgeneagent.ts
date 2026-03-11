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
	'fpkm',
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
	// Differential expression
	'differential',
	'fold change',
	'differentially expressed',
	'dge',
	'de analysis'
]

/**
 * Returns true if the prompt contains gene names but does NOT specify
 * which gene feature the user is interested in, making it ambiguous.
 *
 * @param user_prompt     The raw user query string.
 * @param relevant_genes  Gene names extracted from the prompt (already validated against gene DB).
 * @returns               true if the prompt is ambiguous (missing gene feature), false otherwise.
 */
export function determineAmbiguousGenePrompt(user_prompt: string, relevant_genes: string[]): boolean {
	if (relevant_genes.length === 0) return false

	const promptLower = user_prompt.toLowerCase()

	// Remove gene names from the prompt so they don't accidentally match keywords
	// (e.g. a gene named "EXPRESSION" shouldn't count as a feature keyword)
	let promptWithoutGenes = promptLower
	for (const gene of relevant_genes) {
		const escaped = gene.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
		promptWithoutGenes = promptWithoutGenes.replace(new RegExp(escaped, 'g'), '')
	}

	// Check if any gene feature keyword is present in the remaining prompt
	for (const keyword of GENE_FEATURE_KEYWORDS) {
		if (promptWithoutGenes.includes(keyword)) {
			return false
		}
	}

	// Gene names found but no feature keyword — prompt is ambiguous
	return true
}
