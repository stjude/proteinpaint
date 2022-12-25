const serverconfig = require('../../serverconfig.json')
const path = require('path')
const fs = require('fs')
const readline = require('readline')
const Partjson = require('partjson')

/*
  Precompute dataset values to help speed up 
  server response as needed
*/

if (process.argv.length != 5) {
	console.log('<termdb> <annotation.matrix> <annotation.outcome>, output to stdout for loading to db')
	process.exit()
}

const termdbfile = process.argv[2]
// input file with lines of term_id \t name \t parent_id \t {termjson}
const matrixfile = process.argv[3]
// input file with lines sample,term, ...
const outcomesfile = process.argv[4]
// input file with lines of sample, ...
const missingfromtermdb = new Set()
// term ids from annotation.* but missing from termdb

main()

async function main() {
	try {
		const terms = load_terms(termdbfile)
		// uncomment filter for faster testing
		const annotations = []
		const cohortBySample = new Map()
		await load_file(annotations, matrixfile, terms, cohortBySample)
		await load_file(annotations, outcomesfile, terms, cohortBySample)
		const cohortByTermId = new Map()
		for (const row of annotations) {
			if (!cohortByTermId.has(row.term_id)) cohortByTermId.set(row.term_id, new Set())
			cohortByTermId.get(row.term_id).add(cohortBySample.get(row.sample))
		}
		console.warn('computing sample counts ...')
		const pj = getPj(
			terms,
			annotations, //.filter(d=>d.sample.slice(-2)=="19").slice(0,10000),
			cohortBySample,
			cohortByTermId
		)
		console.warn('partjson', pj.times, 'milliseconds')
		generate_tsv(pj.tree.byCohort)

		if (missingfromtermdb.size) {
			console.error(missingfromtermdb.size + ' terms missing from termdb: ' + [...missingfromtermdb])
		}
	} catch (e) {
		console.error(e.message || e)
		if (e.stack) console.error(e.stack)
	}
}

function load_terms(termdbfile) {
	console.warn('parsing ' + termdbfile + '...')
	const file = fs.readFileSync(termdbfile, { encoding: 'utf8' }) // throws upon invalid file name
	const terms = {}
	const child2parent = Object.create(null)
	// {term_id: parent id}

	for (const line of file.trim().split('\n')) {
		if (line[0] == '#') continue
		const [id, name, parent_id, jsontext] = line.split('\t')
		terms[id] = Object.assign(JSON.parse(jsontext), { id, parent_id, name })
		child2parent[id] = parent_id
	}

	for (const id in terms) {
		const term = terms[id]
		term.conditionlineage = get_term_lineage([id], id, child2parent)
		if (!term.conditionlineage.length) console.error('missing lineage: ' + id)
		term.conditionlineage.push('$ROOT$')
	}
	return terms
}

/* set term ancestry recursively */
function get_term_lineage(lineage, termid, child2parent) {
	const pa = child2parent[termid]
	if (pa) {
		lineage.push(pa)
		return get_term_lineage(lineage, pa, child2parent)
	} else {
		return lineage
	}
}

function load_file(annotations, file, terms, cohortBySample) {
	console.warn('parsing ' + file + '...')
	return new Promise((resolve, reject) => {
		const rl = readline.createInterface({ input: fs.createReadStream(file) })
		rl.on('line', line => {
			const [sample, term_id, value] = line.split('\t')
			if (term_id == 'subcohort') {
				cohortBySample.set(sample, value)
				return
			}

			const term = term_id in terms ? terms[term_id] : null
			if (!term) {
				missingfromtermdb.add(term_id)
			} else {
				annotations.push({
					sample,
					term_id,
					lineage: term.conditionlineage
				})
			}
		})
		rl.on('close', () => {
			resolve()
		})
	})
}

function getPj(terms, data, cohortBySample, cohortByTermId) {
	return new Partjson({
		data,
		template: {
			byCohort: {
				'=cohort(]': {
					byTerm: {
						'$lineage[]': ['$sample', 'set']
					}
				}
			}
		},
		'=': {
			cohort(row) {
				return cohortByTermId.get(row.term_id).size > 1
					? [cohortBySample.get(row.sample), 'CCSS,SJLIFE']
					: [cohortBySample.get(row.sample)]
			}
		}
	})
}

// will output to file via bash argument
function generate_tsv(byCohort) {
	//console.log(Object.keys(bySample).length); return;
	let numRows = 0
	for (const cohort in byCohort) {
		for (const term_id in byCohort[cohort].byTerm) {
			console.log([cohort, term_id, byCohort[cohort].byTerm[term_id].size].join('\t'))
			numRows++
		}
	}
	console.warn('number of rows=' + numRows) //, ", rows="+ numRows)
}

function write_file(file, text) {
	return new Promise((resolve, reject) => {
		fs.writeFile(file, text, err => {
			if (err) reject('cannot write')
			resolve()
		})
	})
}
