import * as uiutils from './dom/uiUtils'
import * as toggle from './dom/toggleButtons'
import { appear } from './dom/animation'
import { select as d3select } from 'd3-selection'
import { first_genetrack_tolist } from './client'

/*

-------EXPORTED-------
bigwigUI
    user inputs
        - genome (required): default hg19
        - either single or multiple track data
            - Single track:
                1. Track name (optional): default 'bigwig track'
                2. File path (required)
            - Multiple tracks:
                1. Pasted tracks data (required): name, filepath

-------Internal-------

*/

export async function bigwigUI(genomes, holder) {
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

	const doms = {}
	makePrompt(wrapper, 'Genome')
	genomeSelection(wrapper, genomes, doms)
	makePrompt(wrapper, 'Data')
	const tabs_div = wrapper.append('div')
	makeTrackEntryTabs(tabs_div, doms)
	submitButton(wrapper, doms, holder, genomes)
	infoSection(wrapper)
}

function validateInput(doms, genomes) {
	//Creates the runpp arguments on submit
	if (!doms.filepath && !doms.multitrackdata) alert('Provide data for either a single track or multiple tracks.')
	let genome = doms.genomeselect.options[doms.genomeselect.selectedIndex].text
	const runpp_args = {
		block: true,
		nobox: 1,
		noheader: true,
		genome,
		tracks: []
	}
	const g = genomes[genome]

	if (doms.singleInUse == true) {
		let file, url
		if (uiutils.isURL(doms.filepath)) url = doms.filepath
		else file = doms.filepath
		const tk = {
			type: 'bigwig',
			name: doms.trackname || 'BigWig track',
			file,
			url,
			scale: {
				auto: 1
			}
		}
		runpp_args.tracks.push(tk)
		first_genetrack_tolist(g, runpp_args.tracks)
		return runpp_args
	}

	if (doms.multiInUse == true) {
		for (const data of doms.multitrackdata.split(/[\r\n]/)) {
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
		first_genetrack_tolist(g, runpp_args.tracks)
		return runpp_args
	}
	throw 'unknown option'
}

function makePrompt(div, text) {
	div
		.append('div')
		.style('display', 'inline-block')
		.style('margin', '15px')
		.style('place-items', 'center left')
		.html(text)
}

function makeTrackEntryTabs(tabs_div, doms) {
	//Tabs for 'Data' entry.
	const tabs = [
		{
			label: 'Single Track',
			callback: async div => {
				doms.singleInUse = true
				doms.multiInUse = false
				div.selectAll('*').remove()
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
				makePrompt(singlediv, 'Name')
				doms.trackname = trackNameInput(singlediv, doms)
				makePrompt(singlediv, 'File Path')
				trackFilePathInput(singlediv, doms)
			}
		},
		{
			label: 'Multiple Tracks',
			callback: async div => {
				doms.singleInUse = false
				doms.multiInUse = true
				div.selectAll('*').remove()
				div.style('border', 'none').style('display', 'block')
				appear(div)
				div
					.append('div')
					.html(
						'<p>Enter one track per line in the following format: [track name],[path/to/file.bw or URL]</p><p style="margin-left: 10px; color: #7d7c7c;">e.g. BigWig Track, proteinpaint_demo/hg19/bigwig/file.bw</p>'
					)
				doms.multiInput = multiTrackInput(div, doms)
			}
		}
	]

	toggle.init_tabs({ holder: tabs_div, tabs })
}

async function genomeSelection(div, genomes, doms) {
	const genome_div = div.append('div')
	const g = uiutils.makeGenomeDropDown(genome_div, genomes).style('border', '1px solid rgb(138, 177, 212)')
	doms.genomeselect = g.node()
}

function trackNameInput(div, doms) {
	const track_div = div.append('div').style('display', 'inline-block')
	const name = uiutils
		.makeTextInput(track_div, 'BigWig track')
		.style('border', '1px solid rgb(138, 177, 212)')
		.on('keyup', async () => {
			doms.trackname = name.property('value').trim()
		})
}

function trackFilePathInput(div, doms) {
	const track_div = div.append('div').style('display', 'inline-block')
	const filepath = uiutils
		.makeTextInput(track_div)
		.style('border', '1px solid rgb(138, 177, 212)')
		.on('keyup', async () => {
			doms.filepath = filepath.property('value').trim()
		})
}

function multiTrackInput(div, doms) {
	const pasteTrack_div = div.append('div').style('display', 'block')
	const multi = uiutils
		.makeTextAreaInput(pasteTrack_div)
		.style('border', '1px solid rgb(138, 177, 212)')
		.style('margin', '0px 0px 0px 20px')
		.on('keyup', async () => {
			doms.multitrackdata = multi.property('value').trim()
		})
}

function submitButton(div, doms, holder, genomes) {
	const submit = div
		.append('button')
		.text('Submit')
		.style('margin', '20px 20px 20px 130px')
		.style('font-size', '16px')
		.style('color', 'black')
		.style('background-color', '#F2F2F2')
		.style('border', '2px solid #999')
		.style('padding', '5px 10px')
		.style('cursor', 'pointer')
		.on('click', () => {
			d3select('.sjpp-bw-ui').remove()
			const runpp_arg = {
				holder: holder
					.append('div')
					.style('margin', '20px')
					.node(),
				host: window.location.origin
			}

			const bigwig_arg = validateInput(doms, genomes)

			runproteinpaint(Object.assign(runpp_arg, bigwig_arg))
		})
}

function infoSection(div) {
	div
		.append('div')
		.style('margin', '10px')
		.style('opacity', '0.6')
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
