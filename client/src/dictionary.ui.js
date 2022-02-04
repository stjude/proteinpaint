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
			doms.data = parseTabDelimitedData(event.target.result)
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
	let keyIndex,
		configIndex,
		colsIndexes = []
	for (const i in lines) {
		let line = lines[i].split('\t')
		// console.log(159, line)
		// const keyIndex = line.findIndex('Variable Name')
		// console.log(keyIndex)
		// const [col1, col2, col3, col4, col5, key0, configstr0] = lines[i].split('\t') //Required format
		// console.log(163, col1, col2, col3, col4, col5, key0, configstr0) //returns array of strings
		if (i == 0) {
			//TODO - Ask Xin if 'Variable name' and 'Variable note' are common/standard names in phenotree
			keyIndex = line.findIndex(l => l.match('Variable Name'))
			if (!keyIndex == -1) throw `Missing required 'Variable Name' column`
			configIndex = line.findIndex(l => l.match('Variable Note'))
			if (configIndex == -1) throw `Missing required 'Variable Note' column`
			for (let idx in line) {
				if (!(idx == keyIndex || idx == configIndex)) colsIndexes.push(idx)
			}
		}
		// console.log(keyIndex, configIndex, colsIndexes)
		try {
			if (i > 0) {
				//Skip header
				if (!line[configIndex] || !line[configIndex].trim()) {
					console.error('Missing configuration string, line: ' + i + ', term: ' + line[keyIndex])
					continue
				}
				let colNames = []
				for (const c in colsIndexes) {
					const col = str2level(line[c])
					colNames.push(col)
				}
				// console.log(colNames)
				let configstr = line[configIndex].replace('"', '').trim()
				// let L1 = str2level(col1),
				// 	L2 = str2level(col2),
				// 	L3 = str2level(col3),
				// 	L4 = str2level(col4),
				// 	L5 = str2level(col5),
				// 	configstr = configstr0.replace('"', '').trim()
				// const levels = [L1, L2, L3, L4, L5]

				// const name = getName(L2, L3, L4, L5).replace(/\"/g, '')
				const name = getName(colNames)
				// console.log(name)

				// if key missing, use name
				let key = line[keyIndex] ? line[keyIndex].trim() : ''
				if (!key) key = name

				keys.push(key) //pushes user provided and derived values to check

				// //Parses col7 into term.type and term.values
				const term = parseConfig(configstr)

				//Create hierarchy
				// let leaflevel = 5

				// for (const [i,] in levels) {
				// 	if (!levels[1]){
				// 		leaflevel = 1
				// 	} else if (i > 0) {
				// 		let addOne = i,
				// 			minusOne = i
				// 		const levela = addOne++, //changes addOne to i+1 and captures current i
				// 			levelm = minusOne--
				// 		console.log(196, levels[addOne], levels[minusOne], levels[levela], levels[levelm])
				// 		// console.log(197, levels[addOne])
				// 		if (!levels[addOne]) {
				// 			// leaflevel = levela
				// 			// console.log(199, leaflevel, levels[levela])
				// 			// console.log(199, leaflevel, levels[levela])
				// 			if (levels[levela] == levels[minusOne]) {
				// 				// levels[minusOne] = null
				// 				// leaflevel = 3
				// 				// console.log(levels[minusOne])
				// 			}
				// 		}
				// 	}
				// }

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

/*****Parsing Functions for Phenotree *****/
function str2level(col) {
	// parses columns and returns name
	const tmp = col.trim()
	if (!tmp || tmp == '-') return null
	return tmp
}

function getName(colArray) {
	//finds last name in the array and returns as name
	const ca = colArray.filter(x => x !== null)
	if (ca.length > 0) return colArray[ca.length - 1].replace(/"/g, '')
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
			// if (v == null) return //stop form from disappearing for now
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
		// alert('Provide data')
		return null
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
