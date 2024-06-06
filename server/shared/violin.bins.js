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
            { x0: density: 0.2 },
            { x0, density: 0.3 },
        }
    ]
    ]
}

*/
import { bin } from 'd3-array'
import * as d3 from 'd3'

export function getBinsDensity(scale, plot, isKDE = false, ticks = 20) {
	const [valuesMin, valuesMax] = d3.extent(plot.values) //Min and max on plot

	//Commented out as it seems to be handled by kde with automatic bandwidth
	//if (valuesMin == valuesMax) return { bins: [{ x0: valuesMin, density: 1 }], densityMax: valuesMax, densityMin: 0}

	const result = isKDE
		? kde(gaussianKernel, scale.ticks(ticks), plot.values, valuesMin, valuesMax)
		: getBinsHist(scale, plot.values, ticks, valuesMin, valuesMax)

	result.bins.unshift({ x0: valuesMin, density: result.densityMin }) //This allows to start the plot from min prob, avoids rendering issues

	//This allows to finish the plot on the min prob
	result.bins.push({ x0: valuesMax, density: result.bins[result.bins.length - 1].density })
	result.bins.push({ x0: valuesMax, density: result.densityMin })
	return result
}

function epanechnikov(bandwidth) {
	return x => (Math.abs((x /= bandwidth)) <= 1 ? (0.75 * (1 - x * x)) / bandwidth : 0)
}

function gaussianKernel(u, bandwidth) {
	return Math.abs((u /= bandwidth)) <= 1 ? (0.75 * (1 - u * u) * Math.exp((-u * u) / 2)) / Math.sqrt(2 * Math.PI) : 0
}

function gaussianKernelWithoutBandwidth(u) {
	return Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI)
}

function kde(kernel, thresholds, data, valuesMin, valuesMax) {
	let bandwidth = completeCVBandwidth(data) / 2
	console.log(bandwidth)
	//if (bandwidth == 0 || isNaN(bandwidth)) bandwidth = 1
	const density = thresholds.map(t => [t, d3.mean(data, d => kernel(t - d, bandwidth))])
	const bins = []
	let densityMax = 0,
		densityMin = 1
	for (const element of density) {
		const bin = { x0: element[0], density: element[1] }
		densityMax = Math.max(densityMax, bin.density)
		densityMin = Math.min(densityMin, bin.density)
		if (bin.x0 < valuesMin) continue
		if (bin.x0 > valuesMax) break
		bins.push(bin)
	}

	return { bins, densityMin, densityMax }
}

function kdeWithoutX(data, x, bandwidth, kernel) {
	return (
		data.reduce((sum, xi) => {
			return sum + kernel((x - xi) / bandwidth)
		}, 0) /
		(data.length * bandwidth)
	)
}

function LOOCV(data, bandwidth, kernel) {
	let totalError = 0

	for (let i = 0; i < data.length; i++) {
		const leaveOutPoint = data[i]
		const trainData = data.filter((_, index) => index !== i)

		const estimate = kdeWithoutX(trainData, leaveOutPoint, bandwidth, kernel)
		const trueDensity = kdeWithoutX(data, leaveOutPoint, bandwidth, kernel)

		totalError += Math.log(estimate) - Math.log(trueDensity)
	}

	return Math.exp(totalError / data.length)
}

function completeCVBandwidth(data, kernel = gaussianKernelWithoutBandwidth) {
	const n = data.length
	let bestBandwidth = 0
	let minError = Infinity

	for (let bandwidth = 0.1; bandwidth <= 2.0; bandwidth += 0.1) {
		const error = LOOCV(data, bandwidth, kernel)

		if (error < minError) {
			minError = error
			bestBandwidth = bandwidth
		}
	}

	return bestBandwidth
}

function mean(data) {
	return data.reduce((sum, value) => sum + value, 0) / data.length
}

function stdDev(data) {
	const meanValue = mean(data)
	const squaredDifferences = data.map(value => Math.pow(value - meanValue, 2))
	const variance = squaredDifferences.reduce((sum, value) => sum + value, 0) / data.length
	return Math.sqrt(variance)
}

function quantileSeq(data, p) {
	const sortedData = data.slice().sort((a, b) => a - b)
	const index = Math.floor(p * (sortedData.length - 1))
	const fraction = p * (sortedData.length - 1) - index
	return (1 - fraction) * sortedData[index] + fraction * sortedData[index + 1]
}

function silvermanBandwidth(data) {
	const std = stdDev(data)
	const iqr = quantileSeq(data, 0.75) - quantileSeq(data, 0.25)
	const n = data.length
	const h = 1.06 * Math.min(std, iqr / 1.34) * Math.pow(n, -1 / 5)
	return h
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
		if (bin.x0 < valuesMin) continue
		if (bin.x0 > valuesMax) break
		bins.push({ x0: bin.x0, density: bin.length })
	}
	return { bins, densityMin: 0, densityMax }
}
