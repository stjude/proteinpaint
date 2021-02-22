/*
this is a test script!

1. runs "bcftools query" for each chr separately
   requires the "vcf2/" folder, in which files are stored as "chrN/N.vcf.gz"
2. using a subset of samples
   has to convert sample names to id for querying vcf, then back to report result
*/

if (process.argv.length != 6) {
	console.log(
		"<vcf2/> <snp file: chr/pos/effallele/ref/weight> <sample file, cindy's output> <sample.idmap> output to stdout"
	)
	process.exit()
}

const missinggt = '.' // hardcoded string for missing GT, either '.' or './.'

const vcfdir = process.argv[2]
const snpfile = process.argv[3]
const samplefile = process.argv[4]
const sampleidmapfile = process.argv[5]

const fs = require('fs')
const spawn = require('child_process').spawn
const readline = require('readline')
const path = require('path')

const sample2id = get_idmap()
const samplenames = get_samples()
const sampleids = samplenames.map(i => sample2id.get(i))
const [chr2tmpsnpfile, pos2snp] = parse_snpfile()
// k: chr.pos, v: {effallele, ref, weight}

// collect results
const samples = samplenames.map(i => {
	return { name: i, sum: 0, effcount: 0 }
})

const promises = []
for (const [chr, tmpsnpfile] of chr2tmpsnpfile) {
	promises.push(run_bcftools(chr, tmpsnpfile))
}

Promise.all(promises).then(() => {
	// output
	console.log('sample\tCNT\tsum')
	for (const s of samples) {
		console.log(s.name + '\t' + s.effcount + '\t' + s.sum)
	}
	for (const t of chr2tmpsnpfile.values()) {
		fs.unlink(t, () => {})
	}
})

////////////////////////

function get_effalefreq(l, EAidx) {
	let eacount = 0,
		total = 0,
		missing = 0
	for (let i = 4; i < l.length; i++) {
		if (l[i] == missinggt) {
			missing++
			continue
		}
		const [a, b] = l[i].split('/')
		if (a == EAidx) eacount++
		if (b == EAidx) eacount++
		total += 2
	}
	return [missing / (l.length - 1), eacount / total]
}
function get_effectaleidx(effale, ref, alt) {
	// assuming alt is only one allele, and is not comma-joined multiple alternative alleles
	if (ref == effale) return ['0', alt]
	if (alt == effale) return ['1', ref]
	return [-1]
}
function get_idmap() {
	const s2i = new Map()
	for (const line of fs
		.readFileSync(sampleidmapfile, { encoding: 'utf8' })
		.trim()
		.split('\n')) {
		const [i, s] = line.split('\t')
		s2i.set(s, i)
	}
	return s2i
}
function get_samples() {
	const lst = []
	const lines = fs
		.readFileSync(samplefile, { encoding: 'utf8' })
		.trim()
		.split('\n')
	for (let i = 1; i < lines.length; i++) {
		lst.push(lines[i].trim().split(/\s+/)[0])
	}
	return lst
}
function parse_snpfile() {
	const chr2snp = new Map() // k: chr, v: list of snp position
	const pos2snp = new Map() // k: "chr:pos", v: {effallele, ref, weight}
	for (const line of fs
		.readFileSync(snpfile, { encoding: 'utf8' })
		.trim()
		.split('\n')) {
		const l = line.split('\t')
		const chr = l[0],
			pos = l[1],
			effallele = l[2],
			ref = l[3],
			weight = Number(l[4])
		if (Number.isNaN(weight)) throw 'invalid weight for a snp'

		if (!chr2snp.has(chr)) chr2snp.set(chr, [])
		chr2snp.get(chr).push(chr + '\t' + pos)

		pos2snp.set(chr + '.' + pos, { effallele, ref, weight })
	}
	const chr2tmpsnpfile = new Map() // k: chr, v: tmp file name
	for (const [chr, lst] of chr2snp) {
		const fn = Math.random().toString()
		fs.writeFileSync(fn, lst.join('\n'))
		chr2tmpsnpfile.set(chr, fn)
	}
	return [chr2tmpsnpfile, pos2snp]
}
function run_bcftools(chr, tmpsnpfile) {
	return new Promise((resolve, reject) => {
		const sp = spawn('bcftools', [
			'query',
			'-R',
			tmpsnpfile,
			'-f',
			'%CHROM %POS %REF %ALT [%GT ]\\n',
			'-s',
			sampleids.join(','),
			path.join(vcfdir, 'chr' + chr, chr + '.vcf.gz')
		])
		const rl = readline.createInterface({ input: sp.stdout })
		rl.on('line', line => {
			const l = line.trim().split(' ')
			if (l.length != samples.length + 4) throw 'field length mismatch: ' + l.length + ' ' + samples.length
			// chr, pos, ref, alt, GT...
			const snp = pos2snp.get(l[0] + '.' + l[1])
			if (!snp) {
				console.error('no match for a line: ' + l.slice(0, 4).join(' '))
				return
			}
			// get allele idx for effect allele based on vcf ref/alt
			const [EAidx, otherallele] = get_effectaleidx(snp.effallele, l[2], l[3])
			if (EAidx == -1 || otherallele != snp.ref) {
				// pair of alleles from vcf line does not match snp
				console.error(`at ${l[0]}:${l[1]} expecting eff:${snp.effallele} ref:${snp.ref}, got ${l[2]}>${l[3]}`)
				return
			}

			// now EAidx is string '0', '1' etc

			// TODO HWE test p-value filter

			const [missingcallrate, effectallelefrequency] = get_effalefreq(l, EAidx)
			if (missingcallrate >= 0.1) {
				console.error('skip missing callrate', l[0] + ':' + l[1])
				return
			}
			if (effectallelefrequency <= 0.01) {
				console.error('skip low freq', l[0] + ':' + l[1])
				return
			}
			// for each sample
			for (let i = 4; i < l.length; i++) {
				const sample = samples[i - 4]
				if (l[i] == missinggt) {
					sample.sum += 2 * effectallelefrequency * snp.weight
					continue
				}
				const [a, b] = l[i].split('/')
				let count = 0
				if (a == EAidx) count++
				if (b == EAidx) count++
				sample.effcount += count
				sample.sum += snp.weight * count
			}
		})
		const err = []
		sp.stderr.on('data', d => err.push(d))
		sp.on('close', () => {
			const e = err.join('')
			if (e) reject(e)
			resolve()
		})
	})
}
