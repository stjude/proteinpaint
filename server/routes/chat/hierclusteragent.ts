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

function buildHierClusterSchema(ds: any, dataset_json: any): { schema: object; activeConfigs: DataTypeConfig[] } {
	const activeConfigs: DataTypeConfig[] = []
	const properties: Record<string, object> = {
		simpleFilter: {
			type: 'array',
			items: { $ref: '#/definitions/FilterTerm' },
			description: 'Optional simple filter terms to restrict the sample set'
		}
	}

	const addedFields = new Set<string>()

	// Only include data types valid for hierCluster (numeric types that support clustering)
	const hierClusterTypes = new Set([TermTypes.GENE_EXPRESSION, TermTypes.METABOLITE_INTENSITY])

	for (const config of DATA_TYPE_REGISTRY) {
		if (!hierClusterTypes.has(config.termType)) continue
		if (!config.detectAvailability(ds, dataset_json)) continue
		activeConfigs.push(config)
		if (!addedFields.has(config.schemaFieldName)) {
			properties[config.schemaFieldName] = config.schemaDefinition
			addedFields.add(config.schemaFieldName)
		}
	}

	const schema = {
		$schema: 'http://json-schema.org/draft-07/schema#',
		$ref: '#/definitions/HierClusterType',
		definitions: {
			HierClusterType: {
				type: 'object',
				properties,
				additionalProperties: false
			},
			...FILTER_TERM_DEFINITIONS
		}
	}

	mayLog(
		'hierclusteragent: active data types:',
		activeConfigs.map(c => c.termType),
		'schema fields:',
		Object.keys(properties)
	)

	return { schema, activeConfigs }
}

// ---------------------------------------------------------------------------
//  System prompt builder
// ---------------------------------------------------------------------------

function buildHierClusterSystemPrompt(
	schema: object,
	activeConfigs: DataTypeConfig[],
	dataset_json: any,
	dataset_db_output: { rag_docs: string[] },
	hiercluster_ds: any,
	training_data: string,
	common_genes: string[],
	ds: any,
	prompt: string,
	matchedGenesets: string[]
): string {
	let s =
		'I am an assistant that extracts terms and data identifiers from the user query to create a hierarchical clustering plot. ' +
		'A hierarchical clustering plot clusters samples and features (genes, metabolites, etc.) using hierarchical clustering and displays the result as a heatmap with dendrograms. ' +
		'The final output must be in the following JSON format with NO extra comments. The JSON schema is as follows: ' +
		JSON.stringify(schema)

	// Describe each active data type field (deduplicated by field name)
	const describedFields = new Set<string>()
	for (const config of activeConfigs) {
		if (!describedFields.has(config.schemaFieldName)) {
			s += ' ' + config.promptFieldDescription
			describedFields.add(config.schemaFieldName)
		}
	}

	// At least one data field must be provided
	const allFieldNames = [...new Set(activeConfigs.map(c => c.schemaFieldName))]
	s += ` At least one of ${allFieldNames.map(f => '"' + f + '"').join(' or ')} must be provided.`

	// Common tail: filter, DB context, training data, gene list, geneset list, question
	s += buildCommonPrompt({
		ds,
		dataset_json,
		chart_ds: hiercluster_ds,
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

export async function extract_hiercluster_terms_from_query(
	prompt: string,
	llm: LlmConfig,
	dataset_db_output: { db_rows: DbRows[]; rag_docs: string[] },
	dataset_json: any,
	genes_list: string[],
	ds: any,
	testing: boolean,
	genesetNames: string[] = []
) {
	const { schema, activeConfigs } = buildHierClusterSchema(ds, dataset_json)
	const common_genes = extractGenesFromPrompt(prompt, genes_list)
	const matchedGenesets = extractGenesetsFromPrompt(prompt, genesetNames)

	// Parse out training data from the dataset JSON
	const hiercluster_ds = dataset_json.charts.find((chart: any) => chart.type == 'hierCluster')
	if (!hiercluster_ds) throw 'hierCluster information is not present in the dataset file.'
	if (hiercluster_ds.TrainingData.length == 0) throw 'No training data is provided for the hierCluster agent.'

	const training_data = formatTrainingExamples(hiercluster_ds.TrainingData)

	const system_prompt = buildHierClusterSystemPrompt(
		schema,
		activeConfigs,
		dataset_json,
		dataset_db_output,
		hiercluster_ds,
		training_data,
		common_genes,
		ds,
		prompt,
		matchedGenesets
	)

	const response: string = await route_to_appropriate_llm_provider(system_prompt, llm)
	if (testing) {
		const test_response = JSON.parse(response)
		test_response.plot = 'hierCluster'
		test_response.type = 'plot'
		return test_response
	} else {
		return validate_hiercluster_response(response, common_genes, ds, activeConfigs)
	}
}

// ---------------------------------------------------------------------------
//  Validation — builds term wrappers from LLM response using active configs
// ---------------------------------------------------------------------------

function validate_hiercluster_response(
	response: string,
	common_genes: string[],
	ds: any,
	activeConfigs: DataTypeConfig[]
) {
	const response_type = JSON.parse(response)
	const pp_plot_json: any = { chartType: 'hierCluster' }
	let text = ''

	if (response_type.text) text = response_type.text

	const terms: any[] = []

	// Validate each active data type field
	const processedFields = new Set<string>()

	// Track data type for the hierCluster config
	let dataType: string | undefined

	for (const config of activeConfigs) {
		if (processedFields.has(config.schemaFieldName)) continue
		processedFields.add(config.schemaFieldName)

		const fieldValues = response_type[config.schemaFieldName]
		if (!fieldValues || !Array.isArray(fieldValues)) continue

		// For shared fields (e.g. geneNames), prefer geneExpression
		const configsForField = activeConfigs.filter(c => c.schemaFieldName === config.schemaFieldName)
		const preferredConfig = configsForField.find(c => c.termType === TermTypes.GENE_EXPRESSION) || configsForField[0]

		if (!dataType) dataType = preferredConfig.termType

		for (const identifier of fieldValues) {
			if (preferredConfig.identifierMode === 'gene') {
				const gene_hits = common_genes.filter(gene => gene === identifier.toLowerCase())
				if (gene_hits.length === 0) {
					text += 'invalid gene name:' + identifier + ' '
				} else {
					terms.push(preferredConfig.buildTermWrapper(identifier))
				}
			} else {
				// Name-based: pass through (backend handles validation)
				terms.push(preferredConfig.buildTermWrapper(identifier))
			}
		}
	}

	// Must have at least one term
	if (terms.length === 0 && text === '') {
		text += 'At least one gene or data identifier is required for a hierarchical clustering plot'
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
		// hierCluster expects terms as an array of term objects (like { gene, type })
		// and a dataType to configure the clustering type
		pp_plot_json.terms = terms
		if (dataType) pp_plot_json.dataType = dataType
		return { type: 'plot', plot: pp_plot_json }
	}
}
