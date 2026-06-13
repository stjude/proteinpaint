import type { LlmConfig } from '#types'
import { TermTypes } from '#shared/terms.js'
import type {
	SummaryPhrase2EntityResult,
	Phrase2EntityResult,
	Entity,
	DEPhrase2EntityResult,
	HierPhrase2EntityResult,
	SurvivalPhrase2EntityResult,
	MatrixPhrase2EntityResult,
	PrebuiltScatterPhrase2EntityResult
} from './scaffoldTypes.ts'
//import { loadOrBuildEmbeddings, findBestMatch } from './semanticSearch.ts'
import { extractGenesetsFromPromptNew, extractGenesFromPrompt, getGenesetNames } from './utils.ts'
import { route_to_appropriate_llm_provider } from './routeAPIcall.ts'
import Database from 'better-sqlite3'
import assert from 'assert'
import { mayLog } from '#src/helpers.ts'

export interface DictTerm {
	id: string
	type: string
	name: string
}

export interface GeneTerm {
	gene: string
	type: string
}

export interface GeneSetTerm {
	geneSet: string
	type: typeof TermTypes.SSGSEA | typeof TermTypes.GENE_VARIANT | typeof TermTypes.GENE_EXPRESSION
}

export interface MethTerm {
	chr: string
	startPos: number
	endPos: number
	type: string
}

type Term = DictTerm | GeneTerm | MethTerm | GeneSetTerm

export type Value = {
	term: Term
	phrase: string
	type: string
	logicalOperator?: '&' | '|'
}

function buildNonDictTermObj(twEntity: Entity, genes_list: string[], genome: any): Value | undefined {
	switch (twEntity.termType) {
		case TermTypes.GENE_EXPRESSION: {
			const relevant_genes = extractGenesFromPrompt(twEntity.phrase, genes_list)
			let twResult: Term
			if (relevant_genes.length > 0) {
				twResult = { gene: relevant_genes[0], type: twEntity.termType } as GeneTerm
				if ('logicalOperator' in twEntity) {
					return {
						term: twResult,
						phrase: twEntity.phrase,
						type: twEntity.termType,
						logicalOperator: twEntity.logicalOperator
					}
				} else {
					return { term: twResult, phrase: twEntity.phrase, type: twEntity.termType }
				}
			} else {
				// Check to see if the phrase contains a geneset
				const relevant_genesets = extractGenesetsFromPromptNew(twEntity.phrase, getGenesetNames(genome))
				if (relevant_genesets.length > 0) {
					twResult = { geneSet: relevant_genesets[0], type: twEntity.termType } as GeneSetTerm
				} else {
					throw `No relevant genes or genesets found in phrase "${twEntity.phrase}" for gene expression term.`
				}

				if ('logicalOperator' in twEntity) {
					return {
						term: twResult,
						phrase: twEntity.phrase,
						type: twEntity.termType,
						logicalOperator: twEntity.logicalOperator
					}
				} else {
					return { term: twResult, phrase: twEntity.phrase, type: twEntity.termType }
				}
			}
		}
		case TermTypes.SSGSEA: {
			const geneSetNames = extractGenesetsFromPromptNew(twEntity.phrase, getGenesetNames(genome))
			const twResult: GeneSetTerm = {
				geneSet: geneSetNames.length > 0 ? geneSetNames[0] : 'UNKNOWN_GENESET',
				type: TermTypes.SSGSEA
			}
			if ('logicalOperator' in twEntity) {
				return {
					term: twResult,
					phrase: twEntity.phrase,
					type: twEntity.termType,
					logicalOperator: twEntity.logicalOperator
				}
			} else {
				return { term: twResult, phrase: twEntity.phrase, type: twEntity.termType }
			}
		}
		case 'dnaMethylation': {
			return undefined
		}
		case TermTypes.GENE_VARIANT: {
			return undefined
		}
		case TermTypes.PROTEOME_ABUNDANCE: {
			return undefined
		}
		default: {
			console.warn(`Unrecognized termType "${twEntity.termType}" for phrase "${twEntity.phrase}".`)
			return undefined
		}
	}
}

