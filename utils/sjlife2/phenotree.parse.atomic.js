if (process.argv.length != 4) {
	console.log('<phenotree> <matrix> output termjson to stdout')
	process.exit()
}
/*
input files:
- phenotree MAP
- matrices

output:
json object for all atomic terms, but not CHC!!

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

CHC is dealt in validate.ctcae.js
*/

const file_phenotree = process.argv[2]
const file_matrix = process.argv[3]
const fs = require('fs')
const readline = require('readline')
const path = require('path')

// lines with this as L2 are CHC and not dealt with here
const L2_CHC = 'Graded Adverse Events'
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

;(async () => {
	// step 1
	const key2terms = step1_parsephenotree()
	// key: term ID
	// value: term json obj

	// step 2
	//for (const file of glob.sync(path.join(dir_matrix, '*'))) { }
	await step2_parsematrix(file_matrix, key2terms)

	// step 3
	step3_finalizeterms(key2terms)

	console.log(JSON.stringify(key2terms, null, 2))
})()

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

	let skip_CHC = 0

	for (let i = 1; i < lines.length; i++) {
		const [t1, t2, t3, t4, t5, key0, configstr0] = lines[i].split('\t')

		const L2 = t2.trim()
		if (L2 == L2_CHC) {
			if (!key0) {
				// key not provided, this line is a chc term, not parsed here
				skip_CHC++
				continue
			} else {
				// the key should be ctcae_graded and is a categorical, to be parsed here
			}
		}
		// rest of lines are expected to be atomic term

		try {
			if (!configstr0 || !configstr0.trim()) throw 'configstr missing'
			const L1 = t1.trim(),
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
			throw e + ': line ' + (i + 1)
		}
	}
	console.error('skipped ' + skip_CHC + ' CHC lines')
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
			// must be categorical and key=value
			const [key, value] = f1.split('=')
			if (!value) throw 'first field is not integer/float, and not k=v: ' + f1
			term.type = 'categorical'
			term.values = {}
			term.values[key] = { label: value }
			term._values_newinmatrix = new Set() // only for categorical but not numeric
		}

		// for all above cases, will have these two
		term._values_foundinmatrix = new Set()

		for (let i = 1; i < l.length; i++) {
			const field = l[i].trim()
			if (field == '') continue
			const [key, value] = field.split('=')
			if (!value) throw 'field ' + (i + 1) + ' is not k=v: ' + field
			if (!term.values) term.values = {}
			term.values[key] = { label: value }
			if (term.type == 'integer' || term.type == 'float') term.values[key].uncomputable = true
		}
	}

	if (term.type == 'categorical') {
		term.groupsetting = { inuse: false }
		// later if a term has two or less categories, will disable group setting
	}

	return term
}

function step2_parsematrix(file, key2terms) {
	return new Promise((resolve, reject) => {
		let headerlst
		const rl = readline.createInterface({ input: fs.createReadStream(file) })
		const header_notermmatch = new Set()
		rl.on('line', line => {
			const l = line.split('\t')
			if (!headerlst) {
				// is header line
				headerlst = l
				return
			}

			// do not parse first 1-4 columns, starting from 5th column
			for (let i = 4; i < l.length; i++) {
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
			console.error('parsed ' + file)
			if (header_notermmatch.size) {
				console.error('matrix header not defined in phenotree: ' + [...header_notermmatch].join(', '))
			}
			resolve()
		})
	})
}
function step3_finalizeterms(key2terms) {
	for (const termID in key2terms) {
		const term = key2terms[termID]
		if (term.type == 'categorical') {
			if (term._set) {
				if (term._set.size == 0) {
					console.error('ERR - ' + termID + ': no categories specified in phenotree and not loaded in matrix')
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
						console.error('ERR - ' + termID + ': category "' + k + '" not found in matrix')
					}
				}
				if (term._values_newinmatrix.size) {
					for (const k of term._values_newinmatrix) {
						console.error('ERR - ' + termID + ': categories undeclared in phenotree: ' + k)
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
			continue
		}
		// numeric term
		if (term.values) {
			// has special cate, do the same validation
			for (const k in term.values) {
				if (!term._values_foundinmatrix.has(k)) {
					console.error('ERR - ' + termID + ': category "' + k + '" not found in matrix')
				}
			}
			delete term._values_foundinmatrix
		}
		if (!('_min' in term.bins)) throw '.bins._min missing'
		if (term.bins._min == term.bins._max) {
			console.error('ERR - ' + termID + ': no numeric data')
			continue
		}
		console.error('RANGE - ' + termID + ': ' + term.bins._min + ' ' + term.bins._max)
		// find bin size
		const range = term.bins._max - term.bins._min
		term.bins.default.bin_size = Math.ceil(range / 5)
		/*
		if (range > 10000) {
			term.bins.default.bin_size = 4000
		} else if (range > 4000) {
			term.bins.default.bin_size = 1000
		} else if (range > 1000) {
			term.bins.default.bin_size = 200
		} else if (range > 100) {
			term.bins.default.bin_size = 20
		} else {
			term.bins.default.bin_size = Math.ceil((term.bins._max - term.bins._min) / 5)
		}
		*/
		term.bins.default.first_bin.stop = term.bins._min + term.bins.default.bin_size
		delete term.bins._min
		delete term.bins._max
	}
}
