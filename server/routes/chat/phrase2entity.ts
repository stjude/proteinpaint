import type { LlmConfig, GeneDataTypeResult } from '#types'
import { extractGenesFromPrompt } from './utils.ts'
import { classifyGeneDataType } from './genedatatypeagentnew.ts'
import { determineAmbiguousGenePrompt } from './ambiguousgeneagent.ts'
import { getDsAllowedTermTypes } from '../termdb.config.ts'
import { route_to_appropriate_llm_provider } from './routeAPIcall.ts'
import type {
	Scaffold,
	SummaryScaffold,
	DEScaffold,
	Entity,
	Phrase2EntityResult,
	DEPhrase2EntityResult,
	MsgToUser
} from './scaffoldTypes.ts'
import { mayLog } from '#src/helpers.ts'

// JSON schema types for the filter tree returned by evaluateFilterTerm()
type FilterLeafNode = { leaf: string }
type FilterOperatorNode = { op: '&' | '|'; left: FilterTreeNode; right: FilterTreeNode }
type FilterTreeNode = FilterLeafNode | FilterOperatorNode
type FilterTreeResult = { sexpr: string; tree: FilterTreeNode }

// The JSON schema definition passed to the LLM prompt
const filterTreeJsonSchema = {
	type: 'object',
	required: ['sexpr', 'tree'],
	properties: {
		sexpr: { type: 'string', description: 'The full S-expression as a string' },
		tree: { $ref: '#/$defs/node' }
	},
	$defs: {
		node: {
			oneOf: [
				{
					type: 'object',
					required: ['op', 'left', 'right'],
					properties: {
						op: { type: 'string', enum: ['&', '|'] },
						left: { $ref: '#/$defs/node' },
						right: { $ref: '#/$defs/node' }
					},
					additionalProperties: false
				},
				{
					type: 'object',
					required: ['leaf'],
					properties: {
						leaf: { type: 'string' }
					},
					additionalProperties: false
				}
			]
		}
	},
	additionalProperties: false
}

function isLeafNode(node: FilterTreeNode): node is FilterLeafNode {
	return 'leaf' in node
}

/** Collect all leaf values from a filter tree, preserving the logical operator that connects each leaf to the previous one */
function collectLeaves(node: FilterTreeNode, parentOp?: '&' | '|'): { phrase: string; logicalOperator?: '&' | '|' }[] {
	if (isLeafNode(node)) return [{ phrase: node.leaf, logicalOperator: parentOp }]
	return [...collectLeaves(node.left, parentOp), ...collectLeaves(node.right, node.op)]
}

/* This function checks if the non-dictionary types mentioned in the scaffold result (e.g. gene names) are valid based
 * on the corresponding db (e.g. genedb). If any invalid terms are found, it throws an error which is caught in the main
 * function and returned as a text response to the user. This is an important validation step to ensure that downstream agents
 * receive valid inputs and can function properly, and also to provide clear feedback to the user if they mention invalid terms.
 *
 * For e.g. ("Show TP53" is invalid because its not clear what term type TP53 is, but "Show expression of TP53" is valid
 * because "expression of TP53" can be resolved to a GENE_EXPRESSION term type which is present in the dataset)
 * We are looking for gene terms against an exhaustive list of genes from a db, but we will need a similar approach for other
 * nondictionary types such as metabolites, genesets, etc.
 */
