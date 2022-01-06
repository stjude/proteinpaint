import * as uiutils from './dom/uiUtils'
import * as toggle from './dom/toggleButtons'
import { appear } from './dom/animation'
import { debounce } from 'debounce'
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
		.classed('sjpp-bwui', true)
		.style('grid-template-columns', '200px auto')
		.style('grid-template-rows', 'repeat(1, auto)')
		.style('gap', '5px')
		.style('place-items', 'center left')
		.style('overflow', 'hidden')

	const doms = {}
	makePrompt(wrapper, 'Genome')
	genomeSelction(wrapper, genomes, doms)
	makePrompt(wrapper, 'Data')
	const tabs_div = wrapper.append('div')
	makeTrackEntryTabs(tabs_div, doms)
	// addBorder(wrapper)
	infoSection(wrapper)
	submitButton(wrapper, doms, holder)

	window.doms = doms
}

function validateInput(doms) {
	if (!doms.filepath && !doms.multitrackdata) alert('Provide either data for a single track or multiple tracks.')
	const runpp_arg = {
		block: true,
		nobox: 1,
		noheader: true,
		genome: doms.genome,
		tracks: []
	}
	{
		const n = doms.genome.node()
		runpp_arg.genome = n.options[n.selectedIndex].text
	}
	if (doms.singleInUse == true) {
		if (doms.filepath == '') return
		let file, url
		if (uiutils.isURL(doms.filepath)) url = doms.filepath
		else file = doms.filepath
		runpp_arg.tracks.push({
			type: 'bigwig',
			name: doms.trackname || 'BigWig track',
			file: file,
			url: url,
			scale: {
				auto: 1
			}
		})
		return runpp_arg
	}
	if (doms.multiInUse == true) {
		for (const data of doms.multitrackdata.split(/[\r\n]/)) {
			const line = data.split(',')
			if (line[0] && line[1]) {
				let file, url
				const tmp = line[1].trim()
				if (uiutils.isURL(tmp)) url = tmp
				else file = tmp

				runpp_arg.tracks.push({
					type: 'bigwig',
					name: line[0].trim(),
					file: file,
					url: url,
					scale: {
						auto: 1
					},
					iscustom: true
				})
			}
		}
	}
	first_genetrack_tolist(doms.genome, [...runpp_arg.tracks])
	return runpp_arg
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
				doms.trackname = trackNameInput(singlediv)
				makePrompt(singlediv, 'File Path')
				trackFilePathInput(singlediv)
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
						'<p>Paste data. Enter one track per line, track name then the filepath separated by a comma. <br>e.g. [track name],[path/to/file.bw or URL]</p>'
					)
				doms.multiInput = multiTrackInput(div)
			}
		}
	]

	toggle.init_tabs({ holder: tabs_div, tabs })
}

async function genomeSelction(div, genomes, doms) {
	const genome_div = div.append('div')
	doms.genome = uiutils.makeGenomeDropDown(genome_div, genomes).style('border', '1px solid rgb(138, 177, 212)')

	// g.on('change', () => {
	//     const n = g.node()
	//     doms.genome = n.options[n.selectedIndex].text
	// })
}

function trackNameInput(div) {
	const track_div = div.append('div').style('display', 'inline-block')
	const name = uiutils
		.makeTextInput(track_div, 'BigWig track')
		.style('border', '1px solid rgb(138, 177, 212)')
		.on(
			'keyup',
			debounce(async () => {
				doms.trackname = name.property('value').trim()
			}),
			700
		)
}

function trackFilePathInput(div) {
	const track_div = div.append('div').style('display', 'inline-block')
	const filepath = uiutils
		.makeTextInput(track_div)
		.style('border', '1px solid rgb(138, 177, 212)')
		.on(
			'keyup',
			debounce(async () => {
				doms.filepath = filepath.property('value').trim()
			}),
			700
		)
}

function multiTrackInput(div) {
	const pasteTrack_div = div.append('div').style('display', 'block')
	const multi = uiutils
		.makeTextAreaInput(pasteTrack_div)
		.style('border', '1px solid rgb(138, 177, 212)')
		.style('margin', '0px 0px 0px 20px')
		.on(
			'keyup',
			debounce(async () => {
				doms.multitrackdata = multi.property('value').trim()
			}),
			700
		)
}

function submitButton(div, doms, holder) {
	const submit = div
		.append('button')
		.text('Submit')
		.style('margin', '20px 20px 20px 130px')
		.style('font-size', '16px')
		.style('color', 'black')
		.style('background-color', '#F2F2F2')
		.style('border', '2px solid #999')
		.style('padding', '5px 10px')
		.on('mouseenter', () => {
			submit
				.style('color', '#1043c4')
				.style('background-color', 'white')
				.style('border', '0.5px solid #1043c4')
		})
		.on('mouseleave', () => {
			submit
				.style('color', 'black')
				.style('background-color', '#F2F2F2')
				.style('border', '2px solid #999')
		})
		.on('click', () => {
			d3select('.sjpp-bwui').remove()
			const runpp_arg = {
				holder: holder
					.append('div')
					.style('margin', '20px')
					.node(),
				host: window.location.origin
			}

			const bigwig_arg = validateInput(doms)

			runproteinpaint(Object.assign(runpp_arg, bigwig_arg))
		})
}

// function addBorder(div){
//     div.append('span')
//         .style('position', 'absolute')
//         .style('left', '12%')
//         .style('width', '0.5px')
//         .style('height', '100%')
//         .style('background-color', 'grey')
//         .style('top', '-15%')
// }

function infoSection(div) {
	div
		.append('div')
		.style('margin', '15px')
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
