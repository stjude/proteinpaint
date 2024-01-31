import { appInit } from '#plots/plot.app.js'
// import { launchWithGenes } from './launchWithGenes'
import { select } from 'd3-selection'

/*
test with http://localhost:3000/example.gdc.exp.html

designed to work for Gene Exp Visualization app in GDC Analysis Tools Framework

the pp react wrapper in Gdc Frontend Framework will call this with parameters:
runpp({ launchGdcHierCluster:true })

initiates a "plot" app instance that wraps around the hierCluster component
and returns the plot app API


********* parameters

holder
genomes = { hg38 : {} }
arg = {}
	runpp() argument object

	.filter0{}
		see notes in launchGdcMatrix.js

	.genes[]
		future: list of genes to launch matrix

	.termgroups[]
		list of terms to be added to the matrix by default
	
	.settings{hierCluster{}}
		.maxGenes

	.opts{hierCluster{}}


********* returns

API object with following methods; pp react wrapper can call api.update() when user updates cohort in the GDC portal
TODO revise to a simpler object

{
	type:'hierCluster'
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
	try {
		const genome = genomes[gdcGenome]
		if (!genome) throw gdcGenome + ' missing'

		// these options will allow session recovery by an embedder
		const settings = arg.settings || {}
		if (typeof settings != 'object') throw 'arg.settings{} not object'
		if (!settings.hierCluster) settings.hierCluster = {}
		if (typeof settings.hierCluster != 'object') throw 'arg.settings.hierCluster{} not object'
		// set defaults
		if (!Number.isInteger(settings.hierCluster.maxGenes)) settings.hierCluster.maxGenes = 100

		if (arg.filter0 && typeof arg.filter0 != 'object') throw 'arg.filter0 not object'

		const plotAppApi = await appInit({
			holder: select(arg.holder).select('.sja_root_holder'),
			genome,
			state: {
				genome: gdcGenome,
				dslabel: gdcDslabel,
				termfilter: { filter0: arg.filter0 },
				plots: [
					// initialize with a geneset component, in case the genes lst is empty
					// this will be replace with the actual matrix/hierCluster app once
					// a valid geneset is selected
					{
						chartType: 'geneset',
						toolName: 'Gene Expression Clustering',
						settings
					}
				]
			},
			app: {
				features: ['recover'],
				callbacks: arg.opts?.app?.callbacks || {}
			},
			geneset: {
				mode: 'expression',
				genome,
				genes: arg.genes,
				showWaitMessage(div) {
					div.style('margin', '20px')
					div.append('div').text('Loading genes that are top variably expressed in current cohort...')
					// can delete cgc line when new api is online
					div.append('div').style('font-size', '.8em').html(`
						Genes are selected from 738 Cancer Gene Census genes.<br>
						Only up to 1000 cases with gene expression data will be used to select genes.
					`)
				},
				callback(genesetCompApi, twlst) {
					plotAppApi.dispatch({
						type: 'plot_splice',
						subactions: [
							{
								type: 'plot_delete',
								id: genesetCompApi.id
							},
							{
								type: 'plot_create',
								config: {
									chartType: 'hierCluster',
									// avoid making a dictionary request when there is no gene data;
									// if there is gene data, then the arg.termgroups can be submitted and rehydrated on app/store.init()
									termgroups: [
										{
											name: 'Gene Expression',
											type: 'hierCluster',
											lst: twlst
										},
										...(arg.termgroups || [])
									],
									divideBy: arg.divideBy || undefined,
									// moved default settings to gdc.hg38.js termdb[chartType].settings
									// but can still override in the runpp() argument
									settings
								}
							}
						]
					})
				}
			},
			recover: {
				undoHtml: 'Undo',
				redoHtml: 'Redo',
				resetHtml: 'Restore',
				hide(state) {
					return state.plots[0]?.chartType != 'hierCluster'
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
			}
		})

		let hierClusterApi
		const api = Object.freeze({
			type: 'hierCluster',
			update: async _arg => {
				if (!plotAppApi) {
					Object.assign(pendingArg, _arg)
					return
				}
				if ('filter0' in _arg) {
					plotAppApi.dispatch({
						type: 'filter_replace',
						filter0: _arg.filter0
					})
				} else {
					if (!hierClusterApi) hierClusterApi = plotAppApi.getComponents('plots.0')
					plotAppApi.dispatch({
						type: 'plot_edit',
						id: hierClusterApi.id,
						config: _arg
					})
				}
			}
		})

		return api
	} catch (e) {
		throw e
	}
}
