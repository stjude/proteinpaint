/*
generate grade=-1 lines and store them in the "precomputed" table

grade=-1 means "Not tested"
as the sjlife clinical assessment is risk-based, it will only assess patients deemed to have risk for a condition
if patient has low risk, the patient will not be assessed for it
thus many patients lack annotation for CHC terms
discussion with the PIs agreed on using "No condition / not tested" as the ref group in groupsetting
where ctcae_graded=true patients AND grade is not 1-5 belongs to this group
this is captured by grade=-1 in the precomputed table

note that grade=-1 does not exist in chronicevents table, which stores the actual events
*/

const fs = require('fs')
const readline = require('readline')

main()

async function main() {
	const [sjlifeGradedPatients, ccssAllPatients] = await getAllPatients()

	{
		const condition2sample = parse_file('./raw/intID/outcomes_sjlife.txt')
		// k: condition term id
		// v: set of samples with grades 0-5 for this condition
		for (const [condition, samples] of condition2sample) {
			for (const s of sjlifeGradedPatients) {
				if (!samples.has(s)) console.log(`${s}\t${condition}\tgrade\t-1\t0\t1\t0`)
			}
		}
	}
	{
		const condition2sample = parse_file('./raw/intID/subneoplasms.txt')
		for (const [condition, samples] of condition2sample) {
			for (const s of sjlifeGradedPatients) {
				if (!samples.has(s)) console.log(`${s}\t${condition}\tgrade\t-1\t0\t1\t0`)
			}
			for (const s of ccssAllPatients) {
				if (!samples.has(s)) console.log(`${s}\t${condition}\tgrade\t-1\t0\t1\t0`)
			}
		}
	}
}

/*
read the big annotation.matrix file
to get complete sets of ctcae-graded sjlife patients, and all ccss
*/
function getAllPatients() {
	return new Promise((resolve, reject) => {
		const rl = readline.createInterface({ input: fs.createReadStream('./annotation.matrix') })
		const sjlife = new Set()
		const ccss = new Set()
		rl.on('line', line => {
			const [s, t, v] = line.split('\t')
			if (t == 'ctcae_graded' && v == '1') {
				sjlife.add(s)
			} else if (t == 'subcohort' && v == 'CCSS') {
				ccss.add(s)
			}
		})
		rl.on('close', () => {
			resolve([sjlife, ccss])
		})
	})
}

/*
read the chc annotation file, output a mapping from condition, to sets of samples with grade 1-5 for this condition
will cover both leaf and non-leaf terms

outcomes_sjlife.txt
1	sample_id	5864
2	root	Clinically-assessed Variables
3	first	Graded Adverse Events
4	second	Auditory System
5	third	Hearing loss
6	fourth
7	agegraded	28.328767123
8	yearstoevent	11.569863014
9	grade	0

subneoplasms.txt
1	sample_id	2642
2	root	Clinically-assessed Variables
3	first	Graded Adverse Events
4	second	Secondary Neoplasms
5	third	Non Melanoma Skin Cancer
6	fourth	Basal cell carcinoma
7	agegraded	47.345205479
8	yearstoevent	42.328767123
9	grade	2

*/
function parse_file(file) {
	const lines = fs
		.readFileSync(file, { encoding: 'utf8' })
		.trim()
		.split('\n')
	lines.shift()
	const condition2sample = new Map()
	for (const line of lines) {
		const [sample, root, w1, w2, w3, w4, x, y, grade] = line.split('\t')
		if (grade == '9') continue // skip uncomputable
		// but do not skip grade=0 for no condition

		if (w2) {
			if (!condition2sample.has(w2)) condition2sample.set(w2, new Set())
			condition2sample.get(w2).add(sample)
		}
		if (w3) {
			if (!condition2sample.has(w3)) condition2sample.set(w3, new Set())
			condition2sample.get(w3).add(sample)
		}
		if (w4) {
			if (!condition2sample.has(w4)) condition2sample.set(w4, new Set())
			condition2sample.get(w4).add(sample)
		}
	}
	return condition2sample
}
