// Test prettier
import type { LlmConfig, DbRows } from '#types'
import { FILTER_TERM_DEFINITIONS, validate_filter } from './filter.ts'
import {
	formatTrainingExamples,
	extractGenesFromPrompt,
	extractGenesetsFromPrompt,
	validate_term,
	buildCommonPrompt
} from './utils.ts'
import { route_to_appropriate_llm_provider } from './routeAPIcall.ts'

export async function extract_samplescatter_terms_from_query(
	prompt: string,
	llm: LlmConfig,
	dataset_db_output: { db_rows: DbRows[]; rag_docs: string[] },
	dataset_json: any,
	genes_list: string[],
	ds: any,
	testing: boolean,
	genesetNames: string[] = []
) {
	if (!dataset_json.prebuiltPlots || dataset_json.prebuiltPlots.length == 0) {
		return { type: 'text', text: 'No pre-built scatter plots (t-SNE/UMAP) are available for this dataset' }
	}

	const Schema = {
		$schema: 'http://json-schema.org/draft-07/schema#',
		$ref: '#/definitions/SampleScatterType',
		definitions: {
			SampleScatterType: {
				type: 'object',
				properties: {
					plotName: {
						type: 'string',
						description: 'Name of the pre-built scatter plot to display'
					},
					colorTW: {
						type: ['string', 'null'],
						description:
							'Term name or gene name to overlay as color on the scatter plot. Set to null to remove the color overlay.'
					},
					shapeTW: {
						type: ['string', 'null'],
						description:
							'Term name or gene name to overlay as shape on the scatter plot. Set to null to remove the shape overlay.'
					},
					term0: {
						type: ['string', 'null'],
						description:
							'Term name to use for Z/Divide which splits the plot into panels. Set to null to remove the divide overlay.'
					},
					simpleFilter: {
						type: 'array',
						items: { $ref: '#/definitions/FilterTerm' },
						description: 'Optional simple filter terms to restrict the sample set'
					}
				},
				required: ['plotName'],
				additionalProperties: false
			},
			...FILTER_TERM_DEFINITIONS
		}
	}
	//Test commit
	const common_genes = extractGenesFromPrompt(prompt, genes_list)
	const matchedGenesets = extractGenesetsFromPrompt(prompt, genesetNames)

	// Parse out training data from the dataset JSON
	const scatter_ds = dataset_json.charts.find((chart: any) => chart.type == 'sampleScatter')
	if (!scatter_ds) throw 'sampleScatter information is not present in the dataset file.'
	if (scatter_ds.TrainingData.length == 0) throw 'No training data is provided for the sampleScatter agent.'

	const training_data = formatTrainingExamples(scatter_ds.TrainingData)

	const plotNames = dataset_json.prebuiltPlots.map((p: any) => p.name).join(', ')

	const system_prompt =
		'I am an assistant that extracts overlay parameters for pre-built scatter plots (t-SNE/UMAP). The final output must be in the following JSON format with NO extra comments. The JSON schema is as follows: ' +
		JSON.stringify(Schema) +
		' The available pre-built plots are: ' +
		plotNames +
		'. The "plotName" field must match one of these exactly. ' +
		'The "colorTW", "shapeTW", and "term0" fields should contain names of clinical fields from the sqlite db, gene names' +
		(ds?.queries?.ssGSEA ? ', gene set pathway names (e.g. HALLMARK_APOPTOSIS)' : '') +
		(ds?.queries?.metaboliteIntensity ? ', or metabolite names' : '') +
		'. ' +
		'To remove an overlay, set the corresponding field to null explicitly. If the user does not mention a particular overlay, do NOT include that field in the output (omit it entirely). ' +
		'Only include "colorTW", "shapeTW", or "term0" if the user explicitly mentions coloring, shaping, or dividing. ' +
		buildCommonPrompt({
			ds,
			dataset_json,
			chart_ds: scatter_ds,
			dataset_db_output,
			training_data,
			common_genes,
			prompt,
			termFieldNames: ['colorTW', 'shapeTW', 'term0'],
			matchedGenesets
		})

	const response: string = await route_to_appropriate_llm_provider(system_prompt, llm)
	if (testing) {
		const test_response = JSON.parse(response)
		test_response.plot = 'sampleScatter'
		test_response.type = 'plot'
		return test_response
	} else {
		return validate_samplescatter_response(response, common_genes, dataset_json, ds)
	}
}

function validate_samplescatter_response(response: string, common_genes: string[], dataset_json: any, ds: any) {
	const response_type = JSON.parse(response)
	let text = ''

	if (response_type.text) text = response_type.text

	// Validate plotName against prebuiltPlots
	if (!response_type.plotName) {
		text += 'plotName is required for sample scatter output'
	} else {
		const matchedPlot = dataset_json.prebuiltPlots.find(
			(p: any) => p.name.toLowerCase() == response_type.plotName.toLowerCase()
		)
		if (!matchedPlot) {
			const availablePlots = dataset_json.prebuiltPlots.map((p: any) => p.name).join(', ')
			text += 'Unknown plot name: ' + response_type.plotName + '. Available plots are: ' + availablePlots
		}
	}

	const pp_plot_json: any = {
		chartType: 'sampleScatter',
		name: response_type.plotName
	}

	// Helper to validate an overlay term (color, shape, or divide)
	const validateOverlayTerm = (termName: string | null | undefined, fieldKey: string) => {
		if (termName === null) {
			// Explicit null means remove the overlay
			pp_plot_json[fieldKey] = null
			return
		}
		if (termName === undefined) {
			// Not mentioned, don't include in output
			return
		}
		const termValidation = validate_term(termName, common_genes, ds)
		if (termValidation.text.length > 0) {
			text += termValidation.text
		} else {
			const tw: any = { ...termValidation.term_type }
			if (termValidation.category == 'float' || termValidation.category == 'integer') {
				tw.q = { mode: 'continuous' }
			}
			pp_plot_json[fieldKey] = tw
		}
	}

	validateOverlayTerm(response_type.colorTW, 'colorTW')
	validateOverlayTerm(response_type.shapeTW, 'shapeTW')
	validateOverlayTerm(response_type.term0, 'term0')

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
		return { type: 'plot', plot: pp_plot_json }
	}
}
