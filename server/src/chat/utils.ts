import type { LlmConfig, DbRows, DbValue, GeneDataTypeResult, GeneSetDataTypeResult } from '#types'
import { TermTypes } from '#shared/terms.js'
import { mayLog } from '#src/helpers.ts'
import { route_to_appropriate_llm_provider } from './routeAPIcall.ts'
import type { MsgToUser, Entity, FilterTreeNode, FilterLeafNode, FilterTreeResult } from './scaffoldTypes.ts'
import { filterTreeJsonSchema, isMsgToUser } from './scaffoldTypes.ts'
import fs from 'fs'
import { getDsAllowedTermTypes } from '../routes/termdb.config.ts'
import Database from 'better-sqlite3'
import { GENE_FEATURE_KEYWORDS, determineAmbiguousGenePrompt } from './determineAmbiguousGene.ts'
import { GENE_SET_KEYWORDS } from './genesetdatatype.ts'
import { classifyGeneDataTypePhrase } from './genedatatypenew.ts'
import { classifyGeneSetDataType } from './genesetdatatype.ts'

export function getChatRelatedPlotTypes(supportedPlotTypes: string[] | undefined): string[] {
	if (!supportedPlotTypes) {
		mayLog(
			'Supported plot types list is undefined. Defaulting to empty list, which may lead to unsupported plot type errors downstream.'
		)
		return []
	}

	const plotTypes = [...supportedPlotTypes]

	// check if it supports summary charts
	if (plotTypes.includes('dictionary')) {
		// summmary means it includes "boxplot", "violin", "barchart", "sampleScatter" as child types
		plotTypes.push('summary')
	}

	// check if it supports heirarchical clustering charts
	// TODO:
	if (plotTypes.includes(TermTypes.GENE_EXPRESSION)) {
		// || plotTypes.includes(TermTypes.PROTEOME_ABUNDANCE) || plotTypes.includes(TermTypes.DNA_METHYLATION))
		plotTypes.push('hiercluster')
	}
	// check if it supports dge
	if (plotTypes.includes('DA')) {
		plotTypes.push('dge')
	}

	// For t-SNE/UMAP scatter plots
	if (plotTypes.includes('sampleScatter')) {
		plotTypes.push('prebuiltscatter')
	}

	// For genomeBrowser
	if (plotTypes.includes('genomeBrowser')) {
		plotTypes.push('genomeBrowser')
	}
	return Array.from(new Set(plotTypes))
}

// ---------------------------------------------------------------------------
//  Shared data type registry — describes non-dictionary data types available
//  to all chat agents (matrix, summary, scatter, etc.)
// ---------------------------------------------------------------------------

type IdentifierMode = 'gene' | 'name'

export interface DataTypeConfig {
	/** TermTypes value, e.g. '${TermTypes.GENE_EXPRESSION}' */
	termType: string
	/** Returns true when the dataset supports this data type.
	 *  ds may be null in testing mode — use dataset_json flags as fallback. */
	detectAvailability: (ds: any, dataset_json: any) => boolean
	/** JSON property name the LLM will output (used by matrix agent schema) */
	schemaFieldName: string
	/** JSON schema definition for this property (used by matrix agent schema) */
	schemaDefinition: object
	/** How identifiers are resolved: 'gene' validates against gene list, 'name' passes through */
	identifierMode: IdentifierMode
	/** Constructs the term wrapper object from a validated identifier */
	buildTermWrapper: (identifier: string) => any
	/** Describes this field to the LLM in the system prompt (used by matrix agent) */
	promptFieldDescription: string
	/** Human-readable description of valid identifiers, used by buildCommonPrompt()
	 *  to tell the LLM what names are accepted (e.g. "Gene set pathway names (e.g. HALLMARK_APOPTOSIS)") */
	dataTypeDescription?: string
}

