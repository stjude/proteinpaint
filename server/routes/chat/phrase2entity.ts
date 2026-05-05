import type { LlmConfig, GeneDataTypeResult } from '#types'
import { extractGenesFromPrompt } from './utils.ts'
import { classifyGeneDataTypePhrase } from './genedatatypeagentnew.ts'
import { GENE_FEATURE_KEYWORDS, determineAmbiguousGenePrompt } from './ambiguousgeneagent.ts'
import { getDsAllowedTermTypes } from '../termdb.config.ts'
import { route_to_appropriate_llm_provider } from './routeAPIcall.ts'
import type {
	Scaffold,
	SummaryScaffold,
	DEScaffold,
	HierarchicalScaffold,
	Entity,
	Phrase2EntityResult,
	DEPhrase2EntityResult,
	PrebuiltScatterPhrase2EntityResult,
	HierPhrase2EntityResult,
	MsgToUser,
	MatrixScaffold,
	PrebuiltScatterScaffold
} from './scaffoldTypes.ts'
import { mayLog } from '#src/helpers.ts'
import assert from 'assert'

// JSON schema types for the filter tree returned by evaluateFilterTerm()
export type FilterLeafNode = { leaf: string }
export type FilterOperatorNode = { op: '&' | '|'; left: FilterTreeNode; right: FilterTreeNode }
export type FilterTreeNode = FilterLeafNode | FilterOperatorNode
export type FilterTreeResult = { sexpr: string; tree: FilterTreeNode }

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
export function collectLeaves(
	node: FilterTreeNode,
	parentOp?: '&' | '|'
): { phrase: string; logicalOperator?: '&' | '|' }[] {
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
		const geneDataTypeMessage: GeneDataTypeResult | string = (await classifyGeneDataTypePhrase(
			// This function uses an LLM to classify which specific gene features (e.g. expression, mutation, etc.) are relevant to the user prompt for each of the relevant genes mentioned in the prompt.
			phrase,
			llm,
			relevant_genes,
			dataset_json
		)) as GeneDataTypeResult | string

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
	}
	// else if {} // Implement similar keyword searches for other nondictionary types later (e.g. metabolite Intensity, ssGSEA)
	else {
		const NonDictKeyWords = extractGenesFromPrompt(phrase, GENE_FEATURE_KEYWORDS) // Using the same function as extracting genes from a phrase. Will later add similar list as GENE_FEATURE_KEYWORDS for other nonDict types such as metabolite Intensity, ssGSEA
		if (NonDictKeyWords.length > 0) {
			msg.text =
				"Prompt includes keyword(s) such as '" +
				NonDictKeyWords.join(',') +
				"' that may refer to a nonDict type (e.g. genes) but no such term was found in the prompt"
			return msg
		}
		// else if // May go for an LLM based approach if the above string search based method is not sufficient
		else {
			return null // This means the term could be some other non-dictionary type (e.g. ssGSEA score, metabolites, etc.) or it could be a dictionary term.
		}
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

export async function phrase2entitytw(
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
export async function evaluateFilterTerm(phrase: string, llm: LlmConfig): Promise<FilterTreeResult> {
	const prompt = `You are an assistant that analyzes a filter term written in natural language and converts it into a nested binary S-expression tree using two operators: AND (&) and OR (|).
Do NOT generate code. You yourself must produce the tree. Return ONLY a JSON string — no explanations, no markdown, no extra keys.

## CORE PRINCIPLE: WHAT IS A LEAF?
A leaf represents ONE filter constraint along ONE dimension (e.g. sex, race, age, diagnosis, gene expression). A leaf is whatever phrase, taken as a whole, expresses a single criterion along a single dimension.

To decide whether a phrase is one leaf or multiple leaves, ask: "Does this phrase combine constraints from MORE THAN ONE dimension?"
  - If YES → split it into one leaf per dimension, joined by implicit AND.
  - If NO → it is a single leaf.

### Dimensions (each is independent and produces a separate leaf)
Examples of independent dimensions: sex/gender, race/ethnicity, age, diagnosis, treatment, mutation status, gene expression, time/year, etc.

### Scope nouns (NEVER a leaf on their own)
Generic population words — "patients", "people", "subjects", "individuals", "cases", "participants" — are scope words, not constraints. They introduce the population being filtered. When a scope noun appears with a modifier, the leaf is the modifier-noun unit as a whole; the scope noun does NOT become a separate leaf.

## LEAF EXTRACTION EXAMPLES

Single dimension → ONE leaf:
  "female patients"           → leaf: "female patients"          (sex only; "patients" is scope)
  "young patients"            → leaf: "young patients"           (age only)
  "diabetic patients"         → leaf: "diabetic patients"        (diagnosis only)
  "patients with diabetes"    → leaf: "diabetes"                 (diagnosis only)
  "patients older than 60"    → leaf: "age > 60"                 (age only)
  "TP53 expression < 10"      → leaf: "TP53 expression < 10"     (gene expression only)

Multiple dimensions → SPLIT into one leaf per dimension, joined by implicit AND:
  "black males"               → (&, black, males)                (race + sex)
  "white women"               → (&, white, women)                (race + sex)
  "young black women"         → (&, (&, young, black), women)    (age + race + sex; chain left-to-right)
  "black diabetic patients"   → (&, black, diabetic patients)    (race + diagnosis; "patients" stays attached to "diabetic")
  "young women with diabetes" → (&, young women, diabetes)       ("young women" already covers age+sex as ONE unit only if you consider them inseparable — but since age and sex are independent dimensions, prefer (&, (&, young, women), diabetes))

When in doubt, split along independent biological/clinical dimensions. Do NOT, however, split a modifier away from a scope noun: "female patients" stays as ONE leaf because "patients" is scope, not a dimension.

## PARSING RULES

1. IDENTIFY LEAVES FIRST. Read the whole phrase and find each independent filter constraint along its own dimension. Each constraint is one leaf.

2. IMPLICIT AND (multi-dimensional descriptors). When adjacent words describe DIFFERENT dimensions of the same group (e.g. "black males" = race + sex), join them with implicit AND, chained left-to-right.
   "black males"     → (&, black, males)
   "tall old man"    → (&, (&, tall, old), man)
   "young black women" → (&, (&, young, black), women)

3. EXPLICIT AND. The word "and" between two groups produces an & operator node.
   "black males and white women" → (&, (&, black, males), (&, white, women))

4. EXPLICIT OR. The word "or" between two groups produces an | operator node.
   "black males or white women" → (|, (&, black, males), (&, white, women))

5. NO OPERATOR PRECEDENCE. Parse strictly left-to-right. The operator encountered first wraps the groups encountered first.
   "A and B or C"  → (|, (&, A, B), C)
   "A or B or C"   → (|, (|, A, B), C)
   "A or B and C"  → (&, (|, A, B), C)

6. BINARY TREE ONLY. Every operator node has exactly two children. For three or more groups joined by the same operator, chain left-to-right.
   "A and B and C"     → (&, (&, A, B), C)
   "A or B or C or D"  → (|, (|, (|, A, B), C), D)

7. SINGLE-CONSTRAINT QUERIES. If the entire phrase expresses one constraint with no AND/OR and no multi-dimensional descriptor, the "tree" field is just the leaf string (no operator node).

## OUTPUT FORMAT
Return ONLY valid JSON conforming to this schema:

${JSON.stringify(filterTreeJsonSchema, null, 2)}

Each node is one of:
  Operator node: { "op": "&" | "|", "left": <node>, "right": <node> }
  Leaf node:     { "leaf": "phrase representing one constraint along one dimension" }

## EXAMPLES

Input: female patients
Output: {
  "sexpr": "(female patients)",
  "tree": {"leaf":"female patients"}
}

Input: patients with age of diagnosis less than 15yrs
Output: {
  "sexpr": "(age of diagnosis < 15yrs)",
  "tree": {"leaf":"age of diagnosis < 15yrs"}
}

Input: patients with TP53 expression less than 10
Output: {
  "sexpr": "(TP53 expression < 10)",
  "tree": {"leaf":"TP53 expression < 10"}
}

Input: age > 60yrs
Output: {
  "sexpr": "(age > 60yrs)",
  "tree": {"leaf":"age > 60yrs"}
}

Input: black males
Output: {
  "sexpr": "(&, black, males)",
  "tree": {
    "op": "&",
    "left":  { "leaf": "black" },
    "right": { "leaf": "males" }
  }
}

Input: black males and white women
Output: {
  "sexpr": "(&, (&, black, males), (&, white, women))",
  "tree": {
    "op": "&",
    "left": {
      "op": "&",
      "left":  { "leaf": "black" },
      "right": { "leaf": "males" }
    },
    "right": {
      "op": "&",
      "left":  { "leaf": "white" },
      "right": { "leaf": "women" }
    }
  }
}

Input: black males or white women and asian men
Output: {
  "sexpr": "(&, (|, (&, black, males), (&, white, women)), (&, asian, men))",
  "tree": {
    "op": "&",
    "left": {
      "op": "|",
      "left": {
        "op": "&",
        "left":  { "leaf": "black" },
        "right": { "leaf": "males" }
      },
      "right": {
        "op": "&",
        "left":  { "leaf": "white" },
        "right": { "leaf": "women" }
      }
    },
    "right": {
      "op": "&",
      "left":  { "leaf": "asian" },
      "right": { "leaf": "men" }
    }
  }
}

Input: female patients with TP53 expression greater than 5
Output: {
  "sexpr": "(&, female patients, TP53 expression > 5)",
  "tree": {
    "op": "&",
    "left":  { "leaf": "female patients" },
    "right": { "leaf": "TP53 expression > 5" }
  }
}

Input: young black women with diabetes
Output: {
  "sexpr": "(&, (&, (&, young, black), women), diabetes)",
  "tree": {
    "op": "&",
    "left": {
      "op": "&",
      "left": {
        "op": "&",
        "left":  { "leaf": "young" },
        "right": { "leaf": "black" }
      },
      "right": { "leaf": "women" }
    },
    "right": { "leaf": "diabetes" }
  }
}

Parse the following query:
Query: ${phrase}
`
	/*
    const prompt = `You are an assistant that analyzes filter term written in natural language and convert into a nested binary S-expression tree using two operators: AND (&) and OR (|). Do NOT generate code that does it, you are supposed to do it yourself. DO NOT give any explanations, just return a JSON string. 
    Avoid using general common nouns (e.g. "patients", "people") as leaves in the tree — instead, try to add specific types of patients as leaves (e.g. "young patients", "black patients", "men", "women", etc.).  

    ### Scope nouns (NEVER a leaf on their own)
    Generic population words — "patients", "people", "subjects", "individuals", "cases", "participants" — are scope words, not constraints. They introduce the population being filtered. When a scope noun appears with a modifier, the leaf is the modifier-noun unit as a whole; the scope noun does NOT become a separate leaf.

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

Input: men with age greater than 60 years
Output: {
  "sexpr": "(&, (men), (age > 60 years))",
  "tree": {
    "op": "&",
    "left": { "leaf": "men" },
    "right": { "leaf": "age > 60 years" }
  }
}

Parse the following query:
Query: ${phrase}
`
*/
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
	if (plotType === 'summary') {
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
	} else if (plotType === 'dge') {
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
	} else if (plotType === 'matrix') {
		const scaffoldResult = scaffold as MatrixScaffold
		assert(scaffoldResult.twLst.length > 0) // 'At least one term is required for matrix plot'

		// Convert each term in twLst to an entity
		const twLstEntities: Entity[] = []
		for (const [index, twPhrase] of scaffoldResult.twLst.entries()) {
			mayLog(`Processing term${index + 1} in twLst: "${twPhrase}"`)
			const twEntity = await phrase2entitytw(twPhrase, llm, genes_list, dataset_json, ds)
			if ('type' in twEntity && twEntity.type === 'text') {
				return twEntity // MsgToUser
			}
			mayLog(`Validation result for term${index + 1} "${twPhrase}":`, twEntity)
			twLstEntities.push(twEntity as Entity)
		}

		const matrix_term: Phrase2EntityResult = {
			twLst: twLstEntities
		}

		// if divideBy is present, convert to entity as well
		if (scaffoldResult.divideBy) {
			const divideByEntity = await phrase2entitytw(scaffoldResult.divideBy, llm, genes_list, dataset_json, ds)
			if ('type' in divideByEntity && divideByEntity.type === 'text') {
				return divideByEntity // MsgToUser
			}
			mayLog(`Validation result for divideBy "${scaffoldResult.divideBy}":`, divideByEntity)
			matrix_term.divideBy = divideByEntity as Entity
		}

		// if filter is present, convert to entity as well
		if (scaffoldResult.filter) {
			const parseFilterResult: FilterTreeResult = await evaluateFilterTerm(scaffoldResult.filter, llm)
			mayLog('Parsed filter tree:', JSON.stringify(parseFilterResult, null, 2))
			// Extract all leaf phrases from the filter tree and resolve each to an entity
			const filter_term = await parseFilterTree(parseFilterResult, llm, genes_list, dataset_json, ds)
			if ('type' in filter_term && filter_term.type === 'text') {
				return filter_term // MsgToUser
			}
			matrix_term.filter = filter_term as Entity[]
			mayLog('Validation result for filter term:', JSON.stringify(matrix_term.filter))
		}
		return matrix_term
	} else if (plotType === 'prebuiltscatter') {
		const scaffoldResult = scaffold as PrebuiltScatterScaffold
		const scatter_term: PrebuiltScatterPhrase2EntityResult = { name: scaffoldResult.name }

		// ColorBy term
		if (scaffoldResult.colorBy === 'null') {
			scatter_term.colorBy = 'null'
		} else if (scaffoldResult.colorBy) {
			const colorByEntity = await phrase2entitytw(scaffoldResult.colorBy, llm, genes_list, dataset_json, ds)
			if ('type' in colorByEntity && colorByEntity.type === 'text') {
				return colorByEntity // MsgToUser
			}
			mayLog(`Validation result for colorBy "${scaffoldResult.colorBy}":`, colorByEntity)
			scatter_term.colorBy = colorByEntity as Entity
		}

		// ShapeBy term
		if (scaffoldResult.shapeBy === 'null') {
			scatter_term.shapeBy = 'null'
		} else if (scaffoldResult.shapeBy) {
			const shapeByEntity = await phrase2entitytw(scaffoldResult.shapeBy, llm, genes_list, dataset_json, ds)
			if ('type' in shapeByEntity && shapeByEntity.type === 'text') {
				return shapeByEntity // MsgToUser
			}
			mayLog(`Validation result for shapeBy "${scaffoldResult.shapeBy}":`, shapeByEntity)
			scatter_term.shapeBy = shapeByEntity as Entity
		}

		// divideBy term
		if (scaffoldResult.divideBy) {
			const divideByEntity = await phrase2entitytw(scaffoldResult.divideBy, llm, genes_list, dataset_json, ds)
			if ('type' in divideByEntity && divideByEntity.type === 'text') {
				return divideByEntity // MsgToUser
			}
			mayLog(`Validation result for divideBy "${scaffoldResult.divideBy}":`, divideByEntity)
			scatter_term.divideBy = divideByEntity as Entity
		}

		// Filter term
		if (scaffoldResult.filter) {
			const parseFilterResult: FilterTreeResult = await evaluateFilterTerm(scaffoldResult.filter, llm)
			// mayLog('Parsed filter tree:', JSON.stringify(parseFilterResult, null, 2))
			// Extract all leaf phrases from the filter tree and resolve each to an entity
			const filter_term = await parseFilterTree(parseFilterResult, llm, genes_list, dataset_json, ds)
			if ('type' in filter_term && filter_term.type === 'text') {
				return filter_term // MsgToUser
			}
			mayLog('Validation result for filter term:', JSON.stringify(filter_term))
			scatter_term.filter = filter_term as Entity[]
		}
		return scatter_term
	} else if (plotType === 'hiercluster') {
		const scaffoldResult = scaffold as HierarchicalScaffold
		const hier_term: HierPhrase2EntityResult = { phrases: [] }
		for (const phrase of scaffoldResult.hierarchicalPhrases) {
			const tw1 = await phrase2entitytw(phrase, llm, genes_list, dataset_json, ds)
			if ('type' in tw1 && tw1.type === 'text') {
				return tw1 // MsgToUser
			} else {
				hier_term.phrases.push(tw1 as Entity)
			}
		}
		if (scaffoldResult.filter) {
			const parseFilterResult: FilterTreeResult = await evaluateFilterTerm(scaffoldResult.filter, llm)
			mayLog('Parsed filter tree:', JSON.stringify(parseFilterResult, null, 2))
			// Extract all leaf phrases from the filter tree and resolve each to an entity
			const leafPhrases = collectLeaves(parseFilterResult.tree)
			hier_term.filter = []
			for (const leaf of leafPhrases) {
				mayLog('Evaluating filter leaf:', leaf.phrase)
				const filterTw = await phrase2entitytw(leaf.phrase, llm, genes_list, dataset_json, ds)
				mayLog('filterTw:', filterTw)

				if ('type' in filterTw && filterTw.type === 'text') {
					return filterTw // MsgToUser
				}
				const filterEntity = filterTw as Entity
				if (leaf.logicalOperator) filterEntity.logicalOperator = leaf.logicalOperator
				hier_term.filter.push(filterEntity)
			}
			mayLog('Validation result for filter term:', JSON.stringify(hier_term.filter))
		}
		return hier_term
	} else {
		const msg: MsgToUser = {
			type: 'text',
			text: `Plot type "${plotType}" is not supported yet.`
		}
		return msg
	}
}
