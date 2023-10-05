import { scaleLinear } from 'd3-scale'
import { violinBinsObj } from '../../server/shared/violin.bins'

/*
********************** EXPORTED
get_densityplot
********************** INTERNAL
get_histogram

term: numeric term from termdb
samples: samples for genearting densityplot for the numeric term
*/

export async function get_densityplot(term, samples) {
	const width = 500,
		xpad = 10

	const values = []
	let minvalue = null,
		maxvalue = null
	for (const value of samples.map(s => s[term.id])) {
		// skip uncomputable values, as declared in term.values{ "-999":{uncomputable:true} }
		if (term.values?.[value]?.uncomputable) continue

		const v = Number(value)
		if (!Number.isFinite(v)) {
			// the sample either unannotated or the annotation is invalid (not a number)
			continue
		}
		values.push(v)
		if (minvalue === null) {
			minvalue = maxvalue = v
		} else {
			minvalue = Math.min(minvalue, v)
			maxvalue = Math.max(maxvalue, v)
		}
	}

	const xscale = scaleLinear()
		.domain([minvalue, maxvalue])
		.range([xpad, xpad + width])

	const bins = violinBinsObj(xscale, { values })
	if (!Array.isArray(bins.bins)) throw 'violinBins does not return {bins[]}'
	if (bins.bins.length == 0) throw 'violinBins {bins[]} empty array'

	const result = {
		minvalue,
		maxvalue,
		densitymax: 0,
		density: [], // [ bin position, sample count ]
		samplecount: values.length,
		unit: term.unit
	}
	for (const b of bins.bins) {
		if (!Number.isFinite(b.x0)) throw 'b.x0 not number'
		if (!Number.isFinite(b.x1)) throw 'b.x1 not number'
		if (!Number.isFinite(b.binValueCount)) throw 'b.binValueCount not number'
		result.density.push([(b.x0 + b.x1) / 2, b.binValueCount])
		result.densitymax = Math.max(result.densitymax, b.binValueCount)
	}

	return result
}
