import type { LlmConfig, GeneSetDataTypeResult } from '#types'
import { mayLog } from '#src/helpers.ts'
import { route_to_appropriate_llm_provider } from './routeAPIcall.ts'
import type { MsgToUser } from './scaffoldTypes.ts'

// ---------------------------------------------------------------------------
//  Geneset data type classifier
// ---------------------------------------------------------------------------

/**
 * Uses an LLM to identify the intended data type for each gene set
 * referenced in the user prompt.
 *
 * Possible data types:
 *  - "ssGSEA"     — the user is asking about a per-sample enrichment
 *                   score for the gene set (ssGSEA / single-sample GSEA).
 *  - "geneVariant" — the user is asking about variants/mutations of the
 *                   genes that belong to the gene set.
 *  - "ambiguous"  — the prompt does not make the intent clear.
 *
 * Returns a single GeneSetDataTypeResult when one geneset is supplied
 * (matching the per-phrase calling pattern used by the gene data type
 * agent). Returns null when there are no genesets to classify.
 */

export async function classifyGeneSetDataType(
	user_prompt: string,
	llm: LlmConfig,
	genesets: string[]
): Promise<GeneSetDataTypeResult | MsgToUser> {
	const genesetList = genesets.join(', ')

	const jsonSchema = JSON.stringify(
		{
			$schema: 'http://json-schema.org/draft-07/schema#',
			type: 'object',
			properties: {
				geneSet: {
					type: 'string',
					description: 'The gene set being classified (use the exact name from the input list)'
				},
				dataType: {
					type: 'string',
					enum: ['ssGSEA', 'geneVariant', 'ambiguous'],
					description:
						'"ssGSEA" if the user is asking about per-sample enrichment scores for the gene set; "geneVariant" if the user is asking about variants/mutations of the genes in the gene set; "ambiguous" if the intent is not clear.'
				}
			},
			required: ['geneSet', 'dataType'],
			additionalProperties: false
		},
		null,
		2
	)

	const prompt = `You are a genomics query classifier. Given a user prompt and a gene set name, determine which gene-set data type the user is referring to.

Valid gene-set data types are:
- "ssGSEA"      — the user is asking about a per-sample single-sample GSEA enrichment score for the gene set as a whole. Trigger keywords/phrases: "ssGSEA", "single sample GSEA", "enrichment score", "pathway score", "pathway activity", "pathway enrichment", "geneset score", "score of the pathway", "activity of the pathway", "enriched", "upregulated pathway", "downregulated pathway", "high/low enrichment".
- "geneVariant" — the user is asking about variants/mutations of the genes that belong to the gene set. Trigger keywords/phrases: "mutation(s)", "variant(s)", "SNV", "SNP", "indel", "deletion", "insertion", "fusion", "CNV", "copy number", "frameshift", "missense", "nonsense", "splice", "truncation", "altered", "alterations", "mutated genes in the pathway", "variants in the pathway".
- "ambiguous"   — the prompt does NOT clearly indicate either intent. Examples: the user only names the pathway (e.g. "show HALLMARK_APOPTOSIS"), or uses generic verbs ("show", "display", "look at") without any of the trigger keywords above.

Rules:
- If the prompt contains an ssGSEA trigger word AND no geneVariant trigger word, classify as "ssGSEA".
- If the prompt contains a geneVariant trigger word AND no ssGSEA trigger word, classify as "geneVariant".
- If neither set of triggers is present, classify as "ambiguous".
- If both sets of triggers are present and the user has not made the target clear, classify as "ambiguous".
- "expression" of a single gene is NOT a gene-set data type. Only classify the geneset itself.

Respond with ONLY a valid JSON object that conforms to the following JSON schema. Do NOT include any text outside the JSON.

JSON Schema:
${jsonSchema}

Example 1 (ssGSEA — explicit):
User prompt: "show ssGSEA scores for HALLMARK_APOPTOSIS"
Geneset: HALLMARK_APOPTOSIS
Response: {"geneSet":"HALLMARK_APOPTOSIS","dataType":"ssGSEA"}

Example 2 (ssGSEA — enrichment score wording):
User prompt: "what is the enrichment score of HALLMARK_P53_PATHWAY across samples"
Geneset: HALLMARK_P53_PATHWAY
Response: {"geneSet":"HALLMARK_P53_PATHWAY","dataType":"ssGSEA"}

Example 3 (ssGSEA — pathway activity wording):
User prompt: "compare HALLMARK_HYPOXIA pathway activity between subtypes"
Geneset: HALLMARK_HYPOXIA
Response: {"geneSet":"HALLMARK_HYPOXIA","dataType":"ssGSEA"}

Example 4 (ssGSEA — single-sample GSEA shorthand):
User prompt: "single sample GSEA of REACTOME_DNA_REPAIR"
Geneset: REACTOME_DNA_REPAIR
Response: {"geneSet":"REACTOME_DNA_REPAIR","dataType":"ssGSEA"}

Example 5 (ssGSEA — upregulated pathway):
User prompt: "is HALLMARK_INFLAMMATORY_RESPONSE upregulated in tumor samples"
Geneset: HALLMARK_INFLAMMATORY_RESPONSE
Response: {"geneSet":"HALLMARK_INFLAMMATORY_RESPONSE","dataType":"ssGSEA"}

Example 6 (geneVariant — mutations of pathway genes):
User prompt: "show mutations in genes of HALLMARK_P53_PATHWAY"
Geneset: HALLMARK_P53_PATHWAY
Response: {"geneSet":"HALLMARK_P53_PATHWAY","dataType":"geneVariant"}

Example 7 (geneVariant — variants in pathway):
User prompt: "list variants in REACTOME_DNA_REPAIR genes"
Geneset: REACTOME_DNA_REPAIR
Response: {"geneSet":"REACTOME_DNA_REPAIR","dataType":"geneVariant"}

Example 8 (geneVariant — copy number / fusions):
User prompt: "show fusions and copy number alterations in HALLMARK_MYC_TARGETS_V1"
Geneset: HALLMARK_MYC_TARGETS_V1
Response: {"geneSet":"HALLMARK_MYC_TARGETS_V1","dataType":"geneVariant"}

Example 9 (geneVariant — altered genes in pathway):
User prompt: "which genes in HALLMARK_APOPTOSIS are altered in this cohort"
Geneset: HALLMARK_APOPTOSIS
Response: {"geneSet":"HALLMARK_APOPTOSIS","dataType":"geneVariant"}

Example 10 (geneVariant — SNV/indel):
User prompt: "SNVs and indels in genes of REACTOME_CELL_CYCLE"
Geneset: REACTOME_CELL_CYCLE
Response: {"geneSet":"REACTOME_CELL_CYCLE","dataType":"geneVariant"}

Example 11 (ambiguous — bare pathway name):
User prompt: "show HALLMARK_APOPTOSIS"
Geneset: HALLMARK_APOPTOSIS
Response: {"geneSet":"HALLMARK_APOPTOSIS","dataType":"ambiguous"}

Example 12 (ambiguous — generic verb, no triggers):
User prompt: "look at HALLMARK_HYPOXIA in PAX5alt subtype"
Geneset: HALLMARK_HYPOXIA
Response: {"geneSet":"HALLMARK_HYPOXIA","dataType":"ambiguous"}

Example 13 (ambiguous — both kinds of triggers in same prompt):
User prompt: "show enrichment and mutations for HALLMARK_P53_PATHWAY"
Geneset: HALLMARK_P53_PATHWAY
Response: {"geneSet":"HALLMARK_P53_PATHWAY","dataType":"ambiguous"}

User prompt: "${user_prompt}"
Geneset: ${genesetList}
Response:`

	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelName)

	let result: GeneSetDataTypeResult
	try {
		const cleaned = stripMarkdownFencing(response)
		result = JSON.parse(cleaned)
	} catch {
		mayLog('classifyGeneSetDataType: failed to parse LLM response as JSON:', response)
		return { type: 'text', text: 'classifyGeneSetDataType: failed to parse LLM response as JSON:' + response }
	}

	if (!result.geneSet || !result.dataType) {
		mayLog('classifyGeneSetDataType: missing required fields in LLM response:', response)
		return { type: 'text', text: 'classifyGeneSetDataType: missing required fields in LLM response:' + response }
	}

	if (result.dataType !== 'ssGSEA' && result.dataType !== 'geneVariant' && result.dataType !== 'ambiguous') {
		mayLog('classifyGeneSetDataType: unexpected dataType in LLM response:', result.dataType)
		result.dataType = 'ambiguous'
	}
	console.log('classifyGeneSetDataType: LLM response parsed successfully:', result)
	return result
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
