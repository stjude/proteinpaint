import * as uiutils from './dom/uiUtils'
import { appear } from './dom/animation'
import { init_tabs } from './dom/toggleButtons'
import { event as d3event } from 'd3-selection'
import { getVocabFromSamplesArray } from './termdb/vocabulary'

/* 
Launches MASS UI by uploading a custom data dictionary

------ EXPORTED ------ 
init_dictionaryUI()
    - holder

------ Internal ------ 
TODO

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
	init_tabs({ holder: tabs_div, tabs })
}

function makeTextEntryFilePathInput(div, doms) {
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
						parseTabDelimitedData(txt, doms)
					})
			} else {
				//TODO: implement serverside filepaths(?)
			}
		})
}

function makeFileUpload(div, doms) {
	const upload_div = div.append('div').style('display', 'block')
	const upload = uiutils.makeFileUpload(upload_div)
	upload.on('change', () => {
		const file = d3event.target.files[0]
		const reader = new FileReader()
		reader.onload = event => {
			parseTabDelimitedData(event.target.result, doms)
		}
		reader.readAsText(file, 'utf8')
	})
}

function makeCopyPasteInput(div, doms) {
	const paste_div = div.append('div').style('display', 'block')
	const paste = uiutils
		.makeTextAreaInput(paste_div)
		.style('border', '1px solid rgb(138, 177, 212)')
		.style('margin', '0px 0px 0px 20px')
		.on('keyup', async () => {
			parseTabDelimitedData(paste.property('value').trim(), doms)
		})
}

//Parse tab delimited files only
function parseTabDelimitedData(input, doms) {
	const data = {
		contents: [],
		attributes: {}
	}

	const required_headers = ['Level_1', 'variable_name', 'variable_note'] //Maybe arg to reuse for other data uploads (i.e sample anno matrix)
	const lines = input.split(/\r?\n/)
	const headers = lines.shift().split('\t')

	//Check for bare minimum data elements
	const searchHeaders = headers.map(e => {
		return e.toLowerCase()
	})
	for (const i in required_headers) {
		let headIndex = searchHeaders.indexOf(required_headers[i].toLowerCase())
		if (headIndex == -1) throw 'Missing data column: ' + required_headers[i]
	}
	//Key column allowed to be anywhere in the data - support hierarchy needs later.
	//Maybe arg to reuse for other data uploads (i.e sample anno matrix)
	const colKey = 'variable_name'
	const dataKeyIndex = searchHeaders.indexOf(colKey.toLocaleLowerCase())
	data.key = headers[dataKeyIndex]

	for (const line of lines) {
		const values = line.split('\t')
		const content = {}
		for (const [i, v] of values.entries()) {
			content[headers[i]] = v
		}

		data.contents.push(content)
	}

	for (const [i, key] of headers.entries()) {
		if (i == dataKeyIndex) continue
		data.attributes[key] = { label: key }
	}

	//reformat data
	let contentMap = new Map()
	for (const d in data.contents) {
		if (data.key) {
			d.content = d[data.key]
			delete d[data.key]
		}
		if (data.attributes) {
			d.s = {}
			for (const k in data.attributes) {
				d.s[k] = d[k]
				delete d[k]
			}
		}
		contentMap.set(d.content, d)
	}
}

function submitButton(div, doms, holder) {
	const submit = uiutils.makeBtn(div, 'Submit')
	submit
		.style('margin', '20px 20px 20px 130px')
		.style('font-size', '16px')
		.on('click', () => {
			validateInput(doms)
			// div.remove()
		})
}

function validateInput(doms) {
	if (!doms.contents && !doms.attributes) {
		alert('Provide data')
		return
	}
	// const data = {
	//     samples: doms.content,
	//     sample_attributes: doms.attributes
	// }
	// console.log(data.samples)

	const vocab = getVocabFromSamplesArray(data)
	// console.log(vocab)
}

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
