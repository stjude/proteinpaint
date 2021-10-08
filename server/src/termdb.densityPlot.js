const createCanvas = require('canvas').createCanvas
const termdbsql = require('./termdb.sql')
const mean = require('d3').mean
const scaleLinear = require('d3-scale').scaleLinear

/*
q: {} the query parameters
  .width
  .height
    int, the dimension of the actual plotting area
  .xpad
  .ypad
    int, x/y padding added to plotting area defined by width/height
  .termid
    required
res: http response
ds: {} the dataset object
*/
module.exports = (q, res, ds) => {
	const width = Number.parseInt(q.width)
	if (Number.isNaN(width)) throw 'width is not integer'
	const height = Number.parseInt(q.height)
	if (Number.isNaN(height)) throw 'height is not integer'
	const xpad = Number.parseInt(q.xpad)
	if (Number.isNaN(xpad)) throw 'xpad is not integer'
	const ypad = Number.parseInt(q.ypad)
	if (Number.isNaN(ypad)) throw 'ypad is not integer'
	if (!q.termid) throw 'termid missing'
	const term = ds.cohort.termdb.q.termjsonByOneid(q.termid)
	if (!term) throw 'invalid termid'
	if (term.type != 'float' && term.type != 'integer') throw 'not numerical term'

	const rows = termdbsql.get_rows_by_one_key({
		ds,
		key: q.termid,
		filter: q.filter ? (typeof q.filter == 'string' ? JSON.parse(q.filter) : q.filter) : null
	})
	// each row is {sample, value:STR}

	const values = []
	const distinctValues = new Set()
	let minvalue = null,
		maxvalue = null
	for (const { value } of rows) {
		if (term.values && term.values[value]) {
			// is a special category
			continue
		}
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
			? distinctValues.size
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
		median: values[Math.floor(values.length / 2)]
	}
	res.send(result)
}

function kernelDensityEstimator(kernel, X) {
	return function(V) {
		return X.map(function(x) {
			return [
				x,
				mean(V, function(v) {
					return kernel(x - v)
				})
			]
		})
	}
}
function kernelEpanechnikov(k) {
	return function(v) {
		return Math.abs((v /= k)) <= 1 ? (0.75 * (1 - v * v)) / k : 0
	}
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
