import type { LlmConfig } from '#types'
import { mayLog } from '#src/helpers.ts'
import { route_to_appropriate_llm_provider } from './routeAPIcall.ts'

/**
 * Uses an LLM to identify the gene data type (expression, mutation,
 * methylation, etc.) for each gene mentioned in a user prompt.
 *
 * When the data type cannot be determined for one or more genes the
 * function returns a user-facing message asking for clarification.
 * When every gene has a clear data type it returns an empty string,
 * allowing the pipeline to continue.
 *
 * Examples:
 *   "show DUX4 expression in PAX5alt subtype"  → gene expression of DUX4
 *   "show DUX4 mutations in PAX5alt subtype"   → mutation in DUX4
 *   "show DUX4 in PAX5alt subtype"             → gene data type is missing for DUX4
 */

interface GeneDataTypeResult {
	gene: string
	dataType: string
}

export async function classifyGeneDataTypes(
	user_prompt: string,
	llm: LlmConfig,
	relevant_genes: string[]
): Promise<string> {
	const geneList = relevant_genes.join(', ')

	const prompt = `You are a genomics query classifier. Given a user prompt and a list of gene names found in the prompt, determine which gene data type the user is referring to for EACH gene.

Valid gene data types are:
- "expression" — gene expression, RNA, transcription, FPKM, TPM, counts, upregulated, downregulated, overexpressed, underexpressed
- "mutation" — gene variant, mutation, SNV, SNP, indel, deletion, insertion, fusion, CNV, copy number, frameshift, missense, nonsense, splice, truncation
- "methylation" — DNA methylation, CpG, epigenetic
- "differential_expression" — differential expression, fold change, DGE, DE analysis
- "missing" — the prompt does NOT specify or imply any gene data type for this gene

Respond with ONLY a valid JSON array. Each element must have "gene" (string) and "dataType" (string). Do NOT include any text outside the JSON.

Example 1:
User prompt: "show DUX4 expression in PAX5alt subtype"
Genes: DUX4
Response: [{"gene":"DUX4","dataType":"expression"}]

Example 2:
User prompt: "show TP53 mutations and MYC expression"
Genes: TP53, MYC
Response: [{"gene":"TP53","dataType":"mutation"},{"gene":"MYC","dataType":"expression"}]

Example 3:
User prompt: "show DUX4 in PAX5alt subtype"
Genes: DUX4
Response: [{"gene":"DUX4","dataType":"missing"}]

User prompt: "${user_prompt}"
Genes: ${geneList}
Response:`

	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelName)
	mayLog('classifyGeneDataTypes raw response:', response)

	let results: GeneDataTypeResult[]
	try {
		// Strip any markdown fencing the LLM may have added
		const cleaned = response
			.trim()
			.replace(/^```json\s*/, '')
			.replace(/^```\s*/, '')
			.replace(/\s*```$/, '')
			.trim()
		results = JSON.parse(cleaned)
	} catch {
		mayLog('classifyGeneDataTypes: failed to parse LLM response as JSON:', response)
		// Fall back: if we can't parse, let the pipeline continue
		return ''
	}

	if (!Array.isArray(results)) return ''

	const missingGenes = results.filter(r => r.dataType === 'missing').map(r => r.gene)
	const classifiedGenes = results.filter(r => r.dataType !== 'missing')

	if (missingGenes.length === 0) {
		// All genes have a clear data type — log the classifications and continue
		for (const g of classifiedGenes) {
			mayLog(`Gene "${g.gene}" classified as: ${g.dataType}`)
		}
		return ''
	}

	// Build a message that tells the user which genes are missing a data type
	// and which ones were successfully classified
	const parts: string[] = []

	if (classifiedGenes.length > 0) {
		const classifiedDescriptions = classifiedGenes.map(g => `${g.gene} (${g.dataType})`).join(', ')
		parts.push(`Identified data types: ${classifiedDescriptions}.`)
	}

	if (missingGenes.length === 1) {
		parts.push(
			`Gene data type is missing for ${missingGenes[0]}. Please specify what you would like to see for this gene (e.g. expression, mutation, methylation).`
		)
	} else {
		parts.push(
			`Gene data type is missing for ${missingGenes.join(
				', '
			)}. Please specify what you would like to see for these genes (e.g. expression, mutation, methylation).`
		)
	}

	return parts.join(' ')
}
