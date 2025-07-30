import fs from 'fs'
import path from 'path'
import * as utils from './utils'
import * as termdbsql from './termdb.sql.js'
import readline from 'readline'
import serverconfig from './serverconfig.js'
import { compute_mclass } from './vcf.mclass.js'

/*
cache file has a header line, with one line per valid snp. columns: 
1. snpid
2. chr
3. pos, 0-based
4. ref
5. alt (comma-joined alternative alleles)
6. effAllele (user-given allele, blank if not specified)
7-rest: integer sample ids, with GT as values, use / as separators

same cache file is used for both snplst and snplocus terms

info fields:
- snplst does not process info fields
- snplocus uses info fields to filter variants. info fields of resulting variants are returned to client for showing in gb

*************** EXPORT
validate()
compute_mclass
*************** function cascade
summarizeSamplesFromCache()
validateInputCreateCache_by_snptext
validateInputCreateCache_by_coord
*/

const bcfformat_snplst = '%CHROM\t%POS\t%REF\t%ALT[\t%TGT]\n'
const bcfformat_snplocus = '%POS\t%ID\t%REF\t%ALT\t%INFO[\t%TGT]\n'
const missing_gt = './.'
const snplocusMaxVariantCount = 1000

export async function validate(q, tdb, ds, genome) {
	try {
		if (q.sumSamples) {
			/* given a cache file, summarize number of samples for each variant
			works for both snplst and snplocus term types
			do not filter variants by AF, as the term q is not provided and cannot derive effect Allele
			returns:
			.numOfSampleWithAnyValidGT: int
			.snps[]
				.snpid
				.gt2count{ k: gt, v: count }
				.alleles[]
					{allele, isRef:true, count}
			*/
			return await summarizeSamplesFromCache(q, tdb, ds, genome)
		}
		if (q.snptext) {
			/* for snplst term:
			given raw text entered from snplst editing UI
			parse snps from the text, and create cache file
			returns:
			.cacheid str
			.snps[]
				.snpid
				.invalid:true
			*/
			return await validateInputCreateCache_by_snptext(q, ds, genome)
		}
		if (q.chr) {
			/* for snplocus term
			given chr/start/stop, query variants from this range and create cache file

			q = {
				validateSnps: 1,
				genome: str
				dslabel: str
				chr: str
				start: int
				stop: int
				variant_filter: { filter obj with info fields }
			}

			returns:
			.cacheid str
			.snps[]
				.snpid
				.info{ k: v }
				.pos (0-based)
			.reachedVariantLimit
			*/
			return await validateInputCreateCache_by_coord(q, ds, genome)
		}
		throw 'unknown how to validate'
	} catch (e) {
		if (e.stack) console.log(e.stack)
		return { error: e.message || e }
	}
}

async function summarizeSamplesFromCache(q, tdb, ds, genome) {
	if (!q.cacheid) throw 'cacheid missing'
	if (serverconfig.cache_snpgt.fileNameRegexp.test(q.cacheid)) throw 'invalid cacheid'

	const tk = ds.queries?.snvindel?.byrange?._tk
	if (!tk) throw 'ds.queries.snvindel.byrange._tk missing'

	// samples are at tk.samples[], each element: {name: int ID}

	let sampleinfilter // list of true/false, same length of tk.samples, to tell if a sample is in use
	if (q.filter) {
		// using optional filter
		const filterSet = new Set((await termdbsql.get_samples({ filter: q.filter }, ds)).map(i => i.id))
		if (filterSet.size == 0) throw 'no samples from filter'
		sampleinfilter = tk.samples.map(i => filterSet.has(i.name))
	} else {
		// no filter, using all samples
		sampleinfilter = tk.samples.map(i => {
			return true
		})
	}

	const lines = (await utils.read_file(path.join(serverconfig.cache_snpgt.dir, q.cacheid))).split('\n')
	const samplewithgt = new Set() // collect samples with valid gt for any snp
	const snps = []
	for (let i = 1; i < lines.length; i++) {
		const l = lines[i].split('\t')
		const snpid = l[0]
		const refAllele = l[3]

		// count per allele count from this snp
		const allele2count = {} // k: allele, v: number of appearances
		const gt2count = {} // k: gt string, v: number of samples
		for (let j = serverconfig.cache_snpgt.sampleColumn; j < l.length; j++) {
			const gt = l[j]
			if (!gt) continue // no gt call for this sample
			if (!sampleinfilter[j - serverconfig.cache_snpgt.sampleColumn]) continue //sample not in use
			// this sample has valid gt
			samplewithgt.add(tk.samples[j - serverconfig.cache_snpgt.sampleColumn].name)
			gt2count[gt] = 1 + (gt2count[gt] || 0)
			const alleles = gt.split('/')
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

async function validateInputCreateCache_by_snptext(q, ds, genome) {
	if (!genome.snp) throw 'snp not supported by genome'
	if (!q.snptext) throw '.snptext missing'

	const snps = parseSnpText(q.snptext)
	if (!snps.length) throw 'no snps'
	// the unique id .snpid is assigned on each snp, no matter valid or not
	/*
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
	*/

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
				invalid: 'INVALID RSID'
			})
		}
		// may support chr:pos
	}
	return snps
}

