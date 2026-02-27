import type { LlmConfig, DbRows } from '#types'
import { FILTER_TERM_DEFINITIONS, FILTER_DESCRIPTION, validate_filter } from './filter.ts'
import { formatTrainingExamples, checkField, safeParseLlmJson, extractGenesFromPrompt } from './utils.ts'
import { route_to_appropriate_llm_provider } from './routeAPIcall.ts'

export async function extract_matrix_search_terms_from_query(
	prompt: string,
	llm: LlmConfig,
	dataset_db_output: { db_rows: DbRows[]; rag_docs: string[] },
	dataset_json: any,
	genes_list: string[],
	ds: any,
	testing: boolean
) {
	const Schema = {
		$schema: 'http://json-schema.org/draft-07/schema#',
		$ref: '#/definitions/MatrixType',
		definitions: {
			MatrixType: {
				type: 'object',
				properties: {
					terms: {
						type: 'array',
						items: { type: 'string' },
						description: 'Names of dictionary/clinical terms to include as rows in the matrix'
					},
					geneNames: {
						type: 'array',
						items: { type: 'string' },
						description: 'Names of genes to include as gene variant rows in the matrix'
					},
					simpleFilter: {
						type: 'array',
						items: { $ref: '#/definitions/FilterTerm' },
						description: 'Optional simple filter terms to restrict the sample set'
					}
				},
				additionalProperties: false
			},
			...FILTER_TERM_DEFINITIONS
		}
	}

	const common_genes = extractGenesFromPrompt(prompt, genes_list)

	// Parse out training data from the dataset JSON
	const matrix_ds = dataset_json.charts.filter((chart: any) => chart.type == 'Matrix')
	if (matrix_ds.length == 0) throw 'Matrix information is not present in the dataset file.'
	if (matrix_ds[0].TrainingData.length == 0) throw 'No training data is provided for the matrix agent.'

	const training_data = formatTrainingExamples(matrix_ds[0].TrainingData)

	let system_prompt =
		'I am an assistant that extracts terms and gene names from the user query to create a matrix plot. A matrix plot displays multiple genes and/or clinical variables across samples in a grid layout. The final output must be in the following JSON format with NO extra comments. The JSON schema is as follows: ' +
		JSON.stringify(Schema) +
		' The "terms" field should ONLY contain names of clinical/dictionary fields from the sqlite db. The "geneNames" field should ONLY contain gene names. At least one of "terms" or "geneNames" must be provided. The "simpleFilter" field is optional and should contain an array of JSON terms with which the dataset will be filtered. ' +
		FILTER_DESCRIPTION +
		checkField(dataset_json.DatasetPrompt) +
		checkField(matrix_ds[0].SystemPrompt) +
		'\n The DB content is as follows: ' +
		dataset_db_output.rag_docs.join(',') +
		' training data is as follows:' +
		training_data

	if (dataset_json.hasGeneExpression && common_genes.length > 0) {
		system_prompt += '\n List of relevant genes are as follows (separated by comma(,)):' + common_genes.join(',')
	}

	system_prompt += ' Question: {' + prompt + '} answer:'

	const response: string = await route_to_appropriate_llm_provider(system_prompt, llm)
	if (testing) {
		return { action: 'matrix', response: safeParseLlmJson(response) }
	} else {
		return validate_matrix_response(response, common_genes, dataset_json, ds)
	}
}

function validate_matrix_response(response: string, common_genes: string[], dataset_json: any, ds: any) {
	const response_type = safeParseLlmJson(response)
	const pp_plot_json: any = { chartType: 'matrix' }
	let text = ''

	if (response_type.text) text = response_type.text

	// Must have at least one of terms or geneNames
	if (
		(!response_type.terms || response_type.terms.length == 0) &&
		(!response_type.geneNames || response_type.geneNames.length == 0)
	) {
		text += 'At least one clinical term or gene name is required for a matrix plot'
	}

	// Validate dictionary terms — use shorthand { id } at tw top level
	const twLst: any[] = []
	if (response_type.terms && Array.isArray(response_type.terms)) {
		for (const t of response_type.terms) {
			const term: any = ds.cohort.termdb.q.termjsonByOneid(t)
			if (!term) {
				text += 'invalid term id:' + t + ' '
			} else {
				twLst.push({ id: term.id })
			}
		}
	}

	// Validate gene names — use geneExpression type for datasets with expression data,
	// fall back to geneVariant for datasets with mutation data
	if (response_type.geneNames && Array.isArray(response_type.geneNames)) {
		for (const g of response_type.geneNames) {
			const gene_hits = common_genes.filter(gene => gene == g.toLowerCase())
			if (gene_hits.length == 0) {
				text += 'invalid gene name:' + g + ' '
			} else {
				const geneName = g.toUpperCase()
				if (dataset_json.hasGeneExpression) {
					twLst.push({ term: { gene: geneName, type: 'geneExpression' } })
				} else {
					twLst.push({ term: { gene: geneName, name: geneName, type: 'geneVariant' } })
				}
			}
		}
	}

	// Validate filters
	if (response_type.simpleFilter && response_type.simpleFilter.length > 0) {
		const validated_filters = validate_filter(response_type.simpleFilter, ds, '')
		if (validated_filters.text.length > 0) {
			text += validated_filters.text
		} else {
			pp_plot_json.filter = validated_filters.simplefilter
		}
	}

	if (text.length > 0) {
		return { type: 'text', text: text }
	} else {
		// Structure as termgroups matching what matrix.js expects:
		// termgroups: [{ name: '', lst: [ { term: {...} }, ... ] }]
		pp_plot_json.termgroups = [{ name: '', lst: twLst }]
		return { type: 'plot', plot: pp_plot_json }
	}
}
