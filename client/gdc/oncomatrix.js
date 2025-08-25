import { appInit } from '#plots/plot.app.js'
import { select } from 'd3-selection'
import { dofetch3 } from '#common/dofetch'
import { fillTermWrapper } from '#termsetting'
import { copyMerge } from '#rx'
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

		const vocabApi = await vocabInit({
			state: { vocab: { genome: gdcGenome, dslabel: gdcDslabel } }
		})
		vocabApi.getTermdbConfig()

		const plotAppApi = await appInit({
			holder: select(arg.holder).select('.sja_root_holder'),
			genome,
			state: copyMerge(
				{
					genome: gdcGenome,
					dslabel: gdcDslabel,
					termfilter: { filter0: arg.filter0 },
					plots: [
						// initialize with a geneset component, in case the genes lst is empty.
						// This will be replaced with the actual matrix/hierCluster app once
						// a valid geneset is selected.
						{
							chartType: 'geneset',
							toolName: 'OncoMatrix',
							settings: {
								maxGenes: settings.matrix.maxGenes,
								geneFilter: settings.matrix.geneFilter
							}
						}
					]
				},
				arg.state || {}
			),
			app: arg.opts?.app || {},
			geneset: {
				mode: 'geneVariant', // consistent mode value as GeneSetEdit
				genome,
				genes: arg.genes,
				reactsTo(action) {
					if (action.type.startsWith('plot_')) return action.id === this.id
					if (action.type.startsWith('filter')) return true
					if (action.type == 'app_refresh') return true
				},
				showWaitMessage(div) {
					div.style('margin', '20px')
					div.append('div').text('Loading the top mutated genes in the current cohort...')
					// can delete cgc line when new api is online
					// div.append('div').style('font-size', '.8em').html(`
					// 	Genes are selected from 738 Cancer Gene Census genes.<br>
					// 	Only up to 1000 cases with gene expression data will be used to select genes.
					// `)
				},
				async callback(_genesetCompApi, twlst) {
					// exit early if the geneset api is already gone,
					// as caused by race condition from quick changes to the filter0
					if (!_genesetCompApi) return
					genesetCompApi = _genesetCompApi
					if (!matrixApi) {
						const plotConfig = plotAppApi.getState().plots.find(p => p.chartType == 'matrix')
						if (plotConfig) matrixApi = plotAppApi.getComponents(`plots.${plotConfig.id}`)
					}

					const termgroups = [
						...(arg.termgroups || []),
						{
							//name: 'Gene Expression',
							lst: twlst
						}
					]

					if (matrixApi) {
						plotAppApi.dispatch({
							type: 'plot_edit',
							id: matrixApi.id,
							config: { termgroups }
						})
					} else {
						plotAppApi.dispatch({
							type: 'plot_create',
							config: {
								chartType: 'matrix',
								// avoid making a dictionary request when there is no gene data;
								// if there is gene data, then the arg.termgroups can be submitted and rehydrated on app/store.init()
								termgroups,
								divideBy: arg.divideBy || undefined,
								// moved default settings to gdc.hg38.js termdb[chartType].settings
								// but can still override in the runpp() argument
								settings
							}
						})
					}
				}
			},
			recover: {
				undoHtml: 'Undo',
				redoHtml: 'Redo',
				resetHtml: 'Restore',
				hide(state) {
					return state.plots[0]?.chartType != 'matrix'
				},
				adjustTrackedState: state => {
					const s = structuredClone(state)
					delete s.termfilter.filter0
					if (s.plots) {
						// don't track plot configuration that are not specific to the plot config/settings
						for (const plot of s.plots) {
							if (!plot.termgroups) continue
							for (const grp of plot.termgroups) {
								if (!grp.lst) continue
								for (const tw of grp.lst) {
									if (!tw?.term) continue
									// this is cohort-dependent and should be ignored like termfilter.filter0
									delete tw.term.category2samplecount
									// for GDC, the term.values may not be known ahead of time
									// and only filled in as data comes in, should ignore this
									// computed value as to avoid affecting tracked state
									delete tw.term.values
								}
							}
						}
					}
					return s
				}
			},
			matrix: copyMerge(
				{
					reactsTo(action) {
						if (action.type.startsWith('plot_')) return action.id === this.id
						if (action.type.startsWith('filter')) return true
						if (action.type == 'app_refresh') return true
					},
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
									for (const key in arg.opts?.app?.callbacks) {
										if (key.startsWith('preDispatch')) {
											arg.opts?.app?.callbacks[key]()
											break
										}
									}
									const genes = await getGenes(
										arg,
										{ maxGenes: value, geneFilter: settings.matrix.geneFilter },
										vocabApi
									)
									api.update({
										termgroups: [{ lst: genes }],
										settings: {
											matrix: { maxGenes: value }
										}
									})
								}
							}
						]
					},
					callbacks: {
						'firstRender.gdcMatrix': async matrixApi => {
							matrixApi.on('firstRender.gdcMatrix', null)
							if (!genesetCompApi) return
							plotAppApi.dispatch({
								type: 'plot_delete',
								id: genesetCompApi.id
							})
							genesetCompApi = undefined
						}
					}
				},
				arg.opts?.matrix || {}
			)
		})

		let matrixApi, genesetCompApi

		const api = {
			getState: () => plotAppApi.getState(),
			destroy: () => plotAppApi.destroy(),
			update: async arg => {
				if (!matrixApi) {
					const plotConfig = plotAppApi.getState().plots.find(p => p.chartType == 'matrix')
					if (plotConfig) matrixApi = plotAppApi.getComponents(`plots.${plotConfig.id}`)
				}

				if (arg.genes) {
					// user geneset as saved and reused from GFF, reshaped to be {gene: string}[]
					plotAppApi.dispatch({
						type: 'plot_edit',
						id: matrixApi.id,
						config: {
							termgroups: [
								{
									lst: await Promise.all(
										arg.genes.map(async g => {
											return await fillTermWrapper(
												{
													term: { gene: g.gene, type: 'geneVariant', name: g.gene }
												},
												vocabApi
											)
										})
									)
								}
							]
						}
					})
				} else if ('filter0' in arg) {
					plotAppApi.dispatch({
						type: 'filter_replace',
						filter0: arg.filter0
					})
				} else if (matrixApi) {
					plotAppApi.dispatch({
						type: 'plot_edit',
						id: matrixApi.id,
						config: arg
					})
				}
			},
			triggerAbort: plotAppApi.triggerAbort
		}
		return api
	} catch (e) {
		throw e
	}
}

async function getGenes(arg, settings, vocabApi) {
	// genes are not predefined. query to get top genes using the current cohort
	const body = {
		maxGenes: settings.maxGenes,
		geneFilter: settings.geneFilter
	}

	if (arg.filter0) body.filter0 = arg.filter0 // to avoid causing a "null" parameter value for backend

	const data = await dofetch3('termdb/topMutatedGenes', { body })
	if (data.error) throw data.error
	if (!data.genes) return // do not throw and halt. downstream will detect no genes and handle it by showing edit ui
	return await Promise.all(
		// do tempfix of "data.genes.slice(0,3).map" for faster testing
		data.genes.map(async i => {
			return await fillTermWrapper({ term: { gene: i.gene, type: 'geneVariant' } }, vocabApi)
		})
	)
}
