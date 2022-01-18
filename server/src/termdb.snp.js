const fs = require('fs')
const path = require('path')
const utils = require('./utils')
const termdbsql = require('./termdb.sql')
const termdb = require('./termdb')
const readline = require('readline')
const serverconfig = require('./serverconfig')

/*
********************** EXPORTED
validate()
********************** INTERNAL
*/

/*
q{}
	.genome
	.dslabel
	.snptext: str, same as input
	.filter: stringified json

snps[ {} ]
	.rsid: raw str, to be validated in genome bb file
	.effectAllele: optional
	.invalid: true if this item is invalid for any reason
	.chr: if not given, will query bb file to map to chr; if no match then missing
	.pos: if not given, match from bb file. 0-based!
	.alleles[]: from bcf file, [0] is ref, [1:] are alts
*/

const bcfformatbase = '%REF\t%ALT\t%FORMAT\n'

export async function validate(q, tdb, ds, genome) {
	try {
		if (!genome.snp) throw 'snp not supported by genome'
		if (!q.snptext) throw '.snptext missing'
		const snps = parseSnpText(q.snptext)
		if (!snps.length) throw 'no snps'
		await mapRsid2chr(snps, genome)
		const [cacheid, numOfSampleWithAnyValidGT, numOfSampleWithAllValidGT] = await queryBcf(q, snps, ds)
		return { snps, cacheid, numOfSampleWithAnyValidGT, numOfSampleWithAllValidGT }
	} catch (e) {
		if (e.stack) console.log(e.stack)
		return { error: 'error validating snps: ' + (e.message || e) }
	}
}

function parseSnpText(text) {
	// duplicated code with client
	const snps = []
	for (const tmp of text.trim().split('\n')) {
		const [rsid, ale] = tmp.trim().split(/[\s\t]/)
		if (rsid) {
			if (snps.find(i => i.rsid == rsid)) continue // duplicate
			const s = { rsid }
			if (ale) s.effectAllele = ale
			snps.push(s)
		}
	}
	return snps
}

async function mapRsid2chr(snps, genome) {
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
	// samples are at tk.samples[], ele: {name: int ID}

	const sampleheader = [] // represent the order of sample columns in the snp-by-sample matrix, after filtering
	const sampleinclude = [] // same length of list of true/false
	let set
	if (q.filter) {
		set = new Set(termdbsql.get_samples(JSON.parse(decodeURIComponent(q.filter)), ds))
	}
	for (const s of tk.samples) {
		if (set) {
			const y = set.has(s.name)
			sampleinclude.push(y)
			if (y) sampleheader.push(s.name)
		} else {
			sampleinclude.push(true)
			sampleheader.push(s.name)
		}
	}
	if (sampleheader.length == 0) throw 'no samples'

	const lines = ['rsid\teffAle\tchr\tpos\talleles\t' + sampleheader.join('\t')] // lines to write to cache file

	const sample2snpcount = new Map()
	// k: sample
	// v: number of snps with valid gt
	// to compute two numbers: #samples with valid gt for at least one snp, and for all snps
	let validsnpcount = 0

	for (const snp of snps) {
		if (snp.invalid) continue
		validsnpcount++
		const file = tk.chr2bcffile[snp.chr]
		if (!file) throw 'chr not in chr2bcffile'
		const coord = (tk.nochr ? snp.chr.replace('chr', '') : snp.chr) + ':' + (snp.pos + 1) + '-' + (snp.pos + 1)
		const gtlst = [] // in the same order as sampleheader
		snp.validgtcount = 0
		await utils.get_lines_bigfile({
			isbcf: true,
			args: ['query', file, '-r', coord, '-f', bcfformatbase],
			dir: tk.dir,
			callback: line => {
				// 'T', 'C', 'GT', '1/1', '0/1', ...
				const l = line.split('\t')
				const alleles = [l[0], ...l[1].split(',')]
				snp.alleles = alleles
				for (let i = 3; i < l.length; i++) {
					const gt = parseGT(i, l[i], sampleinclude, alleles)
					gtlst.push(gt)
					if (gt) {
						// this sample has a valid gt for this snp
						snp.validgtcount++
						const sid = tk.samples[i - 3].name
						sample2snpcount.set(sid, 1 + (sample2snpcount.get(sid) || 0))
					}
				}
			}
		})
		lines.push(
			`${snp.rsid || ''}\t${snp.effectAllele || ''}\t${snp.chr}\t${snp.pos}\t${snp.alleles.join(',')}\t${gtlst.join(
				'\t'
			)}`
		)
	}

	const cacheid = 'snpgt.' + q.genome + '.' + q.dslabel + '.' + new Date() / 1 + '.' + Math.random()
	await utils.write_file(path.join(serverconfig.cachedir, cacheid), lines.join('\n'))

	let numOfSampleWithAllValidGT = 0 // number of samples with valid gt for all snps
	for (const c of sample2snpcount.values()) {
		if (c == validsnpcount) numOfSampleWithAllValidGT++
	}

	return [cacheid, sample2snpcount.size, numOfSampleWithAllValidGT]
}

function parseGT(i, str, sampleinclude, alleles) {
	// i-3 is the array index of tk.samples
	// return reconstructed diploid genotype: A,T
	// if no call or any error in parsing, return empty string
	if (!sampleinclude[i - 3]) return '' // this sample is not used
	if (str == '.' || str == './.') return '' // no call
	const gtidx = str.split('/').map(Number)
	if (gtidx.length != 2) {
		// autosome only for the monent
		return ''
	}
	const ale1 = alleles[gtidx[0]],
		ale2 = alleles[gtidx[1]]
	if (!ale1 || !ale2) return ''
	return ale1 + ',' + ale2
}
