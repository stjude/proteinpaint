import * as uiutils from './dom/uiUtils'
import { appear } from './dom/animation'
import { init_tabs } from './dom/toggleButtons'
import { event as d3event } from 'd3-selection'
import { appInit } from './mass/app'
import { sayerror } from './dom/error'

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
	1. validateLevels()
	2. parseConfig()
	3. createHierarchy()
	4. str2level()
Helpers:
	1. check4DuplicateValues()


obj:{ data:[ {terms} ] }


Documentation: https://docs.google.com/document/d/19RwEbWi7Q1bGemz3XpcgylvGh2brT06GFcXxM6rWjI0/edit
*/

export function init_dictionaryUI(holder, debugmode) {
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

	const obj = {}

	//Data dictionary entry
	uiutils.makePrompt(wrapper, 'Data Dictionary')
	const tabs_div = wrapper.append('div')
	makeDataEntryTabs(holder, tabs_div, obj)

	//Submit button and information section
	submitButton(wrapper, obj, holder)
	infoSection(wrapper)

	//Remove after testing
	if (debugmode) window.doms = obj
}

function makeDataEntryTabs(holder, tabs_div, obj) {
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
					makeTextEntryFilePathInput(holder, files_div, obj)
					uiutils.makePrompt(files_div, 'Upload')
					makeFileUpload(holder, files_div, obj)
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
					makeCopyPasteInput(holder, div, obj)
					tabs[1].rendered = true
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
						obj.data = parseTabDelimitedData(holder, txt)
					})
			} else {
				//TODO: implement serverside filepaths(?)
			}
		})
}

function makeFileUpload(holder, div, obj) {
	const upload_div = div.append('div').style('display', 'block')
	const upload = uiutils.makeFileUpload(upload_div)
	upload.on('change', () => {
		const file = d3event.target.files[0]
		const reader = new FileReader()
		reader.onload = event => {
			obj.data = parseTabDelimitedData(holder, event.target.result)
		}
		reader.readAsText(file, 'utf8')
	})
}

function makeCopyPasteInput(holder, div, obj) {
	const paste_div = div.append('div').style('display', 'block')
	const paste = uiutils
		.makeTextAreaInput(paste_div)
		.style('border', '1px solid rgb(138, 177, 212)')
		.style('margin', '0px 0px 0px 20px')
		.on('keyup', async () => {
			obj.data = parseTabDelimitedData(holder, paste.property('value').trim())
		})
}

