/*
annotation.outcome can contain lines from terms not found in termdb
this is because validate.ctcae.js is unable to identify invalid terms (e.g. duplicated term IDs that are currently dropped by phenotree.parse.term2term.js
*/

if (process.argv.length != 4) {
	console.log('<termdb> <annotation.outcome> modifies 2nd file in-place by dropping lines with unknown terms')
	process.exit()
}

const fs = require('fs'),
	readline = require('readline')

const termFile = process.argv[2],
	annoFile = process.argv[3]

const tidset = new Set()
for (const line of fs
	.readFileSync(termFile, { encoding: 'utf8' })
	.trim()
	.split('\n')) {
	tidset.add(line.split('\t')[0])
}

const lines = []
let skipcount = 0
for (const line of fs
	.readFileSync(annoFile, { encoding: 'utf8' })
	.trim()
	.split('\n')) {
	const l = line.split('\t')
	if (!tidset.has(l[1])) {
		skipcount++
		continue
	}
	lines.push(line)
}

console.log(`${annoFile}: ${skipcount} lines skipped for unknown terms`)

const tmp = Math.random().toString()
fs.writeFileSync(tmp, lines.join('\n'))
fs.renameSync(tmp, annoFile)
