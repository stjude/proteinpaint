import { dofetch3 } from '#common/dofetch'
import { make_one_checkbox } from '#dom/checkbox'
import { appInit } from '#plots/plot.app.js'
import { fillTermWrapper } from '#termsetting'

/*

test with http://localhost:3000/example.gdc.matrix.html
runpp({ launchGdcMatrix:true })

designed to work for Oncoprint app in GDC Analysis Tools Framework

initiates a "plot" app instance that wraps around the matrix component
and returns the plot app API


********* parameters

arg = {}
	runpp() argument object

	.filter0{}
		the filter object from GDC Cohort Builder
		{"op":"and","content":[{"op":"in","content":{"field":"cases.primary_site","value":["breast","bronchus and lung"]}}]}

	.genes[]
		future: list of genes to launch matrix

holder
genomes = { hg38 : {} }


********* returns

matrix API object with following methods; pp react wrapper can call api.update() when user updates cohort in the GDC portal
TODO revise to a simpler object

{
	type:'matrix'
	id:str
	getComponents()
	on()
	update()
	destroy()
}
*/

const gdcGenome = 'hg38'
const gdcDslabel = 'GDC'

export async function init(arg, holder, genomes) {
	const genome = genomes[gdcGenome]
	if (!genome) throw gdcGenome + ' missing'

	// these options will allow session recovery by an embedder
	const m = arg.settings?.matrix || {}
	const geneFilter = m.geneFilter || 'CGC'
	let CGConly = geneFilter === 'CGC'
	let maxGenes = m.maxGenes || 50
	// per discussion on Dec 6, 2022, restrict to cancer gene census genes by default and allow user to change
	const gdcCohort = getGdcCohort(arg)
	const genes = await getGenes(arg, gdcCohort, CGConly, maxGenes)
	const settings = arg.settings || {}
	if (!settings.matrix) settings.matrix = {}
	settings.matrix.geneFilter = geneFilter
	settings.matrix.maxGenes = maxGenes
	const opts = {
		holder,
		genome,
		state: {
			genome: gdcGenome,
			dslabel: gdcDslabel,
			termfilter: { filter0: gdcCohort },
			plots: [
				{
					chartType: 'matrix',
					termgroups: [{ lst: genes }],
					// moved default settings to gdc.hg38.js termdb.matrix.settings
					// but can still override in the runpp() argument
					settings
				}
			]
		},
		app: {
			features: ['recover']
		},
		recover: {
			undoHtml: 'undo',
			redoHtml: 'redo'
		},
		matrix: {
			allow2selectSamples: arg.allow2selectSamples,
			// these will display the inputs together in the Genes menu,
			// instead of being rendered outside of the matrix holder
			customInputs: {
				genes: [
					{
						settingsKey: 'geneFilter',
						title: 'Apply a filter to the top genes',
						type: 'radio',
						label: 'Gene filter',
						labelDisplay: 'block',
						options: [
							{
								label: 'Cancer Gene Census only',
								value: 'CGC'
							},
							{
								label: 'None',
								value: 'none'
							}
						],
						styles: { padding: '3px 0' },
						callback: async value => {
							CGConly = value === 'CGC'
							const genes = await getGenes(arg, gdcCohort, CGConly, maxGenes)
							api.update({
								termgroups: [{ lst: genes }],
								settings: {
									matrix: {
										geneFilter: value
									}
								}
							})
						}
					},
					{
						label: `Maximum # Genes`,
						title: 'Limit the number of displayed genes',
						type: 'number',
						chartType: 'matrix',
						settingsKey: 'maxGenes',
						callback: async value => {
							maxGenes = value
							const genes = await getGenes(arg, gdcCohort, CGConly, maxGenes)
							api.update({
								termgroups: [{ lst: genes }],
								settings: {
									matrix: {
										maxGenes
									}
								}
							})
						}
					}
				]
			}
		}
	}

	const plotAppApi = await appInit(opts)
	const matrixApi = plotAppApi.getComponents('plots.0')

	const api = {
		update: arg => {
			if ('filter0' in arg) {
				plotAppApi.dispatch({
					type: 'filter_replace',
					filter0: arg.filter0
				})
			} else {
				plotAppApi.dispatch({
					type: 'plot_edit',
					id: matrixApi.id,
					config: arg
				})
			}
		}
	}

	return api
}

function getGdcCohort(arg) {
	if (arg.filter0) {
		// already given a filter, return without validation
		if (typeof arg.filter0 != 'object') throw 'filter0 not object'
		return arg.filter0
	}
	// no filter. as discussed Dec/6, 2022, use GBM as a default
	return { op: 'in', content: { field: 'cases.disease_type', value: ['Gliomas'] } }
	/*
	{
		op: 'and',
		content: [
		{ op: 'in', content: { field: 'cases.disease_type', value: ['Gliomas'] } }]
	}
	*/
}

/*
arg={}
	.genes=[ str, ... ]
gdcCohort={}
CGConly=boolean
*/
async function getGenes(arg, gdcCohort, CGConly, maxGenes = 50) {
	if (arg.genes) {
		// genes are predefined
		if (!Array.isArray(arg.genes) || arg.genes.length == 0) throw '.genes[] is not non-empty array'
		return await Promise.all(
			arg.genes.map(async i => {
				return await fillTermWrapper({ term: { name: i, type: 'geneVariant' } })
			})
		)
	}

	// genes are not predefined. query to get top genes using the current cohort
	const body = {
		genome: gdcGenome,
		filter0: gdcCohort,
		maxGenes
	}
	if (CGConly) body.CGConly = 1
	const data = await dofetch3('gdc_filter2topGenes', { body })
	if (data.error) throw data.error
	if (!data.genes) throw 'no top genes found using the cohort filter'
	return await Promise.all(
		data.genes.map(async i => {
			return await fillTermWrapper({ term: { name: i, type: 'geneVariant' } })
		})
	)
}
