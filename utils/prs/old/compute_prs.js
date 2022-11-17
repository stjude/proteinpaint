/*
************************************
Compute PRS for SJLIFE/CCSS samples
************************************

== Objective ==

Compute PRS scores for SJLIFE/CCSS samples using a given set of SNPs and their effect weights. PRS computation steps are as follows:

    - The inputs into this script are a file of SNPs and a file of SJLIFE/CCSS sample IDs. 
    - The SJLIFE/CCSS bcf files are queried using the input SNPs and sample IDs to extract matching SJLIFE/CCSS SNPs and samples. 
    - Matching SNPs are filtered by a number of QC metrics: 
        - Minor allele frequency (MAF) >= 1% (optional)
        - Missing call rate < 10%
        - Hardy-Weinberg equilibrium (HWE) p-value > 1e-6
    - Compute PRS scores for query samples using the filtered SNPs and their effect weights. 

Output the PRS scores of samples to standard out.

== File formats ==

The SNP file needs to contain the following columns (no header): chromosome, position, effect allele, reference allele, effect weight.

The samples file needs to contain one SJLIFE/CCSS sample ID per line. For example:
    1
    4
    11
    25
    103

== Notes ==

1) To limit memory usage, the input SNP file is split into chunks of 10,000 SNPs and PRS is computed separately for each chunk and then summed across chunks.

2) The 1% minor allele frequency (MAF) cutoff is optional and can be activated/disabled using the MAF filter argument.
*/

if (process.argv.length !== 6) {
	console.error('Usage: node compute_prs.js <snps.txt> <samples.txt> <maf/noMaf> <prs.scores.profile> stats to stdout')
	console.error(
		'\t<snps.txt>: snps file\n\t<samples.txt>: samples file\n\t<maf/noMaf>: activate/disable MAF filter\n\t<prs.scores.profile>: output file of PRS scores'
	)
	process.exit(1)
}

const snpfile = process.argv[2]
const samplesfile = process.argv[3]
let mafFilter
if (process.argv[4] === 'maf') {
	mafFilter = 'on'
} else if (process.argv[4] === 'noMaf') {
	mafFilter = 'off'
} else {
	console.error('MAF filter setting not recognized')
	process.exit(1)
}
const outfile = process.argv[5]

const fs = require('fs')
const os = require('os')
const path = require('path')
const spawn = require('child_process').spawn
const readline = require('readline')
const lines2R = require('../../server/src/lines2R')

const missinggt = '.' // hardcoded string for missing GT, either '.' or './.'

// Keep track of the numbers of SNPs dropped and retained
let callrateDropped = 0
let mafDropped = 0
let hweDropped = 0
let qcdSnps = 0

// Store input sample IDs and prepare a map between sample IDs and sample names
const samples = fs
	.readFileSync(samplesfile, { encoding: 'utf8' })
	.trim()
	.split('\n')
const id2name = get_id2name()

// Split SNPs into chunks of 10,000 SNPs
fs.rmdirSync('SNPchunks', { recursive: true })
fs.mkdirSync('SNPchunks')
const shuf = spawn('shuf', [snpfile])
const split = spawn('split', ['-l', '10000', '-', 'SNPchunks/SNPchunk.'])
shuf.stdout.pipe(split.stdin)
split.on('close', async code => {
	if (code !== 0) throw 'SNP splitting closed with non-zero status'
	const snpChunks = fs.readdirSync('SNPchunks')
	// Compute the total PRS of samples across SNP chunks
	const totalPRS = Object.create(null)
	for (const snpChunk of snpChunks) {
		const prs = await compute_chunk_prs(snpChunk)
		for (const prsSample of prs) {
			if (!(prsSample['sample'] in totalPRS)) {
				totalPRS[prsSample['sample']] = Object.create(null)
				totalPRS[prsSample['sample']]['effcount'] = 0
				totalPRS[prsSample['sample']]['score'] = 0
			}
			totalPRS[prsSample['sample']]['effcount'] += prsSample['effcount']
			totalPRS[prsSample['sample']]['score'] += prsSample['score']
		}
	}
	// Output the total PRS data as a tab-delimited table
	const output = []
	output.push('sampleID\tsampleName\teffcount\tscore\n')
	for (const sample in totalPRS) {
		const sampleName = id2name.get(sample)
		output.push(
			sample + '\t' + sampleName + '\t' + totalPRS[sample]['effcount'] + '\t' + totalPRS[sample]['score'] + '\n'
		)
	}
	fs.writeFileSync(outfile, output.join(''))
	console.log(
		'Dropped SNPs:\n\tMissing call rate > 10%: ' +
			callrateDropped +
			'\n\tMinor allele frequency < 1%: ' +
			mafDropped +
			'\n\tHWE p-value < 1e-6: ' +
			hweDropped +
			'\nQCed SNPs: ' +
			qcdSnps
	)
})

// Make a map between sample IDs and sample names
function get_id2name() {
	const id2nameFile = path.join(os.homedir(), 'tp/files/hg38/sjlife/clinical/samples.idmap')
	let id2name = new Map()
	const id2nameLines = fs
		.readFileSync(id2nameFile, { encoding: 'utf8' })
		.trim()
		.split('\n')
	for (const line of id2nameLines) {
		const fields = line.split('\t')
		id2name.set(fields[0], fields[1])
	}
	return id2name
}