//Parse tab delimited files only
function parseTabDelimitedData(holder, input) {
	const lines = input.trim().split(/\r?\n/)

	/* 
    Parses phenotree:
        - Parses tab delim data arranged in cols: levels(n), ID (i.e. Variable name), Configuration (i.e. Variable note).
		- Only the ID and configuration cols are required
		- Not using uncomputable values in this iteration
		- Blank and '-' values for levels converted to null
		- Assumptions:
			1. Headers required. 'Variable name', 'Variable note' may appear anywhere. 'Level_[XX]' for optional hierarchy/level columns. 
			2. Levels are defined left to right, highest to lowest, and in order, no gaps.
			3. No blanks or '-' between levels as well as no duplicate values in the same line.
			4. No identical term ids (keys)
			5. All non-leaf names/ids must be unique. 
    */
	const termsMaps = {
		// Use later for sample annotation matrix and other file types
		// name2id: new Map(),
		/* 
		Connects all term names to their id
			key: term name
			value: id
		*/
		parent2children: new Map(),
		/* 
			key: id
			value(s): Set(['child id', 'child id', ...])
		*/
		child2parents: new Map(),
		/* Collect for ancestry later
			key: child
			value(s): Map({ parent id, order }, { parent id, order }, ...)
		*/

		ch2immediateP: new Map(),
		/* 
			key: child id
			value: parent id
		*/
		p2childorder: new Map()

		//Use later for sample annotation matrix and other files
		// allterms_byorder: new Set(),
	}

	const terms = {
		__root: {
			id: 'root',
			name: 'root',
			__tree_isroot: true
		}
	}
	const ids = [] //To check for duplicate values later

	let varNameIndex,
		configIndex,
		levelColIndexes = []

	for (const [i, v] of lines.entries()) {
		let line = lines[i].split('\t')
		if (i == 0) {
			//Find "Variable Name" (i.e. level 1 id/ leaf id), "Variable Note" (i.e. configuration), and level columns
			varNameIndex = line.findIndex(l => l.toLowerCase().includes('variable name'))
			if (varNameIndex == -1) sayerror(holder, `Missing required 'Variable Name' column`)
			configIndex = line.findIndex(l => l.toLowerCase().includes('variable note'))
			if (configIndex == -1) sayerror(holder, `Missing required 'Variable Note' column`)

			for (const [idx, col] of line.entries()) {
				//Capture the index(es) for level column(s) creating hierarchy later
				if (col.toLowerCase().includes('level_')) levelColIndexes.push(idx)
			}
			//If no level cols provided, use key/Variable name col as single level. Will print the id as name
			if (line.findIndex(l => l.toLowerCase().includes('level_')) == -1) levelColIndexes.push(varNameIndex)

			// console.log("Variable Name Index: " + varNameIndex)
			// console.log("Config Index: " +  configIndex)
			// console.log(levelColIndexes)
			continue
		}
		try {
			/******* Parse lines for term values *******/
			if (!line[configIndex] || !line[configIndex].trim()) {
				console.error('Missing configuration string, line: ' + (i + 1) + ', term: ' + line[varNameIndex])
				continue
			}
			// console.log(line)
			let levelIdxStrs = []
			for (let idx = 0; idx < line.length; idx++) {
				// console.log(idx)
				for (const colIdx of levelColIndexes) {
					//capture str value of all 'level' cols
					//Preserve the index value
					if (idx == colIdx) {
						const levelName = str2level(line[idx])
						levelIdxStrs.push({ idx, name: levelName })
						// console.log(levelName)
					}
				}
			}
			// console.log(levelIdxStrs)

			//Checks for blanks || '-' values between levels, checks for duplicate level entries, and returns the leafindex
			const leafLevel = validateLevels(holder, levelIdxStrs, i)
			// console.log(leafLevel)
			// console.log(levelIdxStrs)

			// if key missing, use leaf level str
			let leafId = line[varNameIndex] ? line[varNameIndex].trim() : ''
			if (!leafId) leafId = leafLevel.name
			//ids array used to check for duplicate id values later
			ids.push(leafId)

			let configstr = line[configIndex].replace('"', '').trim()
			//Parses configuration col into term.type, term.values, and term.groupsetting
			const term = parseConfig(holder, configstr)
			// console.log(term)

			/******* Parse for hierarchy *******/
			const nonNullLevels = levelIdxStrs.filter(l => l.name !== null)
			// console.log(nonNullLevels)

			// Creates a series of maps for generating terms, ancestry table, and eventually connecting to other file types
			createHierarchy(leafLevel.idx, nonNullLevels, leafId, termsMaps)

			/******* Create terms *******/
			for (const [k, v] of termsMaps.p2childorder.entries()) {
				//Create term objects for parents
				if (k == '__root') continue
				if (!terms[k]) {
					terms[k] = {
						id: k,
						name: k,
						isleaf: false,
						parent_id: termsMaps.ch2immediateP.get(k) || null
					}
					ids.push(k)
				}
			}
			//Create term objects for leaves
			terms[leafId] = {
				id: leafId,
				name: leafLevel.name,
				parent_id: termsMaps.ch2immediateP.get(leafId),
				isleaf: !termsMaps.parent2children.has(leafId),
				type: term.type,
				values: term.values,
				groupsetting: term.groupsetting
			}
		} catch (e) {
			throw 'Line ' + (i + 1) + ' error: ' + e
		}
	}
	// Checks all duplicate term.ids for duplicates
	check4DuplicateValues(holder, ids)

	// console.log(ntermsMaps.ame2id)
	// console.log(termsMaps.allterms_byorder)
	// console.log(264, termsMaps.parent2children)
	// console.log(265, termsMaps.ch2immediateP)
	// console.log(266, termsMaps.child2parents)
	// console.log(267, termsMaps.p2childorder)
	// console.log(termsMaps.allterms_byorder.size + ' terms in total')
	console.log({ terms: Object.values(terms) })
	return { terms: Object.values(terms) }
}

/*
 **** Parsing Functions for Phenotree ****
 */

function validateLevels(holder, levelStrs, i) {
	// Check for blanks or '-' between levels

	// Find first index of null
	let firstNull = levelStrs.find(l => l.name == null)

	// Find last index of non-null level value
	function revArray(arr) {
		// Make a copy to avoid changing the original array upstream
		let copy = [...arr]
		return copy.reverse()
	}
	const lastNonNull = revArray(levelStrs).find(l => l.name !== null)
	// console.log(lastNonNull)

	if (firstNull == undefined) firstNull = { idx: lastNonNull.idx + 1, name: 'noname' }
	//TODO: Print error to the screen
	if (lastNonNull.idx > firstNull.idx && firstNull.idx >= 0)
		sayerror(holder, `Blank or '-' value detected between levels in line ` + (i + 1))

	//Check for duplicate string values for levels in the same line
	const nonNullLevelStrs = []
	levelStrs.filter(l => {
		if (l.name !== null) nonNullLevelStrs.push(l.name)
	})
	check4DuplicateValues(holder, nonNullLevelStrs)

	return lastNonNull
}

