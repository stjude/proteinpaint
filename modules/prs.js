const utils = require('./utils')
const asyncPool = require('tiny-async-pool')
//const spawn = require('child_process').spawn
//const readline=require('readline')

/*
arg{}:
.poolnumber
.vcffile: full path to file, compressed and indexed
	FORMAT must have GT as first field
	GT must be delimited by '/'
.nochr: bool, if true, to use '1' but not 'chr1'
.dir: path to the index cache if is custom
	undefined for now
.snps: array of {chr,pos,ref,alt,weight}
.samplenames: array of sample names, full list from vcf file
	alternatively, it could be a list of array index from vcf header

returns a "samples" array, each ele:
{ name, sum, snpcount }
*/
exports.compute = async arg => {
	if (!Number.isInteger(arg.poolnumber)) throw '.poolnumber missing'
	if (!arg.vcffile) throw '.vcffile missing'
	if (!Array.isArray(arg.snps)) throw '.snps[] missing'
	if (arg.snps.length == 0) throw '.snps[] empty array'
	for (const s of arg.snps) {
		if (!s.chr) throw '.chr missing from a snp'
		if (!Number.isInteger(s.pos)) throw '.pos not integer for a snp'
		if (!s.ref) throw '.ref missing from a snp'
		if (!s.alt) throw '.alt missing from a snp'
		if (!Number.isFinite(s.weight)) throw '.weight not a number'
	}
	if (!Array.isArray(arg.samplenames)) throw '.samplenames[] missing'

	// convert each sample name to a result object in a new list
	const samples = arg.samplenames.map(i => {
		return { name: i, sum: 0, snpcount: 0 }
	})
	await asyncPool(arg.poolnumber, arg.snps, queryOneSNP(arg, samples))
	return samples
}

function queryOneSNP(arg, samples) {
	return async snp => {
		return await utils.get_lines_tabix(
			[arg.vcffile, (arg.nochr ? snp.chr.replace('chr', '') : snp.chr) + ':' + snp.pos + '-' + (snp.pos + 1)],
			arg.dir,
			line => {
				const l = line.split('\t')
				if (l[3] != snp.ref || l[4] != snp.alt) return
				for (const [i, sample] of samples.entries()) {
					const gt = l[i + 9].split(':')[0]
					if (gt == './.') {
						console.log('./.')
						continue
					}
					sample.snpcount++
					const tmp = gt.split('/')
					if (tmp.length != 2) continue
					const sum = Number(tmp[0]) + Number(tmp[1])
					if (sum == 0) {
					} else if (sum == 1) {
						sample.sum += snp.weight
					} else if (sum == 2) {
						sample.sum += snp.weight * 2
					} else {
						// sum is greater than 2, do not consider
						// maybe case of multi alt allele in one line
					}
				}
			}
		)
	}
}

/* following helpers are copied from modules/utils.js as it includes better-sqlite3 and can no longer be bundled by webpack??

function get_lines_tabix (args, dir, callback) {
	return new Promise((resolve, reject) => {
		const ps = spawn('tabix', args, { cwd: dir })
		const rl = readline.createInterface({ input: ps.stdout })
		const em = []
		rl.on('line', line => callback(line))
		ps.stderr.on('data', d => em.push(d))
		ps.on('close', () => {
			const e = em.join('').trim()
			if (e) reject(e)
			resolve()
		})
	})
}
exports.get_lines_tabix = get_lines_tabix
exports.get_header_tabix = async (file, dir) => {
	// file is full path file or url
	const lines = []
	await get_lines_tabix([file, '-H'], dir, line => {
		lines.push(line)
	})
	return lines
}
*/
