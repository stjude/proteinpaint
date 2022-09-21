/*
originally, phenotree/matrix.tree is saved from a sheet in the "Phenotree" excel file.
before running the script, must copy the "phenotree/matrix.tree" to "phenotree/matrix.tree.original"

input is phenotree/matrix.tree.original
output is phenotree/matrix.tree

modify the intermediate level name as below:
for immediate children under "Chemotherapy, First 5 Years of Therapy", append "First 5 years.." to term name
for immediate children under "Chemotherapy, Lifetime", append "Lifetime" to term name

this allows to differentiate the intermediate terms belonging to different lineages

this is the same trick for "Graded Adverse Events" vs "Graded adverse events"
*/

const infile = 'phenotree/matrix.tree'

const fs = require('fs')

const newlines = []

// these lines must exist in phenotree file
let hasLinesAboutFirst5 = false,
	hasLinesAboutLifetime = false

for (const line of fs
	.readFileSync(infile, { encoding: 'utf8' })
	.trim()
	.split('\n')) {
	const l = line.split('\t')

	if (l[2] == 'Chemotherapy, First 5 Years of Therapy') {
		hasLinesAboutFirst5 = true

		if (!l[3].endsWith('(First 5 Years of Therapy)')) l[3] += ' (First 5 Years of Therapy)'
		if (!l[4].endsWith('(First 5 Years of Therapy)')) l[4] += ' (First 5 Years of Therapy)'
	} else if (l[2] == 'Chemotherapy, Lifetime') {
		hasLinesAboutLifetime = true

		if (!l[3].endsWith('(Lifetime)')) l[3] += ' (Lifetime)'
		if (!l[4].endsWith('(Lifetime)')) l[4] += ' (Lifetime)'
	}

	newlines.push(l.join('\t'))
}

if (!hasLinesAboutFirst5) throw '"Chemotherapy, First 5 Years of Therapy" not in phenotree'
if (!hasLinesAboutLifetime) throw '"Chemotherapy, Lifetime" not in phenotree'

fs.writeFileSync(infile, newlines.join('\n') + '\n')
