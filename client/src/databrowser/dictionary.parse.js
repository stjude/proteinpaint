/*
------ EXPORTED ------ 
parseDictionary()
	- div
	- input: STR

------ Internal ------ 
Traditional data dictionary parsing: 
	1. parseDataDictionary

Phenotree parsing:
	1. parseConfig()
	2. trackMissingTerms
*/

export function parseDictionary(input) {
	// Returns terms array for appInit({state.vocab.terms})
	const terms = {}

	const lines = input.trim().split(/\r?\n/)
	// process the header line
	// could have used lines.shift() here, but will want to track actual line numbers later for errors
	const header = lines[0].split('\t')

	const term_idIndex = header.findIndex(l => l.toLowerCase().includes('term_id'))
	const variableIndex = header.findIndex(l => l.toLowerCase().includes('variable')) // term_id col in phenotree
	if (term_idIndex != -1) parseDataDictionary(lines, header)
	if (variableIndex != -1) parsePhenotree(lines, header)
	if (variableIndex == -1 && term_idIndex == -1) {
		throw `Unrecognized file format. Please check the header names.`
	}
	// if (varNameIndex != -1 && term_idIndex != -1) throw 'Unrecognized file format'

	function parseDataDictionary(lines, header) {
		/*
		Parses data dictionary in a term_id to parent_id format
			- Parses tab delim data arranged in required cols: term_id, parent_id, name, type, values
			- Assumptions:
				1. Headers required
				2. No blank or '-' values in the term_id, parent_id, name, or type columns. Top grandparents must include 'root' for the parent_id
				3. No identical term ids 
		*/
		const parIdIndex = header.findIndex(l => l.toLowerCase().includes('parent_id'))
		if (parIdIndex == -1) {
			throw `Missing required 'parent_id' header`
		}
		const nameIndex = header.findIndex(l => l.toLowerCase().includes('name'))
		if (nameIndex == -1) {
			throw `Missing required 'Name' header`
		}
		const typeIndex = header.findIndex(l => l.toLowerCase().includes('type'))
		if (typeIndex == -1) {
			throw `Missing required 'Type' header`
		}
		const valuesIndex = header.findIndex(l => l.toLowerCase().includes('values'))
		if (valuesIndex == -1) {
			throw `Missing required 'Values' header`
		}
		if (parIdIndex == -1 || nameIndex == -1 || typeIndex == -1 || valuesIndex == -1) {
			throw `Missing required header(s)`
		}

		const parentIds = new Set()

		for (const [i, line] of lines.entries()) {
			if (i === 0) continue
			const lineNum = i + 1 //Use for error messages

			try {
				const cols = line.split('\t')

				//validate column entries, no blank or '-' values
				for (const [i, c] of cols.entries()) {
					const colNum = i + 1
					let foundProblem
					if (i == valuesIndex) continue //values can be blank
					if (c == '' || c == '-') {
						foundProblem = true
						throw `Blank or '-' entered for line ${lineNum}, column ${colNum}`
					}
					if (foundProblem == true) throw `Invalid entry for line ${lineNum}, column ${colNum}`
				}

				const termId = cols[term_idIndex]
				const type = cols[typeIndex]

				terms[termId] = {
					id: termId,
					name: cols[nameIndex].trim().replace(/"/g, ''),
					parent_id: cols[parIdIndex] != 'root' ? cols[parIdIndex] : null,
					type: cols[typeIndex] != 'non graphable' ? cols[typeIndex] : null
				}

				parentIds.add(terms[termId].parent_id)

				if (type == 'categorical') {
					terms[termId].values = {}
					terms[termId].groupsetting = { inuse: false }
				}
				const values = cols[valuesIndex].trim().replace(/"/g, '').split(';')

				for (const x of values) {
					const v = x.trim()
					if (v == '') continue
					const segments = v.split('=')
					const key = segments.shift()
					const label = segments.join('=')
					if (!label) throw `Values="${v}" in line ${lineNum} not in a key = value format.`
					if (!terms[termId].values) terms[termId].values = {}
					terms[termId].values[key] = { label: label }
				}

				validateNumericTermCategories(terms[termId])
			} catch (e) {
				throw `Line ${lineNum} error: ${e}`
			}
		}
		for (const t in terms) terms[t].isleaf = !parentIds.has(terms[t].id)
	}

	function parsePhenotree(lines, header) {
		/* 
		Parses phenotree:
			- Parses tab delim data arranged in cols: levels(n), variable (i.e. term_id), type, and categories (i.e. previous configuration).
			- Only the vairable and type cols are required
			- Blank and '-' values for levels converted to null -- how to distinguish between no id vs no hierarchy??
			- Assumptions:
				1. Headers required. `Variable', 'Type', and 'Categories' may appear anywhere. 'Level_[XX]' for optional hierarchy/level columns. 
				2. Levels are defined left to right, highest to lowest, and in order, no gaps.
				3. No blanks or '-' between levels as well as no duplicate values in the same line.
				4. No identical term ids
				5. All non-leaf names/ids must be unique. 
		*/
		if (variableIndex == -1) {
			throw `Missing required 'Variable' header`
		}

		const typeIndex = header.findIndex(l => l.toLowerCase().includes('type'))
		if (typeIndex == -1) {
			throw `Missing required 'Type' header`
		}

		const categoriesIndex = header.findIndex(l => l.toLowerCase().includes('categories'))

		const levelColIndexes = header.map((c, i) => (c.toLowerCase().includes('level_') ? i : -1)).filter(i => i != -1)
		//If no level cols provided, use key/Variable col as single level. Will print the id as name
		if (!levelColIndexes.length) levelColIndexes.push(variableIndex)

		/** Old implementation
		 * .attributes is passed to the term obj (see below) but not used.
		 * Leaving parsing code as an option for the future.
		 */
		const additionalAttrIndexes = header.findIndex(l => l.toLowerCase().includes('additional attributes'))

		// caching and/or tracking variables
		const termNameToId = {}
		const parentTermNames = new Set()
		const parent2ChildOrder = new Map()
		parent2ChildOrder.set(null, [])

		for (const [i, line] of lines.entries()) {
			if (i === 0) continue
			const lineNum = i + 1

			try {
				const cols = line.split('\t')
				const levelNames = levelColIndexes.map(i => cols[i].trim().replace(/"/g, '')).filter(c => c != '-')
				if (levelNames.length != new Set(levelNames).size) {
					throw `Non-unique levels in line ${lineNum}: ${JSON.stringify(levelNames)}`
				}

				// Create map of immediate parents to children, in order of appearance
				for (const [i, lvlName] of levelNames.entries()) {
					// Messy?? Is there an more elegant way?
					if (i == 0) {
						if (parent2ChildOrder.get(null).indexOf(lvlName) == -1) parent2ChildOrder.get(null).push(lvlName)
					}
					if (i != levelNames.length - 1) {
						if (!parent2ChildOrder.has(lvlName)) parent2ChildOrder.set(lvlName, [])
					}
					for (const n of levelNames) {
						if (i == levelNames.indexOf(n) - 1) {
							if (parent2ChildOrder.get(lvlName).indexOf(n) == -1) parent2ChildOrder.get(lvlName).push(n)
						}
					}
				}

				const name = levelNames.pop()

				const firstDashIndex = cols.indexOf('-')
				if (firstDashIndex != -1 && firstDashIndex < cols.indexOf(name)) {
					throw `Blank or '-' value detected between levels in line ${lineNum}`
				}

				const term = parseCategories(cols[typeIndex], cols[categoriesIndex], cols[additionalAttrIndexes], lineNum, name)

				const id = cols[variableIndex] || name
				if (id in terms) {
					const orig = terms[id]
					throw `Error: Multiple config rows for term.id='${id}': lines# ${orig.lineNum} and ${lineNum}`
				}

				//Create term object
				terms[id] = {
					id,
					name,
					type: term.type,
					values: term.values,
					groupsetting: term.groupsetting,

					// *** temporary attributes to be deleted later ***
					ancestry: levelNames.slice(), // to be deleted later, used to fill in missing terms
					parent_name: levelNames.pop() || null, // will change this later to parent_id
					lineNum, // to be deleted later
					additionalAttributes: term.attributes
				}
				termNameToId[name] = id
				parentTermNames.add(terms[id].parent_name)
			} catch (e) {
				throw `Line ${lineNum} error: ${e}`
			}
		}
		// some parent term levels may not have entries
		trackMissingTerms(termNameToId, terms, parentTermNames, parent2ChildOrder)

		for (const id in terms) {
			const term = terms[id]
			term.child_order = parent2ChildOrder.get(term.parent_name).indexOf(term.name) + 1
			term.isleaf = !parentTermNames.has(term.name)
			term.parent_id = termNameToId[term.parent_name] || null
			delete term.parent_name
			delete term.lineNum
			//term.ancestry = term.ancestry.map(name => termNameToId[name]).filter(d=>!!d)
			delete term.ancestry
		}
	}
	return { terms: Object.values(terms) }
}

/*
 **** Parsing Functions for Phenotree ****
 */

function parseCategories(type, catJSON, addAttrJSON, lineNum, varName) {
	if (!type) throw `No type provided for variable: ${varName} on line ${lineNum}`

	const term = {
		type,
		values: catJSON == '' || catJSON == undefined ? {} : JSON.parse(catJSON),
		attributes: addAttrJSON == '' || addAttrJSON == undefined ? {} : JSON.parse(addAttrJSON)
	}

	validateNumericTermCategories(term)

	if (term.type == 'categorical') {
		term.groupsetting = { inuse: false }
	}

	return term
}

function trackMissingTerms(termNameToId, terms, parentTermNames, parent2ChildOrder) {
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
					throw `Different parents for term=${name}, '${term.ancestry[i - 1]}' and '${ancestor.parent_name}'`
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

function validateNumericTermCategories(term) {
	if (term.type != 'integer' && term.type != 'float') return
	// term is numeric
	if (!term.values) return // .values{} is optional
	if (typeof term.values != 'object') throw 'numeric .values{} is not object'
	// values{} keys should be uncomputable categories, auto-assign the flag here
	// also make sure keys can be cast into numbers
	for (const key in term.values) {
		if (key == '') throw 'Cannot use empty string as an uncomputable category'
		// key is not empty string
		const tmp = Number(key)
		if (Number.isNaN(tmp)) {
			// this is by design so that all values in the db to match the column type for that value, otherwise the generated SQL statements would always have to include
			throw `Uncomputable category of a numeric term is required to be a number (here uses non-numeric value of ${key}).`
		}
		// key is a valid category because it can be casted into a number
		term.values[key].uncomputable = true
	}
}
