export function initGenesetSearch({ holder, genome, callback, geneList, mode, vocabApi }) {
	const div = holder.append('div').style('width', '50%')
	const headerDiv = div.append('div')
	headerDiv.append('input').attr('placeholder', 'Search genes')
	headerDiv.append('button').text('Search')
	const rightDiv = headerDiv
		.append('div')
		.style('display', 'inline-block')
		.style('float', 'right')
	rightDiv.append('button').text('Load MSigDB gene set')
	rightDiv.append('button').text('Clear')

	const genesDiv = div.append('div')
}
