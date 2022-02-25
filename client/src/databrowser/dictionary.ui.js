import * as uiutils from '../dom/uiUtils'
import { appear } from '../dom/animation'
import { init_tabs } from '../dom/toggleButtons'
import { event as d3event } from 'd3-selection'
import { appInit } from '../mass/app'
import { parseDictionary } from './dictionary.parse'

/* 
Launches MASS UI by uploading a custom data dictionary

------ EXPORTED ------ 
init_dictionaryUI()
    - holder

------ Internal ------ 
UI elements:
	1. makeDataEntryTabs()
		a. makeTextEntryFilePathInput()
		b. makeFileUpload()
		c. makeCopyPasteInput()
	2. submitButton()
	3. infoSection()
Data parsing:
	1. parseTabDelimitedData()
Phenotree parsing:
	1. parseConfig()

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

	infoSection(wrapper)

	//Data dictionary section
	makeSectionHeader(wrapper, 'Data Dictionary')
	const tabs_div = wrapper.append('div').style('margin-left', '2vw')
	makeDataEntryTabs(holder, tabs_div, obj)

	//Submit button and information section
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
	// .style('grid-column', 'span 2')
	div
		.append('div')
		.style('margin', '10px')
		.style('opacity', '0.65').html(`<p>Information Section</p>
				<ul>
                <li>
                    TODO: 1) Fill out documentation 2) example file 3) Example?
                </li>
                <li>
                    Please see the <a href="https://docs.google.com/document/d/19RwEbWi7Q1bGemz3XpcgylvGh2brT06GFcXxM6rWjI0/edit" target="_blank">documentation</a> for more information.
                </li>
            </ul>`)
}

function makeSectionHeader(div, text) {
	const header = uiutils.makePrompt(div, text)
	header
		.style('font-size', '1.5em')
		.style('color', '#003366')
		.style('margin', '20px 10px 40px 10px')
	const hr = div.append('hr')
	hr.style('color', 'ligthgrey')
		.style('margin', '-30px 0px 15px 0px')
		.style('width', '50vw')
		.style('opacity', '0.4')
}

function makeDataEntryTabs(holder, tabs_div, obj) {
	const tabs = [
		{
			label: 'File Path',
			callback: async div => {
				if (!tabs[0].rendered) {
					div.style('border', 'none').style('display', 'block')
					uiutils.makePrompt(div, 'URL')
					makeTextEntryFilePathInput(holder, div, obj)
					// div.append('div').html(`<p style="opacity:0.65;">Provide either a URL filepath or upload a file.</p>`)
					// const files_div = div
					// 	.append('div')
					// 	.style('border', 'none')
					// 	.style('display', 'grid')
					// 	.style('grid-template-columns', '100px auto')
					// 	.style('grid-template-rows', 'repeat(1, auto)')
					// 	.style('gap', '5px')
					// 	.style('place-items', 'center left')
					// 	.style('margin-left', '15px')
					// appear(div)
					// uiutils.makePrompt(files_div, 'URL')
					// makeTextEntryFilePathInput(holder, files_div, obj)
					// files_div.append('div')
					// 	.style('margin', '5px 0px 5px 35px')
					// 	.style('opacity', '0.65')
					// 	.style('grid-column', 'span 2')
					// 	.style('font-style', 'oblique')
					// 	.text('or')
					// uiutils.makePrompt(files_div, 'Upload')
					// makeFileUpload(holder, files_div, obj)
					tabs[0].rendered = true
				}
			}
		},
		{
			label: 'Upload File',
			callback: async div => {
				if (!tabs[1].rendered) {
					div.style('border', 'none').style('display', 'block')
					appear(div)
					// uiutils.makePrompt(div, 'Upload')
					makeFileUpload(holder, div, obj)
					tabs[1].rendered = true
				}
			}
		},
		{
			label: 'Paste Data',
			callback: async div => {
				if (!tabs[2].rendered) {
					div.style('border', 'none').style('display', 'block')
					div
						.append('div')
						.html(`<p style="margin-left: 10px; opacity: 0.65;">Paste data dictionary in a tab delimited format.</p>`)
					appear(div)
					makeCopyPasteInput(holder, div, obj)
					tabs[2].rendered = true
				}
			}
		}
	]
	init_tabs({ holder: tabs_div, tabs })
}

function makeTextEntryFilePathInput(holder, div, obj) {
	const filepath_div = div.append('div').style('display', 'inline-block')
	const filepath = uiutils
		.makeTextInput(filepath_div)
		.style('border', '1px solid rgb(138, 177, 212)')
		.on('keyup', async () => {
			const data = filepath.property('value').trim()
			if (uiutils.isURL(data)) {
				fetch(data)
					.then(req => req.text())
					.then(txt => {
						obj.data = parseDictionary(holder, txt)
					})
			} else {
				//TODO: implement serverside filepaths(?)
			}
		})
}

function makeFileUpload(holder, div, obj) {
	const upload_div = div.append('div').style('display', 'inline-block')
	const upload = uiutils.makeFileUpload(upload_div)
	upload.on('change', () => {
		const file = d3event.target.files[0]
		const reader = new FileReader()
		reader.onload = event => {
			obj.data = parseDictionary(holder, event.target.result)
		}
		reader.readAsText(file, 'utf8')
	})
}

function makeCopyPasteInput(holder, div, obj) {
	const paste_div = div.append('div').style('display', 'block')
	const paste = uiutils
		.makeTextAreaInput(paste_div, '', 10, 70)
		.style('border', '1px solid rgb(138, 177, 212)')
		.style('margin', '0px 0px 0px 20px')
		.on('keyup', async () => {
			obj.data = parseDictionary(holder, paste.property('value').trim())
		})
}

/*
 **** Submission Functions ****
 */

function submitButton(div, obj, holder) {
	const submit = uiutils.makeBtn(div, 'Create Data Browser', 'white', '#001aff', '2px solid #001aff')
	submit
		.style('margin', '40px 20px 40px 130px')
		.style('font-size', '16px')
		.on('click', () => {
			// if (!obj.data) {
			// 	alert('Please provide data')
			// }
			// if (!obj.data.length || obj.data == undefined) {
			// 	throw 'No data provided' // Show user error with alert above and prevent form from disappearing
			// }
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
