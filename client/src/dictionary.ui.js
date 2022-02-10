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

d:{}


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

	const d = {}

	//Data dictionary entry
	uiutils.makePrompt(wrapper, 'Data Dictionary')
	const tabs_div = wrapper.append('div')
	makeDataEntryTabs(tabs_div, d)

	//Submit button and information section
	submitButton(wrapper, d, holder)
	infoSection(wrapper)

	//Remove after testing
	window.doms = d
}

function makeDataEntryTabs(tabs_div, d) {
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
					makeTextEntryFilePathInput(files_div, d)
					uiutils.makePrompt(files_div, 'Upload')
					makeFileUpload(files_div, d)
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
					makeCopyPasteInput(div, d)
					tabs[1].rendered = true
				}
			}
		}
	]
	init_tabs({ holder: tabs_div, tabs })
}

function makeTextEntryFilePathInput(div, d) {
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
						d.data = parseTabDelimitedData(txt)
					})
			} else {
				//TODO: implement serverside filepaths(?)
			}
		})
}

function makeFileUpload(div, d) {
	const upload_div = div.append('div').style('display', 'block')
	const upload = uiutils.makeFileUpload(upload_div)
	upload.on('change', () => {
		const file = d3event.target.files[0]
		const reader = new FileReader()
		reader.onload = event => {
			d.data = parseTabDelimitedData(event.target.result)
		}
		reader.readAsText(file, 'utf8')
	})
}

function makeCopyPasteInput(div, d) {
	const paste_div = div.append('div').style('display', 'block')
	const paste = uiutils
		.makeTextAreaInput(paste_div)
		.style('border', '1px solid rgb(138, 177, 212)')
		.style('margin', '0px 0px 0px 20px')
		.on('keyup', async () => {
			d.data = parseTabDelimitedData(paste.property('value').trim())
		})
}
//TODO: Better place for these?
const name2id = new Map()
/* 
	key: term name
	value: id
*/
const term2term = new Map()
/* 
	key: id
	value(s): Set(['child id', 'child id', ...])
*/
const child2parents = new Map()
/* ancestry
	key: child
	value(s): Map({ parent id, order }, { parent id, order }, ...)
*/
const ch2immediateP = new Map()
/* 
	key: child id
	value: parent id
*/
const p2childorder = new Map()

const root_id = '__root' //placeholder
p2childorder.set(root_id, [])
const allterms_byorder = new Set()

//Parse tab delimited files only
function parseTabDelimitedData(input) {
	const lines = input.trim().split(/\r?\n/)

	/* 
    Parses phenotree:
        - Parses tab delim data arranged in cols: levels(n), Key(i.e. Variable name), Configuration (i.e. Variable note).
		- Only the key and configuration cols are required
		- Not using uncomputable values in this iteration
		- Assumptions:
			1. Headers required. 'Variable name', 'Variable note' may appear anywhere. 'Level_[XX]' for optional hierarchy/level columns. 
			2. Levels are defined left to right and in order, no gaps.
			3. No blanks or '-' between levels as well as no duplicate values in the same line.
			4. No identical term ids (keys)
    */
	const terms = {
		//Required root term for the eventual terms array
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
		if (i == 0) {
			//Find arrays for parsing logic from headers
			keyIndex = line.findIndex(l => l.match('Variable Name'))
			if (!keyIndex == -1) throw `Missing required 'Variable Name' column`
			configIndex = line.findIndex(l => l.match('Variable Note'))
			if (configIndex == -1) throw `Missing required 'Variable Note' column`
			//If no level col(s) provided, use key/Variable name col as single level. Will print id as name.
			if (line.findIndex(l => l.match('Level_')) == -1) colsIndexes.push(keyIndex)
			else {
				//Push level index to array for parsing
				for (let idx in line) {
					if (line[idx].match('Level_')) colsIndexes.push(idx)
				}
			}
		}
		try {
			if (i > 0) {
				//Skip header
				/******* Parse lines for term values *******/
				if (!line[configIndex] || !line[configIndex].trim()) {
					console.error('Missing configuration string, line: ' + (Number(i) + 1) + ', term: ' + line[keyIndex])
					continue
				}
				let colNames = [] //capture str value of all 'level' cols
				for (const c in colsIndexes) {
					const col = str2level(line[c])
					colNames.push(col)
				}
				// console.log(colNames)

				let configstr = line[configIndex].replace('"', '').trim()
				const lastNonNullIdx = check4MisplacedNulls(colNames, i)
				const name = getName(colNames)

				// if key missing, use name
				let key = line[keyIndex] ? line[keyIndex].trim() : ''
				if (!key) key = name

				//pushes user provided variable names and derived values to check
				keys.push(key)

				//Parses col7 into term.type, term.values, and term.groupsetting
				const term = parseConfig(configstr)

				/******* Parse for hierarchy *******/
				const filteredCols = filterCols(colNames)
				let leafIdx = lastNonNullIdx
				createHierarchy(leafIdx, filteredCols, key)

				/******* Create term *******/
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
			throw 'Line ' + (Number(i) + 1) + ' error: ' + e
		}
	}
	check4DuplicateValues(keys) //Checks all duplicate term.ids/keys for duplicates
	console.log(name2id)
	console.log(allterms_byorder)
	console.log(term2term)
	console.log(ch2immediateP)
	console.log(child2parents)
	console.log(p2childorder)
	console.log(allterms_byorder.size + ' terms in total')
	// console.log({ terms: Object.values(terms) })
	return { terms: Object.values(terms) }
}

/*
 **** Parsing Functions for Phenotree ****
 */
function str2level(col) {
	// parses columns and returns name
	const tmp = col.trim().replace(/"/g, '')
	if (!tmp || tmp == '-') return null
	return tmp
}

function check4MisplacedNulls(colArray, i) {
	// Check for blanks or '-' between levels
	const nullIndex = colArray.indexOf(null) //find first index of null
	function revArray(arr) {
		let copy = [...arr]
		return copy.reverse()
	}
	//find last index of non-null level value
	const lastLevelIndex = colArray.length - 1 - revArray(colArray).findIndex(e => e !== null)
	//TODO: Print error to the screen
	if (lastLevelIndex > nullIndex && nullIndex >= 0)
		throw `Blank or '-' value detected between levels in line ` + (Number(i) + 1)

	return lastLevelIndex //Use later for leaflevel
}

function getName(colArray) {
	//finds last name in the array and returns as name
	const ca = filterCols(colArray)

	//checks for duplicates in the resulting array
	check4DuplicateValues(ca)
	if (ca.length > 0) return ca[ca.length - 1]
	throw 'name missing'
}

function filterCols(colArray) {
	//filters null strings to return only string level inputs
	const ca = colArray.filter(x => x !== null)
	return ca
}

function parseConfig(str) {
	//NOT using uncomputable values in this iteration
	// const uncomputable_categories = new Set(['-994', '-995', '-996', '-997', '-998', '-999'])
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
				if (!value) throw 'field ' + (Number(i) + 1) + ' is not k=v: ' + field
				if (!term.values) term.values = {}
				term.values[key] = { label: value }
			}
		}

		if (term.type == 'integer' || term.type == 'float') {
			// for numeric term, all keys in values are not computable
			for (const k in term.values) term.values[k].uncomputable = true
		} //else if (term.type == 'categorical') {
		// 	// select categories are uncomputable
		// 	for (const k in term.values) {
		// 		if (uncomputable_categories.has(k)) term.values[k].uncomputable = true
		// 	}
		// }
	}

	if (term.type == 'categorical') {
		term.groupsetting = { inuse: false }
	}
	return term
}

