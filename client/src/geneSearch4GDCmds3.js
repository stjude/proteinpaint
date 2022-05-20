import { addGeneSearchbox } from '../dom/genesearch'
import { Menu } from '../dom/menu'
import { dofetch3 } from './common/dofetch'
import blockinit from './block.init'

/*
test with http://localhost:3000/example.gdc.html
runpp({ geneSearch4GDCmds3:true })

designed to work with client/src/wrappers/PpReact.js 

*/

const gdcGenome = 'hg38'
const tip = new Menu({ padding: '' })

export async function init(arg, holder, genomes) {
	const genome = genomes[gdcGenome]
	if (!genome) throw gdcGenome + ' missing'

	// first row, gene search
	const geneInputDiv = holder.append('div')
	geneInputDiv
		.append('div')
		.style('opacity', 0.5)
		.text('To view GDC mutations on a gene, enter gene symbol or alias below.')

	// second row, display graph
	const graphDiv = holder.append('div')

	const opt = {
		genome,
		tip,
		row: geneInputDiv,
		geneOnly: true,
		callback: launchView
	}
	const coordInput = addGeneSearchbox(opt)

	async function launchView() {
		if (!coordInput.geneSymbol) throw 'geneSymbol missing'

		graphDiv.selectAll('*').remove()

		const data = await dofetch3('gene2canonicalisoform?genome=' + gdcGenome + '&gene=' + coordInput.geneSymbol)
		if (data.error) throw data.error
		if (!data.isoform) throw 'no canonical isoform for given gene accession'
		const pa = {
			query: data.isoform,
			genome,
			holder: graphDiv,
			gmmode: 'protein',
			tklst: [{ type: 'mds3', dslabel: 'GDC' }]
		}
		blockinit(pa)
	}
}
