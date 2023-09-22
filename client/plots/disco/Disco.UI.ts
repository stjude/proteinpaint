import * as uiutils from '#dom/uiUtils'
import { Tabs } from '#dom/toggleButtons'
import { appear } from '#dom/animation'
import { Selection } from 'd3-selection'
import { Genome } from '#shared/types/index'
import { sayerror } from '#src/client'
import { launch } from './launch.adhoc'

/*
-------EXPORTED-------
init_discoplotUI()

-------Internal-------

*/

/** Genome with dom attributes scoped for this file */
type ScopedGenomes = Genome & {
	options: any
	selectedIndex: number
}

/** Stored values for creating the args for launch() */
type DiscoUIArgs = {
	genome: ScopedGenomes
	/** Dependent on how the user inputs their data. Creates the second half the disco plot arg for launch() */
	inputType: 'Text' | 'File' | 'Url'
	data: string
}

export function init_discoplotUI(
	holder: Selection<HTMLDivElement, any, any, any>,
	genomes: ScopedGenomes,
	debugmode: boolean
) {
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

	const obj: Partial<DiscoUIArgs> = {}

	//Genome drop down
	uiutils
		.makePrompt(wrapper, 'Select Genome')
		.style('font-size', '1.15em')
		.style('padding', '10px 0px')
		.style('color', '#003366')
	genomeSelection(wrapper, genomes, obj)

	//Data type vertical tabs followed by input type horizontal tabs in the content holder
	//User clicks the data type (e.g. 'CNV'), then the input type (e.g. 'Paste')
	uiutils
		.makePrompt(wrapper, 'Provide Data')
		.style('font-size', '1.15em')
		.style('padding', '10px 0px')
		.style('color', '#003366')
	const tabs_div = wrapper.append('div').style('margin-left', '2vw')
	makeDataTypeTabs(tabs_div, obj)

	//Submit and reset button at the bottom.
	const controlBtns_div = wrapper
		.append('div')
		.style('display', 'flex')
		.style('align-items', 'center')
		.style('margin', '40px 0px 40px 130px')

	submitButton(controlBtns_div, obj, genomes, wrapper, holder)
	uiutils.makeResetBtn(controlBtns_div, obj, '.disco_input')

	//Remove after testing
	if (debugmode) (window as any).doms = obj
	return obj
}

function genomeSelection(
	div: Selection<HTMLDivElement, any, any, any>,
	genomes: ScopedGenomes,
	obj: Partial<DiscoUIArgs>
) {
	const genome_div = div.append('div').style('margin-left', '40px')
	const g = uiutils.makeGenomeDropDown(genome_div, genomes).style('border', '1px solid rgb(138, 177, 212)')
	//dom genome options, not the genome obj
	obj.genome = g.node()
}

type Tab = {
	label: string
	contentHolder: Selection<HTMLDivElement, any, any, any>
	callback?: () => void
}

function makeDataTypeTabs(tabs_div: Selection<HTMLDivElement, any, any, any>, obj: Partial<DiscoUIArgs>) {
	const tabs = [
		{
			label: 'SNV',
			active: true,
			callback: async (event: MouseEvent, tab: Tab) => {
				/**values for htmlHints are used as prompts for the pasting data tab. 
				 Each one is specific to the data type (i.e. tab.label) */
				const htmlHint = `<p style="margin-left: 10px; opacity: 0.65;">Paste SNV data in tab delimited format. the columns should include:</p>
				<ol style="margin-left: 10px; opacity: 0.65;">
					<li>chr</li>
					<li>position</li>
					<li>gene</li>
					<li>aachange</li>
					<li>class</li>
				</ol>`
				mainTabCallback(tab, obj, htmlHint)
			}
		},
		{
			label: 'SV',
			active: true,
			callback: async (event: MouseEvent, tab: Tab) => {
				const htmlHint = `<p style="margin-left: 10px; opacity: 0.65;">Paste SV data in tab delimited format. the columns should include:</p>
				<ol style="margin-left: 10px; opacity: 0.65;">
					<li>chrA</li>
					<li>posA</li>
					<li>chrB</li>
					<li>posB</li>
					<li>geneA</li>
					<li>geneB</li>
				</ol>`
				mainTabCallback(tab, obj, htmlHint)
			}
		},
		{
			label: 'CNV',
			active: true,
			callback: async (event: MouseEvent, tab: Tab) => {
				const htmlHint = `<p style="margin-left: 10px; opacity: 0.65;">Paste CNV data in tab delimited format. the columns should include:</p>
				<ol style="margin-left: 10px; opacity: 0.65;">
					<li>chr</li>
					<li>start</li>
					<li>stop</li>
					<li>value</li>
				</ol>`
				mainTabCallback(tab, obj, htmlHint)
			}
		}
	]

	new Tabs({ holder: tabs_div, tabs, tabsPosition: 'vertical', linePosition: 'right' }).main()
}

function mainTabCallback(tab: Tab, obj: Partial<DiscoUIArgs>, htmlHint: any) {
	tab.contentHolder.style('border', 'none').style('display', 'block').style('padding', '5px 0px 0px 30px')
	makeDataInputTabs(tab.contentHolder, obj, htmlHint)
	delete tab.callback
}

