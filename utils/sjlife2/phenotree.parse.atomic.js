if (process.argv.length != 4) {
	console.log('<phenotree> <matrix> output termjson to stdout, diagnostic tabular table to stderr')
	process.exit()
}

/*
input files:

1. phenotree dictionary
   this file no longer includes CHC terms, only categorical/numerical
   CHC is dealt in validate.ctcae.js
1. sample-by-term matrix, for all terms in phenotree

output:
json object for all atomic terms

step 1:
	go over phenotree to initialize json backbone of categorical and numeric terms
	for categorical terms:
		if have predefined categories:
			populate .values{} with categories
			runtime SET ._values_foundinmatrix, for identifying items from .values not showing up in matrix
			runtime SET ._values_newinmatrix, for matrix values not in .values
		else:
			runtime SET ._set  to receive categories from matrix
	for numeric terms:
		runtime .bins._min, .bins._max to get range
		if have predefined categories:
			populate .values{} with categories
			runtime SET ._values_foundinmatrix
step 2:
	go over each matrix file to fill in runtime holders
step 3:
	finalize bin scheme of numeric terms
	output
	print out alerts and diagnostic info

*/

const file_phenotree = process.argv[2]
const file_matrix = process.argv[3]

const fs = require('fs')
const readline = require('readline')
const path = require('path')

const bins = {
	_min: null,
	_max: null, // temporary values
	default: {
		type: 'regular',
		bin_size: 5,
		stopinclusive: true,
		first_bin: {
			startunbounded: true,
			stop: 5,
			stopinclusive: true
		}
	}
}

const uncomputable_categories = new Set(['-994', '-995', '-996', '-997', '-998', '-999'])

main()

async function main() {
	// step 1
	const key2terms = step1_parsephenotree()
	// key: term ID
	// value: term json obj

	// step 2
	await step2_parsematrix(key2terms)

	// step 3
	step3_finalizeterms_diagnosticmsg(key2terms)

	console.log(JSON.stringify(key2terms, null, 2))
}

///////////////////// helpers

function step1_parsephenotree() {
	const key2terms = {}
	/*
	1	Root note	Self-reported Behavior and Outcome Variables
	2	First Branch	Genetic and Congenital Conditions
	3	Second Branch	Genetic Conditions
	4	Third Branch	Bloom's syndrome
	5	Fourth Branch	-
	6	SJLIFE Variable Name	gcbloom
	7	Variable Note	1=Yes; 2=No; 3=Not sure; -997=No response; -998=No response, not applicable; -999=No survey
	8	Missing Notes
	*/
	const lines = fs
		.readFileSync(file_phenotree, { encoding: 'utf8' })
		.trim()
		.split('\n')

	for (let i = 1; i < lines.length; i++) {
		const [t1, t2, t3, t4, t5, key0, configstr0] = lines[i].split('\t')

		try {
			if (!configstr0 || !configstr0.trim()) throw 'configstr missing'
			const L1 = t1.trim(),
				L2 = t2.trim(),
				L3 = t3.trim(),
				L4 = t4.trim(),
				L5 = t5.trim(),
				configstr = configstr0.trim()

			const name = get_name(L2, L3, L4, L5) // must have a name; throws if not
			// if key0 is missing, use name
			let key = key0 ? key0.trim() : ''

			if (!key) key = name

			const term = parseconfig(configstr)
			term.name = name
			key2terms[key] = term
		} catch (e) {
			throw 'Line ' + (i + 1) + ' error: ' + e
		}
	}
	return key2terms
}

