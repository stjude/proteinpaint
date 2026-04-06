import type { LlmConfig, GeneDataTypeResult } from '#types'
import { mayLog } from '#src/helpers.ts'
import { route_to_appropriate_llm_provider } from './routeAPIcall.ts'

// ---------------------------------------------------------------------------
//  Function 1: Classify each term as "gene" or "group"
// ---------------------------------------------------------------------------

/**
 * For terms that appear in both the gene database and the dataset's
 * ExcludedKeywords (i.e. diagnosis-group names that are also gene names),
 * asks the LLM whether the user is referring to the gene or the group.
 *
 * Returns the subset of `relevant_genes` that the LLM considers to be
 * actual gene references (group-only terms are filtered out).
 * If there are no ambiguous terms, returns `relevant_genes` unchanged.
 */

interface GeneOrGroupOrAmbiguousResult {
	term: string
	role: 'gene' | 'group' | 'ambiguous'
}

export async function classifyGeneOrGroup(
	user_prompt: string,
	llm: LlmConfig,
	gene_group_intersection: string[] // Genes from db that are present in the user prompt
): Promise<{ term: string; role: string }[]> {
	//const allTerms = relevant_genes.map(x => x.toUpperCase()).join(', ')
	const ambiguousTerms = gene_group_intersection.join(', ')

	const jsonSchema = JSON.stringify(
		{
			$schema: 'http://json-schema.org/draft-07/schema#',
			type: 'array',
			items: {
				type: 'object',
				properties: {
					term: {
						type: 'string',
						description: 'The ambiguous term being classified'
					},
					role: {
						type: 'string',
						enum: ['gene', 'group', 'ambiguous'],
						description:
							'"gene" if the term refers to the biological gene, "group" if it refers to a diagnosis subtype/group, "ambiguous" if the context does not make it clear'
					}
				},
				required: ['term', 'role'],
				additionalProperties: false
			}
		},
		null,
		2
	)

	const prompt = `You are a genomics query classifier. Some terms in the user prompt match both a gene name and a diagnosis group/subtype name. For each term listed in the ambiguous terms list, decide whether the user is referring to it as a "gene" (the biological entity), a "group" (a diagnosis subtype/group) or if no relevant keywords found then "ambiguous".

Rules:
- If the term appears ONLY near keywords like "subtype", "group", "diagnosis", "category", or is used to describe a patient cohort, classify it as "group".
- If the term appears ONLY near keywords like "expression", "mutation", "variant", "methylation", classify it as "gene".
- If none of the above keywords are near the term , classify it as "ambiguous".

Respond with ONLY valid JSON that conforms to the following JSON schema. Do NOT include any text outside the JSON.

JSON Schema:
${jsonSchema}

Example 1:
User prompt: "show ABC expression in PQR subtype"
Ambiguous terms (both gene and group name): [PQR, ABC]
Response: [{"term":"ABC","role":"gene"},{"term":"PQR","role":"group"}]

Example 2:
User prompt: "show ABC2 expression in EFG2 and PQR2 subtypes"
Ambiguous terms (both gene and group name): [ABC2, EFG2, PQR2]
Response: [{"term":"ABC2","role":"gene"},{"term":"EFG2","role":"group"},{"term":"PQR2","role":"group"}]

Example 3:
User prompt: "show age for ABC3 and XYZ3 subtypes"
Ambiguous terms (both gene and group name): [ABC3, XYZ3]
Response: [{"term":"ABC3","role":"group"},{"term":"XYZ3","role":"group"}]

Example 4:
User prompt: "show ABC4 expression"
Ambiguous terms (both gene and group name): [ABC4]
Response: [{"term":"ABC4","role":"gene"}]

Example 5:
User prompt: "show ABC5 in PQR5 subtype"
Ambiguous terms (both gene and group name): [PQR5]
Response: [{"term":"PQR5","role":"group"}]

Example 6:
User prompt: "show ABC6"
Ambiguous terms (both gene and group name): [ABC6]
Response: [{"term":"ABC6","role":"ambiguous"}]

Example 7:
User prompt: "show ABC7 expression in PQR7 and EFG7"
Ambiguous terms (both gene and group name): [ABC7, PQR7, EFG7]
Response: [{"term":"ABC7","role":"gene"},{"term":"PQR7","role":"ambiguous"},{"term":"EFG7","role":"ambiguous"}]

Example 8:
User prompt: "show ABC8 expression in EFG8 and PQR8 subtypes"
Ambiguous terms (both gene and group name): [EFG8, PQR8]
Response: [{"term":"ABC8","role":"gene"},{"term":"EFG8","role":"group"},{"term":"PQR8","role":"group"}]

Example 9:
User prompt: "compare ABC9 in EFG9 and PQR9 subtypes"
Ambiguous terms (both gene and group name): [EFG9, ABC9]
Response: [{"term":"ABC9","role":"ambiguous"},{"term":"EFG9","role":"group"}]

Example 10:
User prompt: "show ABC10 in PQR10 subtype"
Ambiguous terms (both gene and group name): [ABC10]
Response: [{"term":"ABC10","role":"ambiguous"}]

User prompt: "${user_prompt}"
Ambiguous terms (both gene and group name): [${ambiguousTerms}]
Response:`

	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelName)

	let results: GeneOrGroupOrAmbiguousResult[]
	try {
		const cleaned = stripMarkdownFencing(response)
		results = JSON.parse(cleaned)
	} catch {
		mayLog('classifyGeneOrGroup: failed to parse LLM response as JSON:', response)
		throw 'Failed to parse LLM response as JSON'
	}

	if (!Array.isArray(results)) throw 'classifyGeneOrGroup response is not an array'

	const geneTerms: { term: string; role: string }[] = results.filter(r => r.role === 'group')
	//const filteredGenes = gene_group_intersection.filter(g => geneTerms.includes(g.toLowerCase()))

	return geneTerms
}

