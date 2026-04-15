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
parseFusionLine()
	line

------ Internal ------ 
makeFusionInput
genomeSelection
makePositionDropDown
makeSubmit
makeInfoSection
validatePosition
createFusionVariant
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
			cols: 70, // Increased to accommodate longer isoform format example
			placeholder: 'Example: PAX5,chr9,37002646,-::JAK2,chr9,5081726,+ or RUNX1,chr21,36206706,-,NM_001754::MECOM,chr3,169099311,+,NM_004991'
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
		if (!obj.data || obj.data === undefined) {
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
		<br>
		<strong>Format 1 (Basic):</strong> Each line has eight fields, four fields for each gene. For each gene join the following fields separated by a comma:
		<ol><li>Gene symbol</li>
		<li>Chromosome</li>
		<li>Position, 1-based coordinate</li>
		<li>Strand</li>
		</ol>
		<strong>Format 2 (With RefSeq isoforms):</strong> Each line has ten fields, five fields for each gene. For each gene join the following fields separated by a comma:
		<ol><li>Gene symbol</li>
		<li>Chromosome</li>
		<li>Position, 1-based coordinate</li>
		<li>Strand</li>
		<li>RefSeq isoform (e.g., NM_001754)</li>
		</ol>
		Separate the two genes by a double colon (::). <br><br>
		Examples: <br>
		<p style="margin-left: 10px">
		<strong>Format 1:</strong><br>
		PAX5,chr9,37002646,-::JAK2,chr9,5081726,+<br>
		ZCCHC7,chr9,37257786,-::PAX5,chr9,37024824,-<br>
		BCR,chr22,23524427,+::ABL1,chr9,133729449,+<br><br>
		<strong>Format 2:</strong><br>
		RUNX1,chr21,36206706,-,NM_001754::MECOM,chr3,169099311,+,NM_004991<br>
		PAX5,chr9,37002646,-,NM_016734::JAK2,chr9,5081726,+,NM_004972<p>`)
}

/**
 * Validates a position string
 * @param {string} position - The position string to validate
 * @param {string} geneName - Gene name for error messages
 * @throws {Error} If position is invalid
 */
function validatePosition(position, geneName) {
	if (!/^\d+$/.test(position)) {
		throw new Error(`Invalid fusion format: position for ${geneName} must be a positive integer`)
	}
	const pos = Number(position)
	if (pos <= 0) {
		throw new Error(`Invalid fusion format: position for ${geneName} must be greater than 0 (1-based coordinates)`)
	}
}

/**
 * Parses a fusion line into two gene arrays
 * Supports both formats:
 * - Format 1 (4 fields per gene): gene,chr,pos,strand
 * - Format 2 (5 fields per gene): gene,chr,pos,strand,isoform
 * @param {string} line - The fusion line to parse
 * @returns {Array} [gene1Array, gene2Array] where each array contains [gene, chr, pos, strand] and optionally [isoform]
 * @throws {Error} If the line format is invalid
 */
export function parseFusionLine(line) {
	const parts = line.trim().split('::')
	if (parts.length !== 2) {
		throw new Error('Invalid fusion format: must contain exactly two genes separated by "::"')
	}
	
	const gene1 = parts[0].split(',').map(s => s.trim())
	const gene2 = parts[1].split(',').map(s => s.trim())
	
	// Validate that each gene has either 4 fields (basic format) or 5 fields (with isoform)
	if ((gene1.length !== 4 && gene1.length !== 5) || (gene2.length !== 4 && gene2.length !== 5)) {
		throw new Error(`Invalid fusion format: each gene must have 4 or 5 fields. Found gene1: ${gene1.length} fields, gene2: ${gene2.length} fields`)
	}
	
	// Validate required fields are not empty
	for (let i = 0; i < 4; i++) {
		if (!gene1[i] || !gene2[i]) {
			throw new Error('Invalid fusion format: gene symbol, chromosome, position, and strand are required')
		}
	}
	
	// Validate positions
	validatePosition(gene1[2], gene1[0])
	validatePosition(gene2[2], gene2[0])
	
	// Validate strand is + or -
	if (!/^[+-]$/.test(gene1[3]) || !/^[+-]$/.test(gene2[3])) {
		throw new Error('Invalid fusion format: strand must be "+" or "-"')
	}
	
	return [gene1, gene2]
}

/**
 * Creates a fusion variant object from gene arrays
 * @param {Array} gene1 - First gene array [gene, chr, pos, strand, (isoform)]
 * @param {Array} gene2 - Second gene array [gene, chr, pos, strand, (isoform)]
 * @returns {Object} Variant object for proteinpaint
 */
function createFusionVariant(gene1, gene2) {
	const variant = {
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
	// Add isoform information if available (check for non-empty strings)
	const addIsoformIfPresent = (gene, fieldName) => {
		if (gene.length > 4 && gene[4]?.trim()) {
			variant[fieldName] = gene[4].trim()
		}
	}
	addIsoformIfPresent(gene1, 'isoform1')
	addIsoformIfPresent(gene2, 'isoform2')
	return variant
}

function makeSubmitResult(obj, div, runpp_arg) {
	// Filter out empty lines
	const lines = obj.data.split(/[\r\n]/).filter(line => line.trim().length > 0)
	
	if (lines.length === 1) {
		//Only one line entered, no dropdown
		try {
			const [gene1, gene2] = parseFusionLine(lines[0])
			return makeFusionTabs(div, runpp_arg, gene1, gene2)
		} catch (error) {
			const errorDiv = div.append('div').style('color', 'red').style('margin', '20px')
			sayerror(errorDiv, `Error parsing fusion: ${error.message}`)
			return
		}
	}
	//Make dropdown to select fusions
	//On select, toggle tabs for each gene appears underneath with the track for each gene
	const fusionSelect = div
		.append('div')
		.append('select')
		.style('border-radius', '5px')
		.style('padding', '5px 10px')
		.style('margin', '1px 10px 1px 10px')

	fusionSelect.append('option').text(`Select Fusion (${lines.length})`)

	const tabsDiv = div.append('div').style('margin', '20px')

	const fusionsMap = new Map()

	for (const data of lines) {
		try {
			const [gene1, gene2] = parseFusionLine(data)
			fusionsMap.set(`${gene1[0]}-${gene2[0]}`, [gene1, gene2])
		} catch (error) {
			console.warn(`Skipping invalid fusion line: ${data}. Error: ${error.message}`)
		}
	}

	if (fusionsMap.size === 0) {
		const errorDiv = div.append('div').style('color', 'red').style('margin', '20px')
		sayerror(errorDiv, 'No valid fusion lines found. Please check the format.')
		return
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
				const variant = createFusionVariant(gene1, gene2)
				const fusion_arg = {
					holder: tab.contentHolder.append('div').style('margin', '20px').node(),
					gene: gene1[0],
					tracks: [
						{
							type: 'mds3',
							name: gene1[0],
							custom_variants: [variant]
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
				const variant = createFusionVariant(gene1, gene2)
				const fusion_arg = {
					holder: tab.contentHolder.append('div').style('margin', '20px').node(),
					gene: gene2[0],
					tracks: [
						{
							type: 'mds3',
							name: gene2[0],
							custom_variants: [variant]
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
