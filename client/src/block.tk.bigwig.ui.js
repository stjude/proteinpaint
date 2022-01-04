import * as uiutils from './dom/uiUtils.js'

export async function bigwigUI(genomes, holder) {
	const wrapper = holder.append('div').style('margin', '20px')
	// .style('display', 'flex')
	const form = makeFormLayout(wrapper)
	genomeSelction(form, genomes)
	trackNameInput(form)
}

function makeFormLayout(wrapper) {
	const grid = wrapper
		.append('div')
		.style('display', 'grid')
		.style('grid-template-columns', 'repeat(auto-fit, 1fr 3fr')
		.style('grid-template-areas', '"prompt input"')
		.style('gap', '10px')
		.style('padding', '10px 20px')
		.style('text-align', 'left')
	return grid
}

function makePrompt(div, text) {
	div
		.append('div')
		.style('grid-area', 'prompt')
		.property('position', 'relative')
		.html(text)
}

async function genomeSelction(div, genomes) {
	const genome_div = div.append('div')
	makePrompt(genome_div, 'Genome')
	await uiutils.makeGenomeDropDown(genome_div, genomes).style('grid-area', 'input')
}

function trackNameInput(div) {
	const track_div = div.append('div')
	makePrompt(track_div, 'Track Name')
	uiutils.textInput(track_div, 'Track Name').style('grid-area', 'input')
}
