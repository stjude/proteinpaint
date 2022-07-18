import { dofetch3 } from './dofetch'

/*
genome={}: client-side genome object
str=str: query string to match with dbSNP accession

returns {chr,start,stop}
throws exception if no match
*/
export async function string2snp(genome, str) {
	const data = await dofetch3('snp', {
		method: 'POST',
		body: JSON.stringify({ byName: true, genome: genome.name, lst: [str] })
	})
	if (data.error) throw data.error
	if (!data.results || data.results.length == 0) throw str + ': not a SNP'
	// start/stop are ucsc bed format, include start, not stop
	// return hit on major if any
	for (const i of data.results) {
		const chr = genome.chrlookup[i.chrom.toUpperCase()]
		if (chr && chr.major) {
			return {
				chr: i.chrom,
				start: i.chromStart,
				stop: i.chromEnd
			}
		}
	}
	// no hit on major chr, just return the first one
	const r = data.results[0]
	return {
		chr: r.chrom,
		start: r.chromStart,
		stop: r.chromEnd
	}
}
