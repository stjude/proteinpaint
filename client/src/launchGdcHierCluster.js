import { dofetch3 } from '#common/dofetch'
import { appInit } from '#plots/plot.app.js'
import { fillTermWrapper } from '#termsetting'

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

		const genes = await getGenes(arg, arg.filter0, settings.hierCluster, holder)

		const opts = {
			holder,
			genome,
			state: {
				genome: gdcGenome,
				dslabel: gdcDslabel,
				termfilter: { filter0: arg.filter0 },
				plots: [
					{
						chartType: 'hierCluster',
						termgroups: arg.termgroups,
						genes,
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
			hierCluster: arg.opts?.hierCluster || {}
		}

		const plotAppApi = await appInit(opts)
		const thisApi = plotAppApi.getComponents('plots.0')

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
						id: thisApi.id,
						config: arg
					})
				}
			}
		}

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
		if (!data.genes || data.genes.length == 0) throw 'no top genes found using the cohort filter'
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
