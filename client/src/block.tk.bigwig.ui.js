import * as uiutils from '#dom/uiUtils'
import { init_tabs } from '#dom/toggleButtons'
import { appear } from '#dom/animation'
import { first_genetrack_tolist } from './client'
import { selectAll as d3selectAll } from 'd3-selection'

/*

-------EXPORTED-------
bigwigUI()
    user inputs
        - genome (required): default hg19
        - either single or multiple track data
            - Single track:
                1. Track name (optional): default 'bigwig track'
                2. File path (required)
            - Multiple tracks:
                1. Pasted tracks data (required): name, filepath

-------Internal-------
makeTrackEntryTabs()
genomeSelection()
trackNameInput()
trackFilePathInput()
multiTrackInput()
submitButton()
validateInput()
infoSection()

obj: {}
.genomeselect SELECT
.tabInUse STR
.trackname STR
.filepath STR
.multitrackdata STR
*/

export async function bigwigUI(genomes, holder) {
	//UI layout: two column flexbox grid: Prompts | Inputs
	const wrapper = holder
		.append('div')
		.style('margin', '5px 5px 5px 20px')
		.style('display', 'grid')
		.classed('sjpp-bw-ui', true)
		.style('grid-template-columns', '200px auto')
		.style('grid-template-rows', 'repeat(1, auto)')
		.style('gap', '5px')
		.style('place-items', 'center left')
		.style('overflow', 'hidden')

	const obj = {}
	//User selects genome
	uiutils.makePrompt(wrapper, 'Genome')
	genomeSelection(wrapper, genomes, obj)

	//User file input for bigwig tracks
	//*****TODO: add option for stranded bigwig tracks
	uiutils.makePrompt(wrapper, 'Data').style('align-self', 'baseline')
	const tabs_div = wrapper.append('div')
	makeTrackEntryTabs(tabs_div, obj)

	//Submit and information for user
	submitButton(wrapper, obj, holder, genomes)
	makeResetBtn(wrapper, obj)
	infoSection(wrapper, obj)
}

//Tabs for 'Data' entry.
function makeTrackEntryTabs(tabs_div, obj) {
	const tabs = [
		{
			label: 'Single Track',
			callback: async div => {
				obj.tabInUse = 'single'
				if (!tabs[0].rendered) {
					div.style('border', 'none').style('display', 'block')
					const singlediv = div
						.append('div')
						.style('border', 'none')
						.style('display', 'grid')
						.style('grid-template-columns', '100px auto')
						.style('grid-template-rows', 'repeat(1, auto)')
						.style('gap', '5px')
						.style('place-items', 'center left')
					appear(div)
					uiutils.makePrompt(singlediv, 'Name')
					trackNameInput(singlediv, obj)
					uiutils.makePrompt(singlediv, 'File Path')
					trackFilePathInput(singlediv, obj)
					tabs[0].rendered = true
				}
			}
		},
		{
			label: 'Multiple Tracks',
			callback: async div => {
				obj.tabInUse = 'multi'
				if (!tabs[1].rendered) {
					div.style('border', 'none').style('display', 'block')
					appear(div)
					div
						.append('div')
						.html(
							'<p style="margin-left: 10px;">Enter one track per line in the following format: [track name],[path/to/file.bw or URL]</p><p style="margin-left: 20px; color: #7d7c7c;">e.g. BigWig Track, proteinpaint_demo/hg19/bigwig/file.bw</p>'
						)
					multiTrackInput(div, obj)
					tabs[1].rendered = true
				}
			}
		}
	]

	init_tabs({ holder: tabs_div, tabs })
}

