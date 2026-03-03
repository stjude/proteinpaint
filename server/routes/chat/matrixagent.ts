import type { LlmConfig, DbRows } from '#types'
import { TermTypes } from '#shared/terms.js'
import { FILTER_TERM_DEFINITIONS, validate_filter } from './filter.ts'
import {
	formatTrainingExamples,
	extractGenesFromPrompt,
	extractGenesetsFromPrompt,
	DATA_TYPE_REGISTRY,
	buildCommonPrompt
} from './utils.ts'
import type { DataTypeConfig } from './utils.ts'
import { route_to_appropriate_llm_provider } from './routeAPIcall.ts'
import { mayLog } from '#src/helpers.ts'

// ---------------------------------------------------------------------------
//  Schema builder — generates JSON schema from dataset capabilities
// ---------------------------------------------------------------------------

function buildMatrixSchema(ds: any, dataset_json: any): { schema: object; activeConfigs: DataTypeConfig[] } {
	const activeConfigs: DataTypeConfig[] = []
	const properties: Record<string, object> = {
		terms: {
			type: 'array',
			items: { type: 'string' },
			description: 'Names of dictionary/clinical terms to include as rows in the matrix'
		},
		simpleFilter: {
			type: 'array',
			items: { $ref: '#/definitions/FilterTerm' },
			description: 'Optional simple filter terms to restrict the sample set'
		}
	}

	const addedFields = new Set<string>()

	for (const config of DATA_TYPE_REGISTRY) {
		if (!config.detectAvailability(ds, dataset_json)) continue
		activeConfigs.push(config)
		// Deduplicate shared schema fields (e.g. geneExpression + geneVariant both use 'geneNames')
		if (!addedFields.has(config.schemaFieldName)) {
			properties[config.schemaFieldName] = config.schemaDefinition
			addedFields.add(config.schemaFieldName)
		}
	}

	const schema = {
		$schema: 'http://json-schema.org/draft-07/schema#',
		$ref: '#/definitions/MatrixType',
		definitions: {
			MatrixType: {
				type: 'object',
				properties,
				additionalProperties: false
			},
			...FILTER_TERM_DEFINITIONS
		}
	}

	mayLog(
		'matrixagent: active data types:',
		activeConfigs.map(c => c.termType),
		'schema fields:',
		Object.keys(properties)
	)

	return { schema, activeConfigs }
}

// ---------------------------------------------------------------------------
//  System prompt builder
// ---------------------------------------------------------------------------

function buildMatrixSystemPrompt(
	schema: object,
	activeConfigs: DataTypeConfig[],
	dataset_json: any,
	dataset_db_output: { rag_docs: string[] },
	matrix_ds: any[],
	training_data: string,
	common_genes: string[],
	ds: any,
	prompt: string,
	matchedGenesets: string[]
): string {
	let s =
		'I am an assistant that extracts terms and data identifiers from the user query to create a matrix plot. ' +
		'A matrix plot displays multiple genes, clinical variables, and/or other data types across samples in a grid layout. ' +
		'The final output must be in the following JSON format with NO extra comments. The JSON schema is as follows: ' +
		JSON.stringify(schema)

	// Always-present field description
	s += ' The "terms" field should ONLY contain names of clinical/dictionary fields from the sqlite db.'

	// Describe each active data type field (deduplicated by field name)
	const describedFields = new Set<string>()
	for (const config of activeConfigs) {
		if (!describedFields.has(config.schemaFieldName)) {
			s += ' ' + config.promptFieldDescription
			describedFields.add(config.schemaFieldName)
		}
	}

	// At least one data field must be provided
	const allFieldNames = ['terms', ...new Set(activeConfigs.map(c => c.schemaFieldName))]
	s += ` At least one of ${allFieldNames.map(f => '"' + f + '"').join(' or ')} must be provided.`

	// Common tail: filter, DB context, training data, gene list, geneset list, question
	s += buildCommonPrompt({
		ds,
		dataset_json,
		chart_ds: matrix_ds[0],
		dataset_db_output,
		training_data,
		common_genes,
		prompt,
		matchedGenesets
	})

	return s
}

