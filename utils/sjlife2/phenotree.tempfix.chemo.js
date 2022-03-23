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

const fs = require('fs')

for (const line of fs
	.readFileSync('phenotree/matrix.tree.original', { encoding: 'utf8' })
	.trim()
	.split('\n')) {
	const l = line.split('\t')
	if (l[2] == 'Chemotherapy, First 5 Years of Therapy') l[3] += ' (First 5 Years of Therapy)'
	else if (l[2] == 'Chemotherapy, Lifetime') l[3] += ' (Lifetime)'
	console.log(l.join('\t'))
}
