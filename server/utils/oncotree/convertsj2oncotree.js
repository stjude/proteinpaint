if (process.argv.length != 4) {
	console.log('<sj2oncotree mapping> <original sample table>; outputs to 2 files: table.oncoid and oncotree.sjmissing')
	process.exit()
}

const file_sj2oncotree = process.argv[2]
const file_rawtable = process.argv[3]
/*
output two files:

stdout:
table.oncoid with samples map to a valid id, either onco ID or sj code

stderr:
sj codes that have no onco mapping, output in a format mimick oncotree table and to be appended to termdb/oncotree.sjsubset 
*/

const fs = require('fs')

const sj2onco = new Map()
// k: sj code, v: oncotree code, only for those with valid mapping
const oncomissing = []
{
	const lines = fs
		.readFileSync(file_sj2oncotree, { encoding: 'utf8' })
		.trim()
		.split('\n')
	const sjcodes = new Set() // to detect duplicating codes
	for (let i = 1; i < lines.length; i++) {
		const [sjgroup, sjname, sjcode, onco] = lines[i].split('\t')

		if (sjcodes.has(sjcode)) console.error('Duplicating SJ code: ' + sjcode)
		sjcodes.add(sjcode)

		if (onco == '<NA>') {
			oncomissing.push('St. Jude only (<NA>)\t' + sjname + ' (' + sjcode + ')')
		} else {
			sj2onco.set(sjcode, onco)
		}
	}
}

if (oncomissing.length) {
	fs.writeFileSync('oncotree.sjmissing', '<NA> (<NA>)\n' + oncomissing.join('\n') + '\n')
}

const lines = fs
	.readFileSync(file_rawtable, { encoding: 'utf8' })
	.trim()
	.split('\n')
const lst = []
for (let i = 1; i < lines.length; i++) {
	const l = lines[i].split('\t')
	lst.push(l[0] + '\t' + l[1] + '\t' + l[3] + '\t' + (sj2onco.get(l[2]) || l[2]))
}
fs.writeFileSync('table.oncoid', lst.join('\n') + '\n')
