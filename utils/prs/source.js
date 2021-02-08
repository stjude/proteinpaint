/* to bundle, at pp root directory, do:
$ npx webpack --config=utils/prs/webpack.config.prs.js

will produce "utils/prs/bin.js"
*/
if (process.argv.length < 5) {
	console.log(
		'<full path to vcf.gz> <snp tab file: chr/pos/alt/ref/weight> <pool number> <sample.idmap, optional> output to stdout'
	)
	process.exit()
}

const vcffile = process.argv[2]
const snpfile = process.argv[3]
const poolnumber = Number(process.argv[4])
const idmapfile = process.argv[5]

const fs = require('fs')
const { get_header_tabix } = require('../../modules/tabix')
const prs = require('../../modules/prs')

let idmap
if (idmapfile) {
	idmap = new Map()
	for (const line of fs
		.readFileSync(idmapfile, { encoding: 'utf8' })
		.trim()
		.split('\n')) {
		const l = line.split('\t')
		idmap.set(l[0], l[1])
	}
}

;(async () => {
	const lines = await get_header_tabix(vcffile)
	const samplenames = lines[lines.length - 1].split('\t').slice(9)
	if (idmap) {
		for (let i = 0; i < samplenames.length; i++) {
			samplenames[i] = idmap.get(samplenames[i])
		}
	}
	const snps = []
	for (const line of fs
		.readFileSync(snpfile, { encoding: 'utf8' })
		.trim()
		.split('\n')) {
		const l = line.split('\t')
		snps.push({
			chr: l[0],
			pos: Number(l[1]),
			effectallele: l[2],
			refallele: l[3],
			weight: Number(l[4])
		})
	}
	const result = await prs.compute({ poolnumber, snps, vcffile, samplenames, nochr: true })
	console.log('name\tCNT\tSCORESUM')
	for (const s of result) {
		console.log(`${s.name}\t${s.effalecount}\t${s.sum}`)
	}
})()
