/*
input is the "Phenotree Data Map" file as defined in phenotree.parse.term2term.js
do not validate phenotree content, this should has already been done in the prior script

output a file with 2 columns
each row is a term that will be used in phewas
terms are in original order as in phenotree file
column 1 is group name, where it is a hardcoded parent name of the term
column 2 is term id

*/

const level2_ctcaegraded = 'Graded Adverse Events'

const abort = m => {
	console.error('ERROR: ' + m)
	process.exit()
}

if (process.argv.length != 3) abort('<phenotree txt file> output to stdout')
const infile_phenotree = process.argv[2]

const fs = require('fs')
const path = require('path')

const lines = fs
	.readFileSync(infile_phenotree, { encoding: 'utf8' })
	.trim()
	.split('\n')

for (let i = 1; i < lines.length; i++) {
	const line = lines[i]
	if (!line.trim()) {
		// blank new lines are now introduced by the sjlife/ccss phenotree merging step
		continue
	}

	const l = line.split('\t')
	if (!l[3]) throw 'missing column 4 at line ' + i + ': ' + line
	if (!l[2]) throw 'missing column 3 at line ' + i + ': ' + line

	// id of this line, either l[5] or lowest name
	let thisid = l[5] ? str2level(l[5]) : null

	// names of each level, may be empty; if id is provided, levelX will be term name, otherwise will be term ID
	const level1 = str2level(l[0]),
		level2 = str2level(l[1]),
		level3 = str2level(l[2]),
		level4 = str2level(l[3]),
		level5 = str2level(l[4] || '-') // level 5 is missing from certain terms e.g. ccss ctcae events

	if (!thisid) {
		if (!level2) {
			thisid = level1
		} else if (!level3) {
			thisid = level2
		} else if (!level4) {
			thisid = level3
		} else if (!level5) {
			thisid = level4
		} else {
			thisid = level5
		}
	}

	if (thisid == 'ctcae_graded') continue

	if (thisid == 'diaggrp') {
		console.log('Diagnosis\tdiaggrp')
		continue
	}

	// if a groupname can be found for current term, then output
	// otherwise, do not output
	let groupname
	if (level1 == 'Demographic Variables') {
		groupname = level1
	} else if (level1 == 'Self-reported Behavior and Outcome Variables') {
		if (level2 == 'Medical Outcomes') {
			groupname = level2 + ', ' + level3
		} else if (level2 == 'Graded adverse events') {
			groupname = 'Late effect: ' + level3
		} else {
			groupname = level2
		}
	} else if (level1 == 'Clinically-assessed Variables') {
		if (level2 == 'Clinical Assessments') {
			if (level3 == 'Functional Assessment') {
				groupname = level3 + ', ' + level4
			} else {
				groupname = level2
			}
		} else if (level2 == 'Graded Adverse Events') {
			groupname = 'Late effect: ' + level3
		}
	}

	if (groupname) {
		console.log(groupname + '\t' + thisid)
	}
}

function str2level(str) {
	// parses column 1-5
	const v = str.trim()
	if (!v || v == '-') return null
	if (v.indexOf('"') != -1) abort('Level name should not have double quote: ' + str)
	return v
}
