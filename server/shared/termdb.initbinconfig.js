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
	// first bin stop will equal either (minimum + bin size) or (5th percentile), whichever is larger.
	let p5idx = Math.round(l * 0.05) - 1
	if (p5idx < 0) p5idx = 0
	const p5 = data[p5idx]
	const firstBinStop = Math.max(min + binSize, p5)
	// round the bin values
	let [binSize_rnd, firstBinStop_rnd, lastBinStart_rnd, rounding] = roundBinVals(binSize, firstBinStop, max, min)
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

function roundBinVals(binSize, firstBinStop, max, min) {
	let binSize_rnd, firstBinStop_rnd, lastBinStart_rnd, rounding
	const log = Math.floor(Math.log10(binSize))
	binSize_rnd = Math.round(binSize / (5 * 10 ** log)) * (5 * 10 ** log)
	if (binSize_rnd === 0) binSize_rnd = 1 * 10 ** log
	firstBinStop_rnd = Math.round(firstBinStop / (5 * 10 ** log)) * (5 * 10 ** log)
	if (firstBinStop_rnd === 0) firstBinStop_rnd = 1 * 10 ** log
	if (binSize_rnd === 5 * 10 ** log && firstBinStop_rnd === 1 * 10 ** log) {
		firstBinStop_rnd = 5 * 10 ** log
	}
	if (firstBinStop_rnd < min) firstBinStop_rnd = firstBinStop_rnd * 2
	// if the number of bins is above 8 after rounding, then set the last bin start to restrict the number of bins to 8
	const eighthBinStop_rnd = firstBinStop_rnd + binSize_rnd * 7
	if (max > eighthBinStop_rnd) {
		lastBinStart_rnd = firstBinStop_rnd + binSize_rnd * 6
	}
	if (binSize < 1) {
		const digits = Math.abs(log)
		binSize_rnd = Number(binSize_rnd.toFixed(digits))
		firstBinStop_rnd = Number(firstBinStop_rnd.toFixed(digits))
		if (lastBinStart_rnd) lastBinStart_rnd = Number(lastBinStart_rnd.toFixed(digits))
		rounding = '.' + digits + 'f'
	}
	if (Object.is(firstBinStop_rnd, -0)) firstBinStop_rnd = 0
	return [binSize_rnd, firstBinStop_rnd, lastBinStart_rnd, rounding]
}
