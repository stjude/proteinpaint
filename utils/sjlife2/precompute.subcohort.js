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

const uncomputableGrades = new Set([9])
/*
note that this has been removed from dataset.js file
for the moment hardcode uncomputable grade to be 9
{
	const ds = require(datasetjsfile)
	if (ds.cohort.termdb.patient_condition.uncomputable_grades) {
		for (const k in ds.cohort.termdb.patient_condition.uncomputable_grades) uncomputableGrades.add(Number(k))
	}
}
*/

const missingfromtermdb = new Set()
// term ids from annotation.outcome but missing from termdb

main()

async function main() {
	try {
		const terms = load_terms(termdbfile)
		// uncomment filter for faster testing
		const annotations = []
		const cohortBySample = {}
		await load_file(annotations, matrixfile, terms, cohortBySample)
		await load_file(annotations, outcomesfile, terms, cohortBySample)
		const cohortByTermId = {}
		for (const row of annotations) {
			if (!(row.term_id in cohortByTermId)) cohortByTermId[row.term_id] = new Set()
			cohortByTermId[row.term_id].add(cohortBySample[row.sample])
		}
		const pj = getPj(
			terms,
			annotations /*.filter(d=>d.sample.slice(-2)=="19").slice(0,10000)*/,
			cohortBySample,
			cohortByTermId
		)
		generate_tsv(pj.tree.byCohort)

		if (missingfromtermdb.size) {
			console.error(missingfromtermdb.size + ' CHC terms missing from db: ' + [...missingfromtermdb])
		}
	} catch (e) {
		console.error(e.message || e)
		if (e.stack) console.error(e.stack)
	}
}

function load_terms(termdbfile) {
	console.error('parsing ' + termdbfile + '...')
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
	console.error('parsing ' + file + '...')
	return new Promise((resolve, reject) => {
		const rl = readline.createInterface({ input: fs.createReadStream(file) })
		rl.on('line', line => {
			const [sample, term_id, value] = line.split('\t')
			const term = term_id in terms ? terms[term_id] : { id: term_id }
			if (!term) {
				missingfromtermdb.add(term_id)
			} else if (!term.conditionlineage) {
				if (term_id == 'subcohort') {
					cohortBySample[sample] = value
				}
				//console.error('missing lineage: ' + term.id)
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
						'$lineage[]': ['$sample']
					}
				}
			}
		},
		'=': {
			cohort(row) {
				if (row.term_id in cohortByTermId && cohortByTermId[row.term_id].size > 1) {
					return [cohortBySample[row.sample], 'SJLIFE,CCSS']
				} else {
					return [cohortBySample[row.sample]]
				}
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
			console.log([cohort, term_id, byCohort[cohort].byTerm[term_id].length].join('\t'))
			numRows++
		}
	}
	//write_file(precomputed_file, csv)
	//console.log('Saved precomputed csv to '+ precomputed_file +":")
	console.error('number of rows=' + numRows) //, ", rows="+ numRows)
}

function write_file(file, text) {
	return new Promise((resolve, reject) => {
		fs.writeFile(file, text, err => {
			if (err) reject('cannot write')
			resolve()
		})
	})
}
