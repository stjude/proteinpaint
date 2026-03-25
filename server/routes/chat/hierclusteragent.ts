import type { LlmConfig, DbRows, GeneDataTypeResult } from '#types'
import { TermTypes } from '#shared/terms.js'
import { FILTER_TERM_DEFINITIONS, validate_filter } from './filter.ts'
import {
	formatTrainingExamples,
	extractGenesetsFromPrompt,
	DATA_TYPE_REGISTRY,
	buildCommonPrompt,
	readJSONFile
} from './utils.ts'
import type { DataTypeConfig } from './utils.ts'
import { route_to_appropriate_llm_provider } from './routeAPIcall.ts'
import path from 'path'
import fs from 'fs'
import { getGenesForGeneset } from './utils.ts'
//import { mayLog } from '#src/helpers.ts'

// ---------------------------------------------------------------------------
//  Schema builder — generates JSON schema from dataset capabilities
// ---------------------------------------------------------------------------

function buildHierClusterSchema(ds: any, dataset_json: any): { schema: object; activeConfigs: DataTypeConfig[] } {
	const properties = {
		simpleFilter: {
			type: 'array',
			items: { $ref: '#/definitions/FilterTerm' },
			description: 'Optional simple filter terms to restrict the sample set'
		},
		geneNames: {
			type: 'array',
			items: { type: 'string' },
			description:
				'Names of genes to include as gene expression rows in hierarchical clustering. This should ONLY contain gene names explicitly mentioned in the user prompt.'
		},
		genesetNames: {
			type: 'array',
			items: { type: 'string' },
			description: 'Names of gene sets (e.g. HALLMARK pathways) to be used for hierarchical clustering'
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

	// Only include data types valid for hierCluster (numeric types that support clustering)
	const hierClusterTypes = new Set([TermTypes.GENE_EXPRESSION]) // Will add TermTypes.METABOLITE_INTENSITY later

	const activeConfigs: DataTypeConfig[] = []
	for (const config of DATA_TYPE_REGISTRY) {
		if (!hierClusterTypes.has(config.termType)) continue
		if (!config.detectAvailability(ds, dataset_json)) continue
		activeConfigs.push(config)
	}

	//mayLog(
	//    'hierclusteragent: active data types:',
	//    activeConfigs.map(c => c.termType),
	//    'schema fields:',
	//    Object.keys(properties)
	//)

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
		'A hierarchical clustering plot clusters samples and features such as genes using hierarchical clustering and displays the result as a heatmap with dendrograms. Do NOT add data identifiers on your own, only those specified by the user or from a geneset. ' + // Need to add metabolite intensity and other data types later
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
	ds: any,
	testing: boolean,
	genesetNames: string[] = [],
	geneFeatures: GeneDataTypeResult[],
	aiFilesDir: string,
	genome: any
) {
	if (ds?.queries?.geneExpression) {
		// Will later optionally allow hierarchical clustering if metabolite intensity or other numeric data types are present, but for now require gene expression
		const { schema, activeConfigs } = buildHierClusterSchema(ds, dataset_json)
		const common_genes = geneFeatures.map(g => g.gene)
		const matchedGenesets = extractGenesetsFromPrompt(prompt, genesetNames)
		// Read hierCluster agent-specific JSON file
		if (!fs.existsSync(path.join(aiFilesDir, 'hierCluster.json')))
			throw 'hierarchical clustering agent file is not specified for dataset:' + ds.label
		const hiercluster_ds = await readJSONFile(path.join(aiFilesDir, 'hierCluster.json'))
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
			return validate_hiercluster_response(response, ds, activeConfigs, geneFeatures, genome)
		}
	} else {
		return { type: 'text', text: 'Gene expression hierarchical clustering is not supported for this dataset' }
	}
}

// ---------------------------------------------------------------------------
//  Validation — builds term wrappers from LLM response using active configs
// ---------------------------------------------------------------------------

function validate_hiercluster_response(
	response: string,
	ds: any,
	activeConfigs: DataTypeConfig[],
	geneFeatures: GeneDataTypeResult[],
	genome: any
) {
	console.log('LLM response for hierarchical clustering:', response)
	const response_type = JSON.parse(response)
	const pp_plot_json: any = { chartType: 'hierCluster' }
	let text = ''

	if (response_type.text) text = response_type.text

	// Resolve geneset names to individual genes using trigger_genesetByTermId logic
	if (response_type.genesetNames && Array.isArray(response_type.genesetNames) && genome) {
		const geneExprConfig = DATA_TYPE_REGISTRY.find(
			c => c.termType === TermTypes.GENE_EXPRESSION && c.detectAvailability(ds, null)
		)
		if (geneExprConfig) {
			for (const genesetName of response_type.genesetNames) {
				console.log('Resolving geneset for hierarchical clustering:', genesetName)
				const genes = getGenesForGeneset(genome, genesetName)
				if (!response_type.geneNamesFromGeneset) response_type.geneNamesFromGeneset = []
				if (genes && genes.length > 0) {
					for (const gene of genes) {
						// Ensure genesetNames-resolved genes don't duplicate geneNames-provided genes
						if (!response_type.geneNames?.some((g: string) => g.toLowerCase() === gene.symbol.toLowerCase())) {
							response_type.geneNames = response_type.geneNames || []
							response_type.geneNamesFromGeneset.push(gene.symbol)
						}
					}
				} else {
					text += 'Could not find genes for geneset: ' + genesetName + '. '
				}
			}
		} else {
			text += 'Gene expression is not available for this dataset to resolve geneset genes. '
		}
	}

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
				if (geneFeatures.length > 0) {
					// This conditions helps prevent false hallucinated genes from being shown to users when geneFeatures is not available for a dataset, but still allows validation against geneFeatures when it is available
					const gene_hit = geneFeatures.find(g => g.gene.toLowerCase() === identifier.toLowerCase())
					if (!gene_hit) {
						text += 'invalid gene name:' + identifier + ' '
					} else {
						// Check if the gene type is of "expression" type (e.g. not a mutation or fusion feature)
						if (gene_hit.dataType == 'expression') {
							terms.push(preferredConfig.buildTermWrapper(identifier))
						} else {
							text +=
								'Gene ' +
								identifier +
								' does not have a valid data type (' +
								gene_hit.dataType +
								') for hierarchical clustering. Only genes with expression data can be used for clustering.'
						}
					}
				}
			} else {
				// Name-based: pass through (backend handles validation)
				terms.push(preferredConfig.buildTermWrapper(identifier))
			}
		}

		if (
			response_type.geneNamesFromGeneset &&
			response_type.geneNamesFromGeneset.length > 0 &&
			preferredConfig.identifierMode === 'gene'
		) {
			// Add genes from GeneSet for clustering
			for (const gene of response_type.geneNamesFromGeneset) {
				terms.push(preferredConfig.buildTermWrapper(gene))
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
