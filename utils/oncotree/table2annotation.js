if (process.argv.length != 4) {
	console.log('<oncotree.sjsubset> <table.oncoid> output to stdout')
	process.exit()
}
const file_tree = process.argv[2]
const file_table = process.argv[3]

/*
must also annotate sample to parent terms
*/
const fs = require('fs')
const parse_c2p = require('./oncotree.parse.c2p.js').default
const c2p = parse_c2p(file_tree)

for (const line of fs
	.readFileSync(file_table, { encoding: 'utf8' })
	.trim()
	.split('\n')) {
	const l = line.split('\t')
	const sample = l[2]
	const cid = l[3]
	console.log(sample + '\t' + cid + '\t1')
	let pid = cid
	while (1) {
		pid = c2p.get(pid)
		if (pid) {
			console.log(sample + '\t' + pid + '\t1')
		} else {
			break
		}
	}
}
