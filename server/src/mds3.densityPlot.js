import { getDensity } from '../routes/termdb.violin.ts'

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

	const density = await getDensity(values)
	if (!Array.isArray(density.bins)) throw 'getDensity does not return []'
	if (density.bins.length == 0) throw 'getDensity returns an empty array'

	const result = {
		minvalue,
		maxvalue,
		xMin: density.xMin, //R xMin and xMax are not the same as minvalue and maxvalue
		xMax: density.xMax,
		densityMax: density.densityMax,
		densityMin: density.densityMin,
		density: density.bins,
		samplecount: values.length,
		unit: term.unit
	}

	return result
}
