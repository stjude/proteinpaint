/*
this is a test script!

0. get list of samples matching with vcf header
   divides snps by chr/chunk
   store all snps into pos2snp{ key: snp{} } and collect bcftools query data for each snp
1. for each chr/chunk, write snps to a temp file
   1. run bcftools using chunk.gz and temp snp file
   2. for each snp hit
      1. filter by MAF and callrate
	  2. collect pq and gt into pos2snp{}
2. do hwe test for all snps passing MAF and callrate filter
   obtain snps passing hwe filter
3. cumulate scores for samples
*/

if (process.argv.length < 6) {
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
const asyncPool = require('tiny-async-pool')

////////////////////////////////////////////
// 0. get list of samples to be used to run bcftools
const sample2id = get_idmap()
const samplenames = get_samples()
const sampleids = samplenames.map(i => sample2id.get(i)) // for use in bcftools query

////////////////////////////////////////////
// 0.1 parse chunk index
const chr2allchunks = parse_chunk_index()

;(async () => {
	////////////////////////////////////////////
	// 1. break snps by chr/chunk and write to temp files
	//const [chr2tmpsnpfile, pos2snp] = await parse_snpfile()
	// k: chr.pos, v: {effallele, ref, weight}
	// after bcftools, add following to v{} about this snp

	const [mappedchunks, pos2snp] = await parse_snpfile_2chunk()

	////////////////////////////////////////////
	// 2. for each chunk, run bcftools and filter by maf/callrate
	// good snps passing freq/geno filter in the bcftools query
	const snparray = []
	const promises = []

	{
		const t1 = new Date()
		await asyncPool(10, mappedchunks, run_bcftools(snparray, pos2snp))
		const t2 = new Date()
		console.error('TIME: bcftools: ' + (t2 - t1))
	}

	// all snps passing maf/callrate filters are in snparray[]

	////////////////////////////////////////////
	// 3. compute hwe pvalue for each snp
	let hwepvalues
	{
		const t1 = new Date()
		hwepvalues = await get_hwe(snparray.map(i => i.hweline))
		const t2 = new Date()
		console.error('TIME: hwe: ' + (t2 - t1))
	}

	////////////////////////////////////////////
	// 4. cumulate score for each sample and output
	const samples = samplenames.map(i => {
		return { name: i, sum: 0, effcount: 0 }
	})
	for (const [i, snp] of snparray.entries()) {
		if (hwepvalues[i] <= 1e-6) {
			console.error('hwe skip', hwepvalues[i])
			continue
		}

		for (const [j, gt] of snp.gtlst.entries()) {
			const sample = samples[j]
			if (gt == missinggt) {
				sample.sum += 2 * snp.effectallelefrequency * snp.weight
				continue
			}
			const [a, b] = gt.split('/')
			let count = 0
			if (a == snp.EAidx) count++
			if (b == snp.EAidx) count++
			sample.effcount += count
			sample.sum += snp.weight * count
		}
	}

	// output
	console.log('sample\tCNT\tsum')
	for (const s of samples) {
		console.log(s.name + '\t' + s.effcount + '\t' + s.sum)
	}
	for (const t of mappedchunks) {
		fs.unlink(t.tmpsnpfile, () => {})
	}
})()

////////////////////////

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

function parse_snpfile_2chunk() {
	/*
1 chr
2 1-pos
3 eff ale
4 other ale
5 weight
*/
	const pos2snp = new Map() // k: "chr:pos", v: {effallele, ref, weight}
	return new Promise((resolve, reject) => {
		const rl = readline.createInterface({ input: fs.createReadStream(snpfile) })
		rl.on('line', line => {
			const l = line.split('\t')
			const chr = l[0],
				pos = l[1], // 1-based, for use in bcftools
				effallele = l[2],
				ref = l[3],
				weight = Number(l[4])
			if (Number.isNaN(weight)) throw 'invalid weight for a snp'
			pos2snp.set(chr + '.' + pos, { effallele, ref, weight })

			if (!chr2allchunks.has(chr)) throw 'chr ' + chr + ' missing from chunk index'
			for (const chunk of chr2allchunks.get(chr)) {
				if (chunk.stop >= pos) {
					chunk.snps.push(chr + '\t' + pos)
					return
				}
			}
			throw 'no chunk for a snp: ' + chr + ':' + pos
		})
		rl.on('close', () => {
			const mappedchunks = []
			for (const [chr, chunks] of chr2allchunks) {
				for (const chunk of chunks) {
					if (chunk.snps.length == 0) continue
					const fn = Math.random().toString()
					fs.writeFileSync(fn, chunk.snps.join('\n'))
					mappedchunks.push({
						chr,
						chunkvcffile: path.join(
							vcfdir,
							'chr' + chr + '/chunk/vcfchunk.chr' + chr + '.' + chunk.idx + '.final.vcf.gz'
						),
						tmpsnpfile: fn
					})
				}
			}
			resolve([mappedchunks, pos2snp])
		})
	})
}

function parse_snpfile() {
	/*
1	chr_hg38	chr1
2	bp_hg38_0	100315612
3	bp_hg38_1	100315613
4	variant	chr1:100781169:C:T
5	chr_hg19	1
6	bp_hg19	100781169
7	effect_allele	C
8	ref_allele	T
9	effect_weight	0.0031

1 chr
2 1-pos
3 eff ale
4 other ale
5 weight

*/
	const chr2snp = new Map() // k: chr, v: list of snp position
	const pos2snp = new Map() // k: "chr:pos", v: {effallele, ref, weight}
	return new Promise((resolve, reject) => {
		const rl = readline.createInterface({ input: fs.createReadStream(snpfile) })
		rl.on('line', line => {
			const l = line.split('\t')
			const chr = l[0],
				pos = l[1], // 1-based, for use in bcftools
				effallele = l[2],
				ref = l[3],
				weight = Number(l[4])

			//if(chr!='17') continue // xxxxxxxxxxx for testing on local computer with just one vcf file

			if (Number.isNaN(weight)) throw 'invalid weight for a snp'

			if (!chr2snp.has(chr)) chr2snp.set(chr, [])
			chr2snp.get(chr).push(chr + '\t' + pos)

			pos2snp.set(chr + '.' + pos, { effallele, ref, weight })
		})
		rl.on('close', () => {
			const chr2tmpsnpfile = []
			for (const [chr, lst] of chr2snp) {
				const fn = Math.random().toString()
				fs.writeFileSync(fn, lst.join('\n'))
				chr2tmpsnpfile.push({ chr, tmpsnpfile: fn })
			}
			resolve([chr2tmpsnpfile, pos2snp])
		})
	})
}

function get_hwe(lines) {
	const infile = Math.random().toString()
	fs.writeFileSync(infile, lines.join('\n') + '\n')
	return new Promise((resolve, reject) => {
		const sp = spawn('Rscript', ['hwe.R', infile])
		const out = [],
			out2 = []
		sp.stdout.on('data', d => out.push(d))
		sp.stderr.on('data', d => out2.push(d))
		sp.on('close', c => {
			fs.unlink(infile, () => {})
			const e = out2.join('')
			if (e) reject(e)
			const text = out.join('').trim()
			resolve(text.split('\n').map(Number))
		})
	})
}

// function generator for async pool, take one chr object and return a promise
function run_bcftools(snparray, pos2snp) {
	return ({ chr, chunkvcffile, tmpsnpfile }) => {
		try {
			fs.statSync(chunkvcffile)
		} catch (e) {
			// file missing
			return
		}

		// test step to compare with cindy's PGS000015_chr10.weights files
		//const compsnps = load_cindy_weight(chr)

		return new Promise((resolve, reject) => {
			const sp = spawn('bcftools', [
				'query',
				'-R',
				tmpsnpfile,
				'-f',
				'%CHROM %POS %REF %ALT [%GT ]\\n',
				'-s',
				sampleids.join(','),
				chunkvcffile
			])
			const rl = readline.createInterface({ input: sp.stdout })
			rl.on('line', async line => {
				const l = line.trim().split(' ')
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

				//const cindysnp = compsnps.get('chr' + l[0] + '.' + l[1])
				//if (cindysnp) cindysnp.count++

				// now EAidx is string '0', '1' etc

				const [missingcallrate, effectallelefrequency, href, het, halt] = get_effalefreq(l, EAidx)
				if (missingcallrate >= 0.1) {
					console.error('skip missing callrate', l[0] + ':' + l[1])
					//if (cindysnp) cindysnp.callrate = true
					return
				}
				if (effectallelefrequency <= 0.01) {
					console.error('skip low freq', l[0] + ':' + l[1])
					//if (cindysnp) cindysnp.eaf = true
					return
				}
				//if (cindysnp) cindysnp.inuse = true

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

				//write_cindysnp(chr, compsnps)

				const e = err.join('')
				if (e) reject(e)
				resolve()
			})
		})
	}
}

function load_cindy_weight(chr) {
	const snps = new Map() // key: chr.pos, v: { originalline }
	for (const line of fs
		.readFileSync('PGS000015_chr' + chr + '.weights', { encoding: 'utf8' })
		.trim()
		.split('\n')) {
		const snp = line.split('\t')[0]
		const l = snp.split(':')
		snps.set(l[0] + '.' + l[1], { originalline: snp, count: 0 })
	}
	return snps
}

function write_cindysnp(chr, snps) {
	const totalcount = snps.size

	let countge1 = 0,
		inuse = 0,
		callrate = [],
		eaf = [],
		notused = []
	for (const [snp, v] of snps) {
		if (v.count > 1) countge1++
		if (v.callrate) callrate.push(v.originalline)
		if (v.eaf) eaf.push(v.originalline)

		if (v.inuse) inuse++
		else notused.push(v.originalline)
	}

	console.error(
		'compare chr' +
			chr +
			': ' +
			'total=' +
			totalcount +
			' inuse=' +
			inuse +
			(callrate.length ? ' callrate=' + callrate.join(',') : '') +
			(eaf.length ? ' eaf=' + eaf.join(',') : '') +
			(notused.length ? ' notused=' + notused.join(',') : '')
	)
}

function parse_chunk_index() {
	const chrlst = [
		'1',
		'2',
		'3',
		'4',
		'5',
		'6',
		'7',
		'8',
		'9',
		'10',
		'11',
		'12',
		'13',
		'14',
		'15',
		'16',
		'17',
		'18',
		'19',
		'20',
		'21',
		'22'
	]
	const chr2allchunks = new Map()
	// k: chr
	// v: [ {start,stop,idx, snps} ]
	for (const chr of chrlst) {
		chr2allchunks.set(chr, [])
		let idx = 1
		for (const line of fs
			.readFileSync(path.join(vcfdir, 'chr' + chr, 'chunk', 'chr' + chr + '_indexes.txt'), { encoding: 'utf8' })
			.trim()
			.split('\n')) {
			const l = line.split('\t')
			const start = Number(l[1])
			const stop = Number(l[2])
			chr2allchunks.get(chr).push({ start, stop, idx, snps: [] })
			idx++
		}
	}
	return chr2allchunks
}
