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

	if (arg.genes) {
		if (!Array.isArray(arg.genes) || arg.genes.length == 0) throw '.genes[] is not non-empty array'
		return await launchMatrix(arg.genes, arg, holder, genome)
	}

	// default genes not provided

	if (arg.filter0) {
		// cohort filter is provided. query top genes to use in default matrix
		if (typeof arg.filter0 != 'object') throw 'filter0 not object'
		const data = await dofetch3(
			`gdc_filter2topGenes?genome=${gdcGenome}&filter0=${encodeURIComponent(JSON.stringify(arg.filter0))}`
		)
		if (data.error) throw data.error
		if (!data.genes) throw 'no top genes found'
		return await launchMatrix(data.genes, arg, holder, genome)
	}

	throw 'todo may show disease select'
}

async function launchMatrix(genes, arg, holder, genome) {
	// slicing is for temp testing
	const termlst = genes.slice(5, 10).map(i => {
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