async function genomeSelection(div, genomes, obj) {
	const genome_div = div.append('div')
	const g = uiutils.makeGenomeDropDown(genome_div, genomes).style('border', '1px solid rgb(138, 177, 212)')
	obj.genomeselect = g.node()
}
//Creates name input under Single Track tab
function trackNameInput(div, obj) {
	const track_div = div.append('div').style('display', 'inline-block')
	const name = uiutils
		.makeTextInput(track_div, 'BigWig track')
		.style('border', '1px solid rgb(138, 177, 212)')
		.classed('bigwigUI_input', true)
		.on('keyup', async () => {
			obj.trackname = name.property('value').trim()
		})
}
//Creates filepath input under Single Track tab
function trackFilePathInput(div, obj) {
	const track_div = div.append('div').style('display', 'inline-block')
	const filepath = uiutils
		.makeTextInput(track_div)
		.style('border', '1px solid rgb(138, 177, 212)')
		.classed('bigwigUI_input', true)
		.on('keyup', async () => {
			obj.filepath = filepath.property('value').trim()
		})
}
//Creates textarea input to input multiple bigwig tracks under Multiple Tracks tab
function multiTrackInput(div, obj) {
	const pasteTrack_div = div.append('div').style('display', 'block')
	const multi = uiutils
		.makeTextAreaInput({ div: pasteTrack_div })
		.style('border', '1px solid rgb(138, 177, 212)')
		.style('margin', '0px 0px 0px 20px')
		.classed('bigwigUI_input', true)
		.on('keyup', async () => {
			obj.multitrackdata = multi.property('value').trim()
		})
}

function submitButton(div, obj, holder, genomes) {
	const submit = uiutils.makeBtn({
		div,
		text: 'Submit'
	})
	submit
		.style('margin', '20px 20px 20px 130px')
		.style('font-size', '16px')
		.on('click', () => {
			const runpp_arg = {
				holder: holder
					.append('div')
					.style('margin', '20px')
					.node(),
				host: window.location.origin
			}
			const bigwig_arg = validateInput(obj, genomes)
			if (!bigwig_arg) return
			div.remove()
			runproteinpaint(Object.assign(runpp_arg, bigwig_arg))
		})
}

function makeResetBtn(div, obj) {
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
			d3selectAll('.bigwigUI_input').property('value', '')
			if (obj.data) obj.data = ''
		})
}

//Creates the runpp arguments on submit
function validateInput(obj, genomes) {
	if (!obj.filepath && !obj.multitrackdata) {
		alert('Provide data for either a single track or multiple tracks.')
		return
	}
	let genome = obj.genomeselect.options[obj.genomeselect.selectedIndex].text
	const runpp_args = {
		block: true,
		nobox: 1,
		noheader: true,
		genome,
		tracks: []
	}
	const g = genomes[genome]

	if (obj.tabInUse == 'single') {
		let file, url
		if (uiutils.isURL(obj.filepath)) url = obj.filepath
		else file = obj.filepath
		const tk = {
			type: 'bigwig',
			name: obj.trackname || 'BigWig track',
			file,
			url,
			scale: {
				auto: 1
			}
		}
		runpp_args.tracks.push(tk)
		first_genetrack_tolist(g, runpp_args.tracks) //Creates nativetracks arg
		return runpp_args
	}

	if (obj.tabInUse == 'multi') {
		for (const data of obj.multitrackdata.split(/[\r\n]/)) {
			//Name must be separated from filepath by a comma
			const line = data.split(',')
			if (line[0] && !line[1]) alert('Problem with submission. Are commas between the track names and filepaths?')
			if (line[0] && line[1]) {
				let file, url
				const tmp = line[1].trim()
				if (uiutils.isURL(tmp)) url = tmp
				else file = tmp

				const tk = {
					type: 'bigwig',
					name: line[0].trim(),
					file,
					url,
					scale: {
						auto: 1
					},
					iscustom: true
				}
				runpp_args.tracks.push(tk)
			}
		}
		first_genetrack_tolist(g, runpp_args.tracks) //Creates nativetracks arg
		return runpp_args
	}
	throw 'unknown option'
}

function infoSection(div) {
	div
		.append('div')
		.style('margin', '10px')
		.style('opacity', '0.65')
		.style('grid-column', 'span 2').html(`<ul>
                <li>
                    <a href=https://docs.google.com/document/d/1ZnPZKSSajWyNISSLELMozKxrZHQbdxQkkkQFnxw6zTs/edit#heading=h.6spyog171fm9 target=_blank>BigWig track documentation</a>
                </li>
                <li>
                    <a href=https://pecan.stjude.cloud/static/proteinpaint_demo/hg19/bigwig/file.bw target=_blank>Example file</a>
                </li>
                <li>
                    Please see the <a href=https://genome.ucsc.edu/goldenpath/help/bigWig.html target=_blank>UCSC documention</a> for information on bigWig file formatting.
                </li>
            </ul>`)
}
