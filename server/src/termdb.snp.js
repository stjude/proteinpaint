const fs = require('fs')
const path = require('path')
const utils = require('./utils')
const termdbsql = require('./termdb.sql')
const termdb = require('./termdb')
const readline = require('readline')
const serverconfig = require('./serverconfig')

/*
TODO improve bigBed query usage
TODO support on-the-fly prs computing

********************** EXPORTED
validate()
********************** INTERNAL
*/

/*
q{}
	.genome
	.dslabel
	.snptext: str, same as input

snps[ {} ]
	.rsid: raw str, to be validated in genome bb file
	.effectAllele: optional
	// following attr are assigned during validation and are returned to client
	.invalid: true if this item is invalid for any reason
	.snpid: consistent id, in regression analysis will be equivalent to "term id"
	.chr: if not given, will query bb file to map to chr; if no match then missing
	.pos: if not given, match from bb file. 0-based!
	.dbsnpRef: ref allele from dbSNP
	.dbsnpAlts[]: alt alleles from dbSNP
	.sjlifeRef: ref allele from SJLIFE/CCSS bcf file TODO rename sjlife to bcf
	.sjlifeAlts[]: alt alleles from SJLIFE/CCSS bcf file
	.validgtcount: count of samples with valid genotypes
	.gtlst[]: per-sample genotypes
*/

const bcfformat = '%CHROM\t%POS\t%REF\t%ALT[\t%GT]\n'

export async function validate(q, tdb, ds, genome) {
	try {
		if (q.sumSamples) {
			return await summarizeSamplesFromCache(q, tdb, ds, genome)
		}
		return await validateInputCreateCache(q, tdb, ds, genome)
	} catch (e) {
		if (e.stack) console.log(e.stack)
		return { error: 'error validating snps: ' + (e.message || e) }
	}
}

async function summarizeSamplesFromCache(q, tdb, ds, genome) {
	const tk = ds.track.vcf
	if (!tk) throw 'ds.track.vcf missing'
	// samples are at tk.samples[], each element: {name: int ID}

	// collect samples that will be summarized with optional filter
	let samples
	if (q.filter) {
		samples = termdbsql.get_samples(JSON.parse(decodeURIComponent(q.filter)), ds)
	} else {
		samples = tk.samples.map(x => x.name)
	}
	if (samples.length == 0) throw 'no samples'

	// TODO read and parse cache file to sum samples

	return { numOfSampleWithAllValidGT: 3333, numOfSampleWithAnyValidGT: 6666 }
}

async function validateInputCreateCache(q, tdb, ds, genome) {
	if (!genome.snp) throw 'snp not supported by genome'
	if (!q.snptext) throw '.snptext missing'

	const snps = parseSnpText(q.snptext)
	if (!snps.length) throw 'no snps'
	// the unique id .snpid is assigned on each snp, no matter valid or not

	await mapRsid2chr(snps, genome)
	// snp.invalid is true for invalid ones
	// rsid has been converted to chr/pos/dbsnpRef/dbsnpAlts

	const cacheid = await queryBcf(q, snps, ds)
	// snp.gtlst[] is set

	return { snps, cacheid }
}

function parseSnpText(text) {
	// duplicated code with client
	const snps = []
	for (const tmp of text.trim().split('\n')) {
		const [rsid, ale] = tmp.trim().split(/[\s\t]/)
		if (rsid) {
			if (snps.find(i => i.rsid == rsid)) continue // duplicate
			const s = {
				rsid,
				snpid: rsid
			}
			if (ale) s.effectAllele = ale
			snps.push(s)
			continue
		}
		// may support chr:pos
	}
	return snps
}

async function mapRsid2chr(snps, genome) {
	// TODO process all rsid in one bigbed query
	for (const snp of snps) {
		if (snp.chr && typeof snp.chr == 'string') {
			// supplied chr/pos, verify if correct; no need to check rsid
			const chr = genome.chrlookup[snp.chr.toUpperCase()]
			if (!chr) {
				snp.invalid = true
				continue
			}
			if (!Number.isInteger(snp.pos)) {
				snp.invalid = true
				continue
			}
			if (snp.pos <= 0 || snp.pos >= chr.len) {
				snp.invalid = true
				continue
			}
			continue
		}
		if (snp.rsid) {
			const lst = await utils.query_bigbed_by_name(genome.snp.bigbedfile, snp.rsid)
			const hit = lst[0]
			if (!hit) {
				snp.invalid = true
				continue
			}
			const l = hit.split('\t')
			snp.chr = l[0]
			snp.pos = Number.parseInt(l[1])
			snp.dbsnpRef = l[4]
			snp.dbsnpAlts = l[6].split(',').filter(Boolean)
			continue
		}
		// unknown entry
		snp.invalid = true
	}
	if (snps.reduce((i, j) => i + (j.invalid ? 0 : 1)) == 0) throw 'no valid snps'
}

