/*

q{}
	.chr/start/stop
	.filter{}       -- bona fide filter obj
	.details{}

not integrated into mds3.load.js due to !!HARDCODED!! use of ds.queries.snvindel.byrange.get()
performs post-processing of data from byrange.get()
*/

export async function get_mds3variantData(q, res, ds, genome) {
	if (!q.chr) throw 'q.chr missing'
	q.start = Number(q.start)
	q.stop = Number(q.stop) // somehow q.stop can be string
	if (!Number.isInteger(q.start) || !Number.isInteger(q.stop)) throw 'q.start/stop is not integer'
	if (typeof q.details != 'object') throw 'q.details{} not object'

	const param = {
		rglst: [{ chr: q.chr, start: q.start, stop: q.stop }],
		filterObj: q.filter,
		addFormatValues: true // allows to add FORMAT including GT in each
	}
	const mlst = await ds.queries.snvindel.byrange.get(param)
	/*
	{
		chr/pos/class/dt/mname
		alt/ref
		info{}
		samples[]
			sample_id:int
			GT:'0/1'
	}
	*/

	const results = {}

	if (q.details.computeType == 'AF') {
		compute_AF(mlst, results)
	} else {
		throw 'unknown q.details.computeType'
	}

	res.send(results)
}

function compute_AF(mlst, results) {
	// only keep variants with at least 1 alt allele
	results.mlst = []
	results.skipMcountWithoutAlt = 0 // number of excluded variants for not having a single alt alelle in the current cohort

	for (const m of mlst) {
		// count all alleles and does not assume diploid, to allow it to work with chrY
		let altAlleleCount = 0,
			totalAlleleCount = 0
		for (const s of m.samples) {
			if (!s.GT) continue
			// ds may configure to use '|' if it exists in vcf file
			const tmp = s.GT.split('/').map(Number)
			totalAlleleCount += tmp.length
			for (const i of tmp) {
				if (i == m.altAlleleIdx) altAlleleCount++
			}
		}

		if (altAlleleCount == 0) {
			results.skipMcountWithoutAlt++
			continue
		}

		results.mlst.push(m)
		m.AF = Number((altAlleleCount / totalAlleleCount).toPrecision(2))
		delete m.samples
	}
}