export function getGenesForGeneset(genome: any, genesetTermId: string): { symbol: string }[] | undefined {
	if (!genome?.termdbs) return undefined
	for (const key in genome.termdbs) {
		const tdb = genome.termdbs[key]
		if (!tdb.cohort?.termdb?.isGeneSetTermdb) continue
		const getGenesetByTermId = tdb.cohort?.termdb?.q?.getGenesetByTermId
		if (!getGenesetByTermId) continue
		return getGenesetByTermId(genesetTermId)
	}
	return undefined
}

export const DATA_TYPE_REGISTRY: DataTypeConfig[] = [
	{
		termType: TermTypes.GENE_EXPRESSION,
		detectAvailability: (ds: any) => !!ds?.queries?.geneExpression,
		schemaFieldName: 'geneNames',
		schemaDefinition: {
			type: 'array',
			items: { type: 'string' },
			description: 'Names of genes to include as gene expression rows in the matrix'
		},
		identifierMode: 'gene',
		buildTermWrapper: (gene: string) => ({ term: { gene: gene.toUpperCase(), type: TermTypes.GENE_EXPRESSION } }),
		promptFieldDescription:
			'The "geneNames" field should ONLY contain gene names. These will be shown as gene expression rows.'
	},
	{
		termType: TermTypes.GENE_VARIANT,
		detectAvailability: (ds: any) => !!ds?.mayGetGeneVariantData,
		schemaFieldName: 'geneNames',
		schemaDefinition: {
			type: 'array',
			items: { type: 'string' },
			description: 'Names of genes to include as gene variant rows in the matrix'
		},
		identifierMode: 'gene',
		buildTermWrapper: (gene: string) => ({
			term: { gene: gene.toUpperCase(), name: gene.toUpperCase(), type: TermTypes.GENE_VARIANT }
		}),
		promptFieldDescription:
			'The "geneNames" field should ONLY contain gene names. These will be shown as gene variant/mutation rows.'
	},
	{
		termType: TermTypes.SSGSEA,
		detectAvailability: (ds: any) => !!ds?.queries?.ssGSEA,
		schemaFieldName: 'genesetNames',
		schemaDefinition: {
			type: 'array',
			items: { type: 'string' },
			description:
				'Names of gene sets (e.g. HALLMARK pathways) to include as ssGSEA enrichment score rows in the matrix'
		},
		identifierMode: 'name',
		buildTermWrapper: (name: string) => ({ term: { id: name, name, type: TermTypes.SSGSEA } }),
		promptFieldDescription:
			'The "genesetNames" field should contain gene set pathway names (e.g. HALLMARK_P53_PATHWAY).',
		dataTypeDescription: 'Gene set pathway names (e.g. HALLMARK_APOPTOSIS, HALLMARK_ADIPOGENESIS)'
	},
	{
		termType: TermTypes.METABOLITE_INTENSITY,
		detectAvailability: (ds: any) => !!ds?.queries?.metaboliteIntensity,
		schemaFieldName: 'metaboliteNames',
		schemaDefinition: {
			type: 'array',
			items: { type: 'string' },
			description: 'Names of metabolites to include as metabolite intensity rows in the matrix'
		},
		identifierMode: 'name',
		buildTermWrapper: (name: string) => ({ term: { name, metabolite: name, type: TermTypes.METABOLITE_INTENSITY } }),
		promptFieldDescription: 'The "metaboliteNames" field should contain metabolite names.',
		dataTypeDescription: 'Metabolite names'
	},
	{
		termType: TermTypes.PROTEOME_ABUNDANCE,
		detectAvailability: (ds: any) => !!ds?.queries?.proteome,
		schemaFieldName: 'proteinNames',
		schemaDefinition: {
			type: 'array',
			items: { type: 'string' },
			description: 'Names of proteins to include as whole proteome abundance rows in the matrix'
		},
		identifierMode: 'name',
		buildTermWrapper: (name: string) => ({ term: { name, protein: name, type: TermTypes.PROTEOME_ABUNDANCE } }),
		promptFieldDescription: 'The "proteinNames" field should contain protein names.',
		dataTypeDescription: 'Protein names'
	}
]

