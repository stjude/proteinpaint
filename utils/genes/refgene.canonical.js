if (process.argv.length != 3) {
	console.log('<ncbiRefSeqSelect.txt> output to stdout')
	process.exit()
}

const ncbiRefSeqSelect = process.argv[2]

const fs = require('fs')
for (const line of fs
	.readFileSync(ncbiRefSeqSelect, 'utf8')
	.trim()
	.split('\n')) {
	const l = line.split('\t')
	console.log(`${l[13 - 1]}\t${l[1].split('.')[0]}`)
}
