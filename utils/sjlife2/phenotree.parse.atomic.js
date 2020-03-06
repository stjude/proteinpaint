if (process.argv.length != 4) {
	console.log('<phenotree> <matrices/ folder> output termjson to stdout')
	process.exit()
}
/*
input files:
- phenotree MAP
- matrices

output:
json object for all atomic terms, but not CHC!!

step 1:
	go over phenotree to get a json backbone of all atomic terms, identify numeric terms
step 2:
	go over each matrix file to set the min/max of each numeric term
step 3:
	finalize bin scheme of numeric terms
	output

CHC is dealt in validate.ctcae.js
*/

const file_phenotree = process.argv[2]
const dir_matrix = process.argv[3]
const fs = require('fs')
const readline = require('readline')
const glob = require('glob')
const path = require('path')

// lines with this as L2 are CHC and not dealt with here
const L2_CHC = 'Graded Adverse Events'
const bins = {
	_min: 0,
	_max: 0, // temporary values
	default: {
		type: 'regular',
		bin_size: 5,
		stopinclusive: true,
		first_bin: {
			start: 0,
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
	for (const file of glob.sync(path.join(dir_matrix, '*'))) {
		await step2_parsematrix(file, key2terms)
	}

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
			skip_CHC++
			continue
		}
		// rest of lines are expected to be atomic term

		try {
			if (!configstr0 || !configstr0.trim()) throw 'configstr missing'
			const L1 = t1.trim(),
				L3 = t3.trim(),
				L4 = t4.trim(),
				L5 = t5.trim(),
				configstr = configstr0.trim()

			if (!L1) throw 'L1 missing'
			if (!L2) throw 'L2 missing'
			if (!L3) throw 'L3 missing'
			if (!L4) throw 'L4 missing'
			if (!L5) throw 'L5 missing'
			// if key0 is missing, use name
			let key = key0 ? key0.trim() : ''

			const name = get_name(L2, L3, L4, L5) // must have a name; throws if not
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
	if (L5 != '-') return L5
	if (L4 != '-') return L4
	if (L3 != '-') return L3
	if (L2 != '-') return L2
	throw 'name missing'
}

function parseconfig(str) {
	const term = {}

	// categorical term can be made at two places
	// numeric term is made at just one
	if (str == 'string') {
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
			// now that
		}

		for (let i = 1; i < l.length; i++) {
			const field = l[i].trim()
			const [key, value] = field.split('=')
			if (!value) throw 'field ' + (i + 1) + ' is not k=v: ' + field
			if (!term.values) term.values = {}
			term.values[key] = { label: value }
		}
	}

	if (term.type == 'categorical') {
		term.groupsetting = { disabled: true }
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
			for (let i = 0; i < l.length; i++) {
				const headerfield = headerlst[i]
				if (!headerfield) throw 'headerfield missing: ' + i
				const term = key2terms[headerfield]
				if (!term) {
					header_notermmatch.add(headerfield)
					continue
				}
				if (term.type == 'categorical' && term._set) {
					// to collect categories
					term._set.add(l[i])
					continue
				}
				if (term.type != 'integer' && term.type != 'float') {
					// not numeric
					continue
				}
				if (term.values) {
					// has special categories
					if (term.values[l[i]]) {
						// the value is a special category
						continue
					}
				}
				const value = Number(l[i])
				term.bins._min = Math.min(value, term.bins._min)
				term.bins._max = Math.max(value, term.bins._max)
			}
		})
		rl.on('close', () => {
			console.error('parsed ' + file)
			if (header_notermmatch.size) {
				console.error('header not matching with termID: ' + [...header_notermmatch].join(', '))
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
					console.error('empty _set for ' + termID)
					continue
				}
				for (const s of term._set) {
					term.values[s] = { label: s }
				}
				delete term._set
			}
			continue
		}
		if (!('_min' in term.bins)) throw '.bins._min missing'
		if (term.bins._min == term.bins._max) {
			console.error('no numeric data for ' + term.name)
			continue
		}
		// find bin size
		const range = term.bins._max - term.bins._min
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
		term.bins.default.first_bin.start = term.bins._min
		term.bins.default.first_bin.stop = term.bins.default.bin_size
		delete term.bins._min
		delete term.bins._max
	}
}