// ---------------------------------------------------------------------------
//  Shared prompt builder — common tail appended by all chat agents
// ---------------------------------------------------------------------------

/** Get all geneset names from the genome-level geneset termdb.
 *  Queries the term2genes table for all IDs once, then caches the result.
 *  Returns empty array if unavailable. */
const genesetNamesCache = new Map<string, string[]>()
export function getGenesetNames(genome: any): string[] {
	if (!genome?.termdbs) return []
	for (const key in genome.termdbs) {
		if (genesetNamesCache.has(key)) return genesetNamesCache.get(key)!
		const tdb = genome.termdbs[key]
		if (!tdb.cohort?.termdb?.isGeneSetTermdb) continue
		const cn = tdb.cohort?.db?.connection
		if (!cn) continue
		try {
			const rows = cn.prepare('SELECT id FROM term2genes').all()
			const names = rows.map((r: any) => r.id as string)
			genesetNamesCache.set(key, names)
			return names
		} catch {
			return []
		}
	}
	return []
}

/** Extract geneset names from user prompt that match available genesets.
 *  Splits prompt into keywords (>= 5 chars) and matches against whole
 *  underscore-delimited segments of geneset names to avoid false positives
 *  from common English words (e.g. "from" matching REACTOME_..._FROM_...).
 *  Also checks for exact full-name matches (e.g. "HALLMARK_APOPTOSIS"). */
export function extractGenesetsFromPrompt(prompt: string, genesetNames: string[]): string[] {
	if (genesetNames.length === 0) return []

	const tokens = prompt
		.replace(/[^a-zA-Z0-9_\s]/g, '')
		.split(/\s+/)
		.filter(w => w.length >= 5)
		.map(w => w.toLowerCase())

	if (tokens.length === 0) return []

	// Split underscore-joined tokens into individual words for segment matching
	const words = new Set<string>()
	for (const t of tokens) {
		for (const part of t.split('_')) {
			if (part.length >= 5) words.add(part)
		}
	}

	// Also keep full tokens for exact name matching (e.g. "hallmark_apoptosis")
	const fullTokens = new Set(tokens)

	const matched = genesetNames.filter(gs => {
		const gsLower = gs.toLowerCase()
		// Exact full-name match
		if (fullTokens.has(gsLower)) return true
		// Segment match
		const segments = gsLower.split('_')
		return [...words].some(w => segments.some(seg => seg === w))
	})

	// Cap to avoid prompt bloat
	return matched.slice(0, 10)
}

export function extractGenesetsFromPromptNew(prompt: string, genesetNames: string[]): string[] {
	if (genesetNames.length === 0) return []
	const tokens = prompt
		.replace(/[^a-zA-Z0-9_\s]/g, '')
		.split(/\s+/)
		.map(w => w.toLowerCase())

	if (tokens.length === 0) return []

	// Simple approach - works for primitives
	const common_tokens = genesetNames.filter(item => tokens.includes(item.toLowerCase()))
	return common_tokens
}

/** Format few-shot training examples into a prompt string. */
export function formatTrainingExamples(trainingData: { question: string; answer: any }[]): string {
	return trainingData
		.map(
			(td, i) =>
				'Example question' +
				(i + 1).toString() +
				': ' +
				td.question +
				' Example answer' +
				(i + 1).toString() +
				':' +
				JSON.stringify(td.answer)
		)
		.join(' ')
}

export function checkField(sentence: string) {
	if (!sentence) return ''
	else return sentence
}

export async function readJSONFile(file: string) {
	const json_file = await fs.promises.readFile(file)
	return JSON.parse(json_file.toString())
}

export function generate_group_name(filters: any[], db_rows: DbRows[]): string {
	let name = ''
	let iter = 0
	for (const filter of filters) {
		if (iter > 0 && !filter.join) {
			// Sometimes the LLM misses join terms. In such cases, hardcoding & operator
			name += '&'
		}
		if (filter.join && filter.join == 'and') {
			name += '&'
		}
		if (filter.join && filter.join == 'or') {
			name += '|'
		}
		if (filter.category) {
			// Categorical variable
			name += find_label(filter, db_rows)
		}
		if (filter.start) {
			// Integer or float variable
			name += filter.term + '>=' + filter.start.toString()
		}
		if (filter.stop) {
			// Integer or float variable
			name += filter.term + '<=' + filter.stop.toString()
		}
		iter += 1
	}
	return name
}