async function queryBcf(q, snps, ds) {
	/////////////////
	// using mds2 architecture
	// TODO generalize to work for both mds2 and mds3, and different data formats

	const tk = ds.track.vcf
	if (!tk) throw 'ds.track.vcf missing'
	// samples are at tk.samples[], each element: {name: int ID}

	/*
	do not filter on samples. write all samples to cache file
	(unless the number of samples is too high for that to become a problem)

	// collect samples that will be queried
	let samples
	if (q.filter) {
		const fsamples = termdbsql.get_samples(JSON.parse(decodeURIComponent(q.filter)), ds)
		samples = tk.samples.map(x => x.name).filter(sample => fsamples.includes(sample))
	} else {
		samples = tk.samples.map(x => x.name)
	}
	if (samples.length == 0) throw 'no samples'
	*/

	// collect coordinates and bcf file paths that will be queried
	const bcfs = new Set()
	const coords = []
	let validsnpcount = 0
	for (const snp of snps) {
		if (snp.invalid) continue
		validsnpcount++
		const bcffile = tk.chr2bcffile[snp.chr]
		if (!bcffile) throw 'chr not in chr2bcffile'
		bcfs.add(bcffile)
		const chr = tk.nochr ? snp.chr.replace('chr', '') : snp.chr
		const pos = snp.pos + 1 // 0-based
		const coord = chr + '\t' + pos
		coords.push(coord)
	}

	// write coordinates, and bcf file paths to temp files for bcf query
	const coordsfile = path.join(serverconfig.cachedir, await utils.write_tmpfile(coords.join('\n')))
	const bcffiles = path.join(serverconfig.cachedir, await utils.write_tmpfile([...bcfs].join('\n')))

	// query bcf files for snp coordinates and sample genotypes
	//const sample2snpcount = new Map(samples.map(sample => [sample, 0])) // {k: sample, v: number of snps with valid gt}
	await utils.get_lines_bigfile({
		isbcf: true,
		args: ['query', '-T', coordsfile, '-f', bcfformat, '-v', bcffiles],
		dir: tk.dir,
		callback: line => {
			// chr, pos, ref, alt, '0/0', '0/0', '0/1', '1/1', ...
			const l = line.split('\t')
			const chr = (tk.nochr ? 'chr' : '') + l[0]
			const pos = l[1]
			const ref = l[2]
			const alts = l[3].split(',')
			const alleles = [ref, ...alts]

			// find matching query snp
			const snp = snps.find(snp => {
				if (
					snp.chr == chr &&
					snp.pos === pos - 1 &&
					snp.dbsnpRef == ref &&
					snp.dbsnpAlts.some(allele => alts.includes(allele))
				) {
					return snp
				}
			})
			if (!snp) {
				const sjlifeSNP = chr + ':' + pos + '_' + ref + '_' + alts.join(',')
				throw `sjlife snp: '${sjlifeSNP}' does not match a query snp`
			}
			snp.sjlifeRef = ref // TODO change attribute name
			snp.sjlifeAlts = alts

			// determine sample genotypes
			snp.gtlst = [] // same order as tk.samples
			//snp.validgtcount = 0
			for (let i = 4; i < l.length; i++) {
				const gt = parseGT(l[i], alleles)
				snp.gtlst.push(gt)
				/*
				if (gt != '.') {
					// this sample has a valid gt for this snp
					snp.validgtcount++
					const sample = samples[i - 4]
					sample2snpcount.set(sample, sample2snpcount.get(sample) + 1)
				}
				*/
			}
		}
	})

	fs.unlink(coordsfile, () => {})
	fs.unlink(bcffiles, () => {})

	// write snp data to cache file
	const lines = ['snpid\tchr\tpos\tref\talt\teff\t' + tk.samples.map(i => i.name).join('\t')]
	for (const snp of snps) {
		lines.push(
			snp.snpid +
				'\t' +
				snp.chr +
				'\t' +
				snp.pos +
				'\t' +
				snp.sjlifeRef +
				'\t' +
				snp.sjlifeAlts.join(',') +
				'\t' +
				(snp.effectAllele || '') +
				'\t' +
				snp.gtlst.join('\t')
		)
	}

	const cacheid = 'snpgt.' + q.genome + '.' + q.dslabel + '.' + new Date() / 1 + '.' + Math.random()
	await utils.write_file(path.join(serverconfig.cachedir, cacheid), lines.join('\n'))
	return cacheid

	/*
	let numOfSampleWithAllValidGT = 0 // number of samples with valid gt for all snps
	for (const c of sample2snpcount.values()) {
		if (c == validsnpcount) numOfSampleWithAllValidGT++
	}
	*/

	//return [cacheid, sample2snpcount.size, numOfSampleWithAllValidGT]
}

function parseGT(gt, alleles) {
	if (gt == '.' || gt == './.') return '.'
	const gtidx = gt.split('/').map(Number)
	if (gtidx.length != 2) return '.' // autosome only for the moment
	const ale1 = alleles[gtidx[0]]
	const ale2 = alleles[gtidx[1]]
	if (!ale1 || !ale2) throw `invalid genotype`
	return ale1 + ',' + ale2
}
