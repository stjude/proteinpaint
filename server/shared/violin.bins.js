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
            { x0: 0, x1: 0.05, binValueCount: 121 },
            { x0: 0.05, x1: 0.1, binValueCount: 2 },
        }
    ]
    ]
}

*/
const { bin } = require('d3-array')

export function violinBinsObj(scale, plot, ticks = 15) {
	const bins0 = computeViolinBins(scale, plot.values, ticks)
	//if (plot.values.every((val, i) => val === plot.values[0])) return { bins0, bins: [] }
	// array; each element is an array of values belonging to this bin

	// map messy bins0 to tidy set of bins and return to client
	const bins = []
	let xMax = 0
	for (const b of bins0) {
		const b2 = {
			x0: b.x0,
			x1: b.x1,
			binValueCount: b.length
		}
		delete b.x0
		delete b.x1
		bins.push(b2)
	}
	// Add an extra bin with 0 binValueCount at the end of b2 for improving rendering and removing convoluted logic for threshold.
	const lastBinX1 = bins[bins.length - 1].x1
	const extraBin = {
		x0: lastBinX1,
		x1: lastBinX1,
		binValueCount: 0
	}
	bins.push(extraBin)
	return { bins0, bins }
}

function computeViolinBins(scale, values, ticks) {
	// disable this method for now and hardcode ticks to 15.
	// const uniqueValues = new Set(values)
	// const ticksCompute = uniqueValues.size === 1 ? 50 : uniqueValues.size <= 10 ? 5 : uniqueValues.size <= 20 ? 10 : 20

	const binBuilder = bin()
		.domain(scale.domain()) /* extent of the data that is lowest to highest*/
		.thresholds(scale.ticks(ticks)) /* buckets are created which are separated by the threshold*/
		.value(d => d) /* bin the data points into this bucket*/

	return binBuilder(values)
}
