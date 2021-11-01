// make ensembl to refseq isoform mapping

if (process.argv.length != 3) {
	console.log('<kgXref.txt> output to stdout')
	process.exit()
}

const fs = require('fs')
for (const line of fs
	.readFileSync(process.argv[2], { encoding: 'utf8' })
	.trim()
	.split('\n')) {
	const l = line.split('\t')
	const ensembl = l[0].split('.')[0]
	if (l[1].startsWith('NR_') || l[1].startsWith('NM_')) {
		console.log(ensembl + '\t' + l[1])
	}
}
