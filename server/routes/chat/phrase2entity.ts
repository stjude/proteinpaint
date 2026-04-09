import type { LlmConfig, GeneDataTypeResult } from '#types'
import { extractGenesFromPrompt } from './utils.ts'
import { classifyGeneDataType } from './genedatatypeagentnew.ts'
import { determineAmbiguousGenePrompt } from './ambiguousgeneagent.ts'
import { getDsAllowedTermTypes } from '../termdb.config.ts'
import { route_to_appropriate_llm_provider } from './routeAPIcall.ts'
import type { Scaffold, SummaryScaffold, Entity, Phrase2EntityResult } from './scaffoldTypes.ts'

async function validateNonDictionaryTypes(
	phrase: string,
	llm: LlmConfig,
	genes_list: string[],
	dataset_json: any
): Promise<{ type: 'text'; text: string } | { geneFeatures: GeneDataTypeResult } | null> {
	const relevant_genes = extractGenesFromPrompt(phrase, genes_list)
	if (relevant_genes.length > 0) {
		// for e.g. classifying prompts such as "Show TP53". If not clear which feature (gene expression, mutation, etc.) of TP53 the user is referring to,
		// we want to classify this as an "ambiguous_gene_prompt" plot type and prompt the user to clarify their question. This function does NOT use an LLM
		// and searches for specific keywords in the user prompt to determine if the prompt is ambiguous with respect to which gene feature the user is referring to.
		const AmbiguousGeneMessage = determineAmbiguousGenePrompt(phrase, relevant_genes, dataset_json)
		if (AmbiguousGeneMessage.length > 0) {
			return {
				type: 'text',
				text: AmbiguousGeneMessage
			}
		}
		const geneDataTypeMessage: GeneDataTypeResult | string = await classifyGeneDataType(
			// This function uses an LLM to classify which specific gene features (e.g. expression, mutation, etc.) are relevant to the user prompt for each of the relevant genes mentioned in the prompt.
			phrase,
			llm,
			relevant_genes,
			dataset_json
		)

		if (typeof geneDataTypeMessage === 'string') {
			if (geneDataTypeMessage.length > 0) {
				// This shows error is any of the genes are missing relevant features
				return {
					type: 'text',
					text: geneDataTypeMessage
				}
			} else {
				// Should not happen
				throw 'classifyGeneDataType agent returned an empty string, which is unexpected.'
			}
		} else if (geneDataTypeMessage.gene) {
			return { geneFeatures: geneDataTypeMessage }
		} else {
			throw 'geneDataTypeMessage has unknown data type returned from classifyGeneDataType agent'
		}
	} else {
		// Need a similar exhaustive database for metabolites, genesets (e.g. msigdb)
		return null // This means the term could be some other non-dictionary type (e.g. ssGSEA score, metabolites, etc.) or it could be a dictionary term.
	}
}

async function inferEntities(
	phrase: string,
	llm: LlmConfig,
	genes_list: string[],
	dataset_json: any
): Promise<Entity | { type: 'text'; text: string }> {
	const validatedNonDict = await validateNonDictionaryTypes(phrase, llm, genes_list, dataset_json)
	if (!validatedNonDict) {
		// No match, probably a dictionary term or a non-dictionary term we don't have a way to validate yet (e.g. ssGSEA score, metabolites, etc.)
		return { termType: 'dictionary', phrase: phrase }
	} else if ('type' in validatedNonDict && validatedNonDict.type === 'text') {
		return validatedNonDict // This means we encountered an error or an ambiguous gene prompt, and we want to return early with a user-facing message.
	} else if ('geneFeatures' in validatedNonDict) {
		if (validatedNonDict.geneFeatures.dataType == 'expression') {
			return { termType: 'geneExpression', phrase: phrase }
		} else if (validatedNonDict.geneFeatures.dataType === 'methylation') {
			return { termType: 'dnaMethylation', phrase: phrase }
		} else if (validatedNonDict.geneFeatures.dataType === 'variant') {
			return { termType: 'geneVariant', phrase: phrase }
		} else if (validatedNonDict.geneFeatures.dataType === 'proteome') {
			return { termType: 'proteomeAbundance', phrase: phrase }
		} else {
			throw 'validateNonDictionaryTypes returned an unrecognized geneFeatures:' + validatedNonDict.geneFeatures
		}
	} else {
		// Should not happen
		throw (
			'validatedNonDict has unknown data type returned from validateNonDictionaryTypes function:' +
			JSON.stringify(validatedNonDict)
		)
	}
}

async function phrase2entitytw(
	phrase: string,
	llm: LlmConfig,
	genes_list: string[],
	dataset_json: any,
	ds: any
): Promise<{ type: 'text'; text: string } | Entity> {
	const tw1Result = await inferEntities(phrase, llm, genes_list, dataset_json)
	if ('type' in tw1Result && tw1Result.type === 'text') {
		return { type: 'text', text: tw1Result.text }
	}
	//console.log("getDsAllowedTermTypes(ds):", getDsAllowedTermTypes(ds))
	if ((tw1Result as Entity).termType == 'dictionary') {
		return tw1Result // Dictionary term
	} else if (getDsAllowedTermTypes(ds).includes((tw1Result as Entity).termType)) {
		return tw1Result
	} else {
		return {
			type: 'text',
			text: `The termType "${
				(tw1Result as Entity).termType
			}" in phrase "${phrase}" is not an allowed termType for this dataset`
		}
	}
}

