// quick treatment for terms like "Age at ....", assuming years
//
// does not apply to months

if (process.argv.length != 4) {
	console.log('<termdb, previous version> <keep/manual.termconfig>; output to stdout')
	process.exit()
}

const fs = require('fs')
const file_termdb = process.argv[2]
const file_termconfig = process.argv[3]
const idset = new Set() // term id with config, will not overwrite with auto configs
for (const line of fs
	.readFileSync(file_termconfig, { encoding: 'utf8' })
	.trim()
	.split('\n')) {
	console.log(line)
	idset.add(line.split('\t')[0])
}
let count = 0
for (const line of fs
	.readFileSync(process.argv[2], { encoding: 'utf8' })
	.trim()
	.split('\n')) {
	const l = line.split('\t')
	const id = l[0]
	if (idset.has(id)) continue
	const name = l[1]
	if (name.startsWith('Age at ') || name.endsWith(' age')) {
		console.log(id + '\tbins\tlabel_offset=1;bin_size=10;first_bin.stop=10;last_bin.start=50')
		count++
	}
}
console.error(count + ' age terms with fixed binning scheme')
