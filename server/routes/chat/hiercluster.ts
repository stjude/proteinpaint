import type { LlmConfig, GeneDataTypeResult } from '#types'
import { FILTER_TERM_DEFINITIONS, validate_filter } from './filter.ts'
//import { extractGenesetsFromPrompt } from './utils.ts'
import { route_to_appropriate_llm_provider } from './routeAPIcall.ts'
//import { mayLog } from '#src/helpers.ts'

// ---------------------------------------------------------------------------
//  Main entry point
// ---------------------------------------------------------------------------

export async function extract_hiercluster_terms_from_query(
	prompt: string,
	llm: LlmConfig,
	dataset_json: any,
	ds: any,
	testing: boolean,
	genesetNames: string[] = [],
	geneFeatures: GeneDataTypeResult[]
) {
	// Will later optionally allow hierarchical clustering if metabolite intensity or other numeric data types are present, but for now require gene expression
	console.log('genesetNames:', genesetNames)
	const common_genes = geneFeatures.map(g => g.gene)
	const properties = {
		simpleFilter: {
			type: 'array',
			items: { $ref: '#/definitions/FilterTerm' },
			description: 'Optional simple filter terms to restrict the sample set'
		},
		geneNames: {
			type: 'array',
			items: { type: 'string' },
			description: 'Names of genes to include as gene expression rows in hierarchical clustering'
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

	const training_data = `
        "question": "Cluster TP53, BRCA1 and KRAS gene expression",
            "answer": {
            "geneNames": [
                "TP53",
                "BRCA1",
                "KRAS"
            ]
        }

        "question": "Show hierarchical clustering of AKT1, TP53, BCR, and KRAS",
            "answer": {
            "geneNames": [
                "AKT1",
                "TP53",
                "BCR",
                "KRAS"
            ]
        }

        "question": "Cluster ATM, TP53 and KRAS for patients with KMT2A subtype",
            "answer": {
            "geneNames": [
                "ATM",
                "TP53",
                "KRAS"
            ],
                "simpleFilter": [
                    {
                        "term": "Molecular subtype",
                        "category": "KMT2A"
                    }
                ]
        }

        "question": "Show a gene expression dendrogram for BCR, TMEM181 and AKT1",
        "answer": {
            "geneNames": [
                "BCR",
                "TMEM181",
                "AKT1"
            ]
        }
    
    `

	const system_prompt =
		'I am an assistant that extracts terms and data identifiers from the user query to create a hierarchical clustering plot. ' +
		'A hierarchical clustering plot clusters samples and features such as genes using hierarchical clustering and displays the result as a heatmap with dendrograms. ' + // Need to add metabolite intensity and other data types later
		'The final output must be in the following JSON format with NO extra comments. The JSON schema is as follows: ' +
		JSON.stringify(schema) +
		' Training examples: ' +
		training_data +
		' The dataset has the following genes available for clustering: ' +
		common_genes.join(', ') +
		'.\n' +
		'User query: ' +
		prompt

	const response: string = await route_to_appropriate_llm_provider(system_prompt, llm)
	if (testing) {
		const test_response = JSON.parse(response)
		test_response.plot = 'hierCluster'
		test_response.type = 'plot'
		return test_response
	} else {
		return validate_hiercluster_response(response, ds, geneFeatures)
	}
}

// ---------------------------------------------------------------------------
//  Validation — builds term wrappers from LLM response using active configs
// ---------------------------------------------------------------------------

function validate_hiercluster_response(response: string, ds: any, geneFeatures: GeneDataTypeResult[]) {
	const response_type = JSON.parse(response)
	const pp_plot_json: any = { chartType: 'hierCluster' }
	let text = ''

	if (response_type.text) text = response_type.text
	if (response_type.genesetNames) {
		text += ' Geneset names are not currently supported for hierarchical clustering.'
	}
	const terms: any[] = []

	for (const identifier of response_type.geneNames || []) {
		const gene_hit = geneFeatures.find(g => g.gene.toLowerCase() === identifier.toLowerCase())
		if (!gene_hit) {
			text += 'invalid gene name:' + identifier + ' '
		} else {
			// Check if the gene type is of "expression" type (e.g. not a mutation or fusion feature)
			if (gene_hit.dataType == 'expression') {
				terms.push({ term: { gene: gene_hit.gene, type: 'geneExpression' } })
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
		pp_plot_json.dataType = 'geneExpression' // For now only support gene expression clustering, but will add metabolite intensity and other data types later
		return { type: 'plot', plot: pp_plot_json }
	}
}
