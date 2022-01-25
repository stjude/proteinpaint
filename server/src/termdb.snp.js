const fs = require('fs')
const path = require('path')
const utils = require('./utils')
const termdbsql = require('./termdb.sql')
const termdb = require('./termdb')
const readline = require('readline')
const serverconfig = require('./serverconfig')

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
	.referenceAllele: ref allele from bcf file
	.altAlleles[]: alt alleles from bcf file
	.gtlst[]: per-sample genotypes

cache file has a header line, with one line per valid snp. columns: 
1. snpid
2. chr
3. pos
4. ref
5. alt (comma-joined alternative alleles)
6. effAllele (user-given allele, blank if not specified)
7-rest: integer sample ids
*/

const bcfformat = '%CHROM\t%POS\t%REF\t%ALT[\t%GT]\n'

export async function validate(q, tdb, ds, genome) {
	try {
		if (q.sumSamples) {
			/* returns:
			.numOfSampleWithAnyValidGT: int
			.snps[]
				.snpid
				.gt2count{ k: gt, v: count }
				.alleles[]
					{allele, isRef:true, count}
			*/
			return await summarizeSamplesFromCache(q, tdb, ds, genome)
		}

		/* returns:
		.cacheid str
		.snps[]
			.snpid
			.invalid:true
		*/
		return await validateInputCreateCache(q, tdb, ds, genome)
	} catch (e) {
		if (e.stack) console.log(e.stack)
		return { error: 'error validating snps: ' + (e.message || e) }
	}
}

async function summarizeSamplesFromCache(q, tdb, ds, genome) {
	if (!q.cacheid) throw 'cacheid missing'
	if (q.cacheid.match(/[^\w]/)) throw 'invalid cacheid'
	const tk = ds.track.vcf
	if (!tk) throw 'ds.track.vcf missing'
	// samples are at tk.samples[], each element: {name: int ID}

	// collect samples that will be summarized with optional filter
	let samples
	if (q.filter) {
		samples = termdbsql.get_samples(JSON.parse(decodeURIComponent(q.filter)), ds)
		if (samples.length == 0) throw 'no samples from filter'
	}
	const sampleinfilter = [] // list of true/false, same length of tk.samples, to tell if a sample is in use
	for (const i of tk.samples) {
		if (samples) {
			sampleinfilter.push(samples.includes(i.name))
		} else {
			sampleinfilter.push(true)
		}
	}

	const lines = (await utils.read_file(path.join(serverconfig.cachedir, q.cacheid))).split('\n')
	const samplewithgt = new Set() // collect samples with valid gt for any snp
	const snps = []
	for (let i = 1; i < lines.length; i++) {
		const l = lines[i].split('\t')
		const snpid = l[0]
		const refAllele = l[3]

		// count per allele count from this snp
		const allele2count = {} // k: allele, v: number of appearances
		const gt2count = {} // k: gt string, v: number of samples
		for (let j = 6; j < l.length; j++) {
			const gt = l[j]
			if (!gt) continue // no gt call for this sample
			if (!sampleinfilter[j - 6]) continue //sample not in use
			samplewithgt.add(tk.samples[j - 6].name) // this sample has valid gt
			gt2count[gt] = 1 + (gt2count[gt] || 0)
			const alleles = gt.split(',')
			for (const a of alleles) {
				allele2count[a] = 1 + (allele2count[a] || 0)
			}
		}

		const alleles = []
		for (const k in allele2count) {
			alleles.push({
				allele: k,
				count: allele2count[k],
				isRef: k == refAllele
			})
		}
		snps.push({ snpid, alleles, gt2count })
	}

	return {
		numOfSampleWithAnyValidGT: samplewithgt.size,
		snps
	}
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
	// added: snp.referenceAllele, snp.altAlleles

	return { snps, cacheid }
}

function parseSnpText(text) {
	// duplicated code with client
	const snps = []
	for (const tmp of text.trim().split('\n')) {
		const [rsid, ale] = tmp.trim().split(/[\s\t]/)
		if (rsid && rsid.startsWith('rs')) {
			// valid rsID
			if (snps.find(i => i.rsid == rsid)) continue // duplicate
			const s = {
				rsid,
				snpid: rsid
			}
			if (ale) s.effectAllele = ale
			snps.push(s)
		} else {
			// invalid rsID
			snps.push({
				rsid,
				snpid: rsid,
				invalid: true
			})
		}
		// may support chr:pos
	}
	return snps
}

async function mapRsid2chr(snps, genome) {
	// TODO process all rsid in one bigbed query
	for (const snp of snps) {
		if (snp.invalid) continue
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
	// do not filter on samples. write all samples to cache file
	// (unless the number of samples is too high for that to become a problem)

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
		args: ['query', '-R', coordsfile, '-f', bcfformat, '-v', bcffiles],
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
			if (!snp) return

			snp.referenceAllele = ref
			snp.altAlleles = alts

			// determine sample genotypes
			snp.gtlst = [] // same order as tk.samples
			for (let i = 4; i < l.length; i++) {
				const gt = parseGT(l[i], alleles)
				snp.gtlst.push(gt)
			}
		}
	})

	fs.unlink(coordsfile, () => {})
	fs.unlink(bcffiles, () => {})

	// write snp data to cache file
	const lines = ['snpid\tchr\tpos\tref\talt\teff\t' + tk.samples.map(i => i.name).join('\t')]
	for (const snp of snps) {
		if (snp.invalid) continue // invalid snp
		if (!snp.gtlst) continue // snp was not found in bcf
		lines.push(
			snp.snpid +
				'\t' +
				snp.chr +
				'\t' +
				snp.pos +
				'\t' +
				snp.referenceAllele +
				'\t' +
				snp.altAlleles.join(',') +
				'\t' +
				(snp.effectAllele || '') +
				'\t' +
				snp.gtlst.join('\t')
		)
		delete snp.gtlst // do not return to client
	}

	// cache id is a file name and its characters are covered by \w
	// will apply /[^\w]/ to check against attack
	const cacheid = 'snpgt_' + q.genome + '_' + q.dslabel + '_' + new Date() / 1 + '_' + Math.ceil(Math.random() * 10000)
	await utils.write_file(path.join(serverconfig.cachedir, cacheid), lines.join('\n'))
	return cacheid
}

function parseGT(gt, alleles) {
	if (gt == '.' || gt == './.') return ''
	const gtidx = gt.split('/').map(Number)
	if (gtidx.length != 2) return '' // autosome only for the moment
	const ale1 = alleles[gtidx[0]]
	const ale2 = alleles[gtidx[1]]
	if (!ale1 || !ale2) throw `invalid genotype`
	return ale1 + ',' + ale2
}
