if (process.argv.length != 3) {
	console.log('<input matrix file> output db load data to stdout')
	process.exit()
}

const infile = process.argv[2]

const fs = require('fs')
const lines = fs
	.readFileSync(infile, { encoding: 'utf8' })
	.trim()
	.split('\n')
const header = lines[0].split('\t')
for (let i = 1; i < lines.length; i++) {
	const l = lines[i].split('\t')
	const sample = l[0]
	for (let j = 1; j < header.length; j++) {
		const v = l[j]
		if (v == '' || v == undefined) continue
		console.log(sample + '\t' + header[j] + '\t' + l[j])
	}
}
