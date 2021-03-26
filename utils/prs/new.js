/*
this is a test script!

1. runs "bcftools query" for a single time on all snps
2. using a subset of samples
   has to convert sample names to id for querying vcf, then back to report result
*/

if (process.argv.length != 6) {
	console.log(
		"<vcf.gz> <snp file: chr/pos/effallele/ref/weight> <sample file, cindy's output> <sample.idmap> output to stdout"
	)
	process.exit()
}

const missinggt = '.' // hardcoded string for missing GT, either '.' or './.'

const vcffile = process.argv[2]
const snpfile = process.argv[3]
const samplefile = process.argv[4]
const sampleidmapfile = process.argv[5]

const fs = require('fs')
const spawn = require('child_process').spawn
const readline = require('readline')

const sample2id = get_idmap()
const samplenames = get_samples()
const sampleids = samplenames.map(i => sample2id.get(i))
const [regiontempfile, pos2snp] = parse_snpfile()
// k: chr.pos, v: {effallele, ref, weight}

// collect results
const samples = samplenames.map(i => {
	return { name: i, sum: 0, effcount: 0 }
})

;(async () => {
	await run_bcftools()

	// output
	console.log('sample\tCNT\tsum')
	for (const s of samples) {
		console.log(s.name + '\t' + s.effcount + '\t' + s.sum)
	}

	fs.unlink(regiontempfile, () => {})
})()

function may_get_effalefreq(l, EAidx) {
	let nomissinggt = true
	for (let i = 4; i < l.length; i++) {
		if (l[i] == missinggt) {
			// hardcoded missing gt as '.' but not './.'
			nomissinggt = false
			break
		}
	}
	if (nomissinggt) return
	let eacount = 0,
		total = 0
	for (let i = 4; i < l.length; i++) {
		if (l[i] == missinggt) continue
		const [a, b] = l[i].split('/')
		if (a == EAidx) eacount++
		if (b == EAidx) eacount++
		total += 2
	}
	return eacount / total
}
function get_effectaleidx(effale, ref, alt) {
	if (ref == effale) return 0
	const i = alt.split(',').findIndex(i => i == effale)
	return i == -1 ? -1 : (1 + i).toString()
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
	const lst = []
	const pos2snp = new Map()
	for (const line of fs
		.readFileSync(snpfile, { encoding: 'utf8' })
		.trim()
		.split('\n')) {
		const l = line.split('\t')
		const weight = Number(l[4])
		if (Number.isNaN(weight)) throw 'invalid weight for a snp'
		lst.push(l[0] + '\t' + l[1])
		pos2snp.set(l[0] + '.' + l[1], { effallele: l[2], ref: l[3], weight })
	}
	const fn = Math.random().toString()
	fs.writeFileSync(fn, lst.join('\n'))
	return [fn, pos2snp]
}
function run_bcftools() {
	return new Promise((resolve, reject) => {
		const sp = spawn('bcftools', [
			'query',
			'-R',
			regiontempfile,
			'-f',
			'%CHROM %POS %REF %ALT [%GT ]\\n',
			'-s',
			sampleids.join(','),
			vcffile
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
			const EAidx = get_effectaleidx(snp.effallele, l[2], l[3])
			if (EAidx == -1) {
				// no effect allele
				return
			}
			// now EAidx is string '0', '1' etc
			const effectallelefrequency = may_get_effalefreq(l, EAidx)
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
		sp.stderr.on('data', d => out2.push(d))
		sp.on('close', () => {
			const e = err.join('')
			if (e) reject(e)
			resolve()
		})
	})
}
