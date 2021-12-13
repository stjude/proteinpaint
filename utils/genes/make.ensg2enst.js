const fs = require('fs')
for (const line of fs
	.readFileSync('knownCanonical.txt', { encoding: 'utf8' })
	.trim()
	.split('\n')) {
	const l = line.split('\t')
	console.log(l[5].split('.')[0] + '\t' + l[4].split('.')[0])
}
