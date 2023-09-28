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

	const genes = await getGenes(arg, arg.filter0, settings.hierCluster)

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
			features: ['recover']
		},
		recover: {
			undoHtml: 'Undo',
			redoHtml: 'Redo',
			resetHtml: 'Restore'
		}
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
}

/*
arg={}
	.genes=[ str, ... ]
filter0={}
config{}
*/
async function getGenes(arg, filter0, config) {
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
		filter0,
		maxGenes: config.maxGenes
	}
	const data = await dofetch3('gdc/topVariablyExpressedGenes', { body })
	if (data.error) throw data.error
	if (!data.genes) throw 'no top genes found using the cohort filter'
	return await Promise.all(
		data.genes.map(async i => {
			return await fillTermWrapper({ term: { name: i, type: 'geneVariant' } })
		})
	)
}