// ---------------------------------------------------------------------------
//  Function 2: Determine the gene data type for each gene
// ---------------------------------------------------------------------------

/**
 * Uses an LLM to identify the gene data type (expression, mutation,
 * methylation, etc.) for each gene in the list.
 *
 * Returns an empty string when every gene has a clear data type
 * (pipeline continues). Returns a user-facing message when one or
 * more genes are missing a data type.
 */

export async function classifyGeneDataType(
	user_prompt: string,
	llm: LlmConfig,
	relevant_genes: string[],
	dataset_json: any
): Promise<GeneDataTypeResult | string> {
	const exclude_keywords: string[] = dataset_json?.ExcludedKeywords ?? []
	let genes: string[] = []
	if (exclude_keywords.length > 0) {
		const gene_group_intersection = exclude_keywords.filter(x => relevant_genes.includes(x.toLowerCase()))
		if (gene_group_intersection.length > 0) {
			const classified_genes = (await classifyGeneOrGroup(user_prompt, llm, gene_group_intersection))
				.filter(geneTerm => geneTerm.role === 'group')
				.map(g => g.term.toLowerCase())
			genes = relevant_genes.filter(x => !classified_genes.includes(x))
		} else {
			genes = relevant_genes
		}
	} else {
		genes = relevant_genes
	}
	const geneList = genes.map(x => x.toUpperCase()).join(', ')
	const prompt = `You are a genomics query classifier. Given a user prompt and a list of gene names, determine which gene data type the user is referring to for EACH gene.

Valid gene data types are:
- "expression" — gene expression, RNA, transcription, FPKM, TPM, counts, upregulated, downregulated, overexpressed, underexpressed
- "variant" — gene variant, mutation, SNV, SNP, indel, deletion, insertion, fusion, CNV, copy number, frameshift, missense, nonsense, splice, truncation
- "methylation" — DNA methylation, CpG, epigenetic
- "protein" — protein abundance, proteomics
- "missing" — the prompt does NOT specify or imply any gene data type for this gene

Respond with ONLY a valid JSON object. The object must have "gene" (string) and "dataType" (string). Do NOT include any text outside the JSON.

Example 1:
User prompt: "show ABC expression"
Genes: [ABC]
Response: {"gene":"ABC","dataType":"expression"}

Example 2:
User prompt: "show EFG mutations"
Genes: [EFG]
Response: {"gene":"EFG","dataType":"variant"}

Example 3:
User prompt: "show PQR"
Genes: [PQR]
Response: {"gene":"PQR","dataType":"missing"}

Example 3:
User prompt: "show XYZ protein levels"
Genes: [PQR]
Response: {"gene":"XYZ","dataType":"protein"}

User prompt: "${user_prompt}"
Genes: [${geneList}]
Response:`

	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelName)

	let result: GeneDataTypeResult
	try {
		const cleaned = stripMarkdownFencing(response)
		result = JSON.parse(cleaned)
	} catch {
		mayLog('classifyGeneDataType: failed to parse LLM response as JSON:', response)
		return ''
	}

	if (result.dataType === 'missing') {
		return `Gene data type is missing for ${result.gene}. Please specify what you would like to see for this gene (e.g. expression, variant, methylation).`
	} else {
		return result
	}
}

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

function stripMarkdownFencing(text: string): string {
	return text
		.trim()
		.replace(/^```json\s*/, '')
		.replace(/^```\s*/, '')
		.replace(/\s*```$/, '')
		.trim()
}
