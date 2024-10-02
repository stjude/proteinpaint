import { scaleLinear } from 'd3-scale'
import { getBinsDensity } from '#shared/violin.bins.js'

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
	const ticks = 20
	const density = getBinsDensity(xscale, { values }, true, ticks)
	if (!Array.isArray(density.bins)) throw 'getBinsDensity does not return []'
	if (density.bins.length == 0) throw 'getBinsDensity returns an empty array'

	const result = {
		minvalue,
		maxvalue,
		densityMax: density.densityMax,
		densityMin: density.densityMin,
		density: density.bins,
		samplecount: values.length,
		unit: term.unit,
		ticks
	}

	return result
}
