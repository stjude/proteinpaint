import { getDensity } from '../routes/termdb.violin.ts'

/*
term: numeric term from termdb
samples: samples for genearting densityplot for the numeric term
todo rug plot
*/
export async function get_densityplot(term, samples) {
	const values = []
	for (const value of samples.map(s => s[term.id])) {
		// skip uncomputable values, as declared in term.values{ "-999":{uncomputable:true} }
		if (term.values?.[value]?.uncomputable) continue
		const v = Number(value)
		if (!Number.isFinite(v)) {
			// the sample either unannotated or the annotation is invalid (not a number)
			continue
		}
		values.push(v)
	}
	const density = await getDensity(values)
	if (!Array.isArray(density.bins)) throw 'getDensity does not return []'
	if (density.bins.length == 0) throw 'getDensity returns an empty array'
	return {
		min: density.minvalue,
		max: density.maxvalue,
		charts: {
			'': {
				plots: [
					{
						plotValueCount: values.length,
						density
					}
				]
			}
		}
	}
}