export async function getTermObj(
	key: string,
	twEntity: Entity,
	llm: LlmConfig,
	dbPath: string,
	genes_list: string[],
	genome: any
): Promise<Value | undefined> {
	// Nested LLM-based replacement for semanticSearch.findBestMatch(). Parses the dataset DB
	// via parse_dataset_db() to get the full rag_docs list and hands it to the classifier LLM
	// with the user phrase; the LLM returns the single rag_docs row whose term best matches.

	// Non-dic term types should be resolved accordingly,
	mayLog(`Getting term object for key "${key}" and phrase "${twEntity.phrase}" with term type "${twEntity.termType}"`)
	if (twEntity.termType !== 'dictionary') {
		const twRes = buildNonDictTermObj(twEntity, genes_list, genome)
		if (!twRes) {
			console.warn(`Skipping ${key} — could not build term for type "${twEntity.termType}"`)
			return undefined
		}
		return twRes
	} else {
		/*
const refEmbedding = await loadOrBuildEmbeddings(dbPath, llm)
const topK: number = 3
const match = await findBestMatch(twEntity.phrase, refEmbedding, llm, topK)
*/
		const match = await findBestMatchLLM(twEntity.phrase, dbPath, llm)
		if (!match) {
			console.warn(`findBestMatchLLM returned no match for query "${twEntity.phrase}"`)
			return undefined
		}
		const similarityThreshold = 0.85
		if (match.score < similarityThreshold) {
			// Threshold for "good enough" match, can be tuned
			console.warn(`Low similarity score (${(match.score * 100).toFixed(1)}%) for query "${twEntity.phrase}"`)
		} else {
			mayLog(
				`${key}: "${twEntity.phrase}" → best match: id="${match.id}" type="${match.type}" name="${match.name}" score=${(
					match.score * 100
				).toFixed(1)}%`
			)
			const term: DictTerm = {
				id: match.id,
				type: match.type,
				name: match.name
			}
			return { term, type: 'dictionary', phrase: twEntity.phrase }
		}
	}
}

