/*
exported file has 3 columns:

1	Approved symbol	A2ML1
2	Previous symbols	CPAMD9
3	Synonyms	FLJ25179, p170


*/

if (process.argv.length != 3) {
	console.log('<HGNC download file with 3 columns: Approved symbol, previous symbols, synonyms> output to stdout')
	process.exit()
}

const fs = require('fs')
const lines = fs
	.readFileSync(process.argv[2], { encoding: 'utf8' })
	.trim()
	.split('\n')

for (let i = 1; i < lines.length; i++) {
	const l = lines[i].split('\t')

	const gene = l[0]

	if (l[1]) {
		l[1].split(', ').forEach(j => {
			console.log(j + '\t' + gene)
		})
	}
	if (l[2]) {
		l[2].split(', ').forEach(j => {
			console.log(j + '\t' + gene)
		})
	}
}
