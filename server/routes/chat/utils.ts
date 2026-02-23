import type { DbRows, DbValue } from '#types'
import fs from 'fs'
import Database from 'better-sqlite3'

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

/** Safely parse LLM output that may be wrapped in markdown fences or explanations. */
export function safeParseLlmJson(response: string): any {
	// Try direct parse first (works for well-behaved models)
	try {
		return JSON.parse(response)
	} catch {
		// Find first { and last } to extract the JSON object
		const firstBrace = response.indexOf('{')
		const lastBrace = response.lastIndexOf('}')
		if (firstBrace !== -1 && lastBrace > firstBrace) {
			return JSON.parse(response.slice(firstBrace, lastBrace + 1))
		}
		// Try array
		const firstBracket = response.indexOf('[')
		const lastBracket = response.lastIndexOf(']')
		if (firstBracket !== -1 && lastBracket > firstBracket) {
			return JSON.parse(response.slice(firstBracket, lastBracket + 1))
		}
		throw 'No JSON found in LLM response'
	}
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

export function validate_term(response_term: string, common_genes: string[], dataset_json: any, ds: any) {
	let html = ''
	let term_type: any
	let category: string = ''
	const term: any = ds.cohort.termdb.q.termjsonByOneid(response_term)
	if (!term) {
		const gene_hits = common_genes.filter(gene => gene == response_term.toLowerCase())
		if (gene_hits.length == 0) {
			// Neither a clinical term nor a gene
			html += 'invalid term id:' + response_term
		} else {
			if (dataset_json.hasGeneExpression) {
				// Check to see if dataset support gene expression
				term_type = { term: { gene: response_term.toUpperCase(), type: 'geneExpression' } }
				category = 'float'
			} else {
				html += 'Dataset does not support gene expression'
			}
		}
	} else {
		term_type = { id: term.id }
		category = term.type
	}
	return { term_type: term_type, html: html, category: category }
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
