const serverconfig = require('../../serverconfig.json')
const path = require('path')
const fs = require('fs')
const Partjson = require('partjson')

/*
  Precompute dataset values to help speed up 
  server response as needed
*/

if (process.argv.length != 4) {
	console.log('<termdb> <annotation.outcome>, output to stdout for loading to db')
	process.exit()
}

const termdbfile = process.argv[2]
// input file with lines of term_id \t name \t parent_id \t {termjson}
const outcomesfile = process.argv[3]
// input file with lines of sample,term,grade,age_graded,yearstoevent

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

try {
	const terms = load_terms(termdbfile)
	// uncomment filter for faster testing
	const annotations = load_patientcondition(outcomesfile, terms) //.filter(d=>d.sample.slice(-2)=="19")
	annotations.sort((a, b) => (a.sample < b.sample ? 1 : a.sample < b.sample ? -1 : a.grade < b.grade ? 1 : -1))
	if (1) {
		// precomputing and writting tsv by sample
		// uses 1/2 memory and is >2x faster
		const rowsBySample = {}
		annotations.forEach(row => {
			if (!rowsBySample[row.sample]) rowsBySample[row.sample] = []
			rowsBySample[row.sample].push(row)
		})
		const pj = getPj(terms)
		for (const sample in rowsBySample) {
			pj.refresh({ data: rowsBySample[sample] })
			generate_tsv(pj.tree.bySample)
		}
	} else {
		// uses more memory and takes longer
		// keep for now to compare and verify
		// that optimized processing and template are correct
		const pj = getPj(terms, annotations)
		generate_tsv(pj.tree.bySample)
	}

	if (missingfromtermdb.size) {
		console.error(missingfromtermdb.size + ' CHC terms missing from db: ' + [...missingfromtermdb])
	}
} catch (e) {
	console.error(e.message || e)
	if (e.stack) console.error(e.stack)
}

function load_terms(termdbfile) {
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
		if (term.type == 'condition') {
			// remove the top-most terms, [..., CTCAE, root]
			term.conditionlineage = get_term_lineage([id], id, child2parent).slice(0, -2)
		}
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

function load_patientcondition(outcomesfile, terms) {
	// outcomesfiles: lines of tab-separated sample,term,grade,age_graded,yearstoevent
	const annotations = []
	for (const line of fs
		.readFileSync(outcomesfile, { encoding: 'utf8' })
		.trim()
		.split('\n')) {
		const l = line.split('\t')
		const grade = Number(l[2])
		if (uncomputableGrades.has(grade)) continue
		const sample = l[0]
		const term_id = l[1]
		const term = terms[term_id]
		if (!term) {
			missingfromtermdb.add(term_id)
			continue
		}
		if (!term.conditionlineage) {
			console.error('missing lineage: ' + term.id)
			continue
		}
		annotations.push({
			sample,
			term_id,
			grade,
			age: Number(l[3]),
			lineage: term.conditionlineage
		})
	}
	return annotations
}

function getPj(terms, data) {
	return new Partjson({
		data,
		template: {
			bySample: {
				$sample: {
					byCondition: {
						'$lineage[]': {
							term_id: '@branch',
							maxGrade: '<$grade',
							':__mostRecentAge': '<$age',
							children: ['=child()'],
							computableGrades: ['$grade', 'set'],
							'__:childrenAtMaxGrade': ['=childrenAtMaxGrade(]'],
							'__:childrenAtMostRecent': ['=childrenAtMostRecent(]'],
							'~gradesByAge': {
								//'$age': ['$grade', 'set']
								'=currMostRecentAge()': ['$grade', 'set']
							},
							'__:mostRecentGrades': '=mostRecentGrades()'
						}
					}
				}
			}
		},
		'=': {
			child(row, context) {
				if (context.branch == row.term_id) return
				const i = row.lineage.indexOf(context.branch)
				return row.lineage[i - 1]
			},
			childrenAtMaxGrade(row, context) {
				if (!Array.isArray(context.self.children)) return []
				const byCondition = context.parent
				const ids = new Set()
				for (const id of context.self.children) {
					if (byCondition[id].maxGrade == context.self.maxGrade) {
						ids.add(id)
					}
				}
				return [...ids]
			},
			childrenAtMostRecent(row, context) {
				if (!Array.isArray(context.self.children)) return []
				const byCondition = context.parent
				const ids = new Set()
				for (const id of context.self.children) {
					if (byCondition[id].mostRecentAge == context.self.mostRecentAge) {
						ids.add(id)
					}
				}
				return [...ids]
			},
			mostRecentGrades(row, context) {
				return context.self.gradesByAge[context.self.mostRecentAge]
					? [...context.self.gradesByAge[context.self.mostRecentAge]]
					: []
			},
			currMostRecentAge(row, context) {
				if (context.parent.mostRecentAge == row.age) return row.age
			}
		}
	})
}

// will output to file via bash argument
function generate_tsv(bySample) {
	//console.log(Object.keys(bySample).length); return;
	let csv = '',
		numSamples = 0,
		numRows = 0
	for (const sample in bySample) {
		numSamples++
		for (const termid in bySample[sample].byCondition) {
			const subresult = bySample[sample].byCondition[termid]

			if (!subresult.mostRecentGrades) subresult.mostRecentGrades = []
			const maxIsAlsoMostRecentGrade = subresult.mostRecentGrades.includes(subresult.maxGrade) ? 1 : 0
			console.log([sample, termid, 'grade', subresult.maxGrade, 1, 1, maxIsAlsoMostRecentGrade].join('\t'))

			for (const grade of subresult.mostRecentGrades) {
				if (grade !== subresult.maxGrade) {
					console.log([sample, termid, 'grade', grade, 1, 0, 1].join('\t'))
					numRows++
				}
			}

			if (!subresult.computableGrades) subresult.computableGrades = []
			for (const grade of subresult.computableGrades) {
				if (grade !== subresult.maxGrade && !subresult.mostRecentGrades.includes(grade)) {
					console.log([sample, termid, 'grade', grade, 1, 0, 0].join('\t'))
					numRows++
				}
			}

			if (!subresult.children) subresult.children = []
			if (!subresult.childrenAtMaxGrade) subresult.childrenAtMaxGrade = []
			if (!subresult.childrenAtMostRecent) subresult.childrenAtMostRecent = []

			for (const child of subresult.children) {
				if (!subresult.childrenAtMaxGrade.includes(child) && !subresult.childrenAtMostRecent.includes(child)) {
					console.log([sample, termid, 'child', child, 1, 0, 0].join('\t'))
					numRows++
				}
			}

			for (const child of subresult.childrenAtMaxGrade) {
				const isMostRecent = subresult.childrenAtMostRecent.includes(child) ? 1 : 0
				console.log([sample, termid, 'child', child, 1, 1, isMostRecent].join('\t'))
				numRows++
			}

			for (const child of subresult.childrenAtMostRecent) {
				if (!subresult.childrenAtMaxGrade.includes(child)) {
					console.log([sample, termid, 'child', child, 1, 0, 1].join('\t'))
					numRows++
				}
			}
		}
	}
	//write_file(precomputed_file, csv)
	//console.log('Saved precomputed csv to '+ precomputed_file +":")
	//console.log("number of samples="+ numSamples, ", rows="+ numRows)
}

function write_file(file, text) {
	return new Promise((resolve, reject) => {
		fs.writeFile(file, text, err => {
			if (err) reject('cannot write')
			resolve()
		})
	})
}
