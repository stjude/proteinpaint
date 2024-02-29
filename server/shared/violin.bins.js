//This module generates bins using d3 bin.js (look into node_modules). The functions here require a numeric scale and an array of values stored inside an object(eg, plot/chart: {values: [array]}).
//Based on the domain and range of the scale the bins are computed.
//The threshold decides the number of buckets that will be generated. look at https://observablehq.com/@d3/d3-bin for more details.
/*

input parameters:
1) scale: scalelinear().domain().range
2) plot/chart: {
    values: [number]
}

output:
{
    bins0:[
        [
            numbers.....
        ],
        [
            numbers....
        ],
        [can be empty],
    bins:[                 //take this bins object and send to client. See implementation at termdb.violin.js and mds3.densityPlot.js
        {
            { x0: 0, x1: 0.05, density: 121 },
            { x0: 0.05, x1: 0.1, density: 2 },
        }
    ]
    ]
}

*/
const { bin } = require('d3-array')
import * as d3 from 'd3'

export function getBinsDensity(scale, plot, isKDE = false, ticks = 20, bandwidth = 5) {
	const [min, max] = scale.domain() //Min and max for all plots
	const [valuesMin, valuesMax] = d3.extent(plot.values) //Min and max on plot
	const step = Math.abs(max - min) / ticks

	if (valuesMin == valuesMax) return { bins: [{ x0: valuesMin, x1: valuesMax, density: 1 }], densityMax: valuesMax }

	return isKDE
		? kde(epanechnikov(bandwidth), scale.ticks(ticks), plot.values, valuesMin, valuesMax, step)
		: getBinsHist(scale, plot.values, ticks, valuesMin, valuesMax)
}

function epanechnikov(bandwidth) {
	return x => (Math.abs((x /= bandwidth)) <= 1 ? (0.75 * (1 - x * x)) / bandwidth : 0)
}

function kde(kernel, thresholds, data, valuesMin, valuesMax, step) {
	const density = thresholds.map(t => [t, d3.mean(data, d => kernel(t - d))])
	const bins = []
	let densityMax = 0
	for (const element of density) {
		const bin = { x0: element[0], x1: element[0] + step, density: element[1] }
		densityMax = Math.max(densityMax, bin.density)
		if (bin.x1 < valuesMin) continue
		if (bin.x0 > valuesMax) break
		bins.push(bin)
	}
	console.log(bins, densityMax)
	return { bins, densityMax }
}

function getBinsHist(scale, values, ticks, valuesMin, valuesMax) {
	const binBuilder = bin()
		.domain(scale.domain()) /* extent of the data that is lowest to highest*/
		.thresholds(scale.ticks(ticks)) /* buckets are created which are separated by the threshold*/
		.value(d => d) /* bin the data points into this bucket*/
	const bins0 = binBuilder(values)
	const bins = []
	let densityMax = 0
	for (const bin of bins0) {
		densityMax = Math.max(densityMax, bin.length)
		bins.push({ x0: bin.x0, x1: bin.x1, density: bin.length })
		if (bin.x1 < valuesMin) continue
		if (bin.x0 > valuesMax) break
	}
	console.log(bins, densityMax)
	return { bins, densityMax }
}
