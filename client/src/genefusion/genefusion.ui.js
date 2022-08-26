import * as uiutils from '#dom/uiUtils'
import { select as d3select, selectAll as d3selectAll, event as d3event } from 'd3-selection'
import { sayerror } from '../client'

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

	makeFusionInput(wrapper, obj)

	const dropdown_div = wrapper
		.append('div')
		.style('display', 'flex')
		.style('align-items', 'center')
		.style('margin', '10px')
	genomeSelection(dropdown_div, genomes, obj)
	makePositionDropDown(dropdown_div, obj)

	const controlBtns_div = wrapper
		.append('div')
		.style('display', 'flex')
		.style('align-items', 'center')
		.style('margin', '40px 0px 40px 130px')
	makeSubmit(controlBtns_div, obj, holder, genomes)
	uiutils.makeResetBtn(controlBtns_div, obj, '.genefusion_input').style('margin', '0px 10px')

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

function makeFusionInput(div, obj) {
	const fusionInput = uiutils
		.makeTextAreaInput({
			div,
			cols: 50,
			placeholder: 'Example: PAX5,NM_016734,201,JAK2,NM_004972,812'
		})
		.style('border', '1px solid rgb(138, 177, 212)')
		.style('margin', '0px 0px 0px 20px')
		.classed('genefusion_input', true)
		.on('keyup', async () => {
			obj.data = fusionInput.property('value').trim()
		})
}

async function genomeSelection(div, genomes, obj) {
	const genome_div = div.append('div').style('margin-left', '40px')
	const g = uiutils.makeGenomeDropDown(genome_div, genomes).style('border', '1px solid rgb(138, 177, 212)')
	obj.genome = g.node()
}

async function makePositionDropDown(div, obj) {
	const dropdown_div = div.append('div')

	const positionSelect = dropdown_div
		.append('select')
		.style('border-radius', '5px')
		.style('padding', '5px 10px')
		.style('margin', '1px 10px 1px 10px')
	positionSelect
		.append('option')
		.text('Codon position')
		.property('value', 'codon')
	positionSelect
		.append('option')
		.text('RNA position')
		.property('value', 'rna')
	positionSelect
		.append('option')
		.text('Genomic position')
		.property('value', 'genomic')
	obj.position = positionSelect.node()
}

function makeSubmit(div, obj, holder) {
	const submit = uiutils.makeBtn({
		div,
		text: 'Submit'
	})
	const errorMessage_div = div.append('div')
	submit.style('display', 'block').on('click', () => {
		if (!obj.data || obj.data == undefined) {
			const sayerrorDiv = errorMessage_div
				.append('div')
				.style('display', 'inline-block')
				.style('max-width', '20vw')
			sayerror(sayerrorDiv, 'Please provide data')
			setTimeout(() => sayerrorDiv.remove(), 3000)
		} else {
			const runpp_arg = {
				holder: holder
					.append('div')
					.style('margin', '20px')
					.node(),
				host: window.location.origin,
				nobox: true,
				noheader: true,
				parseurl: false,
				genome: obj.genome.options[obj.genome.selectedIndex].text,
				genefusion: {
					text: obj.data,
					positionType: obj.position.options[obj.position.selectedIndex].value
				}
			}
			console.log(runpp_arg)
			d3select('.sjpp-app-ui').remove()
			runproteinpaint(Object.assign(runpp_arg))
		}
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
