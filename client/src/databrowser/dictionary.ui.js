import * as uiutils from '../dom/uiUtils'
import { appear } from '../dom/animation'
import { init_tabs } from '../dom/toggleButtons'
import { event as d3event } from 'd3-selection'
import { appInit } from '../mass/app'
import { sayerror } from '../dom/error'
import { make_radios } from '../dom/radiobutton'

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
	div
		.append('div')
		.style('margin', '10px')
		.style('opacity', '0.65')
		// .style('grid-column', 'span 2')
		.html(`<p>Information Section</p>
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
	header.style('font-size', '1.5em')
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
						obj.data = parseTabDelimitedData(holder, txt)
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
			obj.data = parseTabDelimitedData(holder, event.target.result)
		}
		reader.readAsText(file, 'utf8')
	})
}

function makeCopyPasteInput(holder, div, obj) {
	const paste_div = div.append('div').style('display', 'block')
	const paste = uiutils
		.makeTextAreaInput(paste_div,'', 10, 70)
		.style('border', '1px solid rgb(138, 177, 212)')
		.style('margin', '0px 0px 0px 20px')
		.on('keyup', async () => {
			obj.data = parseTabDelimitedData(holder, paste.property('value').trim())
		})
}

//Parse tab delimited files only
export function parseTabDelimitedData(holder, input) {
	//autodetect file formats

	/* 
    Parses phenotree:
        - Parses tab delim data arranged in cols: levels(n), ID (i.e. Variable name), Configuration (i.e. Variable note).
		- Only the ID and configuration cols are required
		- Not using uncomputable values in this iteration
		- Blank and '-' values for levels converted to null -- how to distinguish between no id vs no hierarchy??
		- Assumptions:
			1. Headers required. 'Variable name', 'Variable note' may appear anywhere. 'Level_[XX]' for optional hierarchy/level columns. 
			2. Levels are defined left to right, highest to lowest, and in order, no gaps.
			3. No blanks or '-' between levels as well as no duplicate values in the same line.
			4. No identical term ids (keys)
			5. All non-leaf names/ids must be unique. 
    */

	const lines = input.trim().split(/\r?\n/)

	// process the header line
	// could have used lines.shift() here, but will want to track actual line numbers later for errors
	const header = lines[0].split('\t')
	const varNameIndex = header.findIndex(l => l.toLowerCase().includes('variable name'))
	if (varNameIndex == -1) {
		sayerror(holder, `Missing required 'Variable Name' header`)
	}

	const configIndex = header.findIndex(l => l.toLowerCase().includes('variable note'))
	if (configIndex == -1) {
		sayerror(holder, `Missing required 'Variable Note' header`)
	}

	if (configIndex == -1 || varNameIndex == -1) {
		throw `invalid header` // informative error message is already displayed using sayerror
	}

	const levelColIndexes = header.map((c, i) => (c.toLowerCase().includes('level_') ? i : -1)).filter(i => i != -1)
	//If no level cols provided, use key/Variable name col as single level. Will print the id as name
	if (!levelColIndexes.length) levelColIndexes.push(varNameIndex)

	// caching and/or tracking variables
	const terms = {}
	const termNameToId = {}
	const parentTermNames = new Set()

	for (const [i, line] of lines.entries()) {
		if (i === 0) continue
		const lineNum = i + 1

		try {
			const cols = line.split('\t')
			const levelNames = levelColIndexes.map(i => cols[i].trim().replace(/"/g, '')).filter(c => c != '-')
			if (levelNames.length != new Set(levelNames).size) {
				sayerror(holder, `Non-unique levels in line ${lineNum}: ${JSON.stringify(levelNames)}`)
				continue
			}

			const name = levelNames.pop()
			const firstDashIndex = cols.indexOf('-')
			if (firstDashIndex != -1 && firstDashIndex < cols.indexOf(name)) {
				sayerror(holder, `Blank or '-' value detected between levels in line ${lineNum}`)
				continue
			}

			const term = parseConfig(holder, lineNum, cols[configIndex], name)
			if (!term) continue
			// error handled in parseConfig()
			else if (!Object.keys(term).length) {
				// is it possible to have an empty term?
				sayerror(holder, `Error: empty config column for term.id='${name}'.`)
				continue
			}

			const id = cols[varNameIndex] || name
			if (id in terms) {
				console.log(215, id)
				const orig = terms[id]
				sayerror(holder, `Error: Multiple config rows for term.id='${id}': lines# ${orig.lineNum} and ${lineNum}`)
				continue
			}

			//Create term object
			terms[id] = {
				id,
				name,
				type: term.type,
				values: term.values,
				groupsetting: term.groupsetting,
				//isleaf: to be assigned later

				// *** temporary attributes to be deleted later ***
				ancestry: levelNames.slice(), // to be deleted later, used to fill in missing terms
				parent_name: levelNames.pop() || null, // will change this later to parent_id
				lineNum // to be deleted later
			}

			termNameToId[name] = id
			parentTermNames.add(terms[id].parent_name)
		} catch (e) {
			throw `Line ${lineNum} error: ${e}`
		}
	}

	// some parent term levels may not have entries
	trackMissingTerms(termNameToId, terms, parentTermNames, holder)

	for (const id in terms) {
		const term = terms[id]
		term.isleaf = !parentTermNames.has(term.name)
		term.parent_id = termNameToId[term.parent_name] || null
		delete term.parent_name
		delete term.lineNum
		//term.ancestry = term.ancestry.map(name => termNameToId[name]).filter(d=>!!d)
		delete term.ancestry
	}

	//console.log(terms)
	return { terms: Object.values(terms) }
}