function makeDataInputTabs(
	tabs_div: Selection<HTMLDivElement, any, any, any>,
	obj: Partial<DiscoUIArgs>,
	htmlHint: any
) {
	const tabs = [
		{
			label: 'Select File',
			active: true,
			width: 95,
			callback: async (event: MouseEvent, tab: Tab) => {
				tab.contentHolder.style('border', 'none').style('display', 'block')
				appear(tab.contentHolder)

				tab.contentHolder
					.append('div')
					.html(`<p style="margin-left: 10px; opacity: 0.65;">Select a file from your computer.</p>`)
				makeFileUpload(tab.contentHolder, obj)

				delete tab.callback
			}
		},
		{
			label: 'File Path',
			active: false,
			width: 95,
			callback: async (event: MouseEvent, tab: Tab) => {
				tab.contentHolder.style('border', 'none').style('display', 'block')
				appear(tab.contentHolder)

				tab.contentHolder
					.append('div')
					.html(`<p style="margin-left: 10px; opacity: 0.65;">Provide a URL file path.</p>`)
				uiutils.makePrompt(tab.contentHolder, 'URL')
				makeTextEntryFilePathInput(tab.contentHolder, obj)

				delete tab.callback
			}
		},
		{
			label: 'Paste Data',
			active: false,
			width: 95,
			callback: async (event: MouseEvent, tab: Tab) => {
				tab.contentHolder.style('border', 'none').style('display', 'block')
				appear(tab.contentHolder)

				tab.contentHolder.append('div').html(htmlHint)
				makeCopyPasteInput(tab.contentHolder, obj)
				delete tab.callback
			}
		}
	]
	new Tabs({ holder: tabs_div, tabs }).main()
}

function makeTextEntryFilePathInput(div: Selection<HTMLDivElement, any, any, any>, obj: Partial<DiscoUIArgs>) {
	// Renders the file path input div and callback.
	const filepath_div = div.append('div').style('display', 'inline-block')
	const filepath = uiutils
		.makeTextInput(filepath_div)
		.style('border', '1px solid rgb(138, 177, 212)')
		.classed('disco_input', true)
		.on('keyup', async () => {
			const data = filepath.property('value').trim()
			if (uiutils.isURL(data)) {
				await fetch(data)
					.then(req => req.text())
					.then(text => {
						obj.data = text
						obj.inputType = 'Url'
					})
			} else {
				//TODO: implement serverside filepaths(?)
			}
		})
}

function makeFileUpload(div: Selection<HTMLDivElement, any, any, any>, obj: Partial<DiscoUIArgs>) {
	// Renders the select file div and callback.
	const upload_div = div.append('div').style('display', 'inline-block')
	const upload = uiutils.makeFileUpload(upload_div).classed('disco_input', true)
	upload.on('change', (event: KeyboardEvent) => {
		const file = (event.target as any).files[0]
		const reader = new FileReader()
		reader.onload = (event: any) => {
			obj.data = event.target.result
			obj.inputType = 'File'
		}
		reader.readAsText(file, 'utf8')
	})
}

function makeCopyPasteInput(div: Selection<HTMLDivElement, any, any, any>, obj: Partial<DiscoUIArgs>) {
	// Renders the copy/paste div and callback.
	const paste_div = div.append('div').style('display', 'block')
	const paste = uiutils
		.makeTextAreaInput({ div: paste_div, rows: 10 })
		.style('border', '1px solid rgb(138, 177, 212)')
		.style('margin', '0px 0px 0px 20px')
		.classed('disco_input', true)
		.on('keyup', async () => {
			obj.data = paste.property('value').trim()
			obj.inputType = 'Text'
		})
}

function submitButton(
	div: Selection<HTMLDivElement, any, any, any>,
	obj: Partial<DiscoUIArgs>,
	genomes: any,
	wrapper: Selection<HTMLDivElement, any, any, any>,
	holder: Selection<HTMLDivElement, any, any, any>
) {
	const submit = uiutils.makeBtn({ div, text: 'Create Disco Plot' })
	const errorMessage_div = div.append('div')
	submit
		.style('margin-right', '10px')
		.style('font-size', '16px')
		.classed('sjpp-ui-submitBtn', true)
		.attr('type', 'submit')
		.on('click', () => {
			if (!obj.data || obj.data == undefined) {
				const sayerrorDiv = errorMessage_div.append('div').style('display', 'inline-block').style('max-width', '20vw')
				sayerror(sayerrorDiv, 'Please provide data')
				setTimeout(() => sayerrorDiv.remove(), 2000)
			} else {
				const dataType = (wrapper as any)
					.select('.sj-toggle-button.sjpp-active')
					.node()!
					.childNodes[0].innerHTML.toLowerCase()
				const newProp = dataType! + obj.inputType!
				//Can add more args later
				const discoArg = { [newProp]: obj.data }
				const genomeObj = genomes[obj.genome!.options[obj.genome!.selectedIndex].text]

				wrapper.remove()
				launch(discoArg, genomeObj, holder)
			}
		})
}