function get_name(L2, L3, L4, L5) {
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

function parseconfig(str) {
	const term = {}

	if (str == 'string') {
		// is categorical term without predefined categories, need to collect from matrix, no further validation
		term.type = 'categorical'
		term.values = {}
		// list of categories not provided in configstr so need to sum it up from matrix
		term._set = new Set() // temp
	} else {
		const l = str.split(';')

		const f1 = l[0].trim() // special rule for 1st field
		if (f1 == 'integer') {
			term.type = 'integer'
			term.bins = JSON.parse(JSON.stringify(bins))
		} else if (f1 == 'float') {
			term.type = 'float'
			term.bins = JSON.parse(JSON.stringify(bins))
		} else {
			// must be categorical, f1 is either key=value or 'string'
			term.type = 'categorical'
			term.values = {}
			term._values_newinmatrix = new Set() // only for categorical but not numeric
			if (f1 == 'string') {
				// ignore
			} else {
				const [key, value] = f1.split(/(?<!\>|\<)=/)
				if (!value) throw 'first field is not integer/float/string, and not k=v: ' + f1
				term.values[key] = { label: value }
			}
		}

		// for all above cases, will have these two
		term._values_foundinmatrix = new Set()

		for (let i = 1; i < l.length; i++) {
			const field = l[i].trim()
			if (field == '') continue
			const [key, value] = field.split(/(?<!\>|\<)=/)
			if (!value) throw 'field ' + (i + 1) + ' is not k=v: ' + field
			if (!term.values) term.values = {}
			term.values[key] = { label: value }
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
		// later if a term has two or less categories, will disable group setting
	}

	return term
}

function step2_parsematrix(key2terms) {
	return new Promise((resolve, reject) => {
		let headerlst
		const rl = readline.createInterface({ input: fs.createReadStream(file_matrix) })
		const header_notermmatch = new Set()
		rl.on('line', line => {
			const l = line.split('\t')
			if (!headerlst) {
				// is header line
				headerlst = l
				return
			}

			// do not parse first three columns, starting from 4th column
			for (let i = 3; i < l.length; i++) {
				const headerfield = headerlst[i]
				if (!headerfield) throw 'headerfield missing: ' + i
				const str = l[i]
				if (str == '') {
					// empty
					continue
				}

				const term = key2terms[headerfield]
				if (!term) {
					header_notermmatch.add(headerfield)
					continue
				}
				if (term.type == 'categorical') {
					if (term._set) {
						// to collect categories
						term._set.add(str)
					} else {
						// to compare against .values
						if (term.values[str]) {
							// found
							term._values_foundinmatrix.add(str)
						} else {
							term._values_newinmatrix.add(str)
						}
					}
					continue
				}
				if (term.type != 'integer' && term.type != 'float') throw 'term type is not the expected integer/float'
				if (term.values) {
					// has special categories
					if (term.values[str]) {
						// found; do not consider for range
						term._values_foundinmatrix.add(str)
						continue
					}
				}
				const value = Number(str)
				if (term.bins._min == null) {
					term.bins._min = value
					term.bins._max = value
				} else {
					term.bins._min = Math.min(value, term.bins._min)
					term.bins._max = Math.max(value, term.bins._max)
				}
			}
		})
		rl.on('close', () => {
			if (header_notermmatch.size) {
				console.error('matrix header not defined in phenotree: ' + [...header_notermmatch].join(', '))
			}
			resolve()
		})
	})
}

function step3_finalizeterms_diagnosticmsg(key2terms) {
	// finalize terms and print diagnostic messages to stderr

	// diagnostic message is a tabular table and has a header
	console.error('Type\tVariable_ID\tMin/message\tMax\tHidden_categories\tVisible_categories')

	for (const termID in key2terms) {
		const term = key2terms[termID]

		if (term.type == 'categorical') {
			if (term._set) {
				if (term._set.size == 0) {
					console.error('ERR\t' + termID + '\tno categories specified in phenotree and not loaded in matrix')
					continue
				}
				for (const s of term._set) {
					term.values[s] = { label: s }
				}
				delete term._set
			} else {
				// has predefined categories in .values
				for (const k in term.values) {
					if (!term._values_foundinmatrix.has(k)) {
						console.error('ERR\t' + termID + '\tcategory not found in matrix: ' + k)
					}
				}
				if (term._values_newinmatrix.size) {
					for (const k of term._values_newinmatrix) {
						console.error('ERR\t' + termID + '\tcategory not declared in phenotree: ' + k)
						term.values[k] = { label: k }
					}
				}
				delete term._values_foundinmatrix
				delete term._values_newinmatrix
			}

			// count how many categories, if <=2, disable group setting
			if (Object.keys(term.values).length <= 2) {
				delete term.groupsetting.inuse
				term.groupsetting.disabled = true
			}

			// diagnostic output
			const uncomputable = [],
				computable = []
			for (const k in term.values) {
				if (term.values[k].uncomputable) uncomputable.push(k)
				else computable.push(k)
			}
			console.error('CATEGORICAL\t' + termID + '\t\t\t' + uncomputable.join(',') + '\t' + computable.join(','))
			continue
		}

		if (term.type == 'integer' || term.type == 'float') {
			// numeric term

			if (term.values) {
				// has special categories, do the same validation
				for (const k in term.values) {
					if (!term._values_foundinmatrix.has(k)) {
						console.error('ERR\t' + termID + '\tcategory not found in matrix: ' + k)
					}
				}
				delete term._values_foundinmatrix
			}
			if (!('_min' in term.bins)) throw '.bins._min missing'
			if (term.bins._min == term.bins._max) {
				console.error('ERR\t' + termID + '\tno numeric data in matrix')
				continue
			}
			console.error(
				'NUMERICAL\t' +
					termID +
					'\t' +
					term.bins._min +
					'\t' +
					term.bins._max +
					(term.values ? '\t' + Object.keys(term.values).join(',') : '')
			)
			// find bin size
			const range = term.bins._max - term.bins._min
			term.bins.default.bin_size = Math.ceil(range / 5)
			term.bins.default.first_bin.stop = term.bins._min + term.bins.default.bin_size
			delete term.bins._min
			delete term.bins._max
			continue
		}
	}
}
