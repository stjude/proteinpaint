import { dofetch3 } from '#common/dofetch'
import { appInit } from '#plots/plot.app.js'
import { fillTermWrapper } from '#termsetting'
import { showGenesetEdit } from '../dom/genesetEdit.ts'
import { vocabInit } from '#termdb/vocabulary'

/*
test with http://localhost:3000/example.gdc.matrix.html
runpp({ launchGdcMatrix:true })

designed to work for OncoMatrix app in GDC Analysis Tools Framework

initiates a "plot" app instance that wraps around the matrix component
and returns the plot app API


********* parameters

holder
genomes = { hg38 : {} }
arg = {}
	runpp() argument object

	.filter0{}
		the filter object from GDC Cohort Builder, for restricting cases in oncomatrix
		{"op":"and","content":[{"op":"in","content":{"field":"cases.primary_site","value":["breast","bronchus and lung"]}}]}
		not visualized on pp (invisible) and read only, passed to backend -> gdc api
		// NOTE 6/29/2023: this is the default only in the OncoMatrix demo mode,
		// and is supplied by the OncoMatrixWrapper in the GFF repo, no need to supply here
		// return { op: 'in', content: { field: 'cases.disease_type', value: ['Gliomas'] } }

	.genes[]
		future: list of genes to launch matrix

	.termgroups[]
		list of terms to be added to the matrix by default
	
	.settings{matrix{}}
		any state that can be JSON-encoded/hydrated as part of getPlotConfig().settings.matrix. This is meant to hold plot-instance-specific state that only affects rendering and not data requests, but that distinction is not as clear with plots that use server-side rendering like violin plot.
		.maxGenes
		.maxSamples

	.opts{matrix{}}
		any options that cannot be JSON-stringified, like callbacks. These options will also be applied to all rehydrated or new plots of the same type, so not plot-instance-specific. this way of adding callback allows to work with an external portal, e.g. a callback from gdc to collect cases
			.allow2selectSamples: 
				{
				  buttonText: "Create Cohort",
				  attributes: ["case.case_id"],
				  callback: console.log,
				}

			.cellClick(cell), where
				cell = {
					sampleData: the data.row by sample, part of the data.lst as returned by vocabApi.getAnnotatedSampleData()
						{
							sample: name/id string,
							[term1_$id]: {key, label, values, renderedValues, filteredValues, countedValues, sample},
							[....]
						},

					value: the data.row[term.id] value, data shape depends on the term.type,
						// for gene variant
						{	
							dt, class, gene, pos, _SAMPLEID_, _SAMPLENAME
						}
						// not shown here: example values for other term types

					term: the term for this matrix cell, equivalent to t.tw,

					s: the matrix.sampleOrder[] entry for this matrix cell,

					t: the matrix.termOrder[] entry for this matrix cell,

					siblingCells: cell data for the same matrix sample/term, but excluding this cell 
				}



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
	try {
		if (!genome) throw gdcGenome + ' missing'

		// these options will allow session recovery by an embedder
		const settings = arg.settings || {}
		if (typeof settings != 'object') throw 'arg.settings{} not object'
		if (!settings.matrix) settings.matrix = {}
		if (typeof settings.matrix != 'object') throw 'arg.settings.matrix{} not object'
		// set defaults
		if (!settings.matrix.geneFilter) settings.matrix.geneFilter = 'CGC' // filter to only use CGC genes by default
		if (!Number.isInteger(settings.matrix.maxGenes)) settings.matrix.maxGenes = 50

		if (arg.filter0 && typeof arg.filter0 != 'object') throw 'arg.filter0 not object'

		let plotAppApi,
			matrixApi,
			pendingArg = arg,
			removedTempDiv = false
		const api = {
			update: async arg => {
				if (!plotAppApi) {
					Object.assign(pendingArg, arg)
					return
				}
				if (!removedTempDiv && tempDiv?.node?.().closest('body')) {
					Object.assign(pendingArg, arg)
					if ('filter0' in arg) {
						const genes = await getGenes(pendingArg, arg.filter0, settings.matrix)
						if (genes.length) {
							removedTempDiv = true
							tempDiv.remove()
							const plotState = structuredClone(plotAppApi.getState().plots[0])
							if (pendingArg.termgroups) {
								// arg.termgroups was not rehydrated on the appInit() of plotApp,
								// need to rehydrate here manually
								for (const group of pendingArg.termgroups) {
									group.lst = await Promise.all(group.lst.map(fillTermWrapper))
								}
							}
							plotState.termgroups = [...(pendingArg.termgroups || []), { lst: genes }]
							plotAppApi.dispatch({
								type: 'app_refresh',
								state: {
									termfilter: { filter0: arg.filter0 },
									plots: [plotState]
								}
							})
							matrixDiv.style('display', '')
						} else {
							plotAppApi.dispatch({
								type: 'filter_replace',
								filter0: arg.filter0
							})
						}
					} else {
						// this will force an app.postRender() emit to trigger hiding the loading overlay,
						// if there is an arg.app.calllbacks.postRender, and even if there is no state change
						// that would have trigerred a matrix re-render to trigger a postRender closing of
						// the loading overlay
						plotAppApi.dispatch({
							type: 'app_refresh',
							state: {}
						})
					}
					return
				}
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

		const genes = await getGenes(arg, arg.filter0, settings.matrix)
		const tempDiv = !genes.length && holder.append('div') // single-use div to show geneset edit ui if there are no genes
		const matrixDiv = holder.append('div').style('display', genes.length ? '' : 'none') // hide the matrix div if there are no genes
		// launchWithGenes will handle empty genes list with a postInit callback
		plotAppApi = await launchWithGenes(api, genes, genome, arg, settings, holder, tempDiv, matrixDiv)
		matrixApi = plotAppApi.getComponents('plots.0')
		return api
	} catch (e) {
		if (arg.opts?.matrix?.callbacks) {
			for (const eventName in arg.opts.matrix.callbacks) {
				if (eventName.startsWith('error')) arg.opts.matrix.callbacks[eventName]()
			}
		}
		throw e
	}
}

/*
arg={}
	.genes=[ str, ... ]
filter0={}
matrix{}
*/
async function getGenes(arg, filter0, matrix) {
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
		maxGenes: matrix.maxGenes,
		geneFilter: matrix.geneFilter
	}

	if (filter0) body.filter0 = filter0 // to avoid causing a "null" parameter value for backend

	const data = await dofetch3('gdc/topMutatedGenes', { body })
	if (data.error) throw data.error
	if (!data.genes) return // do not throw and halt. downstream will detect no genes and handle it by showing edit ui
	console.log(data.genes)
	throw 'xx'
	return await Promise.all(
		// do tempfix of "data.genes.slice(0,3).map" for faster testing
		data.genes.map(async i => {
			return await fillTermWrapper({ term: { name: i.gene, type: 'geneVariant' } })
		})
	)
}

