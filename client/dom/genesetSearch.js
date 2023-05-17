export function initGenesetSearch({ holder, genome, callback, geneList, mode = 'mutation', vocabApi }) {
	const div = holder.append('div').style('width', '50vw')
	div
		.style('border-style', 'solid')
		.style('border-width', '2px')
		.style('border-color', '#eee')
		.style('padding', '5px')
	const headerDiv = div.append('div')
	headerDiv.append('input').attr('placeholder', 'Search genes')

	headerDiv.append('button').text('Search')
	const rightDiv = headerDiv
		.append('div')
		.style('display', 'inline-block')
		.style('float', 'right')
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
	rightDiv.append('button').text('Clear')

	const genesDiv = div.append('div')
	if (geneList)
		for (const gene of geneList)
			genesDiv
				.append('span')
				.text(gene.name)
				.style('padding', '5px')
	else genesDiv.append('span').text('...')
	const submitDiv = div
		.append('div')
		.append('button')
		.text('Submit')
		.on('click', callback)
}