export async function inferTermObjFromEntity(
	entity: Phrase2EntityResult,
	plotType: string,
	llm: LlmConfig,
	dbPath: string,
	genes_list: string[], // redundant (must be fixed)
	genome: any
): Promise<Record<string, Value | Value[] | string>> {
	const twObjects: Record<string, Value | Value[] | string> = {}
	if (plotType === 'summary') {
		const summaryEntity = entity as SummaryPhrase2EntityResult
		for (const [key, value] of Object.entries(summaryEntity)) {
			// need special handling for filters, since they can be more complex and nested than other term types
			if (key === 'filter') {
				const filterResult = value as Entity[] | undefined
				if (!filterResult) continue

				const filterValues: Value[] = []
				for (const filterTerm of filterResult) {
					mayLog('Evaluating filter term:', filterTerm)
					const termObj = await getTermObj(key, filterTerm, llm, dbPath, genes_list, genome)
					if (!termObj) {
						continue
					}
					const filterEntity = filterTerm as Entity
					if (filterEntity.logicalOperator) termObj.logicalOperator = filterEntity.logicalOperator
					filterValues.push(termObj)
				}
				mayLog('Final filter values:', filterValues)
				twObjects[key] = filterValues
				continue
			}

			// For other keys (tw1, tw2, tw3), we expect a single Entity in the array
			const entry = value as [Entity] | undefined
			if (!entry) continue
			const twEntity = entry[0]
			const termObj = await getTermObj(key, twEntity, llm, dbPath, genes_list, genome)
			if (!termObj) {
				throw `Failed to get term object for key "${key}" and phrase "${twEntity.phrase}".`
			}
			twObjects[key] = termObj
		}
		return twObjects
	} else if (plotType === 'dge') {
		const deEntity = entity as DEPhrase2EntityResult
		for (const [key, value] of Object.entries(deEntity)) {
			if (key === 'method') {
				twObjects[key] = value as string
				continue // method is not a term, so skip it
			}
			assert(value != undefined)
			const filterResult = deEntity[key] as Entity[]
			const filterValues: Value[] = []
			for (const filterTerm of filterResult) {
				mayLog(`Evaluating ${key} term:`, filterTerm)
				const termObj = await getTermObj(key, filterTerm, llm, dbPath, genes_list, genome)
				if (!termObj) {
					console.warn(`Skipping filter term "${filterTerm.phrase}" — failed to get term object`)
					continue
				}
				const filterEntity = filterTerm as Entity
				if (filterEntity.logicalOperator) termObj.logicalOperator = filterEntity.logicalOperator
				filterValues.push(termObj)
			}
			mayLog('Final filter values:', filterValues)
			twObjects[key] = filterValues
		}
		return twObjects
	} else if (plotType === 'survival') {
		const survivalEntity = entity as SurvivalPhrase2EntityResult

		// term holds the already-resolved survival term(s) (a matched name string, or the full
		// list of dataset survival terms when none/ambiguous). Pass it through unchanged.
		if (survivalEntity.term !== undefined) {
			twObjects['term'] = survivalEntity.term as unknown as Value
		}

		// term2 is the REQUIRED stratification variable; resolve it like a single tw entity.
		const term2Obj = await getTermObj('term2', survivalEntity.term2, llm, dbPath, genes_list, genome)
		if (!term2Obj) {
			throw `Failed to get term object for key "term2" and phrase "${survivalEntity.term2.phrase}".`
		}
		twObjects['term2'] = term2Obj

		// optional cohort filter
		if (survivalEntity.filter) {
			const filterValues: Value[] = []
			for (const filterTerm of survivalEntity.filter) {
				mayLog('Evaluating survival filter term:', filterTerm)
				const termObj = await getTermObj('filter', filterTerm, llm, dbPath, genes_list, genome)
				if (!termObj) {
					continue
				}
				const filterEntity = filterTerm as Entity
				if (filterEntity.logicalOperator) termObj.logicalOperator = filterEntity.logicalOperator
				filterValues.push(termObj)
			}
			mayLog('Final survival filter values:', filterValues)
			twObjects['filter'] = filterValues
		}
		return twObjects
	} else if (plotType === 'hiercluster') {
		const hierEntity = entity as HierPhrase2EntityResult
		const DictValues: Value[] = []
		for (const phrase of hierEntity.phrases) {
			mayLog('Evaluating hierCluster phrase:', phrase)
			const termObj = await getTermObj('DictPhrases', phrase, llm, dbPath, genes_list, genome)
			if (!termObj) {
				console.warn(`Skipping hierCluster gene "${phrase.phrase}" — failed to get term object`)
				continue
			}
			DictValues.push(termObj)
		}
		if (DictValues.length === 0) {
			throw 'No valid gene terms could be resolved for hierarchical clustering.'
		}
		twObjects['DictPhrases'] = DictValues

		if (hierEntity.filter) {
			const filterValues: Value[] = []
			for (const filterTerm of hierEntity.filter) {
				mayLog('Evaluating hierCluster filter term:', filterTerm)
				const termObj = await getTermObj('filter', filterTerm, llm, dbPath, genes_list, genome)
				if (!termObj) continue
				if (filterTerm.logicalOperator) termObj.logicalOperator = filterTerm.logicalOperator
				filterValues.push(termObj)
			}
			twObjects['filter'] = filterValues
		}
		return twObjects
	} else if (plotType === 'matrix') {
		const matrixEntity = entity as MatrixPhrase2EntityResult
		for (const [key, value] of Object.entries(matrixEntity)) {
			// need special handling for filters, since they can be more complex and nested than other term types
			if (key === 'filter') {
				const filterResult = value as Entity[] | undefined
				if (!filterResult) continue

				const filterValues: Value[] = []
				for (const filterTerm of filterResult) {
					mayLog('Evaluating filter term:', filterTerm)
					const termObj = await getTermObj(key, filterTerm, llm, dbPath, genes_list, genome)
					if (!termObj) {
						continue
					}
					const filterEntity = filterTerm as Entity
					if (filterEntity.logicalOperator) termObj.logicalOperator = filterEntity.logicalOperator
					filterValues.push(termObj)
				}
				mayLog('Final filter values:', filterValues)
				twObjects[key] = filterValues
				continue
			}

			if (key === 'twLst' && Array.isArray(value)) {
				const twEntities = value as Entity[]
				const termObjs: Value[] = []
				for (const [index, twEntity] of twEntities.entries()) {
					mayLog(`Evaluating twLst[${index}] entity:`, twEntity)
					const termObj = await getTermObj(key, twEntity, llm, dbPath, genes_list, genome)
					if (!termObj) {
						console.warn(`Skipping twLst[${index}] — failed to get term object for phrase "${twEntity.phrase}"`)
						continue
					}
					termObjs.push(termObj)
				}
				if (termObjs.length > 0) {
					twObjects[key] = termObjs
				} else {
					console.warn('No valid term objects could be resolved for any entries in twLst.')
				}
				continue
			}

			// For other keys divideBy,
			mayLog(`Evaluating divide by ${key} entity:`, value)
			const twEntity = value as Entity | undefined
			if (!twEntity) continue
			const termObj = await getTermObj(key, twEntity, llm, dbPath, genes_list, genome)
			if (!termObj) {
				throw `Failed to get term object for key "${key}" and phrase "${twEntity.phrase}".`
			}
			twObjects[key] = termObj
		}
		return twObjects
	} else if (plotType === 'prebuiltscatter') {
		const scatterEntity = entity as PrebuiltScatterPhrase2EntityResult
		if (scatterEntity.name) {
			twObjects['name'] = {
				term: { id: scatterEntity.name, type: 'prebuiltscatter', name: scatterEntity.name },
				type: 'prebuiltscatter',
				phrase: scatterEntity.name
			}
		}
		if (scatterEntity.colorBy === 'null') {
			twObjects['colorBy'] = 'null'
		} else if (scatterEntity.colorBy) {
			const termObj = await getTermObj('colorBy', scatterEntity.colorBy, llm, dbPath, genes_list, genome)
			if (termObj) {
				twObjects['colorBy'] = termObj
			} else {
				console.warn(
					`Failed to resolve colorBy term "${scatterEntity.colorBy.phrase}" for prebuilt scatter — skipping this attribute.`
				)
			}
		}
		if (scatterEntity.shapeBy === 'null') {
			twObjects['shapeBy'] = 'null'
		} else if (scatterEntity.shapeBy) {
			const termObj = await getTermObj('shapeBy', scatterEntity.shapeBy, llm, dbPath, genes_list, genome)
			if (termObj) {
				twObjects['shapeBy'] = termObj
			} else {
				console.warn(
					`Failed to resolve shapeBy term "${scatterEntity.shapeBy.phrase}" for prebuilt scatter — skipping this attribute.`
				)
			}
		}

		if (scatterEntity.divideBy) {
			const termObj = await getTermObj('divideBy', scatterEntity.divideBy, llm, dbPath, genes_list, genome)
			if (termObj) {
				twObjects['divideBy'] = termObj
			} else {
				console.warn(
					`Failed to resolve divideBy term "${scatterEntity.divideBy.phrase}" for prebuilt scatter — skipping this attribute.`
				)
			}
		}

		if (scatterEntity.filter) {
			const filterResult = scatterEntity.filter as Entity[]
			if (!filterResult) {
				console.warn(
					`Failed to resolve filter term "${scatterEntity.filter}" for prebuilt scatter — skipping this attribute.`
				)
			}

			const filterValues: Value[] = []
			for (const filterTerm of filterResult) {
				mayLog('Evaluating filter term:', filterTerm)
				const termObj = await getTermObj('filter', filterTerm, llm, dbPath, genes_list, genome)
				if (!termObj) {
					continue
				}
				const filterEntity = filterTerm as Entity
				if (filterEntity.logicalOperator) termObj.logicalOperator = filterEntity.logicalOperator
				filterValues.push(termObj)
			}
			mayLog('Final filter values:', filterValues)
			twObjects['filter'] = filterValues
		}
		return twObjects
	} else {
		throw 'Other plot types other than summary not yet supported'
	}
}

