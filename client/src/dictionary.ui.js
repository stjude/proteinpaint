import * as uiutils from './dom/uiUtils'
import { appear } from './dom/animation'
import { init_tabs } from './dom/toggleButtons'
import { event as d3event } from 'd3-selection'

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
	const key2terms = {}
	//Maybe arg to reuse for other data uploads (i.e sample anno matrix)
	// const required_headers = ['Name', 'variable_name', 'variable_note']
	const lines = input.trim().split(/\r?\n/)
	// const headers = lines.shift().split('\t')

	//Check for bare minimum data elements
	// const searchHeaders = headers.map(e => {
	// 	return e.toLowerCase()
	// })
	// for (const i in required_headers) {
	// 	let headIndex = searchHeaders.indexOf(required_headers[i].toLowerCase())
	// 	if (headIndex == -1) throw 'Missing data column: ' + required_headers[i]
	// }

	//Key column allowed to be anywhere in the data - support hierarchy needs later.
	//Maybe arg to reuse for other data uploads (i.e sample anno matrix)
	// const colKey = 'variable_name'
	// const dataKeyIndex = searchHeaders.indexOf(colKey.toLocaleLowerCase())
	// data.samplekey = headers[dataKeyIndex]

	//Parse phenotree
	for (const i in lines) {
		const [col1, col2, col3, col4, col5, key0, configstr0] = lines[i].split('\t') //Required format
		try {
			if (i > 0) {
				//Skip header
				if (!configstr0 || !configstr0.trim()) {
					console.error('missing configuration string, line: ' + i + ', term: ' + key0)
					continue
				}
				const L1 = col1.trim()
				const L2 = col2.trim()
				const L3 = col3.trim()
				const L4 = col4.trim()
				const L5 = col5.trim()
				const configstr = configstr0.replace('"', '').trim()

				const name = getName(L2, L3, L4, L5)

				//if key0 missing, use name
				let key = key0 ? key0.trim() : ''
				if (!key) key = name

				const term = parseConfig(configstr)
				term.name = name
				// console.log(term)
				key2terms[key] = term
			}
		} catch (e) {
			throw 'Line ' + (i + 1) + ' error: ' + e
		}
	}
	console.log(key2terms)
	return key2terms
}

function getName(L2, L3, L4, L5) {
	if (!L2) throw 'L2 missing'
	if (!L3) throw 'L3 missing'
	if (!L4) throw 'L4 missing'
	if (!L5) throw 'L5 missing'
	if (L5 != '-') return L5
	if (L4 != '-') return L4
	if (L3 != '-') return L3
	if (L2 != '-') return L2
	throw 'name missing'
}

function parseConfig(str) {
	const uncomputable_categories = new Set(['-994', '-995', '-996', '-997', '-998', '-999'])
	const term = {}

	if (str == 'string') {
		// is categorical term without predefined categories, need to collect from matrix, no further validation
		term.type = 'categorical'
		term.values = {}
		// list of categories not provided in configstr so need to sum it up from matrix
		term._set = new Set() // temp
	} else {
		const line = str.replace('"', '').split(';')
		const config = line[0].trim() //1st field defines term.type
		if (config == 'integer') {
			term.type = 'integer'
		} else if (config == 'float') {
			term.type = 'float'
		} else {
			// must be categorical, f1 is either key=value or 'string'
			term.type = 'categorical'
			term.values = {}
			term._values_newinmatrix = new Set()
			if (config == 'string') {
				//ignore
			} else {
				const [key, value] = config.split(/(?<!\>|\<)=/)
				if (!value) throw 'first field is not integer/float/string, and not k=v: ' + config
				term.values[key] = { label: value }
			}
		}

		for (let i in line) {
			const field = line[i].trim()
			if (i > 0) {
				if (field == '') continue
				const [key, value] = field.split(/(?<!\>|\<)=/)
				if (!value) throw 'field ' + (i + 1) + ' is not k=v: ' + field
				if (!term.values) term.values = {}
				term.values[key] = { label: value }
			}
		}

		if (term.type == 'integer' || term.type == 'float') {
			// for numeric term, all keys in values are not computable
			for (const k in term.values) term.values[k].uncomputable = true
		} else if (term.type == 'categorical') {
			// select categories are uncomputable
			for (const k in term.values) {
				if (uncomputable_categories.has(k)) term.values[k].uncomputable = true
			}
		}
	}

	// // for all above cases, will have these two
	// term._values_foundinmatrix = new Map()

	// if (term.type == 'categorical') {
	// 	term.groupsetting = { inuse: false }
	// }
	return term
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
	if (!doms.term) {
		alert('Provide data')
		return
	}
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
