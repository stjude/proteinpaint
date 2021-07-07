if (process.argv.length != 4) {
	console.log('<phenotree file> <outcomes file>')
	process.exit()
}

console.error('\nRUNNING validate.ctcae.js ...')

/*
to be run three times:
1. sjlife ctcae
2. ccss ctcae
3. sjlife+ccss secondary neoplasm

<phenotree file>
should only have chc terms
use that to validate terms in "outcomes" file and find any mismatch
load outcome terms from phenotree:
first branch: Graded Adverse Events
second branch: organ system
third branch: grouped condition
forth branch: individual condition, maybe missing

<outcomes file>
header line required, "sample_id" identifies the column of integer sample ids
age, yeartoevent, grade are all required


output minimized outcome data with following fields:
1. patient
2. graded condition
3. grade
4. age graded


sjlife ctcae file:
1	sample_id	11
2	root	Clinically-assessed Variables
3	first	Graded Adverse Events
4	second	Auditory System
5	third	Hearing loss
6	fourth
7	agegraded	12.684931507
8	yearstoevent	10.884931507
9	grade	1

ccss ctcae file:
1	sample_id	11
2	root	Self-reported Behavior and Outcome Variables
3	first	Graded Adverse Events
4	second	Auditory system
5	third	Loss of Hearing
6	agegraded
7	grade	0

secondary neoplasm file:
1	sample_id	11
2	root	Clinically-assessed Variables
3	first	Graded Adverse Events
4	second	Secondary Neoplasms
5	third	Non Melanoma Skin Cancer
6	fourth	Basal cell carcinoma
7	agegraded	45.621917808
8	yearstoevent	40.605479452
9	grade	2
*/

const phenotreefile = process.argv[2]
const outcomefile = process.argv[3]

const fs = require('fs')
const readline = require('readline')

// condition terms from phenotree, to sum up number of each grade, and find inconsistency with outcome file
const L1words = new Map(),
	L2words = new Map(),
	L3words = new Map(),
	L4words = new Map()
// k: word, v: { grade:count }

const lines = fs
	.readFileSync(phenotreefile, { encoding: 'utf8' })
	.trim()
	.split('\n')
for (let i = 1; i < lines.length; i++) {
	const l = lines[i].split('\t')

	const w1 = l[1] == '-' ? null : l[1].trim()
	const w2 = l[2] == '-' ? null : l[2].trim()
	const w3 = l[3] == '-' ? null : l[3].trim()
	const w4 = (l[4] || '-') == '-' ? null : l[4].trim()

	if (w1) L1words.set(w1, new Map())
	if (w2) L2words.set(w2, new Map())
	if (w3) L3words.set(w3, new Map())
	if (w4) L4words.set(w4, new Map())
}

const rl = readline.createInterface({ input: fs.createReadStream(outcomefile) })

let first = true
const L1err = new Set(),
	L2err = new Set(),
	L3err = new Set(),
	L4err = new Set()

const patient2condition = new Map()
/*
k: patient
v: {}
   k: condition
   v: [ {grade,age}, {} ]
*/

let sampleid,
	rootidx = 1,
	firstidx = 2,
	secondidx = 3,
	thirdidx = 4,
	fourthidx,
	ageidx,
	yearidx,
	gradeidx

