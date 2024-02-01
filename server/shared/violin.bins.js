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

export function getBinsDensity(scale, plot, ticks = 20, bandwidth = 7) {
	const [min, max] = scale.domain()
	const step = (max - min) / ticks

	const density = kde(epanechnikov(bandwidth), scale.ticks(ticks), plot.values)

	const bins = []
	density.forEach(element => {
		bins.push({ x0: element[0], x1: element[0] + step, density: element[1] })
	})
	bins.push({ x0: max, x1: max, density: 0 })

	return bins
}

function epanechnikov(bandwidth) {
	return x => (Math.abs((x /= bandwidth)) <= 1 ? (0.75 * (1 - x * x)) / bandwidth : 0)
}

function kde(kernel, thresholds, data) {
	return thresholds.map(t => [t, d3.mean(data, d => kernel(t - d))])
}
