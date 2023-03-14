import { dofetch3 } from '#common/dofetch'
import { make_one_checkbox } from '#dom/checkbox'
import { appInit } from '#plots/plot.app'
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
	destroy()
	getComponents()
	id:str
	type:'matrix'
	on()
	update()
}
*/

const gdcGenome = 'hg38'
const gdcDslabel = 'GDC'

export async function init(arg, holder, genomes) {
	const genome = genomes[gdcGenome]
	if (!genome) throw gdcGenome + ' missing'

	// per discussion on Dec 6, 2022, restrict to cancer gene census genes by default and allow user to change
	let CGConly = true
	make_one_checkbox({
		holder: holder.append('div'),
		labeltext: 'Show only Cancer Gene Census genes',
		checked: CGConly,
		//divstyle: { display: 'block', margin: '10px 5px', height: '10px', 'margin-left': '6.5px' },
		callback: async () => {
			CGConly = !CGConly
			const genes = await getGenes(arg, gdcCohort, CGConly)
			api.update({ termgroups: [{ lst: genes }] })
		}
	})

	const gdcCohort = getGdcCohort(arg)
	const genes = await getGenes(arg, gdcCohort, CGConly)

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
					settings: {
						matrix: {
							cellEncoding: 'oncoprint',
							colspace: 0,
							cellbg: 'white'
						}
					}
				}
			]
		}
	}

	const plotAppApi = await appInit(opts)
	const matrixApi = plotAppApi.getComponents('plots.0')

	const api = {
		update: config => {
			plotAppApi.dispatch({
				type: 'plot_edit',
				id: matrixApi.id,
				config
			})
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
async function getGenes(arg, gdcCohort, CGConly) {
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
	const lst = ['genome=' + gdcGenome, 'filter0=' + encodeURIComponent(JSON.stringify(gdcCohort))]
	if (CGConly) lst.push('CGConly=1')
	const data = await dofetch3('gdc_filter2topGenes?' + lst.join('&'))
	if (data.error) throw data.error
	if (!data.genes) throw 'no top genes found using the cohort filter'
	return await Promise.all(
		data.genes.map(async i => {
			return await fillTermWrapper({ term: { name: i, type: 'geneVariant' } })
		})
	)
}
