import type { LlmConfig, GeneDataTypeResult } from '#types'
import { extractGenesFromPrompt } from './utils.ts'
import { classifyGeneDataType } from './genedatatypeagentnew.ts'
import { determineAmbiguousGenePrompt } from './ambiguousgeneagent.ts'
import { getDsAllowedTermTypes } from '../termdb.config.ts'
import type { Scaffold, SummaryScaffold, InferEntity, SummaryPhrase2EntityResult } from './scaffoldTypes.ts'

async function validateNonDictionaryTypes(
	phrase: string,
	llm: LlmConfig,
	genes_list: string[],
	dataset_json: any
): Promise<{ type: 'text'; text: string } | { geneFeatures: GeneDataTypeResult } | null> {
	const relevant_genes = extractGenesFromPrompt(phrase, genes_list)
	if (relevant_genes.length > 0) {
		const AmbiguousGeneMessage = determineAmbiguousGenePrompt(phrase, relevant_genes, dataset_json) // for e.g. classifying prompts such as "Show TP53". In this prompt its not clear which feature (gene expression, mutation, etc.) of TP53 the user is referring to, so we want to classify this as an "ambiguous_gene_prompt" plot type and prompt the user to clarify their question. This function does NOT use an LLM and searches for specific keywords in the user prompt to determine if the prompt is ambiguous with respect to which gene feature the user is referring to.
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
): Promise<InferEntity | { type: 'text'; text: string }> {
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

export async function phrase2entity(
	scaffold: Scaffold,
	plotType: string,
	llm: LlmConfig,
	genes_list: string[],
	dataset_json: any,
	ds: any
): Promise<{ type: 'text'; text: string } | SummaryPhrase2EntityResult> {
	if (plotType == 'summary') {
		const scaffoldResult = scaffold as SummaryScaffold
		const tw1 = await phrase2entitytw(scaffoldResult.tw1, llm, genes_list, dataset_json, ds)
		if ('type' in tw1 && tw1.type === 'text') {
			return { type: 'text', text: tw1.text }
		} else {
			console.log('Validation result for term1:', tw1)
			const summ_term: SummaryPhrase2EntityResult = {
				tw1: [tw1 as InferEntity]
			}
			if (scaffoldResult.tw2) {
				const tw2 = await phrase2entitytw(scaffoldResult.tw2, llm, genes_list, dataset_json, ds)
				if ('type' in tw2 && tw2.type === 'text') {
					return { type: 'text', text: tw2.text }
				}
				console.log('Validation result for term2:', tw2)
				summ_term.tw2 = [tw2 as InferEntity]
			}
			if (scaffoldResult.tw3) {
				const tw3 = await phrase2entitytw(scaffoldResult.tw3, llm, genes_list, dataset_json, ds)
				if ('type' in tw3 && tw3.type === 'text') {
					return { type: 'text', text: tw3.text }
				}
				console.log('Validation result for term3:', tw3)
				summ_term.tw3 = [tw3 as InferEntity]
			}
			if (scaffoldResult.filter) {
				const filter = await phrase2entitytw(scaffoldResult.filter, llm, genes_list, dataset_json, ds)
				if ('type' in filter && filter.type === 'text') {
					return { type: 'text', text: filter.text }
				}
				console.log('Validation result for filter:', filter)
				summ_term.filter = [filter as InferEntity]
			}
			return summ_term
		}
	} else {
		return { type: 'text', text: 'Other plot types not yet supported' }
	}
}

async function phrase2entitytw(
	phrase: string,
	llm: LlmConfig,
	genes_list: string[],
	dataset_json: any,
	ds: any
): Promise<{ type: 'text'; text: string } | InferEntity> {
	const tw1Result = await inferEntities(phrase, llm, genes_list, dataset_json)
	if ('type' in tw1Result && tw1Result.type === 'text') {
		return { type: 'text', text: tw1Result.text }
	}
	//console.log("getDsAllowedTermTypes(ds):", getDsAllowedTermTypes(ds))
	if ((tw1Result as InferEntity).termType == 'dictionary') {
		return tw1Result // Dictionary term
	} else if (getDsAllowedTermTypes(ds).includes((tw1Result as InferEntity).termType)) {
		return tw1Result
	} else {
		return {
			type: 'text',
			text: `The termType "${
				(tw1Result as InferEntity).termType
			}" in phrase "${phrase}" is not an allowed termType for this dataset`
		}
	}
}
