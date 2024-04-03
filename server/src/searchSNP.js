/*
.byCoord
	if true, query bigbed file by coordinate
.byName
	if true, query bigbed file by rs id
.genome
	name of genome
.chr
	used for byCoord
.ranges[ {start, stop} ]
	used for byCoord
.alleleLst[ str ]
	used for byCoord, if provided will only return snps with matching alleles
.lst[ str ]
	used for byName
*/

import { query_bigbed_by_coord } from './utils.js'

export async function searchSNP(q, genome) {
	if (!genome) throw 'invalid genome'
	if (!genome.snp) throw 'snp is not configured for this genome'
	const hits = []
	if (q.byCoord) {
		// query dbSNP bigbed file by coordinate
		// input query coordinates need to be 0-based
		// output snp coordinates are 0-based
		if (genome.genomicNameRegexp.test(q.chr)) throw 'invalid chr name'
		if (!Array.isArray(q.ranges)) throw 'ranges not an array'
		for (const r of q.ranges) {
			// require start/stop of a range to be non-neg integers, as a measure against attack
			if (!Number.isInteger(r.start) || !Number.isInteger(r.stop) || r.start < 0 || r.stop < r.start)
				throw 'invalid start/stop'
			if (r.stop - r.start >= 100) {
				// quick fix!
				// as this function only works as spot checking snps
				// guard against big range and avoid retrieving snps from whole chromosome that will overwhelm server
				throw 'range too big'
			}
			const snps = await query_bigbed_by_coord(genome.snp.bigbedfile, q.chr, r.start, r.stop)
			for (const snp of snps) {
				const hit = snp2hit(snp)
				if (q.alleleLst) {
					// given alleles must be found in a snp for it to be returned
					let missing = false
					for (const i of q.alleleLst) {
						// only test on non-empty strings
						if (i && !hit.alleles.includes(i)) {
							missing = true
							break
						}
					}
					if (missing) continue
				}
				hits.push(hit)
			}
		}
	} else if (q.byName) {
		if (!Array.isArray(q.lst)) throw '.lst[] missing'
		for (const n of q.lst) {
			// query dbSNP bigbed file by rsID
			// see above for description of output snp fields
			if (genome.genomicNameRegexp.test(n)) continue
			const snps = await utils.query_bigbed_by_name(genome.snp.bigbedfile, n)
			for (const snp of snps) {
				const hit = snp2hit(snp)
				hits.push(hit)
			}
		}
	} else {
		throw 'unknown query method'
	}
	return hits
}
