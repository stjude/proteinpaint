const { get_lines_tabix, get_header_tabix } = require('./tabix')
const asyncPool = require('tiny-async-pool')

/*
arg{}:
.poolnumber
	max number of concurrency
.vcffile: full path to file, compressed and indexed
	FORMAT must have GT as first field
	GT must be delimited by '/'
	missing GT is hardcoded to be '.' but not ./. per specification
.nochr: bool, if true, to use '1' but not 'chr1'
.dir: path to the index cache if is custom
	undefined for now
.snps: array of {chr,pos,ref,alt,weight}
.samplenames: array of sample names, full list from vcf file
	alternatively, it could be a list of array index from vcf header

returns a "samples" array, each ele:
{ name, sum, effalecount}
*/
export async function compute(arg) {
	if (!Number.isInteger(arg.poolnumber)) throw '.poolnumber missing'
	if (!arg.vcffile) throw '.vcffile missing'
	if (!Array.isArray(arg.snps)) throw '.snps[] missing'
	if (arg.snps.length == 0) throw '.snps[] empty array'
	for (const s of arg.snps) {
		if (!s.chr) throw '.chr missing from a snp'
		if (!Number.isInteger(s.pos)) throw '.pos not integer for a snp'
		if (!s.refallele) throw '.refallele missing from a snp'
		if (!s.effectallele) throw '.effectallele missing from a snp'
		if (!Number.isFinite(s.weight)) throw '.weight not a number'
	}
	if (!Array.isArray(arg.samplenames)) throw '.samplenames[] missing'

	// convert each sample name to a result object in a new list
	const samples = arg.samplenames.map(i => {
		return { name: i, sum: 0, effalecount: 0 }
	})
	await asyncPool(arg.poolnumber, arg.snps, queryOneSNP(arg, samples))
	return samples
}

function queryOneSNP(arg, samples) {
	return async snp => {
		//const alleles = new Set([snp.effectallele,snp.refallele])

		return await get_lines_tabix(
			[arg.vcffile, (arg.nochr ? snp.chr.replace('chr', '') : snp.chr) + ':' + snp.pos + '-' + snp.pos],
			arg.dir,
			line => {
				const l = line.split('\t')
				const allele0 = l[3],
					allele1 = l[4]
				/*
				if(!alleles.has(allele0) || !alleles.has(allele1)) {
					// not all alleles from this line match with snp
					console.error('xx',l[0],l[1],allele0,allele1)
					return
				}
				*/
				let effectalleleidx
				if (snp.effectallele == allele0) {
					effectalleleidx = '0'
				} else if (snp.effectallele == allele1) {
					effectalleleidx = '1'
				} else {
					// for testing
					console.error('nomatch', snp.chr + '.' + snp.pos + '.' + snp.effectallele + '.' + snp.refallele)
					return
				}
				for (const [i, sample] of samples.entries()) {
					const gt = l[i + 9].split(':')[0]
					if (gt == '.') {
						// XXX missing GT hardcoded to be '.'
						continue
					}

					const tmp = gt.split('/')
					if (tmp.length != 2) continue
					const effale = (tmp[0] == effectalleleidx ? 1 : 0) + (tmp[1] == effectalleleidx ? 1 : 0)
					sample.effalecount += effale
					sample.sum += snp.weight * effale
				}
			}
		)
	}
}
