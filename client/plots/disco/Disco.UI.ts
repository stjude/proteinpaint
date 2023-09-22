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

type DiscoPlotArgs = {
	genome: Genome
	dataType: string
	inputType: string
	data: any
}

export function init_discoplotUI(
	holder: Selection<HTMLDivElement, any, any, any>,
	genomes: Genome,
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

	const obj: Partial<DiscoPlotArgs> = {}

	//Genome drop down
	uiutils
		.makePrompt(wrapper, 'Select Genome')
		.style('font-size', '1.15em')
		.style('padding', '10px 0px')
		.style('color', '#003366')
	genomeSelection(wrapper, genomes, obj)

	//Data type (i.e. snv, cv, sv, etc.) drop down
	uiutils
		.makePrompt(wrapper, 'Choose Data Type')
		.style('font-size', '1.15em')
		.style('padding', '10px 0px')
		.style('color', '#003366')
	dataTypeSelection(wrapper, obj)

	//User provides data via tp file path, copy and paste, or adding a file
	uiutils
		.makePrompt(wrapper, 'Provide Data')
		.style('font-size', '1.15em')
		.style('padding', '10px 0px')
		.style('color', '#003366')
	const tabs_div = wrapper.append('div').style('margin-left', '2vw')
	makeDataInputTabs(tabs_div, obj)

	//Submit and reset button at the bottom.
	const controlBtns_div = wrapper
		.append('div')
		.style('display', 'flex')
		.style('align-items', 'center')
		.style('margin', '40px 0px 40px 130px')

	submitButton(controlBtns_div, obj, wrapper, holder)
	uiutils.makeResetBtn(controlBtns_div, obj, '.disco_input')

	//Remove after testing
	if (debugmode) (window as any).doms = obj
	return obj
}

function genomeSelection(div: Selection<HTMLDivElement, any, any, any>, genomes: Genome, obj: Partial<DiscoPlotArgs>) {
	const genome_div = div.append('div').style('margin-left', '40px')
	const g = uiutils.makeGenomeDropDown(genome_div, genomes).style('border', '1px solid rgb(138, 177, 212)')
	obj.genome = g.node()
}

function dataTypeSelection(div: Selection<HTMLDivElement, any, any, any>, obj: Partial<DiscoPlotArgs>) {
	const data_div = div.append('div').style('margin-left', '40px')
	const options = ['SNV', 'CNV', 'SV']
	const dataType = uiutils.makeDropDown(data_div, options).style('border', '1px solid rgb(138, 177, 212)')
	obj.dataType = dataType.node().value
}

type Tab = {
	contentHolder: Selection<HTMLDivElement, any, any, any>
	callback?: () => void
}

function makeDataInputTabs(tabs_div: Selection<HTMLDivElement, any, any, any>, obj = {}) {
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

				tab.contentHolder
					.append('div')
					.html(
						`<p style="margin-left: 10px; opacity: 0.65;">Paste data dictionary or phenotree in a tab delimited format.</p>`
					)
				makeCopyPasteInput(tab.contentHolder, obj)
				delete tab.callback
			}
		}
	]
	new Tabs({ holder: tabs_div, tabs }).main()
}

function makeTextEntryFilePathInput(div: Selection<HTMLDivElement, any, any, any>, obj: Partial<DiscoPlotArgs>) {
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

function makeFileUpload(div: Selection<HTMLDivElement, any, any, any>, obj: Partial<DiscoPlotArgs>) {
	// Renders the select file div and callback.
	const upload_div = div.append('div').style('display', 'inline-block')
	const upload = uiutils.makeFileUpload(upload_div).classed('disco_input', true)
	upload.on('change', (event: KeyboardEvent) => {
		const file = event.target?.files?.[0]
		const reader = new FileReader()
		reader.onload = (event: any) => {
			obj.data = event.target.result
			obj.inputType = 'File'
		}
		reader.readAsText(file, 'utf8')
	})
}

function makeCopyPasteInput(div: Selection<HTMLDivElement, any, any, any>, obj: Partial<DiscoPlotArgs>) {
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
	obj: Partial<DiscoPlotArgs>,
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
				setTimeout(() => sayerrorDiv.remove(), 3000)
			} else {
				wrapper.remove()
				const newProp = obj.dataType?.toLowerCase()! + obj.inputType!
				//Can add more args later
				const discoArg = { [newProp]: obj.data }
				launch(discoArg, obj.genome!, holder)
			}
		})
}
