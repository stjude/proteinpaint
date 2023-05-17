export function initGenesetSearch({ holder, genome, callback, geneList, mode, vocabApi }) {
	console.log(genome)
	const div = holder.append('div').style('width', '50vw')
	const headerDiv = div.append('div')
	headerDiv.append('input').attr('placeholder', 'Search genes')
	headerDiv.append('button').text('Search')
	const rightDiv = headerDiv
		.append('div')
		.style('display', 'inline-block')
		.style('float', 'right')
	rightDiv.append('input').attr('type', 'checkbox')
	rightDiv.append('span').html('Use only cancer census genes')
	if (genome?.termdbs?.msigdb)
		rightDiv
			.append('button')
			.attr('name', 'msigdbBt')
			.text('Load MSigDB gene set')
	rightDiv.append('button').text('Clear')

	const genesDiv = div.append('div').html('...')
	const submitDiv = div
		.append('div')
		//.style('display', 'inline-block')
		//.style('float', 'right')
		.append('button')
		.text('Submit')
		.on('click', callback)
}
