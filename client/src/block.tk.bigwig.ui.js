import * as uiutils from '#dom/uiUtils'
import { Tabs } from '../dom/toggleButtons'
import { appear } from '#dom/animation'
import { first_genetrack_tolist } from './client'
import { select as d3select, selectAll as d3selectAll } from 'd3-selection'

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

*****TODO: add option for stranded bigwig tracks
*/

export async function bigwigUI(genomes, holder) {
	const wrapper = holder
		.append('div')
		.style('margin', '5px 5px 5px 20px')
		.style(
			'font-family',
			"'Lucida Sans', 'Lucida Sans Regular', 'Lucida Grande', 'Lucida Sans Unicode', Geneva, Verdana, sans-serif"
		)
		// .style('display', 'grid')
		.classed('sjpp-bw-ui', true)
		// .style('grid-template-columns', '200px auto')
		// .style('grid-template-rows', 'repeat(1, auto)')
		// .style('gap', '5px')
		// .style('place-items', 'center left')
		.style('overflow', 'hidden')

	const obj = {}
	//User selects genome
	uiutils
		.makePrompt(wrapper, 'Select Genome')
		.style('font-size', '1.15em')
		.style('padding', '10px 0px')
		.style('color', '#003366')
	genomeSelection(wrapper, genomes, obj)

	//User file input for bigwig tracks
	uiutils
		.makePrompt(wrapper, 'Provide Data')
		.style('font-size', '1.15em')
		.style('padding', '20px 0px 10px 0px')
		.style('color', '#003366')
	const tabs_div = wrapper.append('div').style('margin-left', '40px')
	makeTrackEntryTabs(tabs_div, obj)

	//Submit and information for user
	const controlBtnsDiv = wrapper
		.append('div')
		.style('display', 'flex')
		.style('align-items', 'center')
		.style('margin', '40px 0px 40px 130px')
	submitButton(controlBtnsDiv, obj, holder, genomes)
	uiutils.makeResetBtn(controlBtnsDiv, obj, '.sjpp_bigwigUI_input').style('margin', '0px 20px 20px 0px')
	infoSection(wrapper, obj)
}

//Tabs for 'Data' entry.
function makeTrackEntryTabs(tabs_div, obj) {
	const tabs = [
		{
			label: 'Single Track',
			callback: async (event, tab) => {
				// obj.tabInUse = 'single'

				tab.contentHolder.style('border', 'none').style('display', 'block')
				const singlediv = tab.contentHolder.append('div').style('border', 'none')
				appear(tab.contentHolder)

				uiutils.makePrompt(singlediv, 'Name')
				trackNameInput(singlediv, obj)
				uiutils.makePrompt(singlediv, 'File Path')
				trackFilePathInput(singlediv, obj)

				delete tab.callback
			}
		},
		{
			label: 'Multiple Tracks',
			callback: async (event, tab) => {
				// obj.tabInUse = 'multi'

				tab.contentHolder.style('border', 'none').style('display', 'block')
				appear(tab.contentHolder)

				tab.contentHolder
					.append('div')
					.html(
						'<p style="margin-left: 10px;">Enter one track per line in the following format: [track name],[path/to/file.bw or URL]</p><p style="margin-left: 20px; color: #7d7c7c;">e.g. BigWig Track, proteinpaint_demo/hg19/bigwig/file.bw</p>'
					)
				multiTrackInput(tab.contentHolder, obj)

				delete tab.callback
			}
		}
	]

	new Tabs({ holder: tabs_div, tabs }).main()
}

async function genomeSelection(div, genomes, obj) {
	const genome_div = div.append('div').style('margin-left', '40px')
	const g = uiutils.makeGenomeDropDown(genome_div, genomes).style('border', '1px solid rgb(138, 177, 212)')
	obj.genomeselect = g.node()
}
//Creates name input under Single Track tab
function trackNameInput(div, obj) {
	const track_div = div.append('div').style('margin-left', '10px')
	const name = uiutils
		.makeTextInput(track_div, 'BigWig track')
		.style('border', '1px solid rgb(138, 177, 212)')
		.classed('sjpp_bigwigUI_input', true)
		.on('keyup', async () => {
			obj.trackname = name.property('value').trim()
		})
}
//Creates filepath input under Single Track tab
function trackFilePathInput(div, obj) {
	const track_div = div.append('div').style('margin-left', '10px')
	const filepath = uiutils
		.makeTextInput(track_div)
		.style('border', '1px solid rgb(138, 177, 212)')
		.classed('sjpp_bigwigUI_input', true)
		.on('keyup', async () => {
			obj.filepath = filepath.property('value').trim()
			obj.tabInUse = 'single'
		})
}
//Creates textarea input to input multiple bigwig tracks under Multiple Tracks tab
function multiTrackInput(div, obj) {
	const pasteTrack_div = div.append('div').style('display', 'block')
	const multi = uiutils
		.makeTextAreaInput({ div: pasteTrack_div })
		.style('border', '1px solid rgb(138, 177, 212)')
		.style('margin', '0px 0px 0px 20px')
		.classed('sjpp_bigwigUI_input', true)
		.on('keyup', async () => {
			obj.multitrackdata = multi.property('value').trim()
			obj.tabInUse = 'multi'
		})
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
			const runpp_arg = {
				holder: holder.append('div').style('margin', '20px').node(),
				/** Do not use window.location.origin. See comment: line 180, renderContent(), client/appdrawer/adSandbox.js*/
				host: sessionStorage.getItem('hostURL')
			}
			const bigwig_arg = validateInput(obj, genomes)
			if (!bigwig_arg) return
			d3select('.sjpp-bw-ui').remove()
			runproteinpaint(Object.assign(runpp_arg, bigwig_arg))
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
	// .style('grid-column', 'span 2')
	div.append('div').style('margin', '10px').style('opacity', '0.65').style('line-height', '1.5').html(`<ul>
                <li>
                    <a href=https://docs.google.com/document/d/1ZnPZKSSajWyNISSLELMozKxrZHQbdxQkkkQFnxw6zTs/edit#heading=h.6spyog171fm9 target=_blank>BigWig track documentation</a>
                </li>
                <li>
                    <a href=https://proteinpaint.stjude.org/ppdemo/hg19/bigwig/file.bw target=_blank>Example file</a>
                </li>
                <li>
                    Please see the <a href=https://genome.ucsc.edu/goldenpath/help/bigWig.html target=_blank>UCSC documention</a> for information on bigWig file formatting.
                </li>
            </ul>`)
}
