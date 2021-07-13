const scaleLinear = require('d3-scale').scaleLinear

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
	// height= 100,
	// ypad = 20

	const values = []
	const distinctValues = new Set()
	let minvalue = null,
		maxvalue = null
	for (const value of samples.map(s => s[term.id])) {
		const v = Number(value)
		if (Number.isNaN(v)) {
			// alert?
			continue
		}
		values.push(v)
		distinctValues.add(v)
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

	const default_ticks_n = 40
	const ticks_n =
		term.type == 'integer' && maxvalue - minvalue < default_ticks_n
			? maxvalue - minvalue
			: term.type == 'float' && distinctValues.size < default_ticks_n
			? distinctValues
			: default_ticks_n
	// kernal density replaced with histogram
	// const density = kernelDensityEstimator(kernelEpanechnikov(7), xscale.ticks(40))(values)
	const density = get_histogram(xscale.ticks(ticks_n))(values)
	let densitymax = 0
	for (const d of density) {
		densitymax = Math.max(densitymax, d[1])
	}

	const result = {
		minvalue,
		maxvalue,
		densitymax,
		density,
		samplecount: values.length,
		unit: term.unit
	}
	return result
}

function get_histogram(ticks) {
	return values => {
		// array of {value}
		const bins = []
		for (let i = 0; i < ticks.length; i++) bins.push([ticks[i], 0])
		for (const v of values) {
			for (let i = 1; i < ticks.length; i++) {
				if (v <= ticks[i]) {
					bins[i - 1][1]++
					break
				}
			}
		}
		return bins
	}
}
