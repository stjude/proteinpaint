import { Menu } from '#dom/menu'
import { dofetch3 } from '#common/dofetch'

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

none

this may work with react wrapper?


*/

const gdcGenome = 'hg38'
const gdcDslabel = 'GDC'
const tip = new Menu({ padding: '' })

export async function init(arg, holder, genomes) {
	const genome = genomes[gdcGenome]
	if (!genome) throw gdcGenome + ' missing'

	// always require a gdc cohort filter
	const gdcCohort = getGdcCohort(arg)

	const genes = await getGenes(arg, gdcCohort)

	// TODO limit number of cases, backend?
	return await launchMatrix(genes, arg, holder, genome)
}

function getGdcCohort(arg) {
	if (arg.filter0) {
		// already given a filter, return without validation
		if (typeof arg.filter0 != 'object') throw 'filter0 not object'
		return arg.filter0
	}
	// no filter. as discussed Dec/6, 2022, use GBM as a default
	return {
		op: 'and',
		content: [{ op: 'in', content: { field: 'cases.disease_type', value: ['Gliomas'] } }]
	}
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

async function launchMatrix(genes, arg, holder, genome) {
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
			termfilter: { filter0: arg.filter0 },
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
