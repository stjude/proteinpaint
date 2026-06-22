import type { LlmConfig, DbRows } from '#types'
import {
	extractGenesFromPrompt,
	phrase2entitytw,
	collectLeaves,
	evaluateFilterTerm,
	parse_survival_terms_from_db
} from './utils.ts'
import { generateFilterTerm } from './filter.ts'
import { route_to_appropriate_llm_provider } from './routeAPIcall.ts'
import type {
	Scaffold,
	SummaryScaffold,
	GenomeBrowserScaffold,
	DEScaffold,
	SurvivalScaffold,
	HierarchicalScaffold,
	Entity,
	Phrase2EntityResult,
	DEPhrase2EntityResult,
	PrebuiltScatterPhrase2EntityResult,
	HierPhrase2EntityResult,
	SurvivalPhrase2EntityResult,
	MsgToUser,
	MatrixScaffold,
	PrebuiltScatterScaffold,
	FilterTreeResult
} from './scaffoldTypes.ts'
import { isMsgToUser } from './scaffoldTypes.ts'
import { mayLog } from '#src/helpers.ts'
import { TermTypes } from '#shared/terms.js'
import assert from 'assert'

async function parseFilterTree(
	filterTree: FilterTreeResult,
	llm: LlmConfig,
	genes_list: string[],
	dataset_json: any,
	ds: any,
	genome: any
): Promise<MsgToUser | Entity[]> {
	const entities_result: Entity[] = []
	const leafPhrases = collectLeaves(filterTree.tree)
	for (const leaf of leafPhrases) {
		mayLog('Evaluating filter leaf:', leaf.phrase)
		const filterTw = await phrase2entitytw(leaf.phrase, llm, genes_list, dataset_json, ds, genome)
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
	ds: any,
	genome: any,
	dbPath: string
): Promise<MsgToUser | Phrase2EntityResult | { type: 'plot'; plot: any }> {
	if (plotType === 'summary') {
		const scaffoldResult = scaffold as SummaryScaffold
		const tw1 = await phrase2entitytw(scaffoldResult.tw1, llm, genes_list, dataset_json, ds, genome)
		if ('type' in tw1 && tw1.type === 'text') {
			return tw1 // MsgToUser
		} else {
			mayLog('Validation result for term1:', tw1)
			const summ_term: Phrase2EntityResult = {
				tw1: [tw1 as Entity]
			}
			if (scaffoldResult.tw2) {
				const tw2 = await phrase2entitytw(scaffoldResult.tw2, llm, genes_list, dataset_json, ds, genome)
				if ('type' in tw2 && tw2.type === 'text') {
					return tw2 // MsgToUser
				}
				mayLog('Validation result for term2:', tw2)
				summ_term.tw2 = [tw2 as Entity]
			}
			if (scaffoldResult.tw3) {
				const tw3 = await phrase2entitytw(scaffoldResult.tw3, llm, genes_list, dataset_json, ds, genome)
				if ('type' in tw3 && tw3.type === 'text') {
					return tw3 // MsgToUser
				}
				mayLog('Validation result for term3:', tw3)
				summ_term.tw3 = [tw3 as Entity]
			}
			if (scaffoldResult.filter) {
				const parseFilterResult: FilterTreeResult | MsgToUser = await evaluateFilterTerm(scaffoldResult.filter, llm)
				mayLog('Parsed filter tree:', JSON.stringify(parseFilterResult, null, 2))
				if (isMsgToUser(parseFilterResult)) return parseFilterResult
				// Extract all leaf phrases from the filter tree and resolve each to an entity
				const leafPhrases = collectLeaves(parseFilterResult.tree)
				summ_term.filter = []
				for (const leaf of leafPhrases) {
					mayLog('Evaluating filter leaf:', leaf.phrase)
					const filterTw = await phrase2entitytw(leaf.phrase, llm, genes_list, dataset_json, ds, genome)
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
		let parseFilterResult: FilterTreeResult | MsgToUser = await evaluateFilterTerm(scaffoldResult.filter1, llm)
		if (isMsgToUser(parseFilterResult)) return parseFilterResult
		const dge_term_filter1 = await parseFilterTree(parseFilterResult, llm, genes_list, dataset_json, ds, genome)
		if ('type' in dge_term_filter1 && dge_term_filter1.type === 'text') {
			return dge_term_filter1 // MsgToUser
		}
		dge_term.filter1 = dge_term_filter1 as Entity[]
		mayLog('Validation result for filter1 term:', JSON.stringify(dge_term.filter1))

		// filter 2
		parseFilterResult = await evaluateFilterTerm(scaffoldResult.filter2, llm)
		if (isMsgToUser(parseFilterResult)) return parseFilterResult
		const dge_term_filter2 = await parseFilterTree(parseFilterResult, llm, genes_list, dataset_json, ds, genome)
		if ('type' in dge_term_filter2 && dge_term_filter2.type === 'text') {
			return dge_term_filter2 // MsgToUser
		}
		dge_term.filter2 = dge_term_filter2 as Entity[]
		mayLog('Validation result for filter2 term:', JSON.stringify(dge_term.filter2))

		// filter ?
		if (scaffoldResult.filter) {
			parseFilterResult = await evaluateFilterTerm(scaffoldResult.filter, llm)
			if (isMsgToUser(parseFilterResult)) return parseFilterResult
			const dge_term_filter = await parseFilterTree(parseFilterResult, llm, genes_list, dataset_json, ds, genome)
			if ('type' in dge_term_filter && dge_term_filter.type === 'text') {
				return dge_term_filter // MsgToUser
			}
			dge_term.filter = dge_term_filter as Entity[]
			mayLog('Validation result for optional filter term:', JSON.stringify(dge_term.filter))
		}
		if (scaffoldResult.method) {
			const method = scaffoldResult.method.toLowerCase()
			if (method === 'edger' || method === 'limma' || method === 'wilcoxon') {
				dge_term.method = method
			}
		}
		return dge_term
	} else if (plotType === 'survival') {
		const scaffoldResult = scaffold as SurvivalScaffold

		// Resolve term2 (REQUIRED stratification variable) to an Entity
		const term2Entity = await phrase2entitytw(scaffoldResult.term2, llm, genes_list, dataset_json, ds, genome)
		if ('type' in term2Entity && term2Entity.type === 'text') {
			return term2Entity // MsgToUser
		}
		mayLog('Validation result for survival term2:', term2Entity)

		const survival_term: SurvivalPhrase2EntityResult = {
			term2: term2Entity as Entity
		}

		// Resolve term (OPTIONAL survival type)
		if (scaffoldResult.term) {
			const resolved = await find_survival_terms(scaffoldResult.term, llm, dbPath)
			if (resolved === null) {
				return { type: 'text', text: 'No survival terms available in this dataset.' }
			} else if (typeof resolved === 'object' && 'type' in resolved) {
				return resolved // MsgToUser
			}
			// string = matched single term; DbRows[] = ambiguous, list for user disambiguation
			survival_term.term = resolved
		} else {
			// term not named in prompt; send full list to client so user can pick
			const { db_rows } = await parse_survival_terms_from_db(dbPath)
			if (db_rows.length === 0) {
				return { type: 'text', text: 'No survival terms available in this dataset.' }
			}
			survival_term.term = db_rows
		}

		// Resolve filter (OPTIONAL cohort filter) to Entity[]
		if (scaffoldResult.filter) {
			const parseFilterResult: FilterTreeResult | MsgToUser = await evaluateFilterTerm(scaffoldResult.filter, llm)
			if (isMsgToUser(parseFilterResult)) return parseFilterResult
			const filter_term = await parseFilterTree(parseFilterResult, llm, genes_list, dataset_json, ds, genome)
			if ('type' in filter_term && filter_term.type === 'text') {
				return filter_term // MsgToUser
			}
			survival_term.filter = filter_term as Entity[]
			mayLog('Validation result for survival filter:', JSON.stringify(survival_term.filter))
		}

		return survival_term
	} else if (plotType === 'matrix') {
		const scaffoldResult = scaffold as MatrixScaffold
		assert(scaffoldResult.twLst.length > 0) // 'At least one term is required for matrix plot'

		// Convert each term in twLst to an entity
		const twLstEntities: Entity[] = []
		for (const [index, twPhrase] of scaffoldResult.twLst.entries()) {
			mayLog(`Processing term${index + 1} in twLst: "${twPhrase}"`)
			const twEntity = await phrase2entitytw(twPhrase, llm, genes_list, dataset_json, ds, genome)
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
			const divideByEntity = await phrase2entitytw(scaffoldResult.divideBy, llm, genes_list, dataset_json, ds, genome)
			if ('type' in divideByEntity && divideByEntity.type === 'text') {
				return divideByEntity // MsgToUser
			}
			mayLog(`Validation result for divideBy "${scaffoldResult.divideBy}":`, divideByEntity)
			matrix_term.divideBy = divideByEntity as Entity
		}

		// if filter is present, convert to entity as well
		if (scaffoldResult.filter) {
			const parseFilterResult: FilterTreeResult | MsgToUser = await evaluateFilterTerm(scaffoldResult.filter, llm)
			if (isMsgToUser(parseFilterResult)) return parseFilterResult
			mayLog('Parsed filter tree:', JSON.stringify(parseFilterResult, null, 2))
			// Extract all leaf phrases from the filter tree and resolve each to an entity
			const filter_term = await parseFilterTree(parseFilterResult, llm, genes_list, dataset_json, ds, genome)
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
			const colorByEntity = await phrase2entitytw(scaffoldResult.colorBy, llm, genes_list, dataset_json, ds, genome)
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
			const shapeByEntity = await phrase2entitytw(scaffoldResult.shapeBy, llm, genes_list, dataset_json, ds, genome)
			if ('type' in shapeByEntity && shapeByEntity.type === 'text') {
				return shapeByEntity // MsgToUser
			}
			mayLog(`Validation result for shapeBy "${scaffoldResult.shapeBy}":`, shapeByEntity)
			scatter_term.shapeBy = shapeByEntity as Entity
		}

		// divideBy term
		if (scaffoldResult.divideBy) {
			const divideByEntity = await phrase2entitytw(scaffoldResult.divideBy, llm, genes_list, dataset_json, ds, genome)
			if ('type' in divideByEntity && divideByEntity.type === 'text') {
				return divideByEntity // MsgToUser
			}
			mayLog(`Validation result for divideBy "${scaffoldResult.divideBy}":`, divideByEntity)
			scatter_term.divideBy = divideByEntity as Entity
		}

		// Filter term
		if (scaffoldResult.filter) {
			const parseFilterResult: FilterTreeResult | MsgToUser = await evaluateFilterTerm(scaffoldResult.filter, llm)
			if (isMsgToUser(parseFilterResult)) return parseFilterResult
			// mayLog('Parsed filter tree:', JSON.stringify(parseFilterResult, null, 2))
			// Extract all leaf phrases from the filter tree and resolve each to an entity
			const filter_term = await parseFilterTree(parseFilterResult, llm, genes_list, dataset_json, ds, genome)
			if ('type' in filter_term && filter_term.type === 'text') {
				return filter_term // MsgToUser
			}
			mayLog('Validation result for filter term:', JSON.stringify(filter_term))
			scatter_term.filter = filter_term as Entity[]
		}
		return scatter_term
	} else if (plotType === 'genomeBrowser') {
		const scaffoldResult = scaffold as GenomeBrowserScaffold
		if (!scaffoldResult.genomeBrowserPhrase && !scaffoldResult.genePhrase) {
			throw new Error(
				`LLM response is missing both genomeBrowserPhrase as well as genePhrase: ${JSON.stringify(scaffoldResult)}`
			)
		} else if (scaffoldResult.genomeBrowserPhrase && scaffoldResult.genePhrase) {
			throw new Error(
				`LLM response contains both genomeBrowserPhrase as well as genePhrase: ${JSON.stringify(scaffoldResult)}`
			)
		}
		const pp_plot_json: any = {
			chartType: 'genomeBrowser'
		}
		if (scaffoldResult.genomeBrowserPhrase) {
			const genomicCoordinates = await parseGenomicCoordinates(scaffoldResult.genomeBrowserPhrase, llm)
			if ('type' in genomicCoordinates) {
				return genomicCoordinates // MsgToUser
			}
			pp_plot_json.geneSearchResult = {
				chr: genomicCoordinates.chromosome,
				start: genomicCoordinates.start,
				stop: genomicCoordinates.stop
			}
		} else if (scaffoldResult.genePhrase) {
			const scaffoldResultGene = extractGenesFromPrompt(scaffoldResult.genePhrase, genes_list)
			if (scaffoldResultGene.length === 0) {
				throw new Error(`No recognizable gene names found in genomeBrowser prompt: ${scaffoldResult.genePhrase}`)
			} else if (scaffoldResultGene.length > 1) {
				throw new Error(
					`Multiple gene names found in genomeBrowser prompt, expected only one: ${
						scaffoldResult.genePhrase
					} -> ${scaffoldResultGene.join(', ')}`
				)
			} else {
				const tw1 = await phrase2entitytw(scaffoldResult.genePhrase, llm, genes_list, dataset_json, ds, genome)
				if ('type' in tw1 && tw1.type === 'text') {
					return tw1 // MsgToUser
				} else {
					if (
						'termType' in tw1 &&
						(tw1.termType === TermTypes.GENE_EXPRESSION ||
							tw1.termType === TermTypes.DNA_METHYLATION ||
							tw1.termType === TermTypes.PROTEOME_ABUNDANCE ||
							tw1.termType === TermTypes.SSGSEA)
					) {
						throw new Error(
							`The gene phrase "${scaffoldResult.genePhrase}" is of type ${tw1.termType} which is not supported for genome browser plot.`
						)
					} else if ('termType' in tw1 && tw1.termType === TermTypes.GENE_VARIANT) {
						pp_plot_json.geneSearchResult = {
							geneSymbol: scaffoldResultGene[0]
						}
					} else if ('termType' in tw1) {
						throw new Error(
							`The gene phrase "${
								scaffoldResult.genePhrase
							}" was resolved to an entity of unsupported type for genome browser plot: ${JSON.stringify(tw1.termType)}`
						)
					} else {
						throw new Error(
							`The gene phrase "${
								scaffoldResult.genePhrase
							}" was resolved to an entity missing a termType: ${JSON.stringify(tw1)}`
						)
					}
				}
			}
		} else {
			throw new Error(
				`LLM response is missing both genomeBrowserPhrase as well as genePhrase: ${JSON.stringify(scaffoldResult)}`
			)
		}
		let filterTvs: any
		if (scaffoldResult.filter) {
			if (!genes_list || !dataset_json || !ds || !dbPath) {
				throw 'generateFilterTerm requires genes_list, dataset_json, ds, and dbPath to be provided'
			}
			filterTvs = await generateFilterTerm(scaffoldResult.filter, llm, genes_list, dataset_json, ds, dbPath, genome)
			if (filterTvs && 'type' in filterTvs && filterTvs.type === 'text') {
				return filterTvs as { type: 'text'; text: string }
			}
			pp_plot_json.filter = filterTvs
		}
		return { type: 'plot', plot: pp_plot_json }
	} else if (plotType === 'hiercluster') {
		const scaffoldResult = scaffold as HierarchicalScaffold
		const hier_term: HierPhrase2EntityResult = { phrases: [] }
		for (const phrase of scaffoldResult.hierarchicalPhrases) {
			const tw1 = await phrase2entitytw(phrase, llm, genes_list, dataset_json, ds, genome)
			if ('type' in tw1 && tw1.type === 'text') {
				return tw1 // MsgToUser
			} else {
				hier_term.phrases.push(tw1 as Entity)
			}
		}
		if (scaffoldResult.filter) {
			const parseFilterResult: FilterTreeResult | MsgToUser = await evaluateFilterTerm(scaffoldResult.filter, llm)
			mayLog('Parsed filter tree:', JSON.stringify(parseFilterResult, null, 2))
			if (isMsgToUser(parseFilterResult)) return parseFilterResult
			// Extract all leaf phrases from the filter tree and resolve each to an entity
			const leafPhrases = collectLeaves(parseFilterResult.tree)
			hier_term.filter = []
			for (const leaf of leafPhrases) {
				mayLog('Evaluating filter leaf:', leaf.phrase)
				const filterTw = await phrase2entitytw(leaf.phrase, llm, genes_list, dataset_json, ds, genome)
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

async function parseGenomicCoordinates(
	phrase: string,
	llm: LlmConfig
): Promise<{ chromosome: string; start: number; stop: number } | MsgToUser> {
	const prompt = `You are a ProteinPaint genome browser assistant. Your task is to parse the genomic region phrase extracted from the user's query into its component parts: chromosome, start coordinate, and stop coordinate.

## OUTPUT SCHEMA
Return ONLY a valid JSON object with this structure — no extra fields, no surrounding text, no explanation, no code fences:
{
  "chromosome": "<string>",   // REQUIRED - the chromosome name normalized to include the "chr" prefix (e.g. "chr1", "chrX", "chr17")
  "start": <number>,          // REQUIRED - the start coordinate as a JSON number (1-based integer)
  "stop": <number>            // REQUIRED - the stop coordinate as a JSON number (1-based integer)
}

## FIELD DEFINITIONS
- chromosome (REQUIRED): The chromosome described in the phrase. Always emit it as a string with the "chr" prefix (e.g. "chr1", "chrX", "chrY", "chrM"). If the phrase contains just "1", "X", "chromosome 1", or "Chr1", normalize all of them to "chr1" / "chrX" with lowercase "chr".
- start (REQUIRED): The start coordinate as a JSON NUMBER (not a string). Strip commas, underscores, and unit suffixes ("kb" -> *1000, "Mb" -> *1000000, "Gb" -> *1000000000). Examples: "1,234,567" -> 1234567, "5kb" -> 5000, "2Mb" -> 2000000.
- stop (REQUIRED): The stop coordinate as a JSON NUMBER. Same normalization rules as start.

## EXTRACTION RULES
1. All three fields are REQUIRED. If the phrase is missing any of chromosome, start, or stop, return:
   { "error": "Missing genomic coordinates", "reason": "<brief explanation>" }
2. Always normalize the chromosome to lowercase "chr" + identifier (e.g. "Chromosome 1" -> "chr1", "CHRX" -> "chrX", "chr17" -> "chr17"). Keep the identifier's original case where it matters (X, Y, M).
3. start and stop MUST be JSON numbers, not strings.
4. Strip commas, underscores, and whitespace from numeric literals.
5. Resolve unit suffixes: "kb" / "Kb" / "KB" -> ×1000, "Mb" / "MB" -> ×1000000, "Gb" / "GB" -> ×1000000000.
6. If the phrase uses "chrN:start-stop" syntax, parse the three fields directly from the colon/hyphen separators.
7. If start > stop after normalization, swap them so that start <= stop.

## EXAMPLES

--- Colon/hyphen region string ---
Phrase: "chr17:7,571,720-7,590,868"
Output: {
  "chromosome": "chr17",
  "start": 7571720,
  "stop": 7590868
}

--- Natural language "chromosome N from X to Y" ---
Phrase: "chromosome 1 from 1000000 to 2000000"
Output: {
  "chromosome": "chr1",
  "start": 1000000,
  "stop": 2000000
}

--- Unit suffix normalization (kb) ---
Phrase: "chrX from 5kb to 10kb"
Output: {
  "chromosome": "chrX",
  "start": 5000,
  "stop": 10000
}

--- Unit suffix normalization (Mb) ---
Phrase: "chr1 from 1Mb to 2Mb"
Output: {
  "chromosome": "chr1",
  "start": 1000000,
  "stop": 2000000
}

--- Comma-formatted coordinates without colon ---
Phrase: "chr22 from 16,000,000 to 16,500,000"
Output: {
  "chromosome": "chr22",
  "start": 16000000,
  "stop": 16500000
}

--- Missing "chr" prefix ---
Phrase: "7:140000000-141000000"
Output: {
  "chromosome": "chr7",
  "start": 140000000,
  "stop": 141000000
}

## NEGATIVE EXAMPLES — WHAT NOT TO DO
Phrase: "chr1:1000-2000"
WRONG:
{
  "chromosome": "chr1",
  "start": "1000",          // start must be a NUMBER, not a string
  "stop": "2000"            // stop must be a NUMBER, not a string
}

Phrase: "chromosome 1 from 1000 to 2000"
WRONG:
{
  "chromosome": "1",        // must include the "chr" prefix
  "start": 1000,
  "stop": 2000
}

Phrase: "chr1 from 1Mb to 2Mb"
WRONG:
{
  "chromosome": "chr1",
  "start": "1Mb",           // must resolve unit suffix to a numeric value
  "stop": "2Mb"
}

Parse the following genomic region phrase into the JSON object according to the rules and schema defined above:
Phrase: "${phrase}"
`
	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelName)
	// The LLM provider call failed and returned a user-facing message; propagate it for UI display.
	if (isMsgToUser(response)) return response
	mayLog(`--> Genomic coordinates parse: ${response}`)
	let parsed: any
	try {
		parsed = JSON.parse(response) as { chromosome: string; start: number; stop: number }
	} catch {
		return {
			type: 'text',
			text: `Failed to parse genomic coordinates from LLM response: ${response}`
		}
	}
	if (!parsed.chromosome || typeof parsed.start !== 'number' || typeof parsed.stop !== 'number') {
		return {
			type: 'text',
			text: `LLM response is missing required chromosome/start/stop fields: ${response}`
		}
	}
	return parsed
}

async function find_survival_terms(
	user_prompt: string,
	llm: LlmConfig,
	dbPath: string
): Promise<string | DbRows[] | null | MsgToUser> {
	const { db_rows } = await parse_survival_terms_from_db(dbPath)
	if (db_rows.length === 0) return null

	const survivalTermList = db_rows.map(r => `  - "${r.name}": ${r.description}`).join('\n')

	const prompt = `You are a ProteinPaint survival-term classifier. Given a user query and the list of survival terms available in the dataset, identify which survival term the user is referring to.

## AVAILABLE SURVIVAL TERMS
${survivalTermList}

## OUTPUT SCHEMA
Return ONLY a valid JSON object with this structure — no extra fields, no surrounding text, no explanation, no code fences:
{
  "survivalTerm": "<exact name from the list above>" | null
}

## RULES
1. The "survivalTerm" value MUST be an EXACT match (case-sensitive, character-for-character) of one of the names in the AVAILABLE SURVIVAL TERMS list above, or null.
2. Map common abbreviations and synonyms to the corresponding term, e.g.:
   - "overall survival", "os" → the term whose name corresponds to overall survival
   - "event-free survival", "efs" → the term whose name corresponds to event-free survival
   - "progression-free survival", "pfs" → the term whose name corresponds to progression-free survival
   - "relapse-free survival", "rfs" → the term whose name corresponds to relapse-free survival
   - "disease-free survival", "dfs" → the term whose name corresponds to disease-free survival
3. If the user query does not mention or refer to any of the listed survival terms, return { "survivalTerm": null }.
4. If the user query mentions survival generally but is ambiguous between multiple available terms, return { "survivalTerm": null }.
5. Do NOT invent, paraphrase, or modify term names — copy verbatim from the list.

## EXAMPLES
Query: "Show overall survival for AML patients"
Output: { "survivalTerm": "<exact name corresponding to overall survival, or null if not in list>" }

Query: "Plot EFS by sex"
Output: { "survivalTerm": "<exact name corresponding to event-free survival, or null if not in list>" }

Query: "Show gene expression of TP53"
Output: { "survivalTerm": null }

Classify the following user query:
Query: "${user_prompt}"
`
	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelName)
	// The LLM provider call failed and returned a user-facing message; propagate it for UI display.
	if (isMsgToUser(response)) return response
	mayLog(`--> Survival term classifier: ${response}`)
	let parsed: { survivalTerm: string | null }
	try {
		parsed = JSON.parse(response)
	} catch {
		mayLog(`Failed to parse survival term classifier response: ${response}`)
		return {
			type: 'text',
			text: `Failed to parse survival term classifier response: ${response}`
		}
	}
	const picked = parsed.survivalTerm
	if (!picked || picked === 'null') return db_rows
	const match = db_rows.find(r => r.name === picked)
	if (!match) {
		mayLog(
			`Survival term classifier returned "${picked}" which is not in db_rows; returning full list for user disambiguation.`
		)
		return db_rows
	}
	return match.name
}
