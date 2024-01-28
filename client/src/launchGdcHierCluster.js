import { dofetch3 } from '#common/dofetch'
import { appInit } from '#plots/plot.app.js'
import { fillTermWrapper } from '#termsetting'
import { launchWithGenes } from './launchWithGenes'

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

		let plotAppApi,
			matrixApi,
			pendingArg = arg,
			removedTempDiv = false
		//let plotAppApi, hierClusterApi
		const api = Object.freeze({
			type: 'hierCluster',
			update: async _arg => {
				if (!plotAppApi) {
					Object.assign(pendingArg, _arg)
					return
				}
				if (!removedTempDiv && tempDiv?.node?.().closest('body')) {
					Object.assign(pendingArg, _arg)
					if ('filter0' in _arg) {
						tempDiv.style('display', 'none')
						const genes = await getGenes(pendingArg, _arg.filter0, settings.hierCluster, holder)
						if (genes.length) {
							removedTempDiv = true
							tempDiv.remove()
							const plotState = structuredClone(plotAppApi.getState().plots[0])
							const hcTermGroup = plotState.termgroups.find(grp => grp.type == 'hierCluster')
							// arg.termgroups was not rehydrated on the appInit() of plotApp,
							// need to rehydrate here manually
							hcTermGroup.lst = await Promise.all(genes.map(async tw => await fillTermWrapper(tw)))
							plotAppApi.dispatch({
								type: 'app_refresh',
								state: {
									termfilter: { filter0: _arg.filter0 },
									plots: [plotState]
								}
							})
							chartDiv.style('display', '')
						} else {
							tempDiv.style('display', '')
							plotAppApi.dispatch({
								type: 'filter_replace',
								filter0: _arg.filter0
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

				if ('filter0' in _arg) {
					plotAppApi.dispatch({
						type: 'filter_replace',
						filter0: _arg.filter0
					})
				} else {
					plotAppApi.dispatch({
						type: 'plot_edit',
						id: hierClusterApi.id,
						config: _arg
					})
				}
			}
		})

		const genes = await getGenes(arg, arg.filter0, settings.hierCluster, holder)
		const tempDiv = !genes.length && holder.append('div') // single-use div to show geneset edit ui if there are no genes
		const chartDiv = holder.append('div').style('display', genes.length ? '' : 'none') // hide the matrix div if there are no genes
		// launchWithGenes will handle empty genes list with a postInit callback
		plotAppApi = await launchWithGenes(api, genes, genome, arg, settings, holder, tempDiv, chartDiv)
		matrixApi = plotAppApi.getComponents('plots.0')
		return api
	} catch (e) {
		if (arg.opts?.hierCluster?.callbacks) {
			for (const eventName in arg.opts.hierCluster.callbacks) {
				if (eventName.startsWith('error')) arg.opts.hierCluster.callbacks[eventName]()
			}
		}
		throw e
	}
}

/*
arg={}
	.genes=[ str, ... ]
filter0={}
config{}
*/
async function getGenes(arg, filter0, config, holder) {
	if (arg.genes) {
		// genes are predefined
		if (!Array.isArray(arg.genes) || arg.genes.length == 0) throw 'arg.genes[] is not non-empty array'
		return await makeGeneTwlst(arg.genes)
	}

	const wait = holder.append('div').style('margin', '20px')
	wait.append('div').text('Loading genes that are top variably expressed in current cohort...')
	// can delete cgc line when new api is online
	wait.append('div').style('font-size', '.8em').html(`
	Genes are selected from 738 Cancer Gene Census genes.<br>
	Only up to 1000 cases with gene expression data will be used to select genes.`)
	// hardcode of 1000 is in gdcGetCasesWithExressionDataFromCohort()

	// genes are not predefined. query to get top genes using the current cohort
	const body = {
		genome: gdcGenome,
		dslabel: gdcDslabel,
		maxGenes: config.maxGenes
	}
	if (filter0) body.filter0 = filter0 // to avoid causing a "null" parameter value for backend

	try {
		const data = await dofetch3('termdb/topVariablyExpressedGenes', { body })
		if (data.error) throw data.error
		if (!data.genes) throw 'no top genes found using the cohort filter'
		wait.remove()
		return await makeGeneTwlst(data.genes)
	} catch (e) {
		wait.remove()
		throw e
	}
}
async function makeGeneTwlst(lst) {
	const tws = []
	for (const g of lst) {
		tws.push(await fillTermWrapper({ term: { name: g, type: 'geneVariant' } }))
	}
	return tws
}