async function mapRsid2chr(snps, genome) {
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
			const hits = await utils.query_bigbed_by_name(genome.snp.bigbedfile, snp.rsid)
			const majorhits = []
			for (const line of hits) {
				// must guard against invalid chr as this is querying by name but not by range
				// also only keep major and discard hits on minorchr
				const l = line.split('\t')
				const chr = genome.chrlookup[l[0].toUpperCase()]
				if (chr && chr.major) majorhits.push(l)
			}
			if (majorhits.length == 0) {
				snp.invalid = true
				continue
			}
			// allow multiple hits on majorchr for now
			const l = majorhits[0]
			snp.chr = l[0]
			snp.pos = Number.parseInt(l[1]) // 0-based
			snp.dbsnpRef = l[4]
			snp.dbsnpAlts = l[6].split(',').filter(Boolean)
			continue
		}
		// unknown entry
		snp.invalid = true
	}
	if (!snps.find(snp => !snp.invalid)) throw 'no valid variants'
}

async function queryBcf(q, snps, ds) {
	const tk = ds.queries.snvindel.byrange._tk

	// samples are at tk.samples[], each element: {name: int ID}
	// do not filter on samples. write all samples to cache file
	// (unless the number of samples is too high for that to become a problem)

	// collect coordinates and bcf file paths that will be queried
	const bcfs = new Set()
	const coords = []
	for (const snp of snps) {
		if (snp.invalid) continue

		let bcffile
		if (tk.chr2files) {
			bcffile = tk.chr2files[snp.chr].file
			if (!bcffile) throw 'chr not in chr2files'
		} else {
			bcffile = tk.file || tk.url
		}

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
	await utils.get_lines_bigfile({
		isbcf: true,
		args: ['query', '-R', coordsfile, '-f', bcfformat_snplst, '-v', bcffiles],
		dir: tk.dir,
		callback: line => {
			// chr, pos, ref, alt, '0/0', '0/0', '0/1', '1/1', ...
			const l = line.split('\t')
			const chr = (tk.nochr ? 'chr' : '') + l[0]
			const pos = l[1]
			const ref = l[2]
			const alts = l[3].split(',')

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
				snp.gtlst.push(l[i] == missing_gt ? '' : l[i])
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
	const cacheid = q.genome + '_' + q.dslabel + '_' + new Date() / 1 + '_' + Math.ceil(Math.random() * 10000)
	await utils.write_file(path.join(serverconfig.cache_snpgt.dir, cacheid), lines.join('\n'))
	return cacheid
}

async function validateInputCreateCache_by_coord(q, ds, genome) {
	// for snplocus term
	// q { chr/start/stop }
	const start = Number(q.start),
		stop = Number(q.stop)
	if (!Number.isInteger(start) || !Number.isInteger(stop)) throw 'start/stop are not integers'
	if (start > stop || start < 0) throw 'invalid start/stop coordinate'

	const tk = ds.queries?.snvindel?.byrange?._tk
	if (!tk) throw 'tk missing'
	let file
	if (tk.chr2files) {
		file = tk.chr2files?.[q.chr].file
	} else {
		file = tk.file || tk.url
	}
	if (!file) throw 'no bcf file'

	const coord = (tk.nochr ? q.chr.replace('chr', '') : q.chr) + ':' + start + '-' + stop

	const bcfargs = ['query', file, '-r', coord, '-f', bcfformat_snplocus]
	if (q.variant_filter) {
		add_bcf_variant_filter(q.variant_filter, bcfargs)
	}

	// result obj to return to client
	const result = {
		snps: [] // collect snps {snpid, info} and send to client to store at term.snps, just like snplst
	}

	const lines = ['snpid\tchr\tpos\tref\talt\teff\t' + tk.samples.map(i => i.name).join('\t')]
	await utils.get_lines_bigfile({
		isbcf: true,
		args: bcfargs,
		dir: tk.dir,
		callback: (line, ps) => {
			if (result.snps.length >= snplocusMaxVariantCount) {
				ps.kill()
				result.reachedVariantLimit = true
				return
			}

			const l = line.split('\t')
			const pos = Number(l[0]) - 1 // vcf pos is 1-based, change to 0-based for pp use
			const vcfId = l[1]
			const refAllele = l[2]
			const altAlleles = l[3].split(',')

			// if valid vcf ID is avaialble, use it since it should be snp rsid
			const snpid = vcfId && vcfId != '.' ? vcfId : pos + '.' + refAllele + '.' + altAlleles.join(',')

			const variant = {
				snpid,
				chr: q.chr,
				pos
			}
			compute_mclass(
				tk,
				refAllele,
				altAlleles,
				variant,
				l[4], // vcf INFO column
				l[1] // vcf ID column
			)

			// !! quick fix !!
			// use rsid if available
			for (const m of variant.mlst) {
				if (m.vcf_id) m.mname = m.vcf_id
			}

			result.snps.push(variant)

			const lst = [
				snpid,
				q.chr,
				pos,
				refAllele,
				altAlleles.join(','),
				'' // snplocus file does not have eff ale
			]
			for (let i = 5; i < l.length; i++) {
				lst.push(l[i] == missing_gt ? '' : l[i])
			}
			lines.push(lst.join('\t'))
		}
	})
	result.cacheid = q.genome + '_' + q.dslabel + '_' + new Date() / 1 + '_' + Math.ceil(Math.random() * 10000)
	await utils.write_file(path.join(serverconfig.cache_snpgt.dir, result.cacheid), lines.join('\n'))
	return result
}

export function add_bcf_variant_filter(variant_filter, bcfargs) {
	// on bcf expression https://samtools.github.io/bcftools/bcftools.html#expressions
	const lst = []
	// assumes variant_filter.type == 'tvslst'
	for (const i of variant_filter.lst) {
		if (i.tvs.values) {
			const operator = i.tvs.isnot ? '!=' : '='
			for (const v of i.tvs.values) {
				const value = isNaN(v.key) ? `"${v.key}"` : Number(v.key)
				lst.push(`INFO/${i.tvs.term.id}${operator}${value}`)
			}
		} else if (i.tvs.ranges) {
			for (const range of i.tvs.ranges) {
				if ('start' in range) {
					lst.push(`INFO/${i.tvs.term.id} ${range.startinclusive ? '>=' : '>'} ${range.start}`)
				}
				if ('stop' in range) {
					lst.push(`INFO/${i.tvs.term.id} ${range.stopinclusive ? '<=' : '<'} ${range.stop}`)
				}
			}
		} else {
			throw `unknown tvs spec for info_field: type=${i.type}, term.id=${i.tvs.term.id}`
		}
	}
	if (lst.length == 0) return
	bcfargs.push('-i', lst.join(' && '))
}