/*
 * For filter phrases that have literal or conceptual "ands", they're grouped in a single array
 * If "or", they're grouped into separate array elements
 * For examples:
 * "young and black patients" -> ["young", "black"]
 * "young and black patients or old and white patients" -> [["young", "black"], ["old", "white"]]
 */
async function evaluateFilterTerm(phrase: string, llm: LlmConfig) {
	const prompt = `You are a clinical data phrase decomposer.
Given a user phrase, break it down into the smallest meaningful sub-phrases or words that each represent a standalone clinical or demographic concept or some descriptor term.
Respond ONLY with an array of strings. No explanation, no markdown.

Rules:
- Each item should be a standalone concept on its own
- If the phrase contains "and", split the phrase into two separate items stored in a single array element (e.g. "young and black patients" -> ["young", "black"])
- If the phrase contains "or", split the phrase into two separate items stored in a two array elements (e.g. "young or black patients" -> [["young"], ["black"]])
- Understand "and" in the context of the phrase even when not explicitly stated (e.g. "young black patients" -> ["young", "black"])
- Keep multi-word concepts together if they only make sense as a unit
- Do not rephrase or normalize — keep the original wording from the phrase

Examples:
"black men" → ["black", "men"]
"elderly hispanic women with diabetes" → ["elderly", "hispanic", "women", "diabetes"]
"high gene expression in pediatric patients" → ["high gene expression", "pediatric", "patients"]
"survival of female breast cancer patients over 50" → ["survival", "female", "breast cancer", "over 50"]
"patients of European or African ancestry" → [["European patients"], ["African patients"]]
"young black patients or old white patients" -> [["young", "black"], ["old", "white"]]

Parse the following query into the summary plot scaffold:
Query: ${phrase}
`
	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelName)
	try {
		return JSON.parse(response) as string[]
	} catch {
		console.warn('Failed to parse LLM response:', response)
		return [phrase] // fallback
	}
}

export async function phrase2entity(
	scaffold: Scaffold,
	plotType: string,
	llm: LlmConfig,
	genes_list: string[],
	dataset_json: any,
	ds: any
): Promise<{ type: 'text'; text: string } | Phrase2EntityResult> {
	if (plotType == 'summary') {
		const scaffoldResult = scaffold as SummaryScaffold
		const tw1 = await phrase2entitytw(scaffoldResult.tw1, llm, genes_list, dataset_json, ds)
		if ('type' in tw1 && tw1.type === 'text') {
			return { type: 'text', text: tw1.text }
		} else {
			console.log('Validation result for term1:', tw1)
			const summ_term: Phrase2EntityResult = {
				tw1: [tw1 as Entity]
			}
			if (scaffoldResult.tw2) {
				const tw2 = await phrase2entitytw(scaffoldResult.tw2, llm, genes_list, dataset_json, ds)
				if ('type' in tw2 && tw2.type === 'text') {
					return { type: 'text', text: tw2.text }
				}
				console.log('Validation result for term2:', tw2)
				summ_term.tw2 = [tw2 as Entity]
			}
			if (scaffoldResult.tw3) {
				const tw3 = await phrase2entitytw(scaffoldResult.tw3, llm, genes_list, dataset_json, ds)
				if ('type' in tw3 && tw3.type === 'text') {
					return { type: 'text', text: tw3.text }
				}
				console.log('Validation result for term3:', tw3)
				summ_term.tw3 = [tw3 as Entity]
			}
			if (scaffoldResult.filter) {
				const parseFilterResult = (await evaluateFilterTerm(scaffoldResult.filter, llm)) as string[]
				console.log('Parsed filter terms:', parseFilterResult)
				/*
				for (const filterTerm of parseFilterResult) {
					if (Array.isArray(filterTerm)) {
						for (const _filterTerm of filterTerm) {
							const filterTw = await phrase2entitytw(filterTerm, llm, genes_list, dataset_json, ds)
						}
					} else {
						const filterTw = await phrase2entitytw(filterTerm, llm, genes_list, dataset_json, ds)
					}
				}*/
				summ_term.filter = []
				// Right now, it doesn't handle nested filters
				// Assumes all filter terms are "anded" (i.e. an array of strings/words)
				// Also, need to think about how to separate/represent and/or cases
				for (const filterTerm of parseFilterResult) {
					console.log('Evaluating filter term:', filterTerm)
					const filterTw = await phrase2entitytw(filterTerm, llm, genes_list, dataset_json, ds)
					console.log('filterTw :', filterTw)

					if ('type' in filterTw && filterTw.type === 'text') {
						return { type: 'text', text: filterTw.text }
					}
					summ_term.filter.push(filterTw as Entity)
				}
				console.log('Validation result for filter term:', summ_term.filter)
			}
			return summ_term
		}
	} else {
		return { type: 'text', text: 'Other plot types not yet supported' }
	}
}
