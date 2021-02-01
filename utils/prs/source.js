if (process.argv.length != 5) {
	console.log('<full path to vcf.gz> <snp tab file: chr/pos/alt/ref/weight> <pool number> output to stdout')
	process.exit()
}

const vcffile = process.argv[2]
const snpfile = process.argv[3]
const poolnumber = Number(process.argv[4])

const fs = require('fs')
const utils = require('../../modules/utils')
const prs = require('../../modules/prs')

;(async () => {
	const lines = await utils.get_header_tabix(vcffile)
	const samplenames = lines[lines.length - 1].split('\t').slice(9)
	console.log(samplenames.length, 'samples')
	const snps = []
	for (const line of fs
		.readFileSync(snpfile, { encoding: 'utf8' })
		.trim()
		.split('\n')) {
		const l = line.split('\t')
		snps.push({
			chr: l[0],
			pos: Number(l[1]),
			ref: l[2],
			alt: l[3],
			weight: Number(l[4])
		})
	}
	const result = await prs.compute({ poolnumber, snps, vcffile, samplenames, nochr: true })
	console.log(result)
})()