/**
 * Build a suitable differential-expression plot name from the two sample-group filters
 * (filter1 vs filter2) assembled by resolveToTvs(). Each group name lists its individual filter
 * variables separated by their boolean flags ('&' for AND, '|' for OR)
 *
 * Adapted from the legacy generate_group_name(): instead of walking a flat filter array it walks
 * the tvslst structure ({ type:'tvslst', join, lst:[{ type:'tvs', tvs }, ...] }), since that is
 * what the dge branch of resolveToPlotState() receives as input.filter1 / input.filter2.
 */

/** Recursively turn a tvslst into its filter-variable labels separated by boolean flags. */
export function generate_group_name_from_tvslst(tvslst: any): string {
	if (!tvslst || !Array.isArray(tvslst.lst) || tvslst.lst.length === 0) return ''
	// 'and' → '&', 'or' → '|'; default to '&' when join is absent (single leaf or LLM omission)
	const flag = tvslst.join === 'or' ? '|' : '&'
	const parts: string[] = []
	for (const item of tvslst.lst) {
		if (item.type === 'tvslst') {
			// nested group — wrap in parentheses to preserve grouping
			const nested = generate_group_name_from_tvslst(item)
			if (nested) parts.push(`(${nested})`)
		} else if (item.type === 'tvs' && item.tvs) {
			parts.push(generate_tvs_label(item.tvs))
		}
	}
	return parts.join(flag)
}

/** Label for a single tvs leaf: variable name plus its category value(s) or numeric range. */
function generate_tvs_label(tvs: any): string {
	const termName = tvs.term?.name || tvs.term?.id || ''
	if (Array.isArray(tvs.values) && tvs.values.length > 0) {
		// categorical leaf
		const labels = tvs.values.map((v: any) => v.label || v.key).join(', ')
		return `${termName}=${labels}`
	}
	if (Array.isArray(tvs.ranges) && tvs.ranges.length > 0) {
		// numeric leaf
		const r = tvs.ranges[0]
		if (r.start != null && r.stop != null) return `${r.start}<=${termName}<=${r.stop}`
		if (r.start != null) return `${termName}>=${r.start}`
		if (r.stop != null) return `${termName}<=${r.stop}`
	}
	return termName
}

function find_label(filter: any, db_rows: DbRows[]): string {
	let label = ''
	for (const row of db_rows) {
		if (row.name == filter.term) {
			for (const value of row.values) {
				if (value.value && value.value.label && filter.category == value.key) {
					label = value.value.label
					break
				}
			}
			break
		}
	}
	return label
}

export function removeLastOccurrence(str: string, word: string): string {
	const index = str.lastIndexOf(word)
	if (index === -1) return str // word not found

	const occurrences = countOccurrences(str, word)
	if (occurrences === 1) {
		return str
	} else {
		// Slice out the word and concatenate the surrounding parts
		return str.slice(0, index) + str.slice(index + word.length)
	}
}

function countOccurrences(str: string, word: string): number {
	if (word === '') return 0 // avoid infinite loops
	let count = 0
	let pos = 0

	while ((pos = str.indexOf(word, pos)) !== -1) {
		count++
		pos += word.length // move past this match
	}
	return count
}

/** Extract gene names from user prompt that exist in the gene database. */
export function extractGenesFromPrompt(prompt: string, genes_list: string[]): string[] {
	const words = prompt
		.replace(/[^a-zA-Z0-9\s]/g, '')
		.split(/\s+/)
		.map(str => str.toLowerCase())
	return words.filter(item => genes_list.includes(item))
}

