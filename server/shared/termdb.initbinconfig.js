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
	// round the bin values
	let binSize_rnd, firstBinStop_rnd, lastBinStart_rnd, rounding
	if (Number.isInteger(Number(binSize.toPrecision(1))) && Number.isInteger(Number(firstBinStop.toPrecision(1)))) {
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
	const binSize_rnd = Number(binSize.toPrecision(1))
	const binSize_log = Math.floor(Math.log10(binSize_rnd))
	let firstBinStop_log
	if (firstBinStop === 0) {
		firstBinStop_log = 0
	} else {
		firstBinStop_log = Math.floor(Math.log10(Math.abs(firstBinStop)))
	}
	let firstBinStop_rnd
	if (binSize_log <= firstBinStop_log) {
		firstBinStop_rnd = Math.round(firstBinStop / 10 ** binSize_log) * 10 ** binSize_log
	} else {
		firstBinStop_rnd = Math.round(firstBinStop / 10 ** firstBinStop_log) * 10 ** firstBinStop_log
	}
	// if the number of bins is greater than 8 after rounding, set the last bin start to restrict the number of bins to 8
	let lastBinStart_rnd
	const eighthBinStop_rnd = firstBinStop_rnd + binSize_rnd * 7
	if (max > eighthBinStop_rnd) {
		lastBinStart_rnd = firstBinStop_rnd + binSize_rnd * 6
	}
	return [binSize_rnd, firstBinStop_rnd, lastBinStart_rnd]
}

function roundFractions(binSize, firstBinStop, max) {
	const binSize_rnd = Number(binSize.toPrecision(1))
	const binSize_log = Math.floor(Math.log10(binSize_rnd))
	const firstBinStop_log = Math.floor(Math.log10(Math.abs(firstBinStop)))
	let digits
	if (binSize_log <= firstBinStop_log) {
		digits = Math.abs(binSize_log)
	} else {
		digits = Math.abs(firstBinStop_log)
	}
	const firstBinStop_rnd = Number(firstBinStop.toFixed(digits))
	// if the number of bins is greater than 8 after rounding, set the last bin start to restrict the number of bins to 8
	let lastBinStart_rnd
	const eighthBinStop = firstBinStop_rnd + binSize_rnd * 7
	const eighthBinStop_rnd = Number(eighthBinStop.toFixed(digits))
	if (max > eighthBinStop_rnd) {
		const lastBinStart = firstBinStop_rnd + binSize_rnd * 6
		lastBinStart_rnd = Number(lastBinStart.toFixed(digits))
	}
	const rounding = '.' + digits + 'f'
	return [binSize_rnd, firstBinStop_rnd, lastBinStart_rnd, rounding]
}
