import * as uiutils from '#dom/uiUtils'
import { appear } from '#dom/animation'
import { Tabs } from '../../dom/toggleButtons'
import { appInit } from '#mass/app'
import { parseDictionary } from './dictionary.parse'
import { sayerror } from '../client'

/* 
Launches MASS UI by uploading a custom data dictionary

------ EXPORTED ------ 
init_dictionaryUI()
    - holder

------ Internal ------ 
UI elements:
	- infoSection()
	- makeDataDictionaryTabs()
		a. makeTextEntryFilePathInput()
		b. makeFileUpload()
		c. makeCopyPasteInput()
	- submitButton()

obj:{ data:[ {terms} ] }
*/

export function init_databrowserUI(holder, debugmode) {
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

	//Information section for user with documentation and example
	infoSection(wrapper)

	//Data dictionary section
	makeSectionHeader(wrapper, 'Data Dictionary')
	const tabs_div = wrapper.append('div').style('margin-left', '2vw')
	makeDataDictionaryTabs(tabs_div, obj)

	//Submit and reset button at the bottom.
	const controlBtns_div = wrapper
		.append('div')
		.style('display', 'flex')
		.style('align-items', 'center')
		.style('margin', '40px 0px 40px 130px')

	submitButton(controlBtns_div, obj, wrapper, holder)
	uiutils.makeResetBtn(controlBtns_div, obj, '.databrowser_input')

	//Remove after testing
	if (debugmode) window.doms = obj
	return obj
}

function infoSection(div) {
	div.append('div').style('margin', '10px').style('opacity', '0.65').html(`
			<ul>
                <li>
                    Please see the <a href="https://github.com/stjude/proteinpaint/wiki/Data-Browser" target="_blank">documentation</a> for more information.
                </li>
				<li>
					Download an example data dictionary <a href="https://proteinpaint.stjude.org/ppdemo/databrowser/dictionaryDemoData.tar.gz" target="_self" "download>here</a>.
				</li>
            </ul>`)
}
//Use function more as UI exapands
function makeSectionHeader(div, text) {
	const header = uiutils.makePrompt(div, text)
	header
		.style('font-size', '1.5em')
		.style('color', '#003366')
		.style('margin', '20px 10px 40px 10px')
		.classed('sjpp-databrowser-section-header', true)
	const hr = div.append('hr')
	hr.style('color', 'ligthgrey').style('margin', '-30px 0px 15px 0px').style('width', '50vw').style('opacity', '0.4')
}

function makeDataDictionaryTabs(tabs_div, obj) {
	// Creates the horizontal top tabs and callbacks for the data dictionary section
	// Rendering code and callback to the same parseDictionary().
	// All data parsed in client and returned to obj.data
	const tabs = [
		{
			label: 'Select File',
			active: true,
			width: 95,
			callback: async (event, tab) => {
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
			label: 'Paste Data',
			active: false,
			width: 95,
			callback: async (event, tab) => {
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
		},
		{
			label: 'File Path',
			active: false,
			width: 95,
			callback: async (event, tab) => {
				tab.contentHolder.style('border', 'none').style('display', 'block')
				appear(tab.contentHolder)

				tab.contentHolder
					.append('div')
					.html(`<p style="margin-left: 10px; opacity: 0.65;">Provide a URL file path.</p>`)
				uiutils.makePrompt(tab.contentHolder, 'URL')
				makeTextEntryFilePathInput(tab.contentHolder, obj)

				delete tab.callback
			}
		}
	]
	new Tabs({ holder: tabs_div, tabs }).main()
}

function makeTextEntryFilePathInput(div, obj) {
	// Renders the file path input div and callback.
	const filepath_div = div.append('div').style('display', 'inline-block')
	const filepath = uiutils
		.makeTextInput(filepath_div)
		.style('border', '1px solid rgb(138, 177, 212)')
		.classed('databrowser_input', true)
		.on('keyup', async () => {
			const data = filepath.property('value').trim()
			if (uiutils.isURL(data)) {
				const txt = await fetch(data)
					.then(req => req.text())
					.then(txt => {
						obj.data = parseDictionary(txt)
					})
			} else {
				//TODO: implement serverside filepaths(?)
			}
		})
}

function makeFileUpload(div, obj) {
	// Renders the select file div and callback.
	const upload_div = div.append('div').style('display', 'inline-block')
	const upload = uiutils.makeFileUpload(upload_div).classed('databrowser_input', true)
	upload.on('change', event => {
		const file = event.target.files[0]
		const reader = new FileReader()
		reader.onload = event => {
			obj.data = parseDictionary(event.target.result)
		}
		reader.readAsText(file, 'utf8')
	})
}

function makeCopyPasteInput(div, obj) {
	// Renders the copy/paste div and callback.
	const paste_div = div.append('div').style('display', 'block')
	const paste = uiutils
		.makeTextAreaInput({ div: paste_div, rows: 10 })
		.style('border', '1px solid rgb(138, 177, 212)')
		.style('margin', '0px 0px 0px 20px')
		.classed('databrowser_input', true)
		.on('keyup', async () => {
			obj.data = parseDictionary(paste.property('value').trim())
		})
}

/*
 **** Submission Functions ****
 */

function submitButton(div, obj, wrapper, holder) {
	const submit = uiutils.makeBtn({
		div,
		text: 'Create Data Browser',
		color: 'white',
		backgroundColor: '#001aff',
		border: '2px solid #001aff'
	})
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
				appInit({
					holder: holder,
					state: {
						vocab: {
							terms: obj.data.terms
						},
						plots: [
							{
								chartType: 'dictionary'
							}
						]
					}
				})
			}
		})
}
