/*
check to see if any terms from ./PRS/termdb.prs have same id with ./termdb
*/

const fs = require('fs')

const termids = loadAllTerms()

const duplicates = []

for (const line of fs
	.readFileSync('PRS/termdb.prs', { encoding: 'utf8' })
	.trim()
	.split('\n')) {
	const l = line.split('\t')
	if (termids.has(l[0])) duplicates.push(l[0])
}

if (duplicates.length) throw 'duplicating PRS terms: ' + duplicates.join(' | ')

function loadAllTerms() {
	const set = new Set()
	for (const line of fs
		.readFileSync('termdb', { encoding: 'utf8' })
		.trim()
		.split('\n')) {
		const l = line.split('\t')
		set.add(l[0])
	}
	return set
}