async function launchWithGenes(api, genes, genome, arg, settings, holder, tempDiv, matrixDiv) {
	if (!genes.length) {
		// the GFF will supply these options, should handle gracefully if missing in test code
		if (!arg.opts) arg.opts = {}
		if (!arg.opts.matrix) arg.opts.matrix = {}
		if (!arg.opts.matrix.callbacks) arg.opts.matrix.callbacks = {}
		arg.opts.matrix.callbacks['postInit.genesetEdit'] = async matrixApi => {
			// geneset edit ui requires vocabApi
			tempDiv.append('p').text('No default genes. Please define a gene set to launch OncoMatrix.')
			showGenesetEdit({
				holder: tempDiv.append('div'),
				genome,
				vocabApi: await vocabInit({ state: { genome: gdcGenome, dslabel: gdcDslabel } }),
				callback: async result => {
					tempDiv.remove()
					matrixDiv.style('display', '')
					const twlst = await Promise.all(
						result.geneList.map(async i => {
							return await fillTermWrapper({ term: { name: i.name, type: 'geneVariant' } })
						})
					)
					if (arg.termgroups) {
						// arg.termgroups was not rehydrated on the appInit() of plotApp,
						// need to rehydrate here manually
						for (const group of arg.termgroups) {
							group.lst = await Promise.all(group.lst.map(fillTermWrapper))
						}
					}

					plotAppApi.dispatch({
						type: 'plot_edit',
						id: matrixApi.id,
						config: {
							termgroups: [...(arg.termgroups || []), { lst: twlst }]
						}
					})
				}
			})
		}
	}

	const opts = {
		holder: matrixDiv,
		genome,
		state: {
			genome: gdcGenome,
			dslabel: gdcDslabel,
			termfilter: { filter0: arg.filter0 },
			plots: [
				{
					chartType: 'matrix',
					// avoid making a dictionary request when there is no gene data;
					// if there is gene data, then the arg.termgroups can be submitted and rehydrated on app/store.init()
					termgroups: !genes.length ? [{ lst: genes }] : [...(arg.termgroups || []), { lst: genes }],
					divideBy: arg.divideBy || undefined,
					// moved default settings to gdc.hg38.js termdb.matrix.settings
					// but can still override in the runpp() argument
					settings
				}
			]
		},
		app: {
			features: ['recover'],
			callbacks: arg.opts?.app?.callbacks || {}
		},
		recover: {
			undoHtml: 'Undo',
			redoHtml: 'Redo',
			resetHtml: 'Restore',
			adjustTrackedState(state) {
				const s = structuredClone(state)
				delete s.termfilter.filter0
				return s
			}
		},
		matrix: Object.assign(
			{
				// these will display the inputs together in the Genes menu,
				// instead of being rendered outside of the matrix holder
				customInputs: {
					genes: [
						{
							label: `Maximum # Genes`,
							title: 'Limit the number of displayed genes',
							type: 'number',
							chartType: 'matrix',
							settingsKey: 'maxGenes',
							callback: async value => {
								const genes = await getGenes(arg, arg.filter0, { maxGenes: value })
								api.update({
									termgroups: [{ lst: genes }],
									settings: {
										matrix: { maxGenes: value }
									}
								})
							}
						}
					]
				}
			},
			arg.opts?.matrix || {}
		)
	}

	const plotAppApi = await appInit(opts)
	return plotAppApi
}
