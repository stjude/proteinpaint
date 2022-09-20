if (process.argv.length != 5) {
	abort(
		process.argv[1] +
			' <text dump from gencode.bb> <kgXref.txt> <output file basename (gencode.hg?)> also writes "gencode.canonical" to current dir'
	)
}

const gencodefile = process.argv[2],
	kgxreffile = process.argv[3],
	outfile = process.argv[4]

const fs = require('fs'),
	exec = require('child_process').execSync,
	checkReadingFrame = require('../../server/src/checkReadingFrame'),
	parseBedLine = require('../../server/src/bedj.parseBed').parseBedLine

const enst2desc = new Map()
// k: ENST id
// v: desc
const categories = {
	coding: { color: '#004D99', label: 'Coding gene' },
	nonCoding: { color: '#009933', label: 'Noncoding gene' },
	problem: { color: '#FF3300', label: 'Problem' },
	pseudo: { color: '#FF00CC', label: 'Pseudogene' }
}

/*
1	ENST00000619216.1
2	NR_106918
3
4
5	MIR6859-1
6	NR_106918
7	NR_106918
8	Homo sapiens microRNA 6859-1 (MIR6859-1), microRNA. (from RefSeq NR_106918)
*/
for (const line of fs
	.readFileSync(kgxreffile, 'utf8')
	.trim()
	.split('\n')) {
	const l = line.split('\t')
	if (!l[0] || !l[7]) continue
	enst2desc.set(l[0].split('.')[0], l[7])
}

const out = [] // collect bedj lines for gencode.hg?.gz
const gene2canonical = [] // collect symbol\tenst rows

for (const line of fs
	.readFileSync(gencodefile, 'utf8')
	.trim()
	.split('\n')) {
	const l = line.split('\t')

	const obj = parseBedLine(l, enst2desc)

	out.push(`${l[0]}\t${l[1]}\t${l[2]}\t${JSON.stringify(obj)}`)

	//if(l[26-1].includes('canonical')) gene2canonical.push(l[18-1]+'\t'+isoform)
}

console.log(JSON.stringify(categories))

fs.writeFileSync(outfile, out.join('\n'))
exec('sort -k1,1 -k2,2n ' + outfile + ' > ' + outfile + '.sort')
exec('mv ' + outfile + '.sort ' + outfile)
exec('bgzip -f ' + outfile)
exec('tabix -f -p bed ' + outfile + '.gz')

//fs.writeFileSync('gencode.canonical', gene2canonical.join('\n'))

function abort(m) {
	console.error(m)
	process.exit()
}
