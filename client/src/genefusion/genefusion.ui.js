import * as uiutils from '#dom/uiUtils'
import { select as d3select, selectAll as d3selectAll, event as d3event } from 'd3-selection'

/*
------ EXPORTED ------ 
init_geneFusionUI()
	holder 
	genomes
	debugmode: Remove after testing (?)

------ Internal ------ 

*/

export function init_geneFusionUI(holder, genomes, debugmode) {
	const wrapper = holder
		.append('div')
		.style('margin', '20px 20px 20px 40px')
		.style(
			'font-family',
			"'Lucida Sans', 'Lucida Sans Regular', 'Lucida Grande', 'Lucida Sans Unicode', Geneva, Verdana, sans-serif"
		)
		.style('place-items', 'center left')
		.style('overflow', 'hidden')
		.classed('sjpp-app-ui', true)

	const obj = {}

	// makeSectionHeader(wrapper, 'Gene Fusion')

	uiutils.makeTextAreaInput({ div: wrapper, cols: 50, placeholder:'Example: PAX5,NM_016734,201,JAK2,NM_004972,812' })

	const dropdown_div = wrapper
		.append('div')
		.style('display', 'flex')
		.style('align-items', 'center')
		.style('margin', '10px')
	uiutils.makeGenomeDropDown(dropdown_div, genomes)
	makePositionDropDown(dropdown_div)

	const controlBtns_div = wrapper
		.append('div')
		.style('display', 'flex')
		.style('align-items', 'center')
		.style('margin', '40px 0px 40px 130px')
	makeSubmit(controlBtns_div)
	makeResetBtn(controlBtns_div)

	makeInfoSection(wrapper)

	//Remove after testing
	if (debugmode) window.doms = obj
	return obj
}

function makeSectionHeader(div, text) {
	//maybe more this to uiutils?
	const header = uiutils.makePrompt(div, text)
	header
		.style('font-size', '1.5em')
		.style('color', '#003366')
		.style('margin', '20px 10px 40px 10px')
	const hr = div.append('hr')
	hr.style('color', 'ligthgrey')
		.style('margin', '-30px 0px 15px 0px')
		.style('width', '50vw')
		.style('opacity', '0.4')
}

function makePositionDropDown(div) {
	const dropdown_div = div.append('div')

	const select = dropdown_div
		.append('select')
		.style('border-radius', '5px')
		.style('padding', '5px 10px')
		.style('margin', '1px 10px 1px 10px')
	select.append('option').text('Codon position')
	select.append('option').text('RNA position')
	select.append('option').text('Genomic position')
}

function makeSubmit(div) {
	const submit = uiutils.makeBtn({
		div,
		text: 'Submit'
	})
	submit.style('display', 'block').on('click', () => {
		//do stuff
	})
}

function makeResetBtn(div, obj) {
	//maybe more this to uiutils?
	const reset = uiutils.makeBtn({
		div,
		text: '&#8634;',
		backgroundColor: 'white',
		color: 'grey',
		padding: '0px 6px 1px 6px'
	})
	reset
		.style('font-size', '1.5em')
		.style('display', 'inline-block')
		.style('margin', '0px 10px')
		.attr('type', 'reset')
		.on('click', async () => {
			//TODO
		})
}

function makeInfoSection(div) {
	div
		.append('div')
		.style('margin', '10px')
		.style('opacity', '0.65').html(`Limited to two-gene fusion products.<br>
		One product per line.<br>
		Each line has six fields joined by comma:
		<ol><li>N-term gene symbol</li>
		<li>N-term gene isoform</li>
		<li>N-term gene break-end position</li>
		<li>C-term gene symbol</li>
		<li>C-term gene isoform</li>
		<li>C-term gene break-end position</li>
		<li>(optional) interstitial sequence AA length</li>
		</ol>
		Break-end position types:
		<ul><li>Codon position: integer, 1-based</li>
		<li>RNA position: integer, 1-based, beginning from transcription start site</li>
		<li>Genomic position: chromosome name and 1-based coordinate joined by colon, e.g. chr1:2345</li></ul>`)
}
