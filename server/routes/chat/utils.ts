import type { DbRows, DbValue } from '#types'
import { TermTypes } from '#shared/terms.js'
import { FILTER_DESCRIPTION } from './filter.ts'
import { mayLog } from '#src/helpers.ts'
import fs from 'fs'
import Database from 'better-sqlite3'

// ---------------------------------------------------------------------------
//  Shared data type registry — describes non-dictionary data types available
//  to all chat agents (matrix, summary, scatter, etc.)
// ---------------------------------------------------------------------------

type IdentifierMode = 'gene' | 'name'

export interface DataTypeConfig {
	/** TermTypes value, e.g. 'geneExpression' */
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

export const DATA_TYPE_REGISTRY: DataTypeConfig[] = [
	{
		termType: TermTypes.GENE_EXPRESSION,
		detectAvailability: (ds: any, dataset_json: any) =>
			!!ds?.queries?.geneExpression || !!dataset_json?.hasGeneExpression,
		schemaFieldName: 'geneNames',
		schemaDefinition: {
			type: 'array',
			items: { type: 'string' },
			description: 'Names of genes to include as gene expression rows in the matrix'
		},
		identifierMode: 'gene',
		buildTermWrapper: (gene: string) => ({ term: { gene: gene.toUpperCase(), type: 'geneExpression' } }),
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
			term: { gene: gene.toUpperCase(), name: gene.toUpperCase(), type: 'geneVariant' }
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
		buildTermWrapper: (name: string) => ({ term: { id: name, name, type: 'ssGSEA' } }),
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
		buildTermWrapper: (name: string) => ({ term: { name, metabolite: name, type: 'metaboliteIntensity' } }),
		promptFieldDescription: 'The "metaboliteNames" field should contain metabolite names.',
		dataTypeDescription: 'Metabolite names'
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

/** Builds the common suffix shared by all agent system prompts:
 *  filter description, dataset/chart prompts, DB context, training data,
 *  gene list, geneset list, data type mentions, and the question. */
export function buildCommonPrompt(opts: {
	ds: any
	dataset_json: any
	chart_ds: any
	dataset_db_output: { rag_docs: string[] }
	training_data: string
	common_genes: string[]
	prompt: string
	/** Term field names used by this agent (e.g. ['term','term2'] or ['colorTW','shapeTW','term0']).
	 *  When provided, appends data-type mentions telling the LLM those names are valid values.
	 *  Omit for agents that handle data-type descriptions themselves (e.g. matrix). */
	termFieldNames?: string[]
	/** Geneset names matched from the user prompt against the genome-level geneset termdb.
	 *  When provided, includes these as valid geneset options in the prompt. */
	matchedGenesets?: string[]
}): string {
	let s = ''

	// Filter guidance
	s +=
		' The "simpleFilter" field is optional and should contain an array of JSON terms with which the dataset will be filtered. '
	s += FILTER_DESCRIPTION

	// Dataset-level and chart-specific prompts from the config JSON
	s += checkField(opts.dataset_json.DatasetPrompt)
	s += checkField(opts.chart_ds.SystemPrompt)

	// DB context and training data
	s += '\n The DB content is as follows: ' + opts.dataset_db_output.rag_docs.join(',')
	s += ' training data is as follows:' + opts.training_data

	// Gene list — check registry for gene expression availability
	const hasGeneExpr = DATA_TYPE_REGISTRY.some(
		c => c.identifierMode === 'gene' && c.detectAvailability(opts.ds, opts.dataset_json)
	)
	if (hasGeneExpr && opts.common_genes.length > 0) {
		s += '\n List of relevant genes are as follows (separated by comma(,)):' + opts.common_genes.join(',')
	}

	// Geneset list — matched genesets from the genome-level geneset termdb
	if (opts.matchedGenesets && opts.matchedGenesets.length > 0) {
		mayLog('Matched genesets from prompt:', opts.matchedGenesets.length, opts.matchedGenesets.slice(0, 10))
		s += '\n List of available gene set pathways matching the query (use exact names):' + opts.matchedGenesets.join(',')
	}

	// Data type mentions for name-based types (ssGSEA, metabolite, etc.)
	if (opts.termFieldNames) {
		const fieldNamesStr = opts.termFieldNames.join(', ')
		for (const config of DATA_TYPE_REGISTRY) {
			if (!config.dataTypeDescription) continue
			if (!config.detectAvailability(opts.ds, opts.dataset_json)) continue
			s += ' ' + config.dataTypeDescription + ' can also be used as ' + fieldNamesStr + '.'
		}
	}

	s += ' Question: {' + opts.prompt + '} answer:'
	return s
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

export function validate_term(response_term: string, common_genes: string[], ds: any) {
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
		const gene_hits = common_genes.filter(gene => gene == response_term.toLowerCase())
		if (gene_hits.length > 0) {
			const geneConfig = DATA_TYPE_REGISTRY.find(
				c => c.termType === TermTypes.GENE_EXPRESSION && c.detectAvailability(ds, null)
			)
			if (geneConfig) {
				term_type = geneConfig.buildTermWrapper(response_term)
				category = 'float'
			} else {
				text += 'Dataset does not support gene expression'
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

export async function parse_dataset_db(dataset_db: string) {
	const db = new Database(dataset_db)
	const rag_docs: string[] = []
	const db_rows: DbRows[] = []
	try {
		// Query the database
		const desc_rows = db.prepare('SELECT * from termhtmldef').all()

		const description_map: any = []
		// Process the retrieved rows
		desc_rows.forEach((row: any) => {
			const name: string = row.id
			const jsonhtml = JSON.parse(row.jsonhtml)
			const description: string = jsonhtml.description[0].value
			description_map.push({ name: name, description: description })
		})

		const term_db_rows = db.prepare('SELECT * from terms').all()

		term_db_rows.forEach((row: any) => {
			const found = description_map.find((item: any) => item.name === row.id)
			if (found) {
				// Restrict db to only those items that have a description
				const jsondata = JSON.parse(row.jsondata)
				const description = description_map.filter((item: any) => item.name === row.id)
				const term_type: string = row.type

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
					description: description[0].description,
					values: values,
					term_type: term_type
				}
				const stringified_db = parse_db_rows(db_row)
				rag_docs.push(stringified_db)
				db_rows.push(db_row)
			}
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