async function findBestMatchLLM(
	phrase: string,
	dbPath: string,
	llm: LlmConfig
): Promise<{ id: string; type: string; name: string; score: number; msg?: string } | undefined> {
	const dataset_db_output = await parse_dataset_db(dbPath)
	const { db_rows, rag_docs } = dataset_db_output
	if (rag_docs.length === 0) {
		console.warn('findBestMatchLLM: no rag_docs in DB')
		return undefined
	}
	const prompt = `You are an assistant that maps a user phrase to a dataset dictionary term.
	IMPORTANT: Your goal is NOT to always select a match. Your goal is to AVOID incorrect matches.
	
	You must follow this strict decision rule:
	1. Only select a term if it is a CLEAR, SPECIFIC, and UNIQUE match to the phrase.
	2. If multiple dictionary rows are closely related OR represent subtypes/specializations of the phrase, you MUST return "ambiguous".
	3. If the phrase is broader than the candidate terms (e.g., "chemotherapy" vs specific drug classes), you MUST return "ambiguous".
	4. If two or more candidates differ only by subtype, drug class, or measurement detail, DO NOT pick one — return "ambiguous" and list the three most closely related candidates ordered from most to least relevant.

	Examples of ambiguity:
	- Phrase: "chemotherapy"
	Candidates:
		- alkylating chemotherapy exposure
		- platinum chemotherapy exposure
	→ Return ambiguous (because phrase is general, candidates are specific subtypes)

	- Phrase: "age at diagnosis"
	Candidates:
		- age at diagnosis
		- diagnosis group
	→ Select "age at diagnosis" (clear and unique match)

	Scoring guidance:
	- Keyword overlap is important but NOT sufficient.
	- You must check:
	- specificity (is this too narrow?)
	- exclusivity (is this the only valid match?)
	- competition (are there similar alternatives?)

	Output format:
	- If confident:
	{ "term": "<field name>" }

	- If ambiguous:
	{
		"term": "ambiguous",
		"possible": ["<field1>", "<field2>", "<field3>"]
	}

	Always return ONLY valid JSON. No explanation. No markdown. No code fences.

	Dictionary rows:
	${rag_docs.map((doc, i) => `Row ${i + 1}: ${doc}`).join('\n')}

	Phrase: "${phrase}"

	JSON response:`

	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelName)
	if (!response) {
		throw new Error('No response from LLM for findBestMatchLLM')
	}
	// mayLog("Raw Response: ", JSON.stringify(response))
	let parsedTerm: string
	// let msg: string
	try {
		const parsed = JSON.parse(response) as { term: string; possible?: string[] }
		if (parsed.term === 'ambiguous') {
			mayLog('Ambiguous!!! Possible matches: ')
			if (parsed.possible) {
				parsedTerm = parsed.possible[0]
				mayLog(parsed.possible)
				mayLog('But choosing the first choice: ', parsedTerm)
			} else {
				parsedTerm = 'ambiguous_no_candidates'
			}
		} else {
			parsedTerm = parsed.term
			// msg = ''
		}
	} catch (e) {
		console.warn(`findBestMatchLLM: failed to parse LLM response: ${response}`, e)
		return undefined
	}
	/*
try {
const parsed = JSON.parse(response) as { term: string }
if (!parsed.term) {
console.warn(`findBestMatchLLM: LLM response missing term: ${response}`)
return undefined
}
parsedTerm = parsed.term
} catch (e) {
console.warn(`findBestMatchLLM: failed to parse LLM response: ${response}`, e)
return undefined
}*/

	const matchedRow = db_rows.find(r => r.name === parsedTerm)
	if (!matchedRow) {
		console.warn(`findBestMatchLLM: LLM returned term "${parsedTerm}" that was not found in db_rows`)
		return undefined
	}
	// db_rows.name is the dictionary term id (see parse_dataset_db in utils.ts).
	// LLM doesn't produce a native similarity score; use 1 so the downstream threshold treats this as confident.
	const retVal = {
		id: matchedRow.id,
		name: matchedRow.name,
		type: matchedRow.term_type,
		score: 1
	}
	return retVal
}

