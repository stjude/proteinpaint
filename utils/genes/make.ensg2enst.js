if (process.argv.length != 3) {
	console.log('<wgEncodeGencodeAttrsV?.txt> knownCanonical.txt should be found at pwd; output to stdout')
	process.exit()
}

const gencodefile = process.argv[2]

const fs = require('fs')

const ensg2enst = new Map()
// k: ensg
// v: canonical enst

for (const line of fs
	.readFileSync('knownCanonical.txt', { encoding: 'utf8' })
	.trim()
	.split('\n')) {
	const l = line.split('\t')
	const ensg = l[5].split('.')[0]
	const enst = l[4].split('.')[0]
	ensg2enst.set(ensg, enst)
	console.log(ensg + '\t' + enst)
}

const symbol2ensg = new Map()
// k: symbol, v: ensg
// need to deduplicate
for (const line of fs
	.readFileSync(gencodefile, { encoding: 'utf8' })
	.trim()
	.split('\n')) {
	const l = line.split('\t')
	const ensg = l[0].split('.')[0]
	const symbol = l[1]
	symbol2ensg.set(symbol, ensg)
}
for (const [symbol, ensg] of symbol2ensg) {
	const enst = ensg2enst.get(ensg)
	if (enst) console.log(symbol + '\t' + enst)
}