async function validateNonDictionaryTypes(
	phrase: string,
	llm: LlmConfig,
	genes_list: string[],
	dataset_json: any
): Promise<MsgToUser | { geneFeatures: GeneDataTypeResult } | null> {
	const relevant_genes = extractGenesFromPrompt(phrase, genes_list)
	const msg: MsgToUser = { type: 'text', text: '' }
	if (relevant_genes.length > 0) {
		// for e.g. classifying prompts such as "Show TP53". If not clear which feature (gene expression, mutation, etc.) of TP53 the user is referring to,
		// we want to classify this as an "ambiguous_gene_prompt" plot type and prompt the user to clarify their question. This function does NOT use an LLM
		// and searches for specific keywords in the user prompt to determine if the prompt is ambiguous with respect to which gene feature the user is referring to.
		const AmbiguousGeneMessage = determineAmbiguousGenePrompt(phrase, relevant_genes, dataset_json)
		if (AmbiguousGeneMessage.length > 0) {
			msg.text = AmbiguousGeneMessage
			return msg
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
				msg.text = geneDataTypeMessage
				return msg
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
		// TODO: This also executes when a gene is not present in the genes_list (needs better handling for this case)
		// Need a similar exhaustive database for metabolites, genesets (e.g. msigdb)
		return null // This means the term could be some other non-dictionary type (e.g. ssGSEA score, metabolites, etc.) or it could be a dictionary term.
	}
}

async function inferEntities(
	phrase: string,
	llm: LlmConfig,
	genes_list: string[],
	dataset_json: any
): Promise<Entity | MsgToUser> {
	const validatedNonDict = await validateNonDictionaryTypes(phrase, llm, genes_list, dataset_json)
	if (!validatedNonDict) {
		// No match, probably a dictionary term or a non-dictionary term we don't have a way to validate yet (e.g. ssGSEA score, metabolites, etc.)

		// TODO: This incorrectly fails when a gene is not present in the genes_list, it assumes it's a dictionary term
		// Need a way to handle this correctly and gracefully
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
): Promise<MsgToUser | Entity> {
	const tw1Result = await inferEntities(phrase, llm, genes_list, dataset_json)
	if ('type' in tw1Result && tw1Result.type === 'text') {
		return tw1Result // MsgToUser
	}
	//mayLog("getDsAllowedTermTypes(ds):", getDsAllowedTermTypes(ds))
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
async function evaluateFilterTerm(phrase: string, llm: LlmConfig): Promise<FilterTreeResult> {
	const prompt = `You are an assistant that analyzes filter term written in natural language and convert into a nested binary S-expression tree using two operators: AND (&) and OR (|). Do NOT generate code that does it, you are supposed to do it yourself. DO NOT give any explanations, just return a JSON string. Avoid using general common nouns (e.g. "patients", "people") as leaves in the tree — instead, try to add specific types of patientsas leaves (e.g. "young patients", "black patients", "men", "women", etc.).  

PARSING RULES:

1. IMPLICIT AND (adjacency)
   Adjacent words that form a single semantic unit (adjective + noun, modifier + noun) are grouped with an implicit AND.
   "black males"  → (&, black, males)
   "white women"  → (&, white, women)
   "tall old man" → (&, (&, tall, old), man)  [chain left-to-right]

2. EXPLICIT AND
   The word "and" between two groups produces an & operator node.
   "black males and white women" → (&, (&, black, males), (&, white, women))

3. EXPLICIT OR
   The word "or" between two groups produces a | operator node.
   "black males or white women" → (|, (&, black, males), (&, white, women))

4. NO OPERATOR PRECEDENCE
   Do NOT apply any precedence rules. Do NOT reorder or regroup based on operator type.
   Parse strictly left-to-right. The operator encountered first wraps the groups encountered first.
   "A and B or C"  → (|, (&, A, B), C)   [NOT (&, A, (|, B, C))]
   "A or B or C"   → (|, (|, A, B), C)    [NOT (&, A, (|, B, C))]
   "A or B and C"  → (&, (|, A, B), C)    [NOT (|, A, (&, B, C))]

5. BINARY TREE ONLY
   Every operator node has exactly two children: left and right.
   For three or more groups connected by the same operator, chain left-to-right:
   "A and B and C"       → (&, (&, A, B), C)
   "A or B or C or D"    → (|, (|, (|, A, B), C), D)

6. LEAVES
   A leaf is a single word or a multi-word unit already grouped by implicit AND.
   Leaves have no operator — they are atomic terms in the tree.

OUTPUT FORMAT:
Return ONLY valid JSON conforming to the following JSON schema. No explanation. No markdown. No extra keys.

JSON Schema:
${JSON.stringify(filterTreeJsonSchema, null, 2)}

Each node is one of:
  Operator node: { "op": "&" | "|", "left": <node>, "right": <node> }
  Leaf node:     { "leaf": "word or phrase" }

EXAMPLES:

Input: black males and white women
Output: {
  "sexpr": "(&, (&, black, males), (&, white, women))",
  "tree": {
     "op": "&",
     "left":  { "op": "&", "left": {"leaf":"black"}, "right": {"leaf":"males"} },
     "right": { "op": "&", "left": {"leaf":"white"}, "right": {"leaf":"women"} }
  }
}

Input: patients with age of diagnosis less than 15yrs
Output: {
  "sexpr": "(age < 15yrs)",
  "tree": "age < 15yrs"
}

Input: patients with TP53 expression less than 10
Output: {
  "sexpr": "(TP53 expression < 10)",
  "tree": "TP53 expression < 10"
}

Input: black males and white women or asian men
Output: {
  "sexpr": "(|, (&, (&, black, males), (&, white, women)), (&, asian, men))",
  "tree": {
    "op": "|",
    "left": {
      "op": "&",
      "left":  { "op": "&", "left": {"leaf":"black"}, "right": {"leaf":"males"} },
      "right": { "op": "&", "left": {"leaf":"white"}, "right": {"leaf":"women"} }
    },
    "right": { "op": "&", "left": {"leaf":"asian"}, "right": {"leaf":"men"} }
  }
}

Input: black males or white women and asian men
Output: {
  "sexpr": "(&, (|, (&, black, males), (&, white, women)), (&, asian, men))",
  "tree": {
    "op": "&",
    "left": {
      "op": "|",
      "left":  { "op": "&", "left": {"leaf":"black"}, "right": {"leaf":"males"} },
      "right": { "op": "&", "left": {"leaf":"white"}, "right": {"leaf":"women"} }
    },
    "right": { "op": "&", "left": {"leaf":"asian"}, "right": {"leaf":"men"} }
  }
}

Input: age > 60yrs
Output: {
  "sexpr": "(age > 60yrs)",
  "tree": "age > 60yrs"
}


Parse the following query:
Query: ${phrase}
`
	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelName)
	mayLog('filter response:', response)
	try {
		const parsed = JSON.parse(response) as FilterTreeResult
		if (!parsed.tree || !parsed.sexpr) {
			throw 'Response missing required fields "tree" or "sexpr"'
		}
		return parsed
	} catch (e) {
		console.warn('Failed to parse LLM filter response, wrapping phrase as single leaf:', response, e)
		// Fallback: wrap the entire phrase as a single-leaf tree conforming to the schema
		return {
			sexpr: phrase,
			tree: { leaf: phrase }
		}
	}
}

async function parseFilterTree(
	filterTree: FilterTreeResult,
	llm: LlmConfig,
	genes_list: string[],
	dataset_json: any,
	ds: any
): Promise<MsgToUser | Entity[]> {
	const entities_result: Entity[] = []
	const leafPhrases = collectLeaves(filterTree.tree)
	for (const leaf of leafPhrases) {
		mayLog('Evaluating filter leaf:', leaf.phrase)
		const filterTw = await phrase2entitytw(leaf.phrase, llm, genes_list, dataset_json, ds)
		mayLog('filterTw:', filterTw)
		if ('type' in filterTw && filterTw.type === 'text') {
			return filterTw // MsgToUser
		}
		const filterEntity = filterTw as Entity
		if (leaf.logicalOperator) filterEntity.logicalOperator = leaf.logicalOperator
		entities_result.push(filterEntity)
	}
	return entities_result
}

export async function phrase2entity(
	scaffold: Scaffold,
	plotType: string,
	llm: LlmConfig,
	genes_list: string[],
	dataset_json: any,
	ds: any
): Promise<MsgToUser | Phrase2EntityResult> {
	if (plotType == 'summary') {
		const scaffoldResult = scaffold as SummaryScaffold
		const tw1 = await phrase2entitytw(scaffoldResult.tw1, llm, genes_list, dataset_json, ds)
		if ('type' in tw1 && tw1.type === 'text') {
			return tw1 // MsgToUser
		} else {
			mayLog('Validation result for term1:', tw1)
			const summ_term: Phrase2EntityResult = {
				tw1: [tw1 as Entity]
			}
			if (scaffoldResult.tw2) {
				const tw2 = await phrase2entitytw(scaffoldResult.tw2, llm, genes_list, dataset_json, ds)
				if ('type' in tw2 && tw2.type === 'text') {
					return tw2 // MsgToUser
				}
				mayLog('Validation result for term2:', tw2)
				summ_term.tw2 = [tw2 as Entity]
			}
			if (scaffoldResult.tw3) {
				const tw3 = await phrase2entitytw(scaffoldResult.tw3, llm, genes_list, dataset_json, ds)
				if ('type' in tw3 && tw3.type === 'text') {
					return tw3 // MsgToUser
				}
				mayLog('Validation result for term3:', tw3)
				summ_term.tw3 = [tw3 as Entity]
			}
			if (scaffoldResult.filter) {
				const parseFilterResult: FilterTreeResult = await evaluateFilterTerm(scaffoldResult.filter, llm)
				mayLog('Parsed filter tree:', JSON.stringify(parseFilterResult, null, 2))
				// Extract all leaf phrases from the filter tree and resolve each to an entity
				const leafPhrases = collectLeaves(parseFilterResult.tree)
				summ_term.filter = []
				for (const leaf of leafPhrases) {
					mayLog('Evaluating filter leaf:', leaf.phrase)
					const filterTw = await phrase2entitytw(leaf.phrase, llm, genes_list, dataset_json, ds)
					mayLog('filterTw:', filterTw)

					if ('type' in filterTw && filterTw.type === 'text') {
						return filterTw // MsgToUser
					}
					const filterEntity = filterTw as Entity
					if (leaf.logicalOperator) filterEntity.logicalOperator = leaf.logicalOperator
					summ_term.filter.push(filterEntity)
				}
				mayLog('Validation result for filter term:', JSON.stringify(summ_term.filter))
			}
			return summ_term
		}
	} else if (plotType == 'dge') {
		const scaffoldResult = scaffold as DEScaffold
		const dge_term: DEPhrase2EntityResult = {
			filter1: [],
			filter2: []
		}

		// filter 1
		let parseFilterResult: FilterTreeResult = await evaluateFilterTerm(scaffoldResult.filter1, llm)
		const dge_term_filter1 = await parseFilterTree(parseFilterResult, llm, genes_list, dataset_json, ds)
		if ('type' in dge_term_filter1 && dge_term_filter1.type === 'text') {
			return dge_term_filter1 // MsgToUser
		}
		dge_term.filter1 = dge_term_filter1 as Entity[]
		mayLog('Validation result for filter1 term:', JSON.stringify(dge_term.filter1))

		// filter 2
		parseFilterResult = await evaluateFilterTerm(scaffoldResult.filter2, llm)
		const dge_term_filter2 = await parseFilterTree(parseFilterResult, llm, genes_list, dataset_json, ds)
		if ('type' in dge_term_filter2 && dge_term_filter2.type === 'text') {
			return dge_term_filter2 // MsgToUser
		}
		dge_term.filter2 = dge_term_filter2 as Entity[]
		mayLog('Validation result for filter2 term:', JSON.stringify(dge_term.filter2))

		// filter ?
		if (scaffoldResult.filter) {
			parseFilterResult = await evaluateFilterTerm(scaffoldResult.filter, llm)
			const dge_term_filter = await parseFilterTree(parseFilterResult, llm, genes_list, dataset_json, ds)
			if ('type' in dge_term_filter && dge_term_filter.type === 'text') {
				return dge_term_filter // MsgToUser
			}
			dge_term.filter = dge_term_filter as Entity[]
			mayLog('Validation result for optional filter term:', JSON.stringify(dge_term.filter))
		}

		return dge_term
	} else {
		const msg: MsgToUser = {
			type: 'text',
			text: `Plot type "${plotType}" is not supported yet.`
		}
		return msg
	}
}
