if (process.argv.length != 5) {
	console.log('<termdb> <annotation.matrix> <annotation.outcome> output term2cohort to stdout')
	process.exit()
}

/*
output a file with 3 columns:
1. subcohort name, could be comma-joined
2. term id
3. sample count, always a union of samples from all cohorts

a child term A, it has 10 samples from sjlife, 20 samples from ccss
  as a result, term A also belongs to the "sjlife,ccss" cohort with 30 samples
one of A's parent or ancestor will inherit all cohorts and samples of A

*/

const fs = require('fs')
const readline = require('readline')
const subcohort_key = 'subcohort' // may be parameter
const root_id = '$ROOT$' // hardcoded root term id, does not exist in termdb,

// globals
const infile_termdb = process.argv[2]
const infile_matrix = process.argv[3]
const infile_outcome = process.argv[4]
const c2p = new Map()
// k: child id, v: parent id
const c2cohort = new Map()
// k: child id, v: Map()
// k: cohort, v: Set of samples
const sample2cohort = new Map()
// k: sample, v: cohort, just one, may expand to multiple
const term2cohort = new Map()
// same as c2cohort, but for all terms

main()

async function main() {
	get_c2p()
	await get_sample2cohort()
	await parse_matrix()
	await parse_outcome()
	print_result()
}

function get_c2p() {
	for (const line of fs
		.readFileSync(infile_termdb, { encoding: 'utf8' })
		.trim()
		.split('\n')) {
		const l = line.split('\t')
		c2p.set(l[0], l[2] || root_id)
	}
}

function get_sample2cohort() {
	// from matrix
	return new Promise((resolve, reject) => {
		const rl = readline.createInterface({ input: fs.createReadStream(infile_matrix) })
		rl.on('line', line => {
			const [sample, tid, value] = line.split('\t')
			if (tid == subcohort_key) {
				sample2cohort.set(sample, value)
			}
		})
		rl.on('close', () => {
			console.error('sample2cohort{} loaded')
			resolve()
		})
	})
}

function parse_matrix() {
	return new Promise((resolve, reject) => {
		const rl = readline.createInterface({ input: fs.createReadStream(infile_matrix) })
		rl.on('line', line => {
			const [sample, tid, value] = line.split('\t')
			if (tid == subcohort_key) return
			const cohortofthissample = sample2cohort.get(sample)
			if (!cohortofthissample) throw `unknown cohort for matrix sample "${sample}"`
			if (!c2cohort.has(tid)) c2cohort.set(tid, new Map())
			if (!c2cohort.get(tid).has(cohortofthissample)) c2cohort.get(tid).set(cohortofthissample, new Set())
			c2cohort
				.get(tid)
				.get(cohortofthissample)
				.add(sample)
		})
		rl.on('close', () => {
			console.error(infile_matrix + ' parsed')
			resolve()
		})
	})
}
function parse_outcome() {
	return new Promise((resolve, reject) => {
		const rl = readline.createInterface({ input: fs.createReadStream(infile_outcome) })
		rl.on('line', line => {
			const [sample, tid] = line.split('\t')
			const cohortofthissample = sample2cohort.get(sample)
			if (!cohortofthissample) throw `unknown cohort for outcome sample "${sample}"`
			if (!c2cohort.has(tid)) c2cohort.set(tid, new Map())
			if (!c2cohort.get(tid).has(cohortofthissample)) c2cohort.get(tid).set(cohortofthissample, new Set())
			c2cohort
				.get(tid)
				.get(cohortofthissample)
				.add(sample)
		})
		rl.on('close', () => {
			console.error(infile_outcome + ' parsed')
			resolve()
		})
	})
}
function print_result() {
	// trace back
	for (const [cid, cohort2samples] of c2cohort) {
		/* for the current child term,
		if it is annotated to sjlife & ccss, insert "sjlife,ccss" to cohort2samples
		as if a parent term has one child for sjlife, and another child for ccss,
		then non of the 3 terms should appear for sjlife+ccss combined
		*/
		if (cohort2samples.size > 1) {
			// for now assume just two cohorts
			const [k1, k2] = [...cohort2samples.keys()]
			const newcohortkey = [...cohort2samples.keys()].sort().join(',')
			const unionsamples = new Set()
			for (const s of cohort2samples.get(k1)) unionsamples.add(s)
			for (const s of cohort2samples.get(k2)) unionsamples.add(s)
			cohort2samples.set(newcohortkey, unionsamples)
		}

		term2cohort.set(cid, cohort2samples)
		let pid = c2p.get(cid)
		while (pid) {
			if (!term2cohort.has(pid)) term2cohort.set(pid, new Map())
			for (const [cohort, sampleset] of cohort2samples) {
				if (!term2cohort.get(pid).has(cohort)) term2cohort.get(pid).set(cohort, new Set())
				for (const s of sampleset)
					term2cohort
						.get(pid)
						.get(cohort)
						.add(s)
			}
			pid = c2p.get(pid)
		}
	}

	// output
	for (const [tid, cohort2samples] of term2cohort) {
		for (const [cohort, sampleset] of cohort2samples) {
			console.log(cohort + '\t' + tid + '\t' + sampleset.size)
		}
	}
}
