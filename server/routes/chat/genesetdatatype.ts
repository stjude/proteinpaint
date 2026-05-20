import type { LlmConfig, GeneSetDataTypeResult } from '#types'
import { mayLog } from '#src/helpers.ts'
import { route_to_appropriate_llm_provider } from './routeAPIcall.ts'
import type { MsgToUser } from './scaffoldTypes.ts'
import { TermTypes } from '#shared/terms.js'

// List of keywords/phrases that may indicate a gene set is being referenced in the user prompt. This is useful when no geneset keywords are found but the user intends to use a geneset. This helps to generate a helpful error message stating no relevant genesets were found in the prompt.
export const GENE_SET_KEYWORDS = [
	'HALLMARK',
	'REACTOME',
	'KEGG',
	'BIOCARTA',
	'GO_',
	'geneset',
	'pathway',
	'gene set',
	'ssgsea'
]

// ---------------------------------------------------------------------------
//  Geneset data type classifier
// ---------------------------------------------------------------------------

/**
 * Uses an LLM to identify the intended data type for each gene set
 * referenced in the user prompt.
 *
 * Possible data types:
 *  - "${TermTypes.SSGSEA}"     — the user is asking about a per-sample enrichment
 *                   score for the gene set (${TermTypes.SSGSEA} / single-sample GSEA).
 *  - "${TermTypes.GENE_VARIANT}" — the user is asking about variants/mutations of the
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
	geneset: string
): Promise<GeneSetDataTypeResult | MsgToUser> {
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
					enum: [TermTypes.SSGSEA, TermTypes.GENE_VARIANT, TermTypes.GENE_EXPRESSION, 'ambiguous'],
					description:
						'"${TermTypes.SSGSEA}" if the user is asking about per-sample enrichment scores for the gene set; "${TermTypes.GENE_VARIANT}" if the user is asking about variants/mutations of the genes in the gene set; "${TermTypes.GENE_EXPRESSION}" if the user is asking about expression/upregulation/downregulation of the genes in the gene set; "ambiguous" if the intent is not clear.'
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
- "${TermTypes.SSGSEA}"      — the user is asking about a per-sample single-sample GSEA enrichment score for the gene set as a whole. Trigger keywords/phrases: "${TermTypes.SSGSEA}", "single sample GSEA", "enrichment score", "pathway score", "pathway activity", "pathway enrichment", "geneset score", "score of the pathway", "activity of the pathway", "enriched", "upregulated pathway", "downregulated pathway", "high/low enrichment".
- "${TermTypes.GENE_VARIANT}" — the user is asking about variants/mutations of the genes that belong to the gene set. Trigger keywords/phrases: "mutation(s)", "variant(s)", "SNV", "SNP", "indel", "deletion", "insertion", "fusion", "CNV", "copy number", "frameshift", "missense", "nonsense", "splice", "truncation", "altered", "alterations", "mutated genes in the pathway", "variants in the pathway".
- "${TermTypes.GENE_EXPRESSION}" — the user is asking about expression/upregulation/downregulation of the genes in the gene set. Trigger keywords/phrases: "expression", "expressed", "upregulated", "downregulated", "overexpressed", "underexpressed", "expression of the pathway".
- "ambiguous"   — the prompt does NOT clearly indicate either intent. Examples: the user only names the pathway (e.g. "show HALLMARK_APOPTOSIS"), or uses generic verbs ("show", "display", "look at") without any of the trigger keywords above.

Rules:
- If the prompt contains an ${TermTypes.SSGSEA} trigger word AND no ${TermTypes.GENE_VARIANT} trigger word, classify as "${TermTypes.SSGSEA}".
- If the prompt contains a ${TermTypes.GENE_VARIANT} trigger word AND no ssGSEA trigger word, classify as "${TermTypes.GENE_VARIANT}".
- If neither set of triggers is present, classify as "ambiguous".
- If both sets of triggers are present and the user has not made the target clear, classify as "ambiguous".
- "expression" of a single gene is NOT a gene-set data type. Only classify the geneset itself.

Respond with ONLY a valid JSON object that conforms to the following JSON schema. Do NOT include any text outside the JSON.

JSON Schema:
${jsonSchema}

Example 1 (${TermTypes.SSGSEA} — explicit):
User prompt: "show ${TermTypes.SSGSEA} scores for sdscd geneset"
Geneset: sdscd
Response: {"geneSet":"sdscd","dataType":"${TermTypes.SSGSEA}"}

Example 2 (${TermTypes.SSGSEA} — enrichment score wording):
User prompt: "what is the enrichment score of AJSJDJ across samples"
Geneset: AJSJDJ
Response: {"geneSet":"AJSJDJ","dataType":"${TermTypes.SSGSEA}"}

Example 3 (${TermTypes.GENE_EXPRESSION} — pathway activity wording):
User prompt: "compare sdswf12_csw pathway activity between subtypes"
Geneset: sdswf12_csw
Response: {"geneSet":"sdswf12_csw","dataType":"${TermTypes.GENE_EXPRESSION}"}

Example 3 (${TermTypes.GENE_EXPRESSION} — pathway activity wording):
User prompt: "compare upregulation of BGSBD_dwdwd in pathway"
Geneset: BGSBD_dwdwd
Response: {"geneSet":"BGSBD_dwdwd","dataType":"${TermTypes.GENE_EXPRESSION}"}

Example 4 (${TermTypes.SSGSEA} — single-sample GSEA shorthand):
User prompt: "single sample GSEA of wefwef_wfwf22bgb"
Geneset: wefwef_wfwf22bgb
Response: {"geneSet":"wefwef_wfwf22bgb","dataType":"${TermTypes.SSGSEA}"}

Example 5 (${TermTypes.SSGSEA} — upregulated pathway):
User prompt: "is Brdb34 upregulated in tumor samples"
Geneset: Brdb34
Response: {"geneSet":"Brdb34","dataType":"${TermTypes.SSGSEA}"}

Example 6 (${TermTypes.GENE_VARIANT} — mutations of pathway genes):
User prompt: "show mutations in genes of erfefr_3434_hrbrh"
Geneset: erfefr_3434_hrbrh
Response: {"geneSet":"erfefr_3434_hrbrh","dataType":"${TermTypes.GENE_VARIANT}"}

Example 7 (${TermTypes.GENE_VARIANT} — variants in pathway):
User prompt: "list variants in wsefwef_3434_fewf genes"
Geneset: wsefwef_3434_fewf
Response: {"geneSet":"wsefwef_3434_fewf","dataType":"${TermTypes.GENE_VARIANT}"}

Example 8 (${TermTypes.GENE_VARIANT} — copy number / fusions):
User prompt: "show fusions and copy number alterations in wfewfe_3434"
Geneset: wfewfe_3434
Response: {"geneSet":"wfewfe_3434","dataType":"${TermTypes.GENE_VARIANT}"}

Example 9 (${TermTypes.GENE_VARIANT} — altered genes in pathway):
User prompt: "which genes in wed565cdwd are altered in this cohort"
Geneset: wed565cdwd
Response: {"geneSet":"wed565cdwd","dataType":"${TermTypes.GENE_VARIANT}"}

Example 10 (${TermTypes.GENE_VARIANT} — SNV/indel):
User prompt: "SNVs and indels in genes of sdwd878_csd"
Geneset: sdwd878_csd
Response: {"geneSet":"sdwd878_csd","dataType":"${TermTypes.GENE_VARIANT}"}

Example 11 (ambiguous — bare pathway name):
User prompt: "show adswd_565"
Geneset: adswd_565
Response: {"geneSet":"adswd_565","dataType":"ambiguous"}

Example 12 (ambiguous — generic verb, no triggers):
User prompt: "look at 23sdcwsd_dewd in PAX5alt subtype"
Geneset: 23sdcwsd_dewd
Response: {"geneSet":"23sdcwsd_dewd","dataType":"ambiguous"}

Example 13 (ambiguous — both kinds of triggers in same prompt):
User prompt: "show enrichment and mutations for sdcsc_65454cwd
Geneset: sdcsc_65454cwd
Response: {"geneSet":"sdcsc_65454cwd","dataType":"ambiguous"}

User prompt: "${user_prompt}"
Geneset: ${geneset}
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

	if (
		result.dataType !== TermTypes.GENE_EXPRESSION &&
		result.dataType !== TermTypes.SSGSEA &&
		result.dataType !== TermTypes.GENE_VARIANT &&
		result.dataType !== 'ambiguous'
	) {
		mayLog('classifyGeneSetDataType: unexpected dataType in LLM response:', result.dataType)
		result.dataType = 'ambiguous'
	}
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
