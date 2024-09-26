import * as uiutils from '#dom/uiUtils'
import { Tabs } from '../../dom/toggleButtons'
import { appear } from '#dom/animation'
import { Selection } from 'd3-selection'
import { Genome } from '#types'
import { sayerror } from '../../dom/sayerror'
import { launch, DiscoPlotArgs } from './launch.adhoc'

/** Genome with dom attributes scoped for this file */
type ScopedGenomes = Genome & {
	options: any
	selectedIndex: number
}

/** Stored values for creating the args for launch() */
type DiscoUIArgs = {
	genome: ScopedGenomes
	/** equivalent of arg in launch.adhoc. */
	data: []
}

type Tab = {
	label: string
	/**constructs the property name in obj.data, which is later passed as the dataType + inputType (e.g. snvText) to launch.adhoc */
	key: string
	/**From tabs class*/
	contentHolder: Selection<HTMLDivElement, any, any, any>
	callback?: () => void
}
/**
 * Launches the disco plot form.
 * @param holder
 * @param genomes
 * @param debugmode
 * @returns
 */
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
		.classed('sjpp-disco-ui', true)

	const obj: Partial<DiscoUIArgs> = {
		data: []
	}

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
		.style('padding', '10px 0px 5px 0px')
		.style('color', '#003366')
	wrapper
		.append('div')
		.style('opacity', 0.75)
		.style('padding', '10px 10px 15px 20px')
		.style('width', '65vw')
		.style('line-height', '1.5em')
		.html(
			'<p>The plot accepts multiple data types. Input fields for each data type are available in the tabs below. Upload a file or paste data in at least one data type tab and click "Create Disco Plot". <a href="https://proteinpaint.stjude.org/ppdemo/hg38/disco/discoDemoData.tar.gz" target="Demo data">Download example files</a></p>'
		)

	const dataTypeTabs_div = wrapper.append('div').style('margin-left', '2vw')
	makeDataTypeTabs(dataTypeTabs_div, obj)

	//Submit and reset button at the bottom.
	const controlBtns_div = wrapper
		.append('div')
		.style('display', 'flex')
		.style('align-items', 'center')
		.style('padding', '15px 0px')

	submitButton(controlBtns_div, obj, genomes, wrapper, holder)
	uiutils.makeResetBtn(controlBtns_div, obj, '.disco_input')

	//Remove after testing
	if (debugmode) window['doms'] = obj
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

/**
 * Makes the main tabs labeled by data type (e.g. SNV indel, SV, CNV, etc.)
 * @param dataTypeTabs_div
 * @param obj
 */

function makeDataTypeTabs(dataTypeTabs_div: Selection<HTMLDivElement, any, any, any>, obj: Partial<DiscoUIArgs>) {
	const tabs = [
		{
			label: 'SNV Indel',
			active: true,
			callback: async (event: MouseEvent, dataTypeTab: Tab) => {
				/** Event though event is not required, stops type error??? */
				dataTypeTab.key = 'snv'
				/**Leave the weird spacing for <pre>! Otherwise it doesn't display properly on the client
				 * and the user can't copy and paste the example data.*/
				const listHTML = `<ol>
					<li>chr</li>
					<li>position</li>
					<li>gene</li>
					<li>aachange</li>
					<li>class</li></ol>
					<p>Example:</p>
<pre style="margin-left: 10px;">
chr1	226252135	H3F3A	K28M	M
chr2	98765432	TestGene	TestMutation	F
</pre>`
				mainTabCallback(dataTypeTab, obj, listHTML)
			}
		},
		{
			label: 'SV',
			active: false,
			callback: async (event: MouseEvent, dataTypeTab: Tab) => {
				dataTypeTab.key = 'sv'
				const listHTML = `<ol>
					<li>chrA</li>
					<li>posA</li>
					<li>geneA (optional)</li>
					<li>chrB</li>
					<li>posB</li>
					<li>geneB (optional)</li>
				</ol>
				<p>Example (with genes):</p>
<pre style="margin-left: 10px;">
chr6	3067605	MDC1	chr12	61521661	KMT2D
</pre>
				<p>Example (without genes):</p>
<pre style="margin-left: 10px;">
chr6	3067605	chr12	61521661
</pre>`
				mainTabCallback(dataTypeTab, obj, listHTML)
			}
		},
		{
			label: 'CNV',
			active: false,
			callback: async (event: MouseEvent, dataTypeTab: Tab) => {
				dataTypeTab.key = 'cnv'
				const listHTML = `<ol>
				<li>chr</li>
				<li>start</li>
				<li>stop</li>
				<li>value</li>
				</ol>
				<p>Example:</p>
<pre style="margin-left: 10px;">
chr1	1	100000000	0.5
chr1	100000000	200000000	-0.5
</pre>`
				mainTabCallback(dataTypeTab, obj, listHTML)
			}
		}
	]

	new Tabs({ holder: dataTypeTabs_div, tabs, tabsPosition: 'vertical', linePosition: 'right' }).main()
}

/**
 * Creates the contents for the main tabs in a consistent layout.
 * @param dataTypeTab
 * @param obj
 * @param listHTML
 */
