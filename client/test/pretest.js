#!/usr/bin/env node

// abort testing if TermdbTest is missing

const TESTHOST = process.argv[2] || 'http://localhost:3000'
if (!TESTHOST) throw `missing env.TESTHOST`

const dslabel = 'TermdbTest'

fetch(`${TESTHOST}/genomes`)
	.then(r => r.json())
	.then(r => {
		const termdbTest = Object.values(r.genomes || {}).find(
			g => g.name.includes('hg38') && Object.keys(g.datasets).includes(dslabel)
		)
		if (!termdbTest) {
			console.error(`Missing or ignored ${dslabel} dataset entry in serverconfig.json`)
		}
	})
