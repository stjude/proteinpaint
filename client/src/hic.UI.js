import * as uiutils from '#dom/uiUtils'
import { select, selectAll } from 'd3-selection'

export function init_hicUI(holder, genomes, debugmode) {
	const wrapper = holder
		.append('div')
		.style('margin', '5px 5px 5px 20px')
		.style(
			'font-family',
			"'Lucida Sans', 'Lucida Sans Regular', 'Lucida Grande', 'Lucida Sans Unicode', Geneva, Verdana, sans-serif"
		)
		.classed('sjpp-hic-ui', true)
		.style('overflow', 'hidden')

	const obj = {}

	//User selects genome
	uiutils
		.makePrompt(wrapper, 'Select Genome')
		.style('font-size', '1.15em')
		.style('padding', '10px 0px')
		.style('color', '#003366')
	genomeSelection(wrapper, genomes, obj)

	uiutils
		.makePrompt(wrapper, 'Track Name')
		.style('font-size', '1.15em')
		.style('padding', '10px 0px')
		.style('color', '#003366')
	trackNameInput(wrapper, obj)

	uiutils
		.makePrompt(wrapper, 'Provide Data')
		.style('font-size', '1.15em')
		.style('padding', '10px 0px')
		.style('color', '#003366')
	const dataDiv = wrapper.append('div').style('margin-left', '40px')

	// uiutils.makePrompt(dataDiv, 'Select File').style('display', 'block')
	// makeFileUpload(dataDiv, obj)

	// uiutils.makePrompt(dataDiv, 'File Path').style('display', 'block')
	trackFilePathInput(dataDiv, obj)

	uiutils
		.makePrompt(wrapper, 'Select Restriction Enzyme')
		.style('font-size', '1.15em')
		.style('padding', '10px 0px')
		.style('color', '#003366')
	makeEnzymeDropDown(wrapper, obj)

	const controlBtnsDiv = wrapper
		.append('div')
		.style('display', 'flex')
		.style('align-items', 'center')
		.style('margin', '40px 0px 40px 130px')
	submitButton(controlBtnsDiv, obj, holder, genomes)
	uiutils.makeResetBtn(controlBtnsDiv, obj, '.sjpp-hic-ui-input').style('margin', '0px 20px 20px 0px')

	//Remove after testing
	if (debugmode) window.doms = obj
	return obj
}

async function genomeSelection(div, genomes, obj) {
	const genome_div = div.append('div').style('margin-left', '40px')
	const g = uiutils.makeGenomeDropDown(genome_div, genomes).style('border', '1px solid rgb(138, 177, 212)')
	obj.genomeselect = g.node()
}

function trackNameInput(div, obj) {
	const track_div = div.append('div').style('margin-left', '40px')
	const name = uiutils
		.makeTextInput(track_div, 'Hi-C track')
		.style('border', '1px solid rgb(138, 177, 212)')
		.classed('sjpp-hic-ui-input', true)
		.on('keyup', async () => {
			obj.trackname = name.property('value').trim()
		})
}

function makeFileUpload(div, obj) {
	// Renders the select file div and callback.
	const upload_div = div.append('div').style('display', 'inline-block')
	const upload = uiutils.makeFileUpload(upload_div).classed('sjpp-hic-ui-input', true)
	upload.on('change', event => {
		const file = event.target.files[0]
		const reader = new FileReader()
		reader.onload = event => {
			obj.file = event.target.result
		}
		reader.readAsText(file, 'utf8')
	})
}

function trackFilePathInput(div, obj) {
	const track_div = div.append('div')
	//.style('margin-left', '10px')
	const filepath = uiutils
		.makeTextInput(track_div)
		.style('border', '1px solid rgb(138, 177, 212)')
		.classed('sjpp-hic-ui-input', true)
		.on('keyup', async () => {
			const data = filepath.property('value').trim()
			if (uiutils.isURL(data)) {
				await fetch(data)
					.then(req => req.text())
					.then(text => {
						obj.url = text
					})
			} else {
				//TODO: implement serverside filepaths(?)
			}
		})
}

function makeEnzymeDropDown(div, obj) {
	const options = ['none', 'DpnII', 'EcoRI', 'HindIII', 'Mobl', 'Ncol']
	const enzyme = uiutils.makeDropDown(div.append('div').style('margin-left', '40px'), options)
	obj.enzymeselect = enzyme.node()
}

function submitButton(div, obj, holder, genomes) {
	const submit = uiutils.makeBtn({
		div,
		text: 'Submit'
	})
	submit
		.style('margin', '0px 20px 20px 60px')
		.style('font-size', '16px')
		.on('click', () => {
			// const runpp_arg = {
			// 	holder: holder.append('div').style('margin', '20px').node(),
			// 	host: window.location.origin
			// }
			// const bigwig_arg = validateInput(obj, genomes)
			// if (!bigwig_arg) return
			// d3select('.sjpp-bw-ui').remove()
			// runproteinpaint(Object.assign(runpp_arg, bigwig_arg))
		})
}
