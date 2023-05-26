import { addGeneSearchbox } from '#dom/genesearch'
import { Menu } from '#dom/menu'
import { select } from 'd3-selection'
import { rgb } from 'd3-color'

const tip2 = new Menu({ padding: '0px' })
let selectedCount = 0
export function showGenesetEdit({ x, y, menu, genome, callback, geneList = [], mode = 'mutation', vocabApi }) {
	const div = menu.d
		.append('div')
		.style('width', '1000px')
		.style('padding', '5px')
	const headerDiv = div.append('div')
	const inputSearch = addGeneSearchbox({
		tip: tip2,
		genome,
		row: headerDiv,
		geneOnly: true,
		callback: addGene,
		hideHelp: true
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
		rightDiv.append('span').html('Min average value cut off')
		rightDiv
			.append('button')
			.html(`Load top expressed genes`)
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
									selectedCount = 0
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
	const deleteBt = rightDiv
		.append('button')
		.text('Delete')
		.property('disabled', true)
		.on('click', () => {
			const spans = genesDiv.selectAll('span').nodes()
			for (const [i, span] of Object.entries(spans)) {
				if (span.selected) geneList.splice(i, 1)
			}

			renderGenes()
		})
	const deleteAllBt = rightDiv
		.append('button')
		.text('Delete All')
		.on('click', () => {
			geneList = []
			selectedCount = 0
			renderGenes()
		})

	const genesDiv = div
		.append('div')
		.style('display', 'flex')
		.style('flex-wrap', 'wrap')
		.style('gap', '5px')
		.style('min-height', '20px')
		.style('border-style', 'solid')
		.style('border-width', '2px')
		.style('border-color', '#eee')
		.style('margin', '10px 0px')
		.style('padding', '2px 0px')
		.style('min-height', '30px')
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

		const spans = genesDiv.selectAll('span').data(geneList)
		spans
			.enter()
			.append('div')
			.style('display', 'inline-block')
			.style('position', 'relative')
			.attr('class', 'sja_menuoption')
			.text(gene => gene.name || gene.symbol)
			.style('padding', '5px 20px')
			.on('click', function(event) {
				const span = select(this)
				const activeColor = rgb('#FFD580').toString()
				if (span.style('background-color') != activeColor) span.style('background-color', activeColor)
				else span.style('background-color', '#F2F2F2')
				span.node().selected = span.style('background-color') == activeColor
				selectedCount = span.node().selected ? selectedCount + 1 : selectedCount - 1
				deleteBt.property('disabled', selectedCount == 0)
			})
			.on('mouseover', function(event) {
				const span = select(this)
				span
					.append('div')
					.classed('sjpp_deletebt', true)
					.style('vertical-align', 'middle')
					.style('display', 'inline-block')
					.style('position', 'absolute')
					.style('right', '2px')
					.html(
						`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#000" class="bi bi-x-lg" viewBox="0 0 16 16">
				<path stroke='#000' d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
				</svg>`
					)
			})
			.on('mouseout', function(event) {
				const span = select(this)
				span.select('.sjpp_deletebt').remove()
			})

		deleteBt.property('disabled', selectedCount == 0)
	}
	function addGene() {
		const name = inputSearch.geneSymbol
		geneList.push({ name })
		renderGenes()
	}
}
