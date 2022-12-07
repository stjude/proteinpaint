import { Menu } from '#dom/menu'
import { dofetch3 } from '#common/dofetch'
import { make_one_checkbox } from '#dom/checkbox'

/*

test with http://localhost:3000/example.gdc.matrix.html
runpp({ launchGdcMatrix:true })

designed to work for Oncoprint app in GDC Analysis Tools Framework


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

{ update(_arg) }


*/

const gdcGenome = 'hg38'
const gdcDslabel = 'GDC'
const tip = new Menu({ padding: '' })

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
			await launchView(arg)
		}
	})

	async function launchView(param) {
		// always require a gdc cohort filter
		const gdcCohort = getGdcCohort(param)

		const genes = await getGenes(param, gdcCohort)

		// TODO limit number of cases, backend?
		await launchMatrix(genes, gdcCohort, holder, genome)
	}

	await launchView(arg)

	const api = {
		update: async _arg => {
			Object.assign(arg, _arg)
			await launchView(arg)
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

async function getGenes(arg, gdcCohort) {
	if (arg.genes) {
		// genes are predefined
		if (!Array.isArray(arg.genes) || arg.genes.length == 0) throw '.genes[] is not non-empty array'
		return arg.genes
	}

	// genes are not predefined. query to get top genes using the current cohort
	const data = await dofetch3(
		`gdc_filter2topGenes?genome=${gdcGenome}&filter0=${encodeURIComponent(JSON.stringify(gdcCohort))}`
	)
	if (data.error) throw data.error
	if (!data.genes) throw 'no top genes found using the cohort filter'
	return data.genes
}

async function launchMatrix(genes, gdcCohort, holder, genome) {
	// TODO hide sandbox
	const termlst = genes.map(i => {
		return { term: { name: i, type: 'geneVariant' } }
	})
	const _ = await import('#mass/app')
	const opt = {
		holder,
		genome,
		state: {
			genome: gdcGenome,
			dslabel: gdcDslabel,
			termfilter: { filter0: gdcCohort },
			nav: { header_mode: 'hidden' },
			plots: [
				{
					chartType: 'matrix',
					termgroups: [{ lst: termlst }]
				}
			]
		}
	}
	_.appInit(opt)
}
