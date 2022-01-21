import * as uiutils from './dom/uiUtils'
import { appear } from './dom/animation'
import { init_tabs } from './dom/toggleButtons'
import { getVocabFromSamplesArray } from './termdb/vocabulary'

/* 
Launches MASS UI by uploading a custom data dictionary

------ EXPORTED ------ 
init_dictionaryUI()
    - holder

------ Internal ------ 

doms:{}


Documentation: https://docs.google.com/document/d/19RwEbWi7Q1bGemz3XpcgylvGh2brT06GFcXxM6rWjI0/edit
*/

export function init_dictionaryUI(holder) {
	const wrapper = holder
		.append('div')
		.style('display', 'grid')
		.style('grid-template-columns', '250px auto')
		.style('grid-template-rows', 'repeat(1, auto)')
		.style('gap', '20px 10px')
		.style('margin', '20px')
		.style(
			'font-family',
			"'Lucida Sans', 'Lucida Sans Regular', 'Lucida Grande', 'Lucida Sans Unicode', Geneva, Verdana, sans-serif"
		)
		.style('place-items', 'center left')
		.style('overflow', 'hidden')

	const doms = {}

	//Data dictionary entry
	uiutils.makePrompt(wrapper, 'Data Dictionary')
	const tabs_div = wrapper.append('div')
	makeDataEntryTabs(tabs_div, doms)

	//Submit button and information section
	submitButton(wrapper, doms, holder)
	infoSection(wrapper)

	//Remove after testing
	window.doms = doms
}

function makeDataEntryTabs(tabs_div, doms) {
	const tabs = [
		{
			label: 'File Path',
			callback: async div => {
				if (!tabs[0].rendered) {
					div.style('border', 'none').style('display', 'block')
					const files_div = div
						.append('div')
						.style('border', 'none')
						.style('display', 'grid')
						.style('grid-template-columns', '200px auto')
						.style('grid-template-rows', 'repeat(1, auto)')
						.style('gap', '5px')
						.style('place-items', 'center left')
					appear(div)
					uiutils.makePrompt(files_div, 'Provide Filepath')
					makeTextEntryFilePathInput(files_div, doms)
					uiutils.makePrompt(files_div, 'Upload File')
					makeFileUpload(files_div, doms)
					tabs[0].rendered = true
				}
			}
		},
		{
			label: 'Provide Data',
			callback: async div => {
				if (!tabs[1].rendered) {
					div.style('border', 'none').style('display', 'block')
					div.append('div').html(`<p style="margin-left: 10px;">Paste Data</p>`)
					appear(div)
					makeCopyPasteInput(div, doms)
					tabs[1].rendered = true
				}
			}
		}
	]
	init_tabs({ holder: tabs_div.style('justify-content', 'center'), tabs })
}

function makeTextEntryFilePathInput(div, doms) {
	const filepath_div = div.append('div').style('display', 'inline-block')
	const filepath = uiutils
		.makeTextInput(filepath_div)
		.style('border', '1px solid rgb(138, 177, 212)')
		.on('keyup', async () => {
			doms.filepath = filepath.property('value').trim()
		})
}

function makeFileUpload(div, doms) {
	const upload_div = div.append('div').style('display', 'block')
	const upload = uiutils.makeFileUpload(upload_div)
}

function makeCopyPasteInput(div, doms) {
	const paste_div = div.append('div').style('display', 'block')
	const paste = uiutils
		.makeTextAreaInput(paste_div)
		.style('border', '1px solid rgb(138, 177, 212)')
		.style('margin', '0px 0px 0px 20px')
		.on('keyup', async () => {
			doms.pastedData = paste.property('value').trim()
		})
}

function submitButton(div, doms, holder) {
	const submit = uiutils.makeBtn(div, 'Submit')
	submit
		.style('margin', '20px 20px 20px 130px')
		.style('font-size', '16px')
		.on('click', () => {
			div.remove()
		})
}

function validateInput(doms) {}

function infoSection(div) {
	div
		.append('div')
		.style('margin', '10px')
		.style('opacity', '0.65')
		.style('grid-column', 'span 2').html(`<ul>
                <li>
                    TODO: 1) Fill out documentation 2) example file 3) Example?
                </li>
                <li>
                    Please see the<a href="https://docs.google.com/document/d/19RwEbWi7Q1bGemz3XpcgylvGh2brT06GFcXxM6rWjI0/edit" target="_blank">documentation</a> for more information.
                </li>
            </ul>`)
}