rl.on('line', line => {
	if (first) {
		first = false
		const l = line.split('\t')
		sampleid = l.indexOf('sample_id')
		if (sampleid == -1) throw '"sample_id" column is missing'
		rootidx = l.indexOf('root')
		if (rootidx == -1) throw 'root missing'
		firstidx = l.indexOf('first')
		if (firstidx == -1) throw 'first missing'
		secondidx = l.indexOf('second')
		if (secondidx == -1) throw 'second missing'
		thirdidx = l.indexOf('third')
		if (thirdidx == -1) throw 'third missing'
		fourthidx = l.indexOf('fourth') // missing in ccss
		ageidx = l.indexOf('agegraded')
		if (ageidx == -1) throw 'agegraded missing from header'
		yearidx = l.indexOf('yearstoevent')
		if (yearidx == -1) throw 'yearstoevent missing'
		gradeidx = l.indexOf('grade')
		if (gradeidx == -1) throw 'grade missing from header'
		return
	}

	const l = line.split('\t')
	const patient = l[sampleid]
	const w1 = l[firstidx].replace(/"/g, '')
	const w2 = l[secondidx].replace(/"/g, '')
	const w3 = l[thirdidx].replace(/"/g, '')
	const w4 = fourthidx == -1 ? '' : l[fourthidx].replace(/"/g, '')

	const condition = w4 ? w4 : w3 ? w3 : w2
	if (!condition) console.error('unknown condition')

	const age = Number(l[ageidx])
	if (Number.isNaN(age)) console.error('invalid age', l[ageidx])
	const yearstoevent = Number(l[yearidx])
	if (Number.isNaN(yearstoevent)) console.error('invalid yearstoevent', l[yearidx])
	const grade = Number(l[gradeidx])
	if (!Number.isInteger(grade)) console.error('grade is not integer', l[gradeidx])

	// count grade for each condition
	if (w1) {
		if (L1words.has(w1)) {
			L1words.get(w1).set(grade, 1 + (L1words.get(w1).get(grade) || 0))
		} else {
			L1err.add(w1)
		}
	}
	if (w2) {
		if (L2words.has(w2)) {
			L2words.get(w2).set(grade, 1 + (L2words.get(w2).get(grade) || 0))
		} else {
			L2err.add(w2)
		}
	}
	if (w3) {
		if (L3words.has(w3)) {
			L3words.get(w3).set(grade, 1 + (L3words.get(w3).get(grade) || 0))
		} else {
			L3err.add(w3)
		}
	}
	if (w4) {
		if (L4words.has(w4)) {
			L4words.get(w4).set(grade, 1 + (L4words.get(w4).get(grade) || 0))
		} else {
			L4err.add(w4)
		}
	}

	// output row for this event
	console.log(patient + '\t' + condition + '\t' + grade + '\t' + age + '\t' + yearstoevent)

	// record event for this patient
	if (!patient2condition.has(patient)) {
		patient2condition.set(patient, {})
	}
	if (!patient2condition.get(patient)[condition]) {
		patient2condition.get(patient)[condition] = []
	}
	patient2condition.get(patient)[condition].push({ grade, age, yearstoevent })
})

rl.on('close', () => {
	if (L1err.size) for (const w of L1err) console.error('First branch mismatch:', w)
	if (L2err.size) for (const w of L2err) console.error('Second branch mismatch:', w)
	if (L3err.size) for (const w of L3err) console.error('Third branch mismatch:', w)
	if (L4err.size) for (const w of L4err) console.error('Forth branch mismatch:', w)

	let numberofevents = 0
	const conditions = new Set()

	for (const [patient, o] of patient2condition) {
		const o2 = {}
		for (const k in o) {
			conditions.add(k)
			numberofevents += o[k].length
			o2[k] = { conditionevents: o[k] }
		}
	}
	console.error(patient2condition.size + ' patients, ' + conditions.size + ' conditions, ' + numberofevents + ' events')

	for (const [w, o] of L1words) {
		console.error('L1', w)
		for (const [g, c] of o) {
			console.error('\tgrade ' + g + ': ' + c)
		}
	}
	for (const [w, o] of L2words) {
		console.error('L2', w)
		for (const [g, c] of o) {
			console.error('\tgrade ' + g + ': ' + c)
		}
	}
	for (const [w, o] of L3words) {
		console.error('L3', w)
		for (const [g, c] of o) {
			console.error('\tgrade ' + g + ': ' + c)
		}
	}
	for (const [w, o] of L4words) {
		console.error('L4', w)
		for (const [g, c] of o) {
			console.error('\tgrade ' + g + ': ' + c)
		}
	}

	//get_summary({ term: 'Cardiovascular System', bar_by_children: 1, value_by_most_recent: 1 }, patient2condition)
})

function get_summary(q, patient2condition) {
	/*
to get barchart-style summary for a given term
print result to stderr

note that only bar_by_children and value_by_maxgrade is supported!

q{}
.term
.value_by_?
.bar_by_?
*/
	const p2c = new Map()
	// k: parent term, v: a set of direct children terms
	for (const line of fs
		.readFileSync('termdb', { encoding: 'utf8' })
		.trim()
		.split('\n')) {
		const l = line.split('\t')
		const child = l[0],
			Parent = l[2]
		if (!p2c.has(Parent)) p2c.set(Parent, new Set())
		p2c.get(Parent).add(child)
	}

	if (q.bar_by_children) {
		const child2subcondition = get_child2sub(q.term, p2c)
		// k: descendent (any term under the given root)
		// v: subcondition, corresponding to a bar

		const child2samplecount = new Map()
		// k: subcondition
		// v: number of samples with this subcondition matching with the max/recent grade criteria

		for (const [patient, o] of patient2condition) {
			let matchconditions = new Set()

			if (q.value_by_maxgrade) {
				let maxgrade = 0
				for (const condition in o) {
					const subterm = child2subcondition.get(condition)
					if (!subterm) continue
					const grades = []
					for (const e of o[condition]) {
						if (e.grade == 0 || e.grade == 9) continue
						grades.push(e.grade)
					}
					if (grades.length == 0) continue
					const mg = Math.max(...grades)
					if (mg == maxgrade) {
						matchconditions.add(subterm)
					} else if (mg > maxgrade) {
						maxgrade = mg
						matchconditions = new Set([subterm])
					}
				}
			} else if (q.value_by_most_recent) {
				let lastage = 0
				for (const condition in o) {
					const subterm = child2subcondition.get(condition)
					if (!subterm) continue
					let thislastage = 0
					for (const e of o[condition]) {
						if (e.grade == 0 || e.grade == 9) continue
						thislastage = Math.max(e.age, thislastage)
					}
					if (thislastage == 0) continue
					if (thislastage == lastage) {
						matchconditions.add(subterm)
					} else if (thislastage > lastage) {
						lastage = thislastage
						matchconditions = new Set([subterm])
					}
				}
			} else {
				throw 'unknown value_by_?'
			}

			if (matchconditions.size == 0) continue
			for (const c of matchconditions) {
				child2samplecount.set(c, 1 + (child2samplecount.get(c) || 0))
			}
		}
		console.error(child2samplecount)
	}
}

function get_branch(term, p2c, branch) {
	if (p2c.has(term)) {
		for (const child of p2c.get(term)) {
			branch.add(child)
			get_branch(child, p2c, branch)
		}
	}
}

function get_child2sub(root, p2c) {
	const child2sub = new Map()
	// key: a descendent term in the branch of root
	// v: the subcondition of root
	for (const subcondition of p2c.get(root)) {
		child2sub.set(subcondition, subcondition)
		const set = new Set()
		get_branch(subcondition, p2c, set)
		for (const child of set) {
			child2sub.set(child, subcondition)
		}
	}
	return child2sub
}
