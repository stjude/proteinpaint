import type { LlmConfig } from '#types'
import type { SummaryPhrase2EntityResult, Phrase2EntityResult, Entity, DEPhrase2EntityResult } from './scaffoldTypes.ts'
//import { loadOrBuildEmbeddings, findBestMatch } from './semanticSearch.ts'
import { extractGenesFromPrompt } from './utils.ts'
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

export interface MethTerm {
	chr: string
	startPos: number
	endPos: number
	type: string
}

type Term = DictTerm | GeneTerm | MethTerm

export type Value = {
	term: Term
	phrase: string
	type: string
	logicalOperator?: '&' | '|'
}

function buildNonDictTermObj(twEntity: Entity, genes_list: string[]): Value | undefined {
	switch (twEntity.termType) {
		case 'geneExpression': {
			const relevant_genes = extractGenesFromPrompt(twEntity.phrase, genes_list)
			const twResult: GeneTerm = {
				gene: relevant_genes.length > 0 ? relevant_genes[0] : 'UNKNOWN_GENE',
				type: twEntity.termType
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
		case 'geneVariant': {
			return undefined
		}
		case 'proteomeAbundance': {
			return undefined
		}
		default: {
			console.warn(`Unrecognized termType "${twEntity.termType}" for phrase "${twEntity.phrase}".`)
			return undefined
		}
	}
}

async function getTermObj(
	key: string,
	twEntity: Entity,
	llm: LlmConfig,
	dbPath: string,
	genes_list: string[]
): Promise<Value | undefined> {
	// Nested LLM-based replacement for semanticSearch.findBestMatch(). Parses the dataset DB
	// via parse_dataset_db() to get the full rag_docs list and hands it to the classifier LLM
	// with the user phrase; the LLM returns the single rag_docs row whose term best matches.

	// Non-dic term types should be resolved accordingly,
	if (twEntity.termType !== 'dictionary') {
		const twRes = buildNonDictTermObj(twEntity, genes_list)
		if (!twRes) {
			console.warn(`Skipping ${key} — could not build term for type "${twEntity.termType}"`)
			return undefined
		}
		return twRes
	} else {
		// const refEmbedding = await loadOrBuildEmbeddings(dbPath, llm)
		// const match = await findBestMatch(twEntity.phrase, refEmbedding, llm)
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
	genes_list: string[] // redundant (must be fixed)
): Promise<Record<string, Value | Value[]>> {
	const twObjects: Record<string, Value | Value[]> = {}
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
					const termObj = await getTermObj(key, filterTerm, llm, dbPath, genes_list)
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
			const termObj = await getTermObj(key, twEntity, llm, dbPath, genes_list)
			if (!termObj) {
				throw `Failed to get term object for key "${key}" and phrase "${twEntity.phrase}".`
			}
			twObjects[key] = termObj
		}
		return twObjects
	} else if (plotType == 'dge') {
		const deEntity = entity as DEPhrase2EntityResult
		for (const [key, value] of Object.entries(deEntity)) {
			assert(value != undefined)
			const filterResult = deEntity[key] as Entity[]
			const filterValues: Value[] = []
			for (const filterTerm of filterResult) {
				mayLog(`Evaluating ${key} term:`, filterTerm)
				const termObj = await getTermObj(key, filterTerm, llm, dbPath, genes_list)
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
	} else {
		throw 'Other plot types other than summary not yet supported'
	}
}

async function findBestMatchLLM(
	phrase: string,
	dbPath: string,
	llm: LlmConfig
): Promise<{ id: string; type: string; name: string; score: number } | undefined> {
	const dataset_db_output = await parse_dataset_db(dbPath)
	const { db_rows, rag_docs } = dataset_db_output
	if (rag_docs.length === 0) {
		console.warn('findBestMatchLLM: no rag_docs in DB')
		return undefined
	}

	const prompt = `You are an assistant that selects the best matching dictionary term from a dataset dictionary for a user-supplied phrase.

You will be given:
1. A phrase describing a clinical or genomic concept (e.g. "age at diagnosis", "diagnosis group", "ancestry").
2. A list of dictionary rows. Each row describes one term: its field name, its type (categorical, integer, float, condition, etc.), its description, and — for categorical terms — the possible (key, label) values it can take.

Your job:
- Select the SINGLE dictionary row whose term is most semantically similar to the phrase.
- Match on field name, description, and — when relevant — on the value labels of categorical terms.
- Return ONLY a JSON object conforming to the following schema, with no explanation, no markdown, no extra keys:
  { "term": "<the field name of the selected row>" }

Dictionary rows:
${rag_docs.map((doc, i) => `Row ${i + 1}: ${doc}`).join('\n')}

Phrase: "${phrase}"

JSON response:`

	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelName)
	let parsedTerm: string
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
	}

	const matchedRow = db_rows.find(r => r.name === parsedTerm)
	if (!matchedRow) {
		console.warn(`findBestMatchLLM: LLM returned term "${parsedTerm}" that was not found in db_rows`)
		return undefined
	}
	// db_rows.name is the dictionary term id (see parse_dataset_db in utils.ts).
	// LLM doesn't produce a native similarity score; use 1 so the downstream threshold treats this as confident.
	return {
		id: matchedRow.id,
		name: matchedRow.name,
		type: matchedRow.term_type,
		score: 1
	}
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
