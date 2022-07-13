import * as uiutils from '../../dom/uiUtils'
import { appear } from '../../dom/animation'
import { init_tabs } from '../../dom/toggleButtons'
import { event as d3event } from 'd3-selection'
import { appInit } from '../../mass/app'
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


Documentation: https://docs.google.com/document/d/19RwEbWi7Q1bGemz3XpcgylvGh2brT06GFcXxM6rWjI0/edit


Long term plans: 
Will include sample annotation matrix, longitudinal data, sample ID hierarcy and molecular data (see old sketch: https://docs.google.com/drawings/d/1x3BgBbUF2ChkOGCXkA-fW8r46EbT_ZEqNZgwyTXLTXE/edit)
*/

export function init_dictionaryUI(holder, debugmode) {
	const wrapper = holder
		.append('div')
		.style('margin', '20px 20px 20px 40px')
		.style(
			'font-family',
			"'Lucida Sans', 'Lucida Sans Regular', 'Lucida Grande', 'Lucida Sans Unicode', Geneva, Verdana, sans-serif"
		)
		.style('place-items', 'center left')
		.style('overflow', 'hidden')

	const obj = {}

	//Information section for user with documentation and example
	infoSection(wrapper)

	//Data dictionary section
	makeSectionHeader(wrapper, 'Data Dictionary')
	const tabs_div = wrapper.append('div').style('margin-left', '2vw')
	makeDataDictionaryTabs(tabs_div, obj)

	//Submit button
	submitButton(wrapper, obj, holder)

	//Remove after testing
	if (debugmode) window.doms = obj
}

//TODO later
// function makeResetBtn(div, obj) {
// 	const reset = uiutils.makeBtn(div, '↺')
// 	reset
// 		.style('grid-column', 'span 2')
// 		.style('align-self', 'right')
// 		.on('click', () => {
// 			Object.keys(obj).forEach(key => delete obj[key])
// 	})
// }

function infoSection(div) {
	div
		.append('div')
		.style('margin', '10px')
		.style('opacity', '0.65').html(`
			<ul>
                <li>
                    Please see the <a href="https://docs.google.com/document/d/19RwEbWi7Q1bGemz3XpcgylvGh2brT06GFcXxM6rWjI0/edit" target="_blank">documentation</a> for more information.
                </li>
				<li>
					Download an example data dictionary <a href="https://pecan.stjude.cloud/static/proteinpaint_demo/databrowser/dictionaryDemoData.tar.gz" target="_self" "download>here</a>.
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
	hr.style('color', 'ligthgrey')
		.style('margin', '-30px 0px 15px 0px')
		.style('width', '50vw')
		.style('opacity', '0.4')
}

function makeDataDictionaryTabs(tabs_div, obj) {
	// Creates the horizontal top tabs and callbacks for the data dictionary section
	// Rendering code and callback to the same parseDictionary().
	// All data parsed in client and returned to obj.data
	const tabs = [
		{
			label: 'Select File',
			callback: async div => {
				if (!tabs[1].rendered) {
					div.style('border', 'none').style('display', 'block')
					appear(div)
					div.append('div').html(`<p style="margin-left: 10px; opacity: 0.65;">Select a file from your computer.</p>`)
					makeFileUpload(div, obj)
					tabs[1].rendered = true
				}
			}
		},
		{
			label: 'Paste Data',
			callback: async div => {
				if (!tabs[2].rendered) {
					div.style('border', 'none').style('display', 'block')
					appear(div)
					div
						.append('div')
						.html(
							`<p style="margin-left: 10px; opacity: 0.65;">Paste data dictionary or phenotree in a tab delimited format.</p>`
						)
					makeCopyPasteInput(div, obj)
					tabs[2].rendered = true
				}
			}
		},
		{
			label: 'File Path',
			callback: async div => {
				if (!tabs[0].rendered) {
					div.style('border', 'none').style('display', 'block')
					appear(div)
					div.append('div').html(`<p style="margin-left: 10px; opacity: 0.65;">Provide a URL file path.</p>`)
					uiutils.makePrompt(div, 'URL')
					makeTextEntryFilePathInput(div, obj)
					tabs[0].rendered = true
				}
			}
		}
	]
	init_tabs({ holder: tabs_div, tabs })
}

function makeTextEntryFilePathInput(div, obj) {
	// Renders the file path input div and callback.
	const filepath_div = div.append('div').style('display', 'inline-block')
	const filepath = uiutils
		.makeTextInput(filepath_div)
		.style('border', '1px solid rgb(138, 177, 212)')
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
	const upload = uiutils.makeFileUpload(upload_div)
	upload.on('change', () => {
		const file = d3event.target.files[0]
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
		.makeTextAreaInput(paste_div, '', 10, 70)
		.style('border', '1px solid rgb(138, 177, 212)')
		.style('margin', '0px 0px 0px 20px')
		.on('keyup', async () => {
			obj.data = parseDictionary(paste.property('value').trim())
		})
}

/*
 **** Submission Functions ****
 */

function submitButton(div, obj, holder) {
	const submit = uiutils.makeBtn({
		div,
		text: 'Create Data Browser',
		color: 'white',
		backgroundColor: '#001aff',
		border: '2px solid #001aff'
	})
	submit
		.style('margin', '40px 20px 40px 130px')
		.style('font-size', '16px')
		.classed('sjpp-ui-submitBtn', true)
		.on('click', () => {
			if (!obj.data || obj.data == undefined) {
				alert('Please provide data')
				throw 'No data provided'
			}
			div.remove()
			console.log(449, obj.data.terms)
			appInit({
				holder: holder,
				state: {
					vocab: {
						terms: obj.data.terms
					}
				}
			})
		})
}