// Compute PRS using a given SNP chunk
async function compute_chunk_prs(snpChunk) {
	// Further split SNPs by chr and write to temp files
	const [chr2tmpsnpfile, pos2snp] = await parse_snpfile(snpChunk)

	// For each SNP chr chunk, run bcftools and filter by maf/callrate
	const snparray = []
	const promises = []
	for (const [chr, tmpsnpfile] of chr2tmpsnpfile) {
		promises.push(run_bcftools(chr, tmpsnpfile, snparray, pos2snp))
	}
	await Promise.all(promises)

	// Compute HWE p-value for each SNP
	const out = await lines2R(path.join(os.homedir(), 'tp/utils/hwe.R'), snparray.map(i => i.hweline))
	const hwepvalues = out.map(Number)

	// Compute PRS score for each sample
	const prs = samples.map(i => {
		return { sample: i, score: 0, effcount: 0 }
	})
	for (const [i, snp] of snparray.entries()) {
		if (hwepvalues[i] <= 1e-6) {
			hweDropped++
			continue
		}

		qcdSnps++
		for (const [j, gt] of snp.gtlst.entries()) {
			const prsSample = prs[j]
			if (gt == missinggt) {
				prsSample.score += 2 * snp.effectallelefrequency * snp.weight
				continue
			}
			const [a, b] = gt.split('/')
			let count = 0
			if (a == snp.EAidx) count++
			if (b == snp.EAidx) count++
			prsSample.effcount += count
			prsSample.score += snp.weight * count
		}
	}

	for (const t of chr2tmpsnpfile.values()) {
		fs.unlink(t, () => {})
	}
	return prs
}

function get_effalefreq(l, EAidx) {
	let eacount = 0,
		total = 0,
		missing = 0,
		href = 0, // for hwe
		het = 0,
		halt = 0
	for (let i = 4; i < l.length; i++) {
		const gt = l[i]
		if (gt == missinggt) {
			missing++
			continue
		}

		if (gt == '0/0') href++
		else if (gt == '1/1') halt++
		else het++

		const [a, b] = gt.split('/')
		if (a == EAidx) eacount++
		if (b == EAidx) eacount++
		total += 2
	}
	return [missing / (l.length - 1), eacount / total, href, het, halt]
}

function get_effectaleidx(effale, ref, alt) {
	// assuming alt is only one allele, and is not comma-joined multiple alternative alleles
	if (ref == effale) return ['0', alt]
	if (alt == effale) return ['1', ref]
	return [-1]
}

function parse_snpfile(snpChunk) {
	const chr2snp = new Map() // k: chr, v: list of snp position
	const pos2snp = new Map() // k: "chr:pos", v: {effallele, ref, weight}
	return new Promise((resolve, reject) => {
		const rl = readline.createInterface({ input: fs.createReadStream(path.join('SNPchunks', snpChunk)) })
		rl.on('line', line => {
			const l = line.split('\t')
			const chr = l[0],
				pos = l[1], // 1-based, for use in bcftools
				effallele = l[2],
				ref = l[3],
				weight = Number(l[4])

			if (Number.isNaN(weight)) throw 'invalid weight for a snp'

			if (!chr2snp.has(chr)) chr2snp.set(chr, [])
			chr2snp.get(chr).push(chr + '\t' + pos)

			pos2snp.set(chr + '.' + pos, { effallele, ref, weight })
		})
		rl.on('close', () => {
			const chr2tmpsnpfile = new Map() // k: chr, v: tmp file name
			for (const [chr, lst] of chr2snp) {
				const fn = Math.random().toString()
				fs.writeFileSync(fn, lst.join('\n'))
				chr2tmpsnpfile.set(chr, fn)
			}
			resolve([chr2tmpsnpfile, pos2snp])
		})
	})
}

function run_bcftools(chr, tmpsnpfile, snparray, pos2snp) {
	return new Promise((resolve, reject) => {
		const bcffile = path.join(
			os.homedir(),
			'tp/files/hg38/sjlife/bcf/GT',
			'chr' + chr + '_SJLIFE_CCSS.GT.NoINFO.bcf.gz'
		)
		try {
			fs.statSync(bcffile)
		} catch (e) {
			reject('bcf file missing')
		}
		const sp = spawn('bcftools', [
			'query',
			'-R',
			tmpsnpfile,
			'-f',
			'%CHROM %POS %REF %ALT [%GT ]\\n',
			'-s',
			samples.join(','),
			bcffile
		])
		const rl = readline.createInterface({ input: sp.stdout })
		rl.on('line', async line => {
			const l = line.trim().split(' ')
			// chr, pos, ref, alt, GT...
			const snp = pos2snp.get(l[0] + '.' + l[1])
			if (!snp) reject('unable to retrieve SNP: ' + l.slice(0, 4).join(' '))
			// get allele idx for effect allele based on vcf ref/alt
			const [EAidx, otherallele] = get_effectaleidx(snp.effallele, l[2], l[3])
			// ignore vcf snp if it does not have the same alleles as query snp
			if (EAidx == -1 || otherallele != snp.ref) return

			// now EAidx is string '0', '1' etc

			const [missingcallrate, effectallelefrequency, href, het, halt] = get_effalefreq(l, EAidx)
			if (missingcallrate >= 0.1) {
				callrateDropped++
				return
			}
			if (mafFilter === 'on') {
				if (effectallelefrequency <= 0.01) {
					mafDropped++
					return
				}
			}

			snp.EAidx = EAidx
			snp.effectallelefrequency = effectallelefrequency
			snp.hweline = href + '\t' + het + '\t' + halt
			snp.gtlst = l.slice(4)
			snparray.push(snp)
		})
		const err = []
		sp.stderr.on('data', d => err.push(d))
		sp.on('close', () => {
			fs.unlink(tmpsnpfile, () => {})
			const e = err.join('')
			if (e) reject(e)
			resolve()
		})
	})
}
