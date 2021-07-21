const jStat = require('jstat').jStat

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
	// compute bin size, first bin stop, and last bin start (if applicable)
	const max = jStat.max(data)
	const min = jStat.min(data)
	const binSize = (max - min) / 6
	const firstBinStop = jStat.percentile(data, 0.05)
	const eighthBinStop = firstBinStop + binSize * 7
	let lastBinStart
	if (max > eighthBinStop) {
		//upper limit number of bins is 8
		const eighthBinStart = firstBinStop + binSize * 6
		lastBinStart = eighthBinStart
	}
	// round the bin values
	let binSize_rnd, firstBinStop_rnd, lastBinStart_rnd, rounding
	if (binSize >= 1 && firstBinStop >= 1) {
		;[binSize_rnd, firstBinStop_rnd, lastBinStart_rnd] = roundIntegers(binSize, firstBinStop, lastBinStart)
	} else {
		;[binSize_rnd, firstBinStop_rnd, lastBinStart_rnd, rounding] = roundFractions(binSize, firstBinStop, lastBinStart)
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

function roundIntegers(binSize, firstBinStop, lastBinStart) {
	const binSize_rnd = Number(binSize.toPrecision(1))
	const binSize_log = Math.floor(Math.log10(binSize))
	const firstBinStop_log = Math.floor(Math.log10(firstBinStop))
	let firstBinStop_rnd
	if (binSize_log <= firstBinStop_log) {
		firstBinStop_rnd = Math.round(firstBinStop / 10 ** binSize_log) * 10 ** binSize_log
	} else {
		firstBinStop_rnd = Math.round(firstBinStop / 10 ** firstBinStop_log) * 10 ** firstBinStop_log
	}
	let lastBinStart_rnd
	if (lastBinStart) {
		lastBinStart_rnd = Math.round(lastBinStart / 10 ** binSize_log) * 10 ** binSize_log
	}
	return [binSize_rnd, firstBinStop_rnd, lastBinStart_rnd]
}

function roundFractions(binSize, firstBinStop, lastBinStart) {
	const binSize_rnd = Number(binSize.toPrecision(1))
	const binSize_log = Math.floor(Math.log10(binSize))
	const firstBinStop_log = Math.floor(Math.log10(Math.abs(firstBinStop)))
	let digits
	if (binSize_log <= firstBinStop_log) {
		digits = Math.abs(binSize_log)
	} else {
		digits = Math.abs(firstBinStop_log)
	}
	const firstBinStop_rnd = Number(firstBinStop.toFixed(digits))
	let lastBinStart_rnd
	if (lastBinStart) {
		lastBinStart_rnd = Number(lastBinStart.toFixed(digits))
	}
	const rounding = '.' + digits + 'f'
	return [binSize_rnd, firstBinStop_rnd, lastBinStart_rnd, rounding]
}
