/*
Initialize a bin configuration for a numeric dataset
<data>: array of numeric data values
<opts> (optional): object of options
    {}: output bin config as JavaScript object (default)
    {format: 'string'}: output bin config as JSON string
*/
module.exports = function initBinConfig(data, opts = {}) {
	for (const x of data) {
		if (!Number.isFinite(x)) throw 'Cannot compute bin config. Data contains non-numeric values.'
	}
	// compute the bin size for a maximum bin number of 8
	data.sort((a, b) => a - b)
	const l = data.length
	const min = data[0]
	const max = data[l - 1]
	const binSize = (max - min) / 8
	// first bin stop will equal the 5th percentile of the dataset
	let p5idx = Math.round(l * 0.05) - 1
	if (p5idx < 0) p5idx = 0
	const firstBinStop = data[p5idx]
	// round the bin values based on whether the dataset contains mostly integers or fractions
	let binSize_rnd, firstBinStop_rnd, lastBinStart_rnd, rounding
	const integers = data.filter(x => Math.abs(x) >= 1)
	if (integers.length / data.length > 0.5) {
		;[binSize_rnd, firstBinStop_rnd, lastBinStart_rnd] = roundIntegers(binSize, firstBinStop, max)
	} else {
		;[binSize_rnd, firstBinStop_rnd, lastBinStart_rnd, rounding] = roundFractions(binSize, firstBinStop, max)
	}
	// generate the bin configuration
	const binConfig = {
		type: 'regular',
		startinclusive: true,
		bin_size: binSize_rnd,
		first_bin: { stop: firstBinStop_rnd }
	}
	if (lastBinStart_rnd) binConfig.last_bin = { start: lastBinStart_rnd }
	if (rounding) binConfig.rounding = rounding
	if ('format' in opts) {
		if (opts.format === 'string') {
			return JSON.stringify(binConfig)
		} else {
			throw 'options are not in the correct format'
		}
	} else {
		return binConfig
	}
}

function roundIntegers(binSize, firstBinStop, max) {
	let binSize_rnd, firstBinStop_rnd, lastBinStart_rnd
	if (binSize < 10) {
		binSize_rnd = Math.round(binSize / 5) * 5
		if (binSize_rnd === 0) binSize_rnd = 1
		firstBinStop_rnd = Math.ceil(firstBinStop / 5) * 5
	} else {
		if (firstBinStop === 0) {
			const log = Math.floor(Math.log10(binSize))
			binSize_rnd = Math.round(binSize / 10 ** log) * 10 ** log
			firstBinStop_rnd = 0
		} else {
			const log = Math.min(Math.floor(Math.log10(binSize)), Math.floor(Math.log10(Math.abs(firstBinStop))))
			binSize_rnd = Math.round(binSize / 10 ** log) * 10 ** log
			firstBinStop_rnd = Math.ceil(firstBinStop / 10 ** log) * 10 ** log
		}
	}
	// if there are more than 8 bins after rounding, then set the last bin start to restrict the number of bins to 8
	const eighthBinStop_rnd = firstBinStop_rnd + binSize_rnd * 7
	if (max > eighthBinStop_rnd) {
		lastBinStart_rnd = firstBinStop_rnd + binSize_rnd * 6
	}
	if (Object.is(firstBinStop_rnd, -0)) firstBinStop_rnd = 0
	return [binSize_rnd, firstBinStop_rnd, lastBinStart_rnd]
}

function roundFractions(binSize, firstBinStop, max) {
	let binSize_rnd, firstBinStop_rnd, lastBinStart_rnd, digits
	if (binSize > 0.1) {
		digits = 1
		binSize_rnd = Number((Math.round(binSize / 0.5) * 0.5).toFixed(digits))
		if (binSize_rnd === 0) binSize_rnd = 0.1
		firstBinStop_rnd = Number((Math.ceil(firstBinStop / 0.5) * 0.5).toFixed(digits))
		// if there are more than 8 bins after rounding, then set the last bin start to restrict the number of bins to 8
		const eighthBinStop = firstBinStop_rnd + binSize_rnd * 7
		if (max > eighthBinStop) {
			const lastBinStart = firstBinStop_rnd + binSize_rnd * 6
			lastBinStart_rnd = Number((Math.floor(lastBinStart / 0.5) * 0.5).toFixed(digits))
		}
	} else {
		if (firstBinStop === 0) {
			const log = Math.floor(Math.log10(binSize))
			digits = Math.abs(log)
			binSize_rnd = Number((Math.round(binSize / 10 ** log) * 10 ** log).toFixed(digits))
			firstBinStop_rnd = 0
			// if there are more than 8 bins after rounding, then set the last bin start to restrict the number of bins to 8
			const eighthBinStop = firstBinStop_rnd + binSize_rnd * 7
			if (max > eighthBinStop) {
				const lastBinStart = firstBinStop_rnd + binSize_rnd * 6
				lastBinStart_rnd = Number((Math.floor(lastBinStart / 10 ** log) * 10 ** log).toFixed(digits))
			}
		} else {
			const log = Math.min(Math.floor(Math.log10(binSize)), Math.floor(Math.log10(Math.abs(firstBinStop))))
			digits = Math.abs(log)
			binSize_rnd = Number((Math.round(binSize / 10 ** log) * 10 ** log).toFixed(digits))
			firstBinStop_rnd = Number((Math.ceil(firstBinStop / 10 ** log) * 10 ** log).toFixed(digits))
			// if there are more than 8 bins after rounding, then set the last bin start to restrict the number of bins to 8
			const eighthBinStop = firstBinStop_rnd + binSize_rnd * 7
			if (max > eighthBinStop) {
				const lastBinStart = firstBinStop_rnd + binSize_rnd * 6
				lastBinStart_rnd = Number((Math.floor(lastBinStart / 10 ** log) * 10 ** log).toFixed(digits))
			}
		}
	}
	const rounding = '.' + digits + 'f'
	if (Object.is(firstBinStop_rnd, -0)) firstBinStop_rnd = 0
	return [binSize_rnd, firstBinStop_rnd, lastBinStart_rnd, rounding]
}
