import type { LlmConfig, GeneDataTypeResult, TermdbTopVariablyExpressedGenesRequest } from '#types'
import { FILTER_TERM_DEFINITIONS, validate_filter } from './filter.ts'
import { getGenesForGeneset, extractGenesetsFromPromptNew, getGenesetNames } from './utils.ts'
import { route_to_appropriate_llm_provider } from './routeAPIcall.ts'
//import { mayLog } from '#src/helpers.ts'

// ---------------------------------------------------------------------------
//  Main entry point
// ---------------------------------------------------------------------------

export async function extract_hiercluster_terms_from_query(
	prompt: string,
	llm: LlmConfig,
	genome: any,
	ds: any,
	geneFeatures: GeneDataTypeResult[],
	dataType: string
) {
	// Will later optionally allow hierarchical clustering if metabolite intensity or other numeric data types are present,
	// but for now require gene expression
	let response: any
	if (dataType == 'geneExpression') {
		// This is to extract any geneset names mentioned in the prompt, which will then be used as additional context for the gene data type
		// classification and hierarchical clustering term extraction agents. For hierarchical clustering, users might mention geneset names instead of
		// individual gene names, so this is to capture those geneset names and use them as additional context for the downstream agents.
		const relevant_genesets = extractGenesetsFromPromptNew(prompt, getGenesetNames(genome))
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
			},
			topVariablyExpressedGenes: {
				type: 'integer',
				description:
					'A positive integer to specify how many genes to include for top variably expressed genes. In case a number is not specified, set it to -1'
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

			"question": "Show a dendrogram of the top variably expressed genes across all samples",
			"answer": {
				"topVariablyExpressedGenes": -1
			}

			"question": "Show a dendrogram of the top 100 variably expressed genes across all samples",
			"answer": {
				"topVariablyExpressedGenes": 100
			}
		`

		let system_prompt =
			'I am an assistant that extracts terms and data identifiers from the user query to create a hierarchical clustering plot. ' +
			'A hierarchical clustering plot clusters samples and features such as genes using hierarchical clustering and displays the result as a heatmap with dendrograms. ' + // Need to add metabolite intensity and other data types later
			'The final output must be in the following JSON format with NO extra comments. The JSON schema is as follows: ' +
			JSON.stringify(schema) +
			' Training examples: ' +
			training_data

		if (common_genes.length > 0) {
			system_prompt +=
				'The dataset has the following relevant genes available for clustering: ' +
				common_genes.join(', ') +
				'. Add these genes to geneNames field'
		}

		if (relevant_genesets.length > 0) {
			system_prompt +=
				'The dataset has the following relevant genesets available for clustering: ' +
				relevant_genesets.join(', ') +
				'. Add these genesets to genesetNames field'
		}

		system_prompt += '.\n' + 'User query: ' + prompt

		response = await route_to_appropriate_llm_provider(system_prompt, llm)
	} else {
		return {
			type: 'text',
			text: 'Hierarchical clustering is currently only supported for gene expression data.'
		}
	}
	return await validate_hiercluster_response(response, ds, genome, geneFeatures, dataType)
}

async function validate_hiercluster_gene_expression_response(
	response: string,
	ds: any,
	genome: any,
	geneFeatures: GeneDataTypeResult[]
) {
	const response_type = JSON.parse(response)
	const pp_plot_json: any = { chartType: 'hierCluster' }
	let text = ''

	// if (response_type.text) text = response_type.text // will this ever happen? the LLM is never instructed to return text?
	const terms: any[] = []
	const seen_genes: Set<string> = new Set() // to track genes we've already added from geneNames and genesets to avoid duplicates

	// Not supported cases
	if (response_type.genesetNames && response_type.topVariablyExpressedGenes) {
		return {
			type: 'text',
			text: 'We do not support using both geneset names and top variably expressed genes for hierarchical clustering. Please specify only one of these in your query.'
		}
	}

	// If geneset names are provided, resolve them to gene names and add to the geneNames array (while ensuring no duplicates)
	if (response_type.genesetNames) {
		// Multiple geneset names not supported (might change)
		if (response_type.genesetNames.length > 1) {
			return {
				type: 'text',
				text: 'We currently only support using one geneset for hierarchical clustering. Please specify only one geneset in your query.'
			}
		}

		const genesInGeneset = getGenesForGeneset(genome, response_type.genesetNames)
		if (!genesInGeneset || genesInGeneset.length === 0) {
			return {
				type: 'text',
				text: 'Could not find genes for geneset: ' + response_type.genesetNames + '. '
			}
		}

		for (const gene of genesInGeneset) {
			// Ensure genesetNames-resolved genes don't duplicate geneNames-provided genes
			seen_genes.add(gene.symbol.toLowerCase())
			terms.push({ term: { gene: gene.symbol, type: 'geneExpression' } })
		}
	} else if (response_type.topVariablyExpressedGenes) {
		let topVEgenes: string[] = []
		let num_genes: number
		if (Number.isInteger(response_type.topVariablyExpressedGenes) && response_type.topVariablyExpressedGenes > 0) {
			num_genes = response_type.topVariablyExpressedGenes
		} else if (response_type.topVariablyExpressedGenes === -1) {
			num_genes = 100 // Default to top 100 variably expressed genes if -1 is specified
		} else {
			return {
				type: 'text',
				text:
					'Invalid value for topVariablyExpressedGenes: ' +
					response_type.topVariablyExpressedGenes +
					'. Must be a positive integer.'
			}
		}

		const q: TermdbTopVariablyExpressedGenesRequest = {
			genome: genome.id,
			dslabel: ds.label,
			maxGenes: num_genes
		}
		topVEgenes = await ds.queries.topVariablyExpressedGenes.getGenes(q)
		for (const gene of topVEgenes) {
			// Ensure genesetNames-resolved genes don't duplicate geneNames-provided genes
			seen_genes.add(gene.toLowerCase())
			terms.push({ term: { gene: gene, type: 'geneExpression' } })
		}
	}

	// Process individual gene names if provided
	for (const identifier of response_type.geneNames || []) {
		const gene_hit = geneFeatures.find(g => g.gene.toLowerCase() === identifier.toLowerCase())
		if (!gene_hit) {
			text += 'invalid gene name:' + identifier + ' '
		} else {
			// Check if the gene type is of "expression" type (e.g. not a mutation or fusion feature)
			if (gene_hit.dataType === 'expression') {
				if (seen_genes.has(gene_hit.gene.toLowerCase())) continue
				seen_genes.add(gene_hit.gene.toLowerCase())
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
	if (terms.length < 3 && text === '') {
		return {
			type: 'text',
			text: 'Please specify at least 3 genes for hierarchical clustering.'
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
		// hierCluster expects terms as an array of term objects (like { gene, type })
		// and a dataType to configure the clustering type
		pp_plot_json.terms = terms
		pp_plot_json.dataType = 'geneExpression' // For now only support gene expression clustering, but will add metabolite intensity and other data types later
		return { type: 'plot', plot: pp_plot_json }
	}
}

// ---------------------------------------------------------------------------
//  Validation — builds term wrappers from LLM response using active configs
// ---------------------------------------------------------------------------

async function validate_hiercluster_response(
	response: string,
	ds: any,
	genome: any,
	geneFeatures: GeneDataTypeResult[],
	dataType: string
) {
	switch (dataType) {
		case 'geneExpression':
			return await validate_hiercluster_gene_expression_response(response, ds, genome, geneFeatures)
		default:
			return {
				type: 'text',
				text: 'Hierarchical clustering is currently only supported for gene expression data.'
			}
	}
}