export async function parse_dataset_db(dataset_db: string) {
	const db = new Database(dataset_db)
	const rag_docs: string[] = []
	const db_rows: DbRows[] = []
	try {
		const rows = db
			.prepare(
				'SELECT t.id, t.name, t.type, t.jsondata, h.jsonhtml FROM terms t INNER JOIN termhtmldef h ON t.id = h.id'
			)
			.all()

		rows.forEach((row: any) => {
			const jsonhtml = JSON.parse(row.jsonhtml)
			const description: string = jsonhtml.description[0].value
			const jsondata = JSON.parse(row.jsondata)

			const values: DbValue[] = []
			if (jsondata.values && Object.keys(jsondata.values).length > 0) {
				for (const key of Object.keys(jsondata.values)) {
					const value = jsondata.values[key]
					const db_val: DbValue = { key: key, value: value }
					values.push(db_val)
				}
			}
			const db_row: DbRows = {
				id: row.id,
				name: row.name,
				description: description,
				values: values,
				term_type: row.type
			}
			const stringified_db = parse_db_rows(db_row)
			rag_docs.push(stringified_db)
			db_rows.push(db_row)
		})
	} catch (error) {
		throw 'Error in parsing dataset DB:' + error
	} finally {
		db.close()
	}
	return { db_rows: db_rows, rag_docs: rag_docs }
}

export function parse_db_rows(db_row: DbRows) {
	let output_string: string =
		'Name of the field is:"' +
		db_row.name +
		'". This field is of the type:' +
		db_row.term_type +
		'. Description: ' +
		db_row.description

	if (db_row.values.length > 0) {
		output_string += 'This field contains the following possible values.'
		for (const value of db_row.values) {
			if (value.value && value.value.label) {
				output_string += 'The key is "' + value.key + '" and the label is "' + value.value.label + '".'
			}
		}
	}
	return output_string
}

export type DbRows = {
	/** ID of the term */
	id: string
	/** Name of the term */
	name: string
	/** Description of the term in plain language */
	description: string
	/** The type of variable stored in the DB (e.g. categorical, float) */
	term_type: string
	/** Array of {key,value} terms storing the possible categories for a categorical variable */
	values: DbValue[]
}

export type DbValue = {
	/** Name of the key */
	key: string
	/** Object of values corresponding to the key */
	value: any
}
