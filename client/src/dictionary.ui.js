import * as uiutils from './dom/uiUtils'
import { appear } from './dom/animation'
import { init_tabs } from './dom/toggleButtons'
import { event as d3event } from 'd3-selection'
import { appInit } from './mass/app'

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
					div.append('div').html(`<p style="opacity:0.65;">Provide either a URL filepath or upload a file.</p>`)
					const files_div = div
						.append('div')
						.style('border', 'none')
						.style('display', 'grid')
						.style('grid-template-columns', '100px auto')
						.style('grid-template-rows', 'repeat(1, auto)')
						.style('gap', '5px')
						.style('place-items', 'center left')
						.style('margin-left', '15px')
					appear(div)
					uiutils.makePrompt(files_div, 'Filepath')
					makeTextEntryFilePathInput(files_div, doms)
					uiutils.makePrompt(files_div, 'Upload')
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
					div
						.append('div')
						.html(`<p style="margin-left: 10px; opacity: 0.65;">Paste data dictionary in a tab delimited format.</p>`)
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
						doms.data = parseTabDelimitedData(txt)
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
			console.log(120, 'preparse')
			doms.data = parseTabDelimitedData(event.target.result)
			// console.log(122, 'post parse', doms)
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
			doms.data = parseTabDelimitedData(paste.property('value').trim())
		})
}

//Parse tab delimited files only
function parseTabDelimitedData(input) {
	const lines = input.trim().split(/\r?\n/)

	/* 
    Parses phenotree:
        - Parses tab delim data arranged in cols: Level1, Level2, Level3, Level4, Level5, Key(i.e. ID), Configuration.
        - Checks for identical keys.
    */
	const terms = {
		__root: {
			id: 'root',
			name: 'root',
			__tree_isroot: true
		}
	}
	const keys = [] //To check for duplicate values later
	for (const i in lines) {
		const [col1, col2, col3, col4, col5, key0, configstr0] = lines[i].split('\t') //Required format
		try {
			if (i > 0) {
				//Skip header
				if (!configstr0 || !configstr0.trim()) {
					console.error('Missing configuration string, line: ' + i + ', term: ' + key0)
					continue
				}
				const L1 = col1.trim()
				const L2 = col2.trim()
				const L3 = col3.trim()
				const L4 = col4.trim()
				const L5 = col5.trim()
				const configstr = configstr0.replace('"', '').trim()

				const name = getName(L2, L3, L4, L5).replace(/\"/g, '')

				//if key0 missing, use name
				let key = key0 ? key0.trim() : ''
				if (!key) key = name

				keys.push(key) //pushes user provided and derived values to check

				//Parses col7 into term.type and term.values
				const term = parseConfig(configstr)
				// console.log(181)
				terms[key] = {
					id: key,
					parent_id: null,
					name,
					isleaf: true,
					type: term.type,
					values: term.values,
					groupsetting: term.groupsetting
				}
			}
		} catch (e) {
			throw 'Line ' + (i + 1) + ' error: ' + e
		}
	}
	check4DuplicateKeys(keys)

	// console.log({terms: Object.values(terms)})
	return { terms: Object.values(terms) }
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
		// Not relevant yet: is categorical term without predefined categories, need to collect from matrix, no further validation
		term.type = 'categorical'
		term.values = {}
		// Not relevant yet: list of categories not provided in configstr so need to sum it up from matrix
		term._set = new Set() // temp
	} else {
		const line = str.replace('"', '').split(';')
		const config = line[0].trim() //1st field defines term.type
		if (config == 'integer') {
			term.type = 'integer'
		} else if (config == 'float') {
			term.type = 'float'
		} else {
			// must be categorical, config is either key=value or 'string'
			term.type = 'categorical'
			term.values = {}
			// term._values_newinmatrix = new Set() //Not needed yet
			if (config == 'string') {
				//ignore
			} else {
				const [key, value] = config.split(/(?<!\>|\<)=/)
				if (!value) throw 'first field is not integer/float/string, and not k=v: ' + config
				term.values[key] = { label: value }
			}
		}

		for (let i in line) {
			if (i > 0) {
				//Skip type, defined above
				const field = line[i].trim()
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

	if (term.type == 'categorical') {
		term.groupsetting = { inuse: false }
	}
	return term
}

function check4DuplicateKeys(keys) {
	const duplicates = new Set()
	for (const i in keys) {
		if (keys.indexOf(keys[i]) !== keys.lastIndexOf(keys[i])) {
			duplicates.add(keys[i])
		}
	}
	if (duplicates.size > 0) {
		const dup = Array.from(duplicates)
		alert(`Error: Nonunique ID(s) found: ` + dup + `. IDs must be unique values.`)
	}
	return true
}

function submitButton(div, doms, holder) {
	const submit = uiutils.makeBtn(div, 'Submit')
	submit
		.style('margin', '20px 20px 20px 130px')
		.style('font-size', '16px')
		.on('click', () => {
			validateInput(doms)
			// console.log(296, doms)
			div.remove()
			appInit({
				holder: holder,
				state: {
					vocab: {
						terms: doms.data.terms
					}
				}
			})
		})
}

function validateInput(doms) {
	//May not be needed?
	if (!doms.data) {
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
                    Please see the <a href="https://docs.google.com/document/d/19RwEbWi7Q1bGemz3XpcgylvGh2brT06GFcXxM6rWjI0/edit" target="_blank">documentation</a> for more information.
                </li>
            </ul>`)
}
