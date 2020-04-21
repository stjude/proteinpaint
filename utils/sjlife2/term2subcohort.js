if (process.argv.length != 5) {
	console.log('<termdb> <annotation.matrix> <annotation.outcome> output term2cohort to stdout')
	process.exit()
}

const fs = require('fs')
const readline = require('readline')

// globals
const infile_termdb = process.argv[2]
const infile_matrix = process.argv[3]
const infile_outcome = process.argv[4]
const c2p = new Map()
// k: child id, v: parent id
const c2cohort = new Map()
// k: child id, v: Set of cohort names
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
		c2p.set(l[0], l[2])
	}
}

function get_sample2cohort() {
	// from matrix
	return new Promise((resolve, reject) => {
		const rl = readline.createInterface({ input: fs.createReadStream(infile_matrix) })
		rl.on('line', line => {
			const l = line.split('\t')
			if (l[1] == 'subcohort') {
				sample2cohort.set(l[0], l[2])
			}
		})
		rl.on('close', () => {
			console.error('sample2subcohort loaded')
			resolve()
		})
	})
}

function parse_matrix() {
	return new Promise((resolve, reject) => {
		const rl = readline.createInterface({ input: fs.createReadStream(infile_matrix) })
		rl.on('line', line => {
			const [sample, tid, value] = line.split('\t')
			if (tid == 'subcohort') return
			const cohortofthissample = sample2cohort.get(sample)
			if (!cohortofthissample) throw 'unknown cohort for matrix sample ' + sample
			if (!c2cohort.has(tid)) c2cohort.set(tid, new Set())
			c2cohort.get(tid).add(cohortofthissample)
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
			if (!cohortofthissample) throw 'unknown cohort for outcome sample ' + sample
			if (!c2cohort.has(tid)) c2cohort.set(tid, new Set())
			c2cohort.get(tid).add(cohortofthissample)
		})
		rl.on('close', () => {
			console.error(infile_outcome + ' parsed')
			resolve()
		})
	})
}
function print_result() {
	// trace back
	for (const [cid, cohortset] of c2cohort) {
		// if a child term is annotated to sjlife & ccss, create new label "sjlife,ccss"
		// as if a parent term has one child for sjlife, and another child for ccss,
		// then non of the 3 terms should appear for sjlife+ccss combined
		if (cohortset.size > 1) {
			// for now assume just two cohorts
			cohortset.add(
				[...cohortset]
					.sort()
					.reverse()
					.join(',')
			)
		}

		term2cohort.set(cid, cohortset)
		let pid = c2p.get(cid)
		while (pid) {
			if (!term2cohort.has(pid)) term2cohort.set(pid, new Set())
			for (const cohort of cohortset) term2cohort.get(pid).add(cohort)
			pid = c2p.get(pid)
		}
	}

	// output
	for (const [tid, s] of term2cohort) {
		for (const c of s) {
			console.log(c + '\t' + tid)
		}
	}
}