export function validate_term(response_term: string, ds: any, geneFeatures: GeneDataTypeResult[]) {
	let text = ''
	let term_type: any
	let category: string = ''

	// 1. Try dictionary term lookup
	const term: any =
		ds.cohort.termdb.q.termjsonByOneid(response_term) ||
		ds.cohort.termdb.q.termjsonByOneid(response_term.toUpperCase()) ||
		ds.cohort.termdb.q.termjsonByOneid(response_term.toLowerCase())
	if (term) {
		term_type = { id: term.id }
		category = term.type
	} else {
		// 2. Try gene name lookup
		const gene_hit = geneFeatures.find(geneTerm => geneTerm.gene.toLowerCase() == response_term.toLowerCase())
		if (gene_hit) {
			if (gene_hit.dataType == 'expression') {
				const geneConfig = DATA_TYPE_REGISTRY.find(
					c => c.termType === TermTypes.GENE_EXPRESSION && c.detectAvailability(ds, null)
				)
				if (geneConfig) {
					term_type = geneConfig.buildTermWrapper(response_term)
					category = 'float'
				} else {
					text += 'Dataset does not support gene expression'
				}
			} else if (gene_hit.dataType == 'variant') {
				text +=
					'Gene ' +
					gene_hit.gene +
					' has variant type. However, gene variant/mutation data plotting has not been currently implemented'
			} else if (gene_hit.dataType == 'methylation') {
				text +=
					'Gene ' +
					gene_hit.gene +
					' has methylation type. However, methylation data has plotting not been currently implemented'
			} else {
				// Should not happen since we only return known data types from getGeneDataTypes, but just in case
				text += 'Gene ' + gene_hit.gene + ' has unknown data type: ' + gene_hit.dataType
			}
		}
		// 3. Try name-based types (ssGSEA, metabolite, etc.) — first available match wins
		else {
			const nameConfig = DATA_TYPE_REGISTRY.find(c => c.identifierMode === 'name' && c.detectAvailability(ds, null))
			if (nameConfig) {
				term_type = nameConfig.buildTermWrapper(response_term)
				category = 'float'
			} else {
				text += 'invalid term id:' + response_term
			}
		}
	}
	return { term_type, text, category }
}

export async function parse_geneset_db(genedb: string) {
	let genes_list: string[] = []
	const db = new Database(genedb)
	try {
		// Query the database
		const desc_rows = db.prepare('SELECT name from codingGenes').all()
		desc_rows.forEach((row: any) => {
			genes_list.push(row.name)
		})
		genes_list = genes_list.map(str => str.toLowerCase()) // Converting to lowercase
	} catch (error) {
		throw 'Could not parse geneDB' + error
	} finally {
		db.close()
	}
	return genes_list
}

export async function parse_dataset_db(
	dataset_db: string
): Promise<{ db_rows: DbRows[]; rag_docs: string[] } | MsgToUser> {
	const db = new Database(dataset_db)
	const rag_docs: string[] = []
	const db_rows: DbRows[] = []
	try {
		const rows = db
			.prepare('SELECT t.id, t.type, t.jsondata, h.jsonhtml FROM terms t INNER JOIN termhtmldef h ON t.id = h.id')
			.all()

		for (const row of rows as any[]) {
			let jsonhtml: any
			try {
				jsonhtml = JSON.parse(row.jsonhtml)
			} catch (e) {
				mayLog(`Failed to parse jsonhtml for row id ${row.id}:`, e)
				// Surface a message to the client instead of crashing on the malformed term definition below.
				return {
					type: 'text',
					text: `Failed to read the dataset dictionary: the definition for term "${row.id}" is malformed. The error message is: ${e}.`
				}
			}
			const description: string = jsonhtml.description[0].value
			let jsondata: any
			try {
				jsondata = JSON.parse(row.jsondata)
			} catch (e) {
				mayLog(`Failed to parse jsondata for row id ${row.id}:`, e)
				return {
					type: 'text',
					text: `Failed to read the dataset dictionary: the data for term "${row.id}" is malformed. The error message is: ${e}.`
				}
			}
			const values: DbValue[] = []
			if (jsondata.values && Object.keys(jsondata.values).length > 0) {
				for (const key of Object.keys(jsondata.values)) {
					const value = jsondata.values[key]
					const db_val: DbValue = { key: key, value: value }
					values.push(db_val)
				}
			}
			const db_row: DbRows = {
				name: row.id,
				description: description,
				values: values,
				term_type: row.type
			}
			const stringified_db = parse_db_rows(db_row)
			rag_docs.push(stringified_db)
			db_rows.push(db_row)
		}
	} catch (error) {
		throw 'Error in parsing dataset DB:' + error
	} finally {
		db.close()
	}
	return { db_rows: db_rows, rag_docs: rag_docs }
}