/*
 **** Parsing Functions for Phenotree ****
 */

function parseConfig(holder, lineNum, str, varName) {
	//NOT using uncomputable values in this iteration
	// const uncomputable_categories = new Set(['-994', '-995', '-996', '-997', '-998', '-999'])

	const configStr = str.replace('"', '').trim()
	if (!configStr) {
		sayerror(holder, `Missing Variable Note string, line=${lineNum}, term='${varName}'`)
		return
	}

	const term = {}

	if (configStr == 'string') {
		// Not relevant yet: is categorical term without predefined categories, need to collect from matrix, no further validation
		term.type = 'categorical'
		term.values = {}
		// Not relevant yet: list of categories not provided in configstr so need to sum it up from matrix
		term._set = new Set() // temp
	} else {
		const line = configStr.replace('"', '').split(';')
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
				// const [key, value] = config.split(/(?<!\>|\<)=/)
				const segments = config.split('=') //Fix for Safari not supporting regex look behinds
				const key = segments.shift()
				const label = segments.join('=')
				if (!label)
					sayerror(
						holder,
						`Variable note is not an integer/float/string and not k=v. line=${lineNum} variable note='${config}'`
					)
				term.values[key] = { label: label }
			}
		}

		for (let i = 0; i < line.length; i++) {
			if (i > 0) {
				//Skip type, defined above
				const field = line[i].trim()
				if (field == '') continue
				// const [key, value] = field.split(/(?<!\>|\<)=/)
				const segments = field.split('=') //Fix for Safari not supporting regex look behinds
				const key = segments.shift()
				const label = segments.join('=')
				if (!label) sayerror(holder, 'field ' + (i + 1) + ' is not k=v: ' + field)
				if (!term.values) term.values = {}
				term.values[key] = { label: label }
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

function trackMissingTerms(termNameToId, terms, parentTermNames, holder) {
	for (const id in terms) {
		const term = terms[id]
		for (const [i, name] of term.ancestry.entries()) {
			if (name in termNameToId) {
				// a tsv line was already processed for this term
				const id = termNameToId[name]
				const ancestor = terms[id]
				/* if this term's ancestor has no level above it, previous processing of this ancestor
				should also not have a term parent,
				OR if this ancestor another level above it,
				check that it is the same parent_term as previousy processed */
				if ((i - 1 < 0 && ancestor.parent_name) || ancestor.parent_name != term.ancestry[i - 1]) {
					sayerror(
						holder,
						`Different parents for term=${name}, '${term.ancestry[i - 1]}' and '${ancestor.parent_name}'`
					)
				}
				continue
			}

			terms[name] = {
				id: name,
				name,
				isleaf: false,
				ancestry: term.ancestry.slice(0, i)
			}

			terms[name].parent_name = terms[name].ancestry.slice(-1)[0] || null
			termNameToId[name] = name
			parentTermNames.add(name)
		}
	}
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
			if (!obj.data) {
				alert('Please provide data')
			}
			if (!obj.data.length || obj.data == undefined) {
				throw 'No data provided' // Show user error with alert above and prevent form from disappearing
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
