import * as uiutils from '#dom/uiUtils'
import { select as d3select, selectAll as d3selectAll } from 'd3-selection'
import { sayerror } from '../client'
import { Tabs } from '../../dom/toggleButtons'
import { appear } from '#dom/animation'

/*
------ EXPORTED ------ 
init_geneFusionUI()
	holder 
	genomes

------ Internal ------ 
makeFusionInput
genomeSelection
makePositionDropDown
makeSubmit
makeInfoSection
makeSubmitResult
makeFusionTabs

*/

export function init_geneFusionUI(holder, genomes) {
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

	return obj
}

function makeFusionInput(div, obj) {
	const fusionInput = uiutils
		.makeTextAreaInput({
			div,
			cols: 50,
			placeholder: 'Example: PAX5,chr9,37002646,-::JAK2,chr9,5081726,+'
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
	positionSelect.append('option').text('Codon position').property('value', 'codon')
	positionSelect.append('option').text('RNA position').property('value', 'rna')
	positionSelect.append('option').text('Genomic position').property('value', 'genomic').attr('selected', true)
	obj.posType = positionSelect.node()
}

function makeSubmit(div, obj, holder) {
	const submit = uiutils.makeBtn({
		div,
		text: 'Submit'
	})
	const errorMessage_div = div.append('div')
	submit.style('display', 'block').on('click', () => {
		if (!obj.data || obj.data == undefined) {
			const sayerrorDiv = errorMessage_div.append('div').style('display', 'inline-block').style('max-width', '20vw')
			sayerror(sayerrorDiv, 'Please provide data')
			setTimeout(() => sayerrorDiv.remove(), 3000)
		} else {
			d3select('.sjpp-app-ui').remove()
			const runpp_arg = {
				/** Do not use window.location.origin. See comment: line 180, renderContent(), client/appdrawer/adSandbox.js*/
				host: sessionStorage.getItem('hostURL'),
				nobox: true,
				noheader: true,
				parseurl: false,
				genome: obj.genome.options[obj.genome.selectedIndex].text
			}
			makeSubmitResult(obj, holder, runpp_arg)
		}
	})
}

function makeInfoSection(div) {
	div.append('div').style('margin', '10px').style('opacity', '0.65').html(`Limited to two-gene fusion products.<br>
		One product per line.<br>
		Each line has eight fields. four fields for each gene. For each gene join the following fields separated by a comma:
		<ol><li>Gene symbol</li>
		<li>Chromosome</li>
		<li>Position, 1-based coordinate</li>
		<li>Strand</li>
		</ol>
		Separate the two genes by a double colon (::). <br><br>
		Example: <br>
		<p style="margin-left: 10px">
		PAX5,chr9,37002646,-::JAK2,chr9,5081726,+<br>
		ZCCHC7,chr9,37257786,-::PAX5,chr9,37024824,-<br>
		BCR,chr22,23524427,+::ABL1,chr9,133729449,+<p>`)
}

function makeSubmitResult(obj, div, runpp_arg) {
	if (obj.data.split(/[\r\n]/).length == 1) {
		//Only one line entered, no dropdown
		const line = obj.data.trim().split('::')
		const gene1 = line[0].split(',')
		const gene2 = line[1].split(',')
		return makeFusionTabs(div, runpp_arg, gene1, gene2)
	}
	//Make dropdown to select fusions
	//On select, toggle tabs for each gene appears underneath with the track for each gene
	const fusionSelect = div
		.append('div')
		.append('select')
		.style('border-radius', '5px')
		.style('padding', '5px 10px')
		.style('margin', '1px 10px 1px 10px')

	fusionSelect.append('option').text(`Select Fusion (${obj.data.split(/[\r\n]/).length})`)

	const tabsDiv = div.append('div').style('margin', '20px')

	const fusionsMap = new Map()

	for (const data of obj.data.split(/[\r\n]/)) {
		const line = data.trim().split('::')
		const gene1 = line[0].split(',')
		const gene2 = line[1].split(',')
		fusionsMap.set(`${gene1[0]}-${gene2[0]}`, [gene1, gene2])
	}

	for (const fusion of fusionsMap) {
		fusionSelect.append('option').property('value', fusion[0]).text(fusion[0])
	}
	fusionSelect.on('change', () => {
		tabsDiv.selectAll('*').remove()
		const geneArrays = fusionsMap.get(fusionSelect.property('value'))
		makeFusionTabs(tabsDiv, runpp_arg, geneArrays[0], geneArrays[1])
	})
}

function makeFusionTabs(div, runpp_arg, gene1, gene2) {
	const tabs = [
		// {
		// ************ Keep for later, will introduce gene fusion view once data format settled *************
		// 	label: 'Fusion',
		// 	callback: async div => {
		// 		if (!tabs[0].rendered) {
		// 			appear(div)
		// 			const text = `${gene1[0]}, ${gene1[1]},${gene1[2]},${gene2[0]},${gene2[1]},${gene2[2]}`
		// 			const runpp_arg = {
		// 				holder: div
		// 					.append('div')
		// 					.style('margin', '20px')
		// 					.node(),
		// 				host: window.location.origin,
		// 				nobox: true,
		// 				noheader: true,
		// 				parseurl: false,
		// 				genome,
		// 				genefusion: {
		// 					text,
		// 					positionType: posType
		// 					}
		// 				}
		// 			console.log(runpp_arg)
		// 			runproteinpaint(Object.assign(runpp_arg))
		// 			tabs[0].rendered = true
		// 		}
		// 	}
		// },
		{
			label: gene1[0],
			callback: async (event, tab) => {
				appear(tab.contentHolder)
				const fusion_arg = {
					holder: tab.contentHolder.append('div').style('margin', '20px').node(),
					gene: gene1[0],
					tracks: [
						{
							type: 'mds3',
							name: gene1[0],
							custom_variants: [
								{
									gene1: gene1[0],
									chr1: gene1[1],
									pos1: parseInt(gene1[2]) - 1,
									strand1: gene1[3],
									gene2: gene2[0],
									chr2: gene2[1],
									pos2: parseInt(gene2[2]) - 1,
									strand2: gene2[3],
									dt: 2,
									class: 'Fuserna'
								}
							]
						}
					]
				}
				runproteinpaint(Object.assign(runpp_arg, fusion_arg))
				delete tab.callback
			}
		},
		{
			label: gene2[0],
			callback: async (event, tab) => {
				appear(tab.contentHolder)
				const fusion_arg = {
					holder: tab.contentHolder.append('div').style('margin', '20px').node(),
					gene: gene2[0],
					tracks: [
						{
							type: 'mds3',
							name: gene2[0],
							custom_variants: [
								{
									gene1: gene1[0],
									chr1: gene1[1],
									pos1: parseInt(gene1[2]) - 1,
									strand1: gene1[3],
									gene2: gene2[0],
									chr2: gene2[1],
									pos2: parseInt(gene2[2]) - 1,
									strand2: gene2[3],
									dt: 2,
									class: 'Fuserna'
								}
							]
						}
					]
				}
				runproteinpaint(Object.assign(runpp_arg, fusion_arg))
				delete tab.callback
			}
		}
	]

	new Tabs({ holder: div, tabs }).main()
}