function parseConfig(holder, str) {
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
				if (!value) sayerror(holder, 'first field is not integer/float/string, and not k=v: ' + config)
				term.values[key] = { label: value }
			}
		}

		for (let i of line) {
			if (i > 0) {
				//Skip type, defined above
				const field = line[i].trim()
				if (field == '') continue
				const [key, value] = field.split(/(?<!\>|\<)=/)
				if (!value) sayerror(holder, 'field ' + (i + 1) + ' is not k=v: ' + field)
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

function createHierarchy(leafIndex, levelNames, leafID, termsMaps) {
	const root_id = '__root' //placeholder
	//Maps the children in order; will use later to create the parent terms
	termsMaps.p2childorder.set(root_id, [])

	//Find the smallest level index before looping through levelNames
	let idxArr = []
	levelNames.filter(l => idxArr.push(l.idx))
	// console.log(idxArr)
	const idxMin = Math.min(...idxArr)
	// console.log(idxMin)

	for (const level of levelNames) {
		let id
		if (level.idx === leafIndex) {
			id = leafID
			// Use later for sample annotation and other file types
			// termsMaps.name2id.set(levelNames[level.idx], id)
		} else {
			id = level.name
			// Create map for parents to all children for term.isleaf
			if (!termsMaps.parent2children.has(id) && id) {
				termsMaps.parent2children.set(id, new Set())
			}
		}
		// console.log(id)

		if (level.idx == idxMin) {
			//Minimal parsing for the first level
			// The parent_id  = null for the first level
			termsMaps.ch2immediateP.set(id, null)

			// Connect to the first col id to the root
			if (termsMaps.p2childorder.get(root_id).indexOf(id) == -1) termsMaps.p2childorder.get(root_id).push(id)
			continue
		} else {
			// Find id (i.e. name) for the immediate parent level
			const parent = levelNames.find(l => {
				const parentIdx = level.idx - 1
				if (l.idx == parentIdx) return l
			})
			// console.log(parent)

			termsMaps.parent2children.get(parent.name).add(id)

			// Map children to all parents; create a new map for every child id
			if (!termsMaps.child2parents.has(id)) termsMaps.child2parents.set(id, new Map())

			for (const y of levelNames) {
				// Collect parent ids(y) for children(level) when the index(y.idx) is less than the child
				if (y.idx < level.idx) {
					termsMaps.child2parents.get(id).set(level.name, y.name)
				}
			}
			//Capture immediate parent for child term.parent_id
			termsMaps.ch2immediateP.set(id, parent.name)

			// Map parent to children in order for creating term objs for parents
			// Create a new array for parent in map
			if (!termsMaps.p2childorder.has(parent.name)) termsMaps.p2childorder.set(parent.name, [])
			// Add child id to parent array if child id not found
			if (termsMaps.p2childorder.get(parent.name).indexOf(id) == -1) termsMaps.p2childorder.get(parent.name).push(id)
		}

		// Use later for sample annotation matrix and other file types
		// termsMaps.allterms_byorder.add(id)
	}
}

function str2level(str) {
	// parses columns and returns name
	const tmp = str.trim().replace(/"/g, '')
	if (!tmp || tmp == '-') return null
	return tmp
}

/*
 **** Helpers ****
 */

function check4DuplicateValues(holder, values) {
	// Find duplicate values from an array and, if applicable, print duplicate values to the screen
	const duplicates = new Set()
	for (const i in values) {
		if (values.indexOf(values[i]) !== values.lastIndexOf(values[i])) {
			duplicates.add(values[i])
		}
	}
	if (duplicates.size > 0) {
		const dup = Array.from(duplicates)
		sayerror(holder, `Error: Nonunique values(s) found: ` + dup + `. Values must be unique.`)
	}
	return true
}

/*
 **** Submission Functions ****
 */

function submitButton(div, obj, holder) {
	const submit = uiutils.makeBtn(div, 'Submit')
	submit
		.style('margin', '20px 20px 20px 130px')
		.style('font-size', '16px')
		.on('click', () => {
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
