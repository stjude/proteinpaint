import type { LlmConfig, GeneDataTypeResult } from '#types'
import { extractGenesFromPrompt } from './utils.ts'
import { classifyGeneDataType } from './genedatatypeagentnew.ts'
import { determineAmbiguousGenePrompt } from './ambiguousgeneagent.ts'
import { getDsAllowedTermTypes } from '../termdb.config.ts'
import { route_to_appropriate_llm_provider } from './routeAPIcall.ts'
import type {
	Scaffold,
	SummaryScaffold,
	Entity,
	Phrase2EntityResult,
	FilterTreeNode,
	FilterLeafNode,
	FilterTreeResult,
	FilterTreeNodeEntity,
	FilterLeafNodeEntity
} from './scaffoldTypes.ts'

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

/** Recursively resolve a FilterTreeNode by converting each leaf phrase to an Entity */
async function resolveFilterTree(
	node: FilterTreeNode,
	llm: LlmConfig,
	genes_list: string[],
	dataset_json: any,
	ds: string
): Promise<FilterTreeNodeEntity | { type: 'text'; text: string }> {
	if (isLeafNode(node)) {
		console.log('Evaluating filter leaf:', node.leaf)
		const filterTw = await phrase2entitytw(node.leaf, llm, genes_list, dataset_json, ds)
		console.log('filterTw:', filterTw)
		if ('type' in filterTw && filterTw.type === 'text') {
			return { type: 'text', text: filterTw.text }
		}
		return { leaf: filterTw as Entity } as FilterLeafNodeEntity
	}
	const left = await resolveFilterTree(node.left, llm, genes_list, dataset_json, ds)
	if ('type' in left && left.type === 'text') return left
	const right = await resolveFilterTree(node.right, llm, genes_list, dataset_json, ds)
	if ('type' in right && right.type === 'text') return right
	return { op: node.op, left, right } as FilterTreeNodeEntity
}

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
async function evaluateFilterTerm(phrase: string, llm: LlmConfig): Promise<FilterTreeResult> {
	const prompt = `You are an assistant that analyzes filter term written in natural language and convert into a nested binary S-expression tree using two operators: AND (&) and OR (|). Do NOT generate code that does it, you are supposed to do it yourself. DO NOT give any explanations, just return a JSON string.  

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
	console.log('filter response:', response)
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
				const parseFilterResult: FilterTreeResult = await evaluateFilterTerm(scaffoldResult.filter, llm)
				console.log('Parsed filter tree:', JSON.stringify(parseFilterResult, null, 2))
				// Recursively resolve the filter tree, converting each leaf phrase to an Entity
				const resolvedTree = await resolveFilterTree(parseFilterResult.tree, llm, genes_list, dataset_json, ds)
				if ('type' in resolvedTree && resolvedTree.type === 'text') {
					return resolvedTree
				}
				summ_term.filter = { sexpr: parseFilterResult.sexpr, tree: resolvedTree as FilterTreeNodeEntity }
				console.log('Validation result for filter term:', JSON.stringify(summ_term.filter))
			}
			return summ_term
		}
	} else {
		return { type: 'text', text: 'Other plot types not yet supported' }
	}
}
