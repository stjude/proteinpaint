import * as uiutils from './dom/uiUtils'
import * as toggle from './dom/toggleButtons'
import { appear, disappear } from './dom/animation'
import { debounce } from 'debounce'
import { event } from 'd3-selection'

export async function bigwigUI(genomes, holder) {
	const wrapper = holder
		.append('div')
		.style('margin', '20px')
		.style('display', 'grid')
		.style('grid-template-columns', '200px auto')
		.style('grid-template-rows', 'repeat(1, auto)')
		.style('gap', '5px')
		.style('place-items', 'center left')

	const doms = {}
	makePrompt(wrapper, 'Genome')
	genomeSelction(wrapper, genomes, doms)
	const tabs_div = wrapper.append('div').style('grid-column', 'span 2')
	makeTrackEntryTabs(tabs_div, doms)
	submitButton(wrapper, doms)
	infoSection(wrapper)

	window.doms = doms

	// validateInput(doms)
}

function validateInput(dom) {
	console.log(dom)
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
				div.selectAll('*').remove()
				div.style('border', 'none')
				appear(div)
				makePrompt(div, 'BigWig Track Name')
				doms.trackname = trackNameInput(div)
				makePrompt(div, 'File Path')
				trackFilePathInput(div)
			}
		},
		{
			label: 'Multiple Tracks',
			callback: async div => {
				div.selectAll('*').remove()
				div.style('border', 'none')
				appear(div)
				makePrompt(div, 'Paste Data')
				doms.multiInput = multiTrackInput(div)
			}
		}
	]

	toggle.init_tabs({ holder: tabs_div, tabs })
}

async function genomeSelction(div, genomes, doms) {
	const genome_div = div.append('div')
	const g = uiutils.makeGenomeDropDown(genome_div, genomes).style('border', '1px solid rgb(138, 177, 212)')
	const n = g.node()
	doms.genome = n.options[n.selectedIndex].text
}

function trackNameInput(div) {
	const track_div = div.append('div').style('display', 'inline-block')
	const name = uiutils
		.makeTextInput(track_div, 'Track Name')
		.style('border', '1px solid rgb(138, 177, 212)')
		.on('change', () => {
			doms.trackname = name.property('value').trim()
		})
}

function trackFilePathInput(div) {
	const track_div = div.append('div').style('display', 'inline-block')
	const filepath = uiutils
		.makeTextInput(track_div)
		.style('border', '1px solid rgb(138, 177, 212)')
		.on('change', () => {
			doms.filepath = filepath.property('value').trim()
		})
}

function multiTrackInput(div) {
	const pasteTrack_div = div.append('div').style('display', 'inline-block')
	const multi = uiutils
		.makeTextAreaInput(pasteTrack_div, 'Enter one track per line: [track name],[path/to/file.bw or URL]')
		.style('border', '1px solid rgb(138, 177, 212)')
		.on('change', () => {
			doms.multi = multi.property('value').trim()
		})
}

function submitButton(div, doms) {
	const submit = div
		.append('button')
		.text('Submit')
		//single add
		.on('click', () => {
			if (doms.filepath == '') return
			let file, url
			if (uiutils.isURL(doms.filepath)) {
				url = doms.filepath
			} else {
				file = doms.filepath
			}
			const runpp_arg = {
				holder: div
					.append('div')
					.style('margin', '20px')
					.node(),
				host: window.location.origin,
				block: true,
				nobox: 1,
				genome: doms.genome,
				tracks: [
					{
						type: 'bigwig',
						name: doms.trackname || 'bigwig track',
						file: file,
						url: url,
						scale: {
							auto: 1
						}
					}
				]
			}

			runproteinpaint(Object.assign(runpp_arg))
		})

	//520, block.tk.menu, multi add
	// .on('click', () => {
	//     const text = input.property('value').trim()
	//     if (text == '') return
	//     for (const s of text.split(/[\r\n]/)) {
	//         const l = s.split(',')
	//         if (l[0] && l[1]) {
	//             const t = {
	//                 type: client.tkt.bigwig,
	//                 name: l[0].trim(),
	//                 scale: { auto: 1 },
	//                 iscustom: true
	//             }

	//             const tmp = l[1].trim()

	//             if (stringisurl(tmp)) t.url = tmp
	//             else t.file = tmp

	//             const t2 = block.block_addtk_template(t)
	//             block.tk_load(t2)
	//         }
	//     }
	// })
}

function infoSection(div) {
	div
		.append('div')
		.style('margin', '15px')
		.style('color', '#4f4f4f')
		.style('grid-column', 'span 2').html(`<ul>
                <li>
                    <a href=https://docs.google.com/document/d/1ZnPZKSSajWyNISSLELMozKxrZHQbdxQkkkQFnxw6zTs/edit#heading=h.6spyog171fm9 target=_blank>BigWig track documentation</a>
                </li>
                <li>
                    Please see the <a href=https://genome.ucsc.edu/goldenpath/help/bigWig.html target=_blank>bigWig documention</a> for more information on file formatting.
                </li>
            </ul>`)
}