function mainTabCallback(dataTypeTab: Tab, obj: Partial<DiscoUIArgs>, listHTML: any) {
	dataTypeTab.contentHolder.style('border', 'none').style('display', 'block').style('padding-left', '30px')
	makeDataInputTabs(dataTypeTab, obj)

	dataTypeTab.contentHolder
		.append('div')
		.style('padding', '15px 0px 0px 10px')
		.style('opacity', 0.75)
		.text(`Provide ${dataTypeTab.label} data in tab delimited format with the following columns:`)
		.append('span')
		.html(listHTML)
	delete dataTypeTab.callback
}

/**
 * Creates the different input tabs within the data type tabs. Users are able to upload a file or paste data.
 * TODO: add option to provide a file path from server or url
 * @param dataTypeTab
 * @param obj
 */
function makeDataInputTabs(dataTypeTab: Tab, obj: Partial<DiscoUIArgs>) {
	const width = 95
	const tabs = [
		// //TODO: implement file upload and file path input once launch.adhoc is ready
		{
			label: 'Select File',
			active: true,
			width,
			callback: async (event: MouseEvent, tab: Tab) => {
				const key = dataTypeTab.key
				tab.contentHolder.style('border', 'none').style('display', 'block')
				appear(tab.contentHolder)

				tab.contentHolder
					.append('div')
					.style('padding', '0px 0px 5px 15px')
					.style('opacity', 0.65)
					.text(`Select a local file`)
				makeFileUpload(tab, obj, key)

				delete tab.callback
			}
		},
		// {
		// 	label: 'File Path',
		// 	active: false,
		// 	width,
		// 	callback: async (tab: Tab) => {
		// 		const key = dataTypeTab.key
		// 		tab.contentHolder.style('border', 'none').style('display', 'block')
		// 		appear(tab.contentHolder)

		// 		tab.contentHolder
		// 			.append('div')
		// 			.html(`<p style="margin-left: 10px; opacity: 0.65;">Provide a URL file path.</p>`)
		// 		uiutils.makePrompt(tab.contentHolder, 'URL')
		// 		makeTextEntryFilePathInput(tab.contentHolder, obj, key)

		// 		delete tab.callback
		// 	}
		// },
		{
			label: 'Paste Data',
			active: false,
			width,
			callback: async (event: MouseEvent, tab: Tab) => {
				const key = dataTypeTab.key
				tab.contentHolder.style('border', 'none').style('display', 'block')
				appear(tab.contentHolder)

				makeCopyPasteInput(tab, obj, key)
				delete tab.callback
			}
		}
	]
	new Tabs({ holder: dataTypeTab.contentHolder, tabs }).main()
}

// function makeTextEntryFilePathInput(tab: Tab, obj: Partial<DiscoUIArgs>, key: string) {
// 	// Renders the file path input div and callback.
// 	const filepath_div = tab.contentHolder.append('div').style('display', 'inline-block')
// 	const filepath = uiutils
// 		.makeTextInput(filepath_div)
// 		.style('border', '1px solid rgb(138, 177, 212)')
// 		.classed('disco_input', true)
// 		.on('keyup', async () => {
// 			const data = filepath.property('value').trim()
// 			if (uiutils.isURL(data)) {
// 				await fetch(data)
// 					.then(req => req.text())
// 					.then(text => {
// 						obj.data![key + 'Url'] = text
// 					})
// 			} else {
// 				//TODO: implement serverside filepaths(?)
// 			}
// 		})
// }

/**
 * Renders the select file div. Callback captures file text as a string.
 * ?TODO: maybe allow other file types and detect the delimiter (uiutils.detectDelimiter)
 * @param tab
 * @param obj
 * @param key
 */
function makeFileUpload(tab: Tab, obj: Partial<DiscoUIArgs>, key: string) {
	const upload_div = tab.contentHolder.append('div').style('display', 'inline-block')
	const upload = uiutils.makeFileUpload(upload_div).classed('disco_input', true)
	upload.on('change', (event: KeyboardEvent) => {
		const file = (event.target as any).files[0]
		const reader = new FileReader()
		reader.onload = (event: any) => {
			obj.data![key + 'Text'] = event.target.result
		}
		reader.readAsText(file, 'utf8')
	})
}

/**
 * Renders the copy/paste div and callback.
 * @param tab
 * @param obj
 * @param key
 */
function makeCopyPasteInput(tab: Tab, obj: Partial<DiscoUIArgs>, key: string) {
	const paste_div = tab.contentHolder.append('div').style('display', 'block')
	const paste = uiutils
		.makeTextAreaInput({ div: paste_div, cols: 50 })
		.style('border', '1px solid rgb(138, 177, 212)')
		.style('margin', '0px 0px 0px 20px')
		.classed('disco_input', true)
		.on('keyup', async () => {
			obj.data![key + 'Text'] = paste.property('value').trim()
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
				const genomeObj = genomes[obj.genome!.options[obj.genome!.selectedIndex].text]
				wrapper.remove()
				/** launch() validates data and returns errors to the browser */
				launch(obj.data as DiscoPlotArgs, genomeObj, holder)
				backButton(holder, genomes)
			}
		})
}

function backButton(holder: Selection<HTMLDivElement, any, any, any>, genomes: any) {
	holder
		.append('button')
		.html('&#171; Back')
		.on('click', () => {
			holder.selectAll('*').remove()
			init_discoplotUI(holder, genomes, false)
		})
}