export async function parse_survival_terms_from_db(dataset_db: string) {
	const db = new Database(dataset_db)
	const rag_docs: string[] = []
	const db_rows: DbRows[] = []
	try {
		const rows = db.prepare("SELECT * FROM terms WHERE type = 'survival'").all()

		rows.forEach((row: any) => {
			const jsondata = row.jsondata ? JSON.parse(row.jsondata) : {}

			const values: DbValue[] = []
			if (jsondata.values && Object.keys(jsondata.values).length > 0) {
				for (const key of Object.keys(jsondata.values)) {
					const value = jsondata.values[key]
					const db_val: DbValue = { key: key, value: value }
					values.push(db_val)
				}
			}
			const db_row: DbRows = {
				name: row.id,
				description: jsondata.name || row.id,
				values: values,
				term_type: row.type
			}
			const stringified_db = parse_db_rows(db_row)
			rag_docs.push(stringified_db)
			db_rows.push(db_row)
		})
	} catch (error) {
		throw new Error('Error in parsing survival terms from dataset DB:' + error)
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

export async function phrase2entitytw(
	phrase: string,
	llm: LlmConfig,
	genes_list: string[],
	dataset_json: any,
	ds: any,
	genome: any
): Promise<MsgToUser | Entity> {
	const tw1Result = await inferEntities(phrase, llm, genes_list, dataset_json, genome)
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

async function inferEntities(
	phrase: string,
	llm: LlmConfig,
	genes_list: string[],
	dataset_json: any,
	genome: any
): Promise<Entity | MsgToUser> {
	const validatedNonDict = await validateNonDictionaryTypes(phrase, llm, genes_list, dataset_json, genome)
	if (!validatedNonDict) {
		// No match, probably a dictionary term or a non-dictionary term we don't have a way to validate yet (e.g. ssGSEA score, metabolites, etc.)

		// TODO: This incorrectly fails when a gene is not present in the genes_list, it assumes it's a dictionary term
		// Need a way to handle this correctly and gracefully
		return { termType: 'dictionary', phrase: phrase }
	} else if ('type' in validatedNonDict && validatedNonDict.type === 'text') {
		return validatedNonDict // This means we encountered an error or an ambiguous gene prompt, and we want to return early with a user-facing message.
	} else if ('geneFeatures' in validatedNonDict) {
		if (validatedNonDict.geneFeatures.dataType == 'expression') {
			return { termType: TermTypes.GENE_EXPRESSION, phrase: phrase }
		} else if (validatedNonDict.geneFeatures.dataType === 'methylation') {
			return { termType: TermTypes.DNA_METHYLATION, phrase: phrase }
		} else if (validatedNonDict.geneFeatures.dataType === 'variant') {
			return { termType: TermTypes.GENE_VARIANT, phrase: phrase }
		} else if (validatedNonDict.geneFeatures.dataType === 'proteome') {
			return { termType: TermTypes.PROTEOME_ABUNDANCE, phrase: phrase }
		} else {
			throw 'validateNonDictionaryTypes returned an unrecognized geneFeatures:' + validatedNonDict.geneFeatures
		}
	} else if ('geneSetFeatures' in validatedNonDict) {
		if (validatedNonDict.geneSetFeatures.dataType === TermTypes.SSGSEA) {
			return { termType: TermTypes.SSGSEA, phrase: phrase }
		} else if (validatedNonDict.geneSetFeatures.dataType === TermTypes.GENE_VARIANT) {
			return { termType: TermTypes.GENE_VARIANT, phrase: phrase }
		} else if (validatedNonDict.geneSetFeatures.dataType === TermTypes.GENE_EXPRESSION) {
			return { termType: TermTypes.GENE_EXPRESSION, phrase: phrase }
		} else {
			throw 'validateNonDictionaryTypes returned an unrecognized geneSetFeatures:' + validatedNonDict.geneSetFeatures
		}
	} else {
		// Should not happen
		throw (
			'validatedNonDict has unknown data type returned from validateNonDictionaryTypes function:' +
			JSON.stringify(validatedNonDict)
		)
	}
}

/* This function checks if the non-dictionary types mentioned in the scaffold result (e.g. gene names) are valid based
 * on the corresponding db (e.g. genedb). If any invalid terms are found, it throws an error which is caught in the main
 * function and returned as a text response to the user. This is an important validation step to ensure that downstream agents
 * receive valid inputs and can function properly, and also to provide clear feedback to the user if they mention invalid terms.
 *
 * For e.g. ("Show TP53" is invalid because its not clear what term type TP53 is, but "Show expression of TP53" is valid
 * because "expression of TP53" can be resolved to a TermTypes.GENE_EXPRESSION term type which is present in the dataset)
 * We are looking for gene terms against an exhaustive list of genes from a db, but we will need a similar approach for other
 * nondictionary types such as metabolites, genesets, etc.
 */
export async function validateNonDictionaryTypes(
	phrase: string,
	llm: LlmConfig,
	genes_list: string[],
	dataset_json: any,
	genome: any
): Promise<MsgToUser | { geneFeatures: GeneDataTypeResult } | { geneSetFeatures: GeneSetDataTypeResult } | null> {
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
		const geneDataTypeMessage: GeneDataTypeResult | string | null = (await classifyGeneDataTypePhrase(
			// This function uses an LLM to classify which specific gene features (e.g. expression, mutation, etc.) are relevant to the user prompt for each of the relevant genes mentioned in the prompt.
			phrase,
			llm,
			relevant_genes,
			dataset_json
		)) as GeneDataTypeResult | string | null

		if (geneDataTypeMessage === null) {
			// This will be null when a word could be both a gene/metabolite and a dictionary variable for e.g. A molecular subtype named "KMT2A" which is also a gene. When classifyGeneDataTypePhrase() classifies it as a dictionary variable, it returns null for geneDataTypeMessage, and then we want to return null from this function so that the main phrase2entity function can continue processing it as a dictionary variable rather than a nonDictionary variable.
			return null
		} else if (typeof geneDataTypeMessage === 'string') {
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
	const relevant_genesets = extractGenesetsFromPromptNew(phrase, getGenesetNames(genome))
	if (relevant_genesets.length > 0) {
		// Similar validation for genesets. If the prompt includes a geneset keyword but no valid geneset is found, we want to return an error message to the user. If a valid geneset is found, we will return null so that the main phrase2entity function can continue processing it as a non-dictionary variable rather than a dictionary variable.
		if (relevant_genesets.length > 1) {
			throw 'More than one gene set found in phrase:' + relevant_genesets.join(', ')
		}
		const genesetDataTypeMessage: GeneSetDataTypeResult | MsgToUser = (await classifyGeneSetDataTypePhrase(
			// This function uses an LLM to classify which specific gene-set features (e.g. ssGSEA enrichment score, gene variants of pathway members) are relevant to the user prompt.
			phrase,
			llm,
			relevant_genesets[0]
		)) as GeneSetDataTypeResult | MsgToUser
		mayLog('classifyGeneSetDataTypePhrase result:', genesetDataTypeMessage)
		// TODO: surface ssGSEA vs geneVariant downstream once consumers know how to handle genesetFeatures.
		if ('type' in genesetDataTypeMessage && genesetDataTypeMessage.type === 'text') {
			return genesetDataTypeMessage
		} else if ('dataType' in genesetDataTypeMessage && genesetDataTypeMessage.dataType === 'ambiguous') {
			msg.text =
				'The intent for geneset "' +
				genesetDataTypeMessage.geneSet +
				'" is ambiguous. Please clarify if you are asking about the ssGSEA enrichment score for the geneset, or the gene variants of the genes in the geneset.'
			return msg
		} else if ('geneSet' in genesetDataTypeMessage && genesetDataTypeMessage.geneSet) {
			return { geneSetFeatures: genesetDataTypeMessage }
		} else {
			throw 'geneSetDataTypeMessage has unknown data type returned from classifyGeneSetDataType agent'
		}
	}
	// else if {} // Implement similar keyword searches for other nondictionary types later (e.g. metabolite Intensity, protein abundance, etc.)
	else {
		const NonDictGeneKeyWords = extractGenesFromPrompt(phrase, GENE_FEATURE_KEYWORDS) // Using the same function as extracting genes from a phrase. Will later add similar list as GENE_FEATURE_KEYWORDS for other nonDict types such as metabolite Intensity, protein abundance, etc.
		if (NonDictGeneKeyWords.length > 0) {
			msg.text =
				"Prompt includes keyword(s) such as '" +
				NonDictGeneKeyWords.join(',') +
				"' that may refer to a nonDict type (e.g. genes) but no such term was found in the prompt"
			return msg
		}
		const NonDictGeneSetKeyWords = extractGenesFromPrompt(phrase, GENE_SET_KEYWORDS) // Using the same function as extracting genes from a phrase.
		if (NonDictGeneSetKeyWords.length > 0) {
			msg.text =
				"Prompt includes keyword(s) such as '" +
				NonDictGeneSetKeyWords.join(',') +
				"' that may refer to a nonDict type (e.g. geneset) but no such term was found in the prompt"
			return msg
		}
		// else if // May go for an LLM based approach if the above string search based method is not sufficient
		else {
			return null // This means the term could be some other non-dictionary type (e.g. ssGSEA score, metabolites, etc.) or it could be a dictionary term.
		}
	}
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

async function classifyGeneSetDataTypePhrase(
	phrase: string,
	llm: LlmConfig,
	geneset: string
): Promise<GeneSetDataTypeResult | MsgToUser> {
	// Need to add string search based heuristics here similar to validateNonDictionaryTypes for certain keywords that may indicate ssGSEA vs geneVariant to reduce unnecessary LLM calls, but for now we will just call the LLM directly to classify the geneset data type based on the user prompt.
	return await classifyGeneSetDataType(phrase, llm, geneset)
}

/*
 * For filter phrases that have literal or conceptual "ands", they're grouped in a single array
 * If "or", they're grouped into separate array elements
 * For examples:
 * "young and black patients" -> ["young", "black"]
 * "young and black patients or old and white patients" -> [["young", "black"], ["old", "white"]]
 */
export async function evaluateFilterTerm(phrase: string, llm: LlmConfig): Promise<FilterTreeResult | MsgToUser> {
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
	// The LLM provider call failed and returned a user-facing message; propagate it for UI display.
	mayLog('filter response:', response)
	if (isMsgToUser(response)) return response
	let parsed: FilterTreeResult
	try {
		parsed = JSON.parse(response) as FilterTreeResult
	} catch (e) {
		return {
			type: 'text',
			text: `Failed to parse LLM filter response for phrase: "${phrase}". Error message is "${e}"`
		} as MsgToUser
	}
	try {
		if (!parsed.tree || !parsed.sexpr) {
			throw 'Response missing required fields "tree" or "sexpr"'
		}
		return parsed
	} catch (e) {
		mayLog('Failed to parse LLM filter response, wrapping phrase as single leaf:', response, ' error message:', e)
		// Fallback: wrap the entire phrase as a single-leaf tree conforming to the schema
		return {
			sexpr: phrase,
			tree: { leaf: phrase }
		}
	}
}
