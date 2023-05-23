import { addGeneSearchbox } from '#dom/genesearch'
import { Menu } from '#dom/menu'

const tip2 = new Menu({ padding: '0px' })
export function showGenesetEdit({ x, y, menu, genome, callback, geneList = [], mode = 'mutation', vocabApi }) {
	const div = menu.d.append('div').style('width', '60vw')
	div
		.style('border-style', 'solid')
		.style('border-width', '2px')
		.style('border-color', '#eee')
		.style('padding', '5px')
	const headerDiv = div.append('div')
	const inputSearch = addGeneSearchbox({
		tip: tip2,
		genome,
		row: headerDiv,
		geneOnly: true,
		callback: addGene
	})

	const rightDiv = headerDiv
		.append('div')
		.style('display', 'inline-flex')
		.style('align-items', 'center')
		.style('float', 'right')
		.style('gap', '5px')

	if (mode == 'mutation') {
		rightDiv.append('input').attr('type', 'checkbox')
		rightDiv.append('span').html('Use only cancer census genes')
		rightDiv
			.append('button')
			.html(`Load top mutated genes`)
			.on('click', async event => {})
	} else if (mode == 'expression') {
		rightDiv
			.append('input')
			.attr('value', 10)
			.attr('type', 'number')
			.style('width', '40px')
		rightDiv.append('span').html('Minimum average value cut off')
		rightDiv
			.append('button')
			.html(`Load top variably expressed genes`)
			.on('click', async event => {})
	}
	if (genome?.termdbs?.msigdb)
		for (const key in genome.termdbs) {
			let text = 'Load MSigDB gene set &#9660;'
			const id = genome.termdbs.length > 1 ? key : ''
			const msigdbBt = rightDiv
				.append('button')
				.attr('name', 'msigdbBt')
				.html(`Load MSigDB gene set ${id} &#9660;`)
				.on('click', async event => {
					tip2.clear()
					const termdb = await import('../termdb/app')
					termdb.appInit({
						holder: tip2.d,
						state: {
							dslabel: key,
							genome: genome.name,
							nav: {
								header_mode: 'search_only'
							}
						},
						tree: {
							click_term: term => {
								const geneset = term._geneset
								if (geneset) {
									geneList = geneset
									renderGenes()
								}
								//menu.hide()
								tip2.hide()
							}
						}
					})
					tip2.showunder(msigdbBt.node())
				})
		}
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
		.on('click', () => {
			menu.hide()
			callback(geneList)
		})
	menu.show(x, y, false, true)

	function renderGenes() {
		genesDiv.selectAll('*').remove()
		if (geneList)
			for (const gene of geneList)
				genesDiv
					.append('span')
					.text(gene.name || gene.symbol)
					.style('padding', '5px')
	}
	function addGene() {
		const name = inputSearch.geneSymbol
		geneList.push({ name })
		renderGenes()
	}
}