function createHierarchy(leafIdx, filteredCols, key) {
	for (const fc in filteredCols) {
		let id
		if (fc == leafIdx) {
			id = key
			name2id.set(filteredCols[fc], id)
		} else {
			id = filteredCols[fc]
		}
		//find id for parent immediate level
		const levelUpId = filteredCols[Number(fc) - 1]

		if (fc != 0) {
			term2term.get(levelUpId).add(id)
			if (!child2parents.has(id)) child2parents.set(id, new Map())
			for (const y in filteredCols) {
				if (y < fc) {
					child2parents.get(id).set(filteredCols[y], y)
				}
			}
			ch2immediateP.set(id, levelUpId)
			if (!p2childorder.has(levelUpId)) p2childorder.set(levelUpId, []) //Why is this needed when there's term2term?
			if (p2childorder.get(levelUpId).indexOf(id) == -1) p2childorder.get(levelUpId).push(id)
		} else {
			if (p2childorder.get(root_id).indexOf(id) == -1) p2childorder.get(root_id).push(id)
		}

		if (!term2term.has(id) && fc != leafIdx) {
			term2term.set(id, new Set())
		}
		allterms_byorder.add(id)
	}
}

function check4DuplicateValues(values) {
	const duplicates = new Set()
	for (const i in values) {
		if (values.indexOf(values[i]) !== values.lastIndexOf(values[i])) {
			duplicates.add(values[i])
		}
	}
	if (duplicates.size > 0) {
		const dup = Array.from(duplicates)
		throw `Error: Nonunique values(s) found: ` + dup + `. Values must be unique.` //TODO print to screen
	}
	return true
}

/*
 **** Submission Functions ****
 */

function submitButton(div, d, holder) {
	const submit = uiutils.makeBtn(div, 'Submit')
	submit
		.style('margin', '20px 20px 20px 130px')
		.style('font-size', '16px')
		.on('click', () => {
			validateInput(div, d)
			// if (v == null) return //stop form from disappearing for now
			div.remove()
			appInit({
				holder: holder,
				state: {
					vocab: {
						terms: d.data.terms
					}
				}
			})
		})
}

function validateInput(div, d) {
	//May not be needed?
	if (!d.data) {
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
//TODO print data submission errors to the viewport rather than alerts
function makeErrorDiv(div) {
	div
		.append('div')
		.style('margin', '10px')
		.style('opacity', '0.65')
		.style('grid-column', 'span 2')
		.html(`<h3>Errors found</h3>`)
}