// ---------------------------------------------------------------------------
//  Main entry point
// ---------------------------------------------------------------------------

export async function extract_matrix_search_terms_from_query(
	prompt: string,
	llm: LlmConfig,
	dataset_db_output: { db_rows: DbRows[]; rag_docs: string[] },
	dataset_json: any,
	genes_list: string[],
	ds: any,
	testing: boolean,
	genesetNames: string[] = []
) {
	const { schema, activeConfigs } = buildMatrixSchema(ds, dataset_json)
	const common_genes = extractGenesFromPrompt(prompt, genes_list)
	const matchedGenesets = extractGenesetsFromPrompt(prompt, genesetNames)

	// Parse out training data from the dataset JSON
	const matrix_ds = dataset_json.charts.filter((chart: any) => chart.type == 'Matrix')
	if (matrix_ds.length == 0) throw 'Matrix information is not present in the dataset file.'
	if (matrix_ds[0].TrainingData.length == 0) throw 'No training data is provided for the matrix agent.'

	const training_data = formatTrainingExamples(matrix_ds[0].TrainingData)

	const system_prompt = buildMatrixSystemPrompt(
		schema,
		activeConfigs,
		dataset_json,
		dataset_db_output,
		matrix_ds,
		training_data,
		common_genes,
		ds,
		prompt,
		matchedGenesets
	)

	const response: string = await route_to_appropriate_llm_provider(system_prompt, llm)
	if (testing) {
		return { action: 'matrix', response: JSON.parse(response) }
	} else {
		return validate_matrix_response(response, common_genes, ds, activeConfigs)
	}
}

// ---------------------------------------------------------------------------
//  Validation — builds term wrappers from LLM response using active configs
// ---------------------------------------------------------------------------

function validate_matrix_response(response: string, common_genes: string[], ds: any, activeConfigs: DataTypeConfig[]) {
	const response_type = JSON.parse(response)
	const pp_plot_json: any = { chartType: 'matrix' }
	let text = ''

	if (response_type.text) text = response_type.text

	const twLst: any[] = []

	// Validate dictionary terms — use shorthand { id } at tw top level
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

	// Validate each active data type field
	const processedFields = new Set<string>()

	for (const config of activeConfigs) {
		if (processedFields.has(config.schemaFieldName)) continue
		processedFields.add(config.schemaFieldName)

		const fieldValues = response_type[config.schemaFieldName]
		if (!fieldValues || !Array.isArray(fieldValues)) continue

		// For shared fields (e.g. geneNames), prefer geneExpression over geneVariant
		const configsForField = activeConfigs.filter(c => c.schemaFieldName === config.schemaFieldName)
		const preferredConfig = configsForField.find(c => c.termType === TermTypes.GENE_EXPRESSION) || configsForField[0]

		for (const identifier of fieldValues) {
			if (preferredConfig.identifierMode === 'gene') {
				const gene_hits = common_genes.filter(gene => gene === identifier.toLowerCase())
				if (gene_hits.length === 0) {
					text += 'invalid gene name:' + identifier + ' '
				} else {
					twLst.push(preferredConfig.buildTermWrapper(identifier))
				}
			} else {
				// Name-based: pass through (backend handles validation)
				twLst.push(preferredConfig.buildTermWrapper(identifier))
			}
		}
	}

	// Must have at least one term wrapper
	if (twLst.length === 0 && text === '') {
		text += 'At least one clinical term or data identifier is required for a matrix plot'
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
		return { type: 'text', text }
	} else {
		// Structure as termgroups matching what matrix.js expects:
		// termgroups: [{ name: '', lst: [ { term: {...} }, ... ] }]
		pp_plot_json.termgroups = [{ name: '', lst: twLst }]
		return { type: 'plot', plot: pp_plot_json }
	}
}
