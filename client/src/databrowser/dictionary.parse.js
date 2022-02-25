import { sayerror } from '../dom/error'
/*
------ EXPORTED ------ 
parseDictionary()
    - div
    - input: STR

------ Internal ------ 

Phenotree parsing:
	1. parseConfig()
    2. trackMissingTerms
*/

export function parseDictionary(div, input) {
	//autodetect file formats

	const terms = {}

	const lines = input.trim().split(/\r?\n/)
	// process the header line
	// could have used lines.shift() here, but will want to track actual line numbers later for errors
	const header = lines[0].split('\t')

	const term_idIndex = header.findIndex(l => l.toLowerCase().includes('term_id'))
	const varNameIndex = header.findIndex(l => l.toLowerCase().includes('variable name'))
	if (term_idIndex != -1) parseDataDictionary(div, lines, header)
	if (varNameIndex != -1) parsePhenotree(div, lines, header)
	if (varNameIndex != -1 && term_idIndex != -1) {
		sayerror(div, `Unrecognized file format. Please check the header names.`)
	}

	function parseDataDictionary(div, lines, header) {
		/*
        Parses data dictionary in a term_id to parent_id format
            - Parses tab delim data arranged in required cols: term_id, parent_id, name, type, values
            - Assumptions:
                1. Headers required
                2. No blank values in the term_id or parent_id columns. Top grandparents must include 'root' for the parent_id
                3. type?????
                4. No identical term ids 
        */
		const parIdIndex = header.findIndex(l => l.toLowerCase().includes('parent_id'))
		if (parIdIndex == -1) {
			sayerror(div, `Missing required 'parent_id' header`)
		}
		const nameIndex = header.findIndex(l => l.toLowerCase().includes('name'))
		if (nameIndex == -1) {
			sayerror(div, `Missing required 'Name' header`)
		}
		const typeIndex = header.findIndex(l => l.toLowerCase().includes('type'))
		if (typeIndex == -1) {
			sayerror(div, `Missing required 'Type' header`)
		}
		const valuesIndex = header.findIndex(l => l.toLowerCase().includes('values'))
		if (valuesIndex == -1) {
			sayerror(div, `Missing required 'Values' header`)
		}

		for (const [i, line] of lines.entries()) {
			if (i === 0) continue
			const lineNum = i + 1 //Use for error messages

			try {
				const cols = line.split('\t')
				const termId = cols[term_idIndex]
				const type = cols[typeIndex]

				terms[termId] = {
					id: termId,
					name: cols[nameIndex].trim().replace(/"/g, ''),
					parent_id: cols[parIdIndex] != 'root' ? cols[parIdIndex] : null,
					isleaf: cols[typeIndex] != 'non graphable' ? true : false,
					type: cols[typeIndex] != 'non graphable' ? cols[typeIndex] : null
				}

				if (type == 'categorical') {
					terms[termId].values = {}
					terms[termId].groupsetting = { inuse: false }
				}
				const values = cols[valuesIndex]
					.trim()
					.replace(/"/g, '')
					.split(';')

				for (const x of values) {
					const v = x.trim()
					if (v == '') continue
					const segments = v.split('=')
					const key = segments.shift()
					const label = segments.join('=')
					if (!label) sayerror(div, `${v} is not in a key = value format.`)
					if (!terms[termId].values) terms[termId].values = {}
					terms[termId].values[key] = { label: label }
				}

				if (type == 'integer' || type == 'float') {
					for (const k in terms[termId].values) terms[termId].values[k].uncomputable = true
				}
			} catch (e) {
				throw `Line ${lineNum} error: ${e}`
			}
		}
		return { terms: Object.values(terms) }
	}

	function parsePhenotree(div, lines, header) {
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
                4. No identical term ids
                5. All non-leaf names/ids must be unique. 
        */
		if (varNameIndex == -1) {
			sayerror(div, `Missing required 'Variable Name' header`)
		}

		const configIndex = header.findIndex(l => l.toLowerCase().includes('variable note'))
		if (configIndex == -1) {
			sayerror(div, `Missing required 'Variable Note' header`)
		}

		if (configIndex == -1 || varNameIndex == -1) {
			throw `invalid header` // informative error message is already displayed using sayerror
		}

		const levelColIndexes = header.map((c, i) => (c.toLowerCase().includes('level_') ? i : -1)).filter(i => i != -1)
		//If no level cols provided, use key/Variable name col as single level. Will print the id as name
		if (!levelColIndexes.length) levelColIndexes.push(varNameIndex)

		// caching and/or tracking variables
		const termNameToId = {}
		const parentTermNames = new Set()

		for (const [i, line] of lines.entries()) {
			if (i === 0) continue
			const lineNum = i + 1

			try {
				const cols = line.split('\t')
				const levelNames = levelColIndexes.map(i => cols[i].trim().replace(/"/g, '')).filter(c => c != '-')
				if (levelNames.length != new Set(levelNames).size) {
					sayerror(div, `Non-unique levels in line ${lineNum}: ${JSON.stringify(levelNames)}`)
					continue
				}
				const name = levelNames.pop()
				const firstDashIndex = cols.indexOf('-')
				if (firstDashIndex != -1 && firstDashIndex < cols.indexOf(name)) {
					sayerror(div, `Blank or '-' value detected between levels in line ${lineNum}`)
					continue
				}

				const term = parseConfig(div, lineNum, cols[configIndex], name)
				if (!term) continue
				// error handled in parseConfig()
				else if (!Object.keys(term).length) {
					// is it possible to have an empty term?
					sayerror(div, `Error: empty config column for term.id='${name}'.`)
					continue
				}

				const id = cols[varNameIndex] || name
				if (id in terms) {
					console.log(215, id)
					const orig = terms[id]
					sayerror(div, `Error: Multiple config rows for term.id='${id}': lines# ${orig.lineNum} and ${lineNum}`)
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
		trackMissingTerms(termNameToId, terms, parentTermNames, div)

		for (const id in terms) {
			const term = terms[id]
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

function parseConfig(div, lineNum, str, varName) {
	//NOT using uncomputable values in this iteration
	// const uncomputable_categories = new Set(['-994', '-995', '-996', '-997', '-998', '-999'])
	const configStr = str.replace('"', '').trim()
	if (!configStr) {
		sayerror(div, `Missing Variable Note string, line=${lineNum}, term='${varName}'`)
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
						div,
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
				if (!label) sayerror(div, 'field ' + (i + 1) + ' is not k=v: ' + field)
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

function trackMissingTerms(termNameToId, terms, parentTermNames, div) {
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
					sayerror(div, `Different parents for term=${name}, '${term.ancestry[i - 1]}' and '${ancestor.parent_name}'`)
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
