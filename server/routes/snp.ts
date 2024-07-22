import * as utils from '#src/utils.js'

export const api: any = {
	// route endpoint
	// - no need for trailing slash
	// - should be a noun (method is based on HTTP GET, POST, etc)
	// - don't add 'Data' as response is assumed to be data
	endpoint: 'snp',
	methods: {
		get: {
			init,
			request: {
				typeId: 'any'
			},
			response: {
				typeId: 'any'
			}
		},
		post: {
			alternativeFor: 'get',
			init
		}
	}
}

function init({ genomes }) {
	return async function handle_snp(req, res) {
		// TODO move to routes
		try {
			const n = req.query.genome
			if (!n) throw 'no genome'
			res.send({ results: await searchSNP(req.query, genomes[n]) })
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			return res.send({ error: e.message || e })
		}
	}
}

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
export async function searchSNP(q, genome) {
	if (!genome) throw 'invalid genome'
	if (!genome.snp) throw 'snp is not configured for this genome'
	const hits: any[] = []
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
			const snps = await utils.query_bigbed_by_coord(genome.snp.bigbedfile, q.chr, r.start, r.stop)
			for (const snp of snps) {
				const hit = snp2hit(snp)
				if (q.alleleLst) {
					/*
					TODO: output of utils.query_bigbed_by_coord() is not guaranteed to yield variants with the same start position, even if r.stop - r.start is a single base (see documentation for bigBedToBed). Therefore, the alleles in q.alleleLst[] may be checked against variants with different start position.
					*/
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

function snp2hit(snp) {
	// snp must be non-empty string
	// output snp fields: [0]chrom, [1]chromStart, [2]chromEnd, [3]name, [4]ref, altCount, [6]alts, shiftBases, freqSourceCount, minorAlleleFreq, majorAllele, minorAllele, maxFuncImpact, class, ucscNotes, _dataOffset, _dataLen
	const fields = snp.split('\t')
	const ref = fields[4]
	const alts = fields[6].split(',').filter(Boolean)
	const observed = ref + '/' + alts.join('/')
	const hit = {
		chrom: fields[0],
		chromStart: Number(fields[1]),
		chromEnd: Number(fields[2]),
		name: fields[3],
		observed: observed,
		ref: ref,
		alt: alts,
		alleles: [ref, ...alts]
	}
	return hit
}
