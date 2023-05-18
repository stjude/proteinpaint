import { addGeneSearchbox } from '#dom/genesearch'
import { Menu } from '#dom/menu'

export function initGenesetEdit({ holder, genome, callback, geneList, mode = 'mutation', vocabApi }) {
	const div = holder.append('div').style('width', '50vw')
	div
		.style('border-style', 'solid')
		.style('border-width', '2px')
		.style('border-color', '#eee')
		.style('padding', '5px')
	const headerDiv = div.append('div')
	const inputSearch = addGeneSearchbox({
		tip: new Menu({ padding: '5px' }),
		genome,
		row: headerDiv,
		geneOnly: true,
		callback: addGene
	})

	const rightDiv = headerDiv
		.append('div')
		.style('display', 'inline-flex')
		.style('float', 'right')
		.style('gap', '5px')

	if (mode == 'mutation') {
		rightDiv.append('input').attr('type', 'checkbox')
		rightDiv.append('span').html('Use only cancer census genes')
	} else if (mode == 'expression') {
		rightDiv
			.append('input')
			.attr('value', 10)
			.attr('type', 'number')
			.style('width', '40px')
		rightDiv.append('span').html('Minimum average value cut off')
	}
	if (genome?.termdbs?.msigdb)
		rightDiv
			.append('button')
			.attr('name', 'msigdbBt')
			.text('Load MSigDB gene set')
	rightDiv
		.append('button')
		.text('Clear')
		.on('click', () => {
			geneList = []
			renderGenes()
		})

	const genesDiv = div
		.append('div')
		.style('display', 'flex')
		.style('gap', '5px')
		.style('min-height', '20px')
	renderGenes()

	const submitDiv = div
		.append('div')
		.append('button')
		.text('Submit')
		.on('click', () => callback(geneList))

	function renderGenes() {
		genesDiv.selectAll('*').remove()
		if (geneList)
			for (const gene of geneList)
				genesDiv
					.append('span')
					.text(gene.name)
					.style('padding', '5px')
	}
	function addGene() {
		const name = inputSearch.geneSymbol
		geneList.push({ name })
		renderGenes()
	}
}
