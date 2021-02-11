/*
input: "matrix.stringID", with two columns of string id for sjlife and ccss
output:
1. matrix, just one column of numeric id
2. sample.idmap, with both sjlife and ccss (if available) to the same integer id
*/

const fs = require('fs')
const lines = fs
	.readFileSync('matrix.stringID', { encoding: 'utf8' })
	.trim()
	.split('\n')
let id = 1
const rows = []
for (let i = 0; i < lines.length; i++) {
	const l = lines[i].split('\t')
	if (i == 0) {
		console.log('sample\t' + l.slice(2).join('\t'))
		continue
	}
	if (l[0]) rows.push(id + '\t' + l[0])
	if (l[1]) rows.push(id + '\t' + l[1])
	console.log(id + '\t' + l.slice(2).join('\t'))
	id++
}

fs.writeFileSync('samples.idmap', rows.join('\n') + '\n')
