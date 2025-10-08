/*
Initialize a bin configuration for a numeric dataset
<data>: array of numeric data values
<opts> (optional): object of options
    {}: output bin config as JavaScript object (default)
    {format: 'string'}: output bin config as JSON string
*/
export default function initBinConfig(data, opts = {}) {
	if (data.find(d => !Number.isFinite(d))) throw new Error('non-numeric values found')

	let binConfig
	const s = new Set(data)
	if (s.size === 1) {
		// single unique value in data array
		// prepare custom bin config for 3 bins: first bin
		// for values less than the value, second bin for values
		// equal to the value, and third bin one for values
		// greater than the value
		// all data values will fall into the second bin
		const value = [...s][0]
		binConfig = {
			type: 'custom-bin',
			lst: [
				{ stop: value, stopinclusive: false, startunbounded: true, label: '<' + value },
				{ start: value, stop: value, startinclusive: true, stopinclusive: true, label: '=' + value },
				{ start: value, startinclusive: false, stopunbounded: true, label: '>' + value }
			]
		}
	} else {
		// multiple unique values in data array
		// prepare regular bin config

		// compute the bin size for a maximum bin number of 8
		data.sort((a, b) => a - b)
		const l = data.length
		const min = data[0]
		const max = data[l - 1]
		const p5idx = Math.ceil(l * 0.05) - 1
		const p98idx = Math.ceil(l * 0.98) - 1
		const p5 = data[p5idx]
		const p98 = data[p98idx]
		// use 98th and 5th percentiles to compute bin size to reduce outlier influence
		// if 98th = 5th, use max and min instead
		const binSize = p98 != p5 ? (p98 - p5) / 8 : (max - min) / 8
		// first bin stop will equal either (minimum + bin size) or (5th percentile), whichever is larger.
		const firstBinStop = Math.max(min + binSize, p5)
		// round the bin values
		let [binSize_rnd, firstBinStop_rnd, lastBinStart_rnd, rounding] = roundBinVals(binSize, firstBinStop, max, min)
		// generate the bin configuration
		binConfig = {
			type: 'regular-bin',
			startinclusive: true,
			bin_size: binSize_rnd,
			first_bin: { stop: firstBinStop_rnd }
		}
		if (lastBinStart_rnd) binConfig.last_bin = { start: lastBinStart_rnd }
		if (rounding) binConfig.rounding = rounding
	}
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
	if (binSize >= 0.1 && binSize <= 2) {
		// Round to the nearest one for small bin sizes
		binSize_rnd = Math.round(binSize / (1 * 10 ** log)) * (1 * 10 ** log)
		firstBinStop_rnd = Math.round(firstBinStop / (1 * 10 ** log)) * (1 * 10 ** log)
	} else {
		// Round to the nearest five for large bin sizes
		binSize_rnd = Math.round(binSize / (5 * 10 ** log)) * (5 * 10 ** log)
		firstBinStop_rnd = Math.round(firstBinStop / (5 * 10 ** log)) * (5 * 10 ** log)
		if (binSize_rnd === 0) binSize_rnd = 1 * 10 ** log
		if (firstBinStop_rnd === 0) firstBinStop_rnd = 1 * 10 ** log
		if (binSize_rnd === 5 * 10 ** log && firstBinStop_rnd === 1 * 10 ** log) firstBinStop_rnd = 5 * 10 ** log
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
