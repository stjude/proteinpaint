import type { LlmConfig } from '@sjcrh/proteinpaint-types'
import type { route_to_appropriate_llm_provider } from './routeAPIcall.ts'
import type { MsgToUser } from './scaffoldTypes.ts'
import type { mayLog } from '#src/helpers.ts'

const TermTypeDefinitions: Record<string, string> = {
	survival:
		'Supports survival analysis, time-to-event analysis, and Kaplan-Meier / Cox regression workflows. Represents a variable capturing the time until an event of interest occurs (e.g., death, relapse, progression), typically paired with an event/censoring indicator.',
	geneVariant:
		'Supports genetic variant analysis, mutation analysis, somatic/germline variant queries, and genotype-phenotype association studies. Represents a specific genetic variant or mutation (e.g., SNV, indel, copy number change) at the gene or locus level.',
	geneExpression:
		'Supports gene expression analysis, bulk RNA-seq / microarray expression queries, differential expression comparisons, and expression-based correlation or stratification. Represents the expression level of a gene.',
	isoformExpression:
		'Supports isoform-level expression analysis, transcript-level quantification, alternative splicing analysis, and isoform-specific differential expression. Represents the expression level of a specific isoform (transcript) of a gene.',
	ssGSEA:
		'Supports single-sample gene set enrichment analysis (ssGSEA), pathway activity scoring, gene set / signature scoring, and pathway-level comparisons across samples. Represents a per-sample enrichment score for a given gene set or pathway.',
	dnaMethylation:
		'Supports DNA methylation analysis, epigenetic analysis, differential methylation queries, and methylation-expression correlation studies. Represents the methylation status or beta value of a DNA region (e.g., CpG site, promoter, or region).',
	singleCellCellType:
		'Supports single-cell cell type analysis, cell type composition / proportion analysis, and cell-type-based stratification or annotation queries on single-cell data. Represents the assigned cell type label for cells in single-cell data.',
	singleCellGeneExpression:
		'Supports single-cell gene expression analysis, per-cell expression queries, cell-type-specific expression comparisons, and single-cell differential expression. Represents the gene expression level measured at single-cell resolution.'
}

export async function answerDataQueries(
	userPrompt: string,
	llm: LlmConfig,
	allowedTermTypes: string[]
): Promise<MsgToUser> {
	// Keep only the allowed term types that have a description defined.
	// Preserves the order of allowedTermTypes for deterministic prompts.
	const describedAllowedTerms: Array<[string, string]> = allowedTermTypes
		.filter(term => term in TermTypeDefinitions)
		.map(term => [term, TermTypeDefinitions[term]])

	// If none of the allowed terms have descriptions, we have no grounded basis
	// to classify against — return "Unsure" rather than hallucinate capabilities.
	if (describedAllowedTerms.length === 0) {
		return { type: 'text', text: 'No available data variable descriptions found.' } as MsgToUser
	}

	const allowedTermsBlock = describedAllowedTerms.map(([term, desc]) => `- ${term}: ${desc}`).join('\n')

	const allowedTermNames = describedAllowedTerms.map(([term]) => term).join(', ')

	const prompt = `You are a strict classifier that determines whether a user's query can be answered using a dataset.
    You must return ONLY valid JSON that matches exactly one of:
    - {"ans": "Yes", "term": "<the allowedTermType that matched to answer yes>"}
    - {"ans": "No", "term": ""}
    - {"ans": "Unsure", "term": ""}
    No explanations. No extra text.
    ---
    You are given:
    1. A user query about data, variables, or analyses.
    2. A list of allowed variable types supported by the dataset, each with a description of what it represents and which analyses it supports.

    Allowed variable types (name: description):
    ${allowedTermsBlock}

    The "term" field in your JSON response, when "ans" is "Yes", MUST be exactly one of these names (case-sensitive):
    ${allowedTermNames}
    ---
    Decision rules:
    1. Respond "Yes" if:
    - The query clearly refers to variables or analyses that are directly supported by one of the allowed variable types, based on its description.
    - Match the query's intent against the "Supports ..." capabilities listed in each description, not just the variable name.
    - Set "term" to the single allowed variable type whose description best supports the query.
    2. Respond "No" if:
    - The query requires variables, data, or analyses that are NOT covered by any description in the allowed list.
    - The query is clearly out of scope for every allowed variable type.
    3. Respond "Unsure" if:
    - The query is ambiguous, vague, or underspecified.
    - It is unclear which (if any) allowed variable type would be needed.
    - The query uses general terms (e.g., "treatment", "outcomes", "chemotherapy") that do not map specifically to any described variable type.
    - The query requires combining multiple variable types and it is unclear whether all required ones are present.
    ---
    Important constraints:
    - Be conservative. When in doubt, return "Unsure".
    - Ground every "Yes" decision in a specific allowed variable type's description.
    - Do NOT assume capabilities beyond what the descriptions state.
    - Do NOT infer unsupported analyses or unlisted variable types.
    - Match based on meaning and the described supported analyses, not just keyword overlap with the variable name.
    - If the query requires combining multiple variables and any one is missing from the allowed list → return "No".
    ---
    User query:
    "${userPrompt}"
    Answer:`

	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelName)
	let parsed: any
	try {
		parsed = JSON.parse(response) as { ans: string; term: string }
	} catch {
		throw `Couldn't parse ${response}  from binary data query.`
	}
	mayLog('Used term blocks: ', allowedTermsBlock)
	mayLog(`---> Binary Data Query: ${JSON.stringify(parsed)}`)
	let retVal: any
	if (parsed.ans === 'Yes') {
		retVal = { type: 'text', text: `Yes. Is ${parsed.term} the relevant variable(s) you are looking for?` }
	} else {
		retVal = {
			type: 'text',
			text: parsed.ans === 'No' ? 'No' : 'Not sure, the query is ambiguous or underspecified. Could you please clarify?'
		}
	}
	return retVal
}
