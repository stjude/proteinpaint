const createCanvas = require('canvas').createCanvas
const termdbsql = require('./termdb.sql')
const mean = require('d3').mean
const scaleLinear = require('d3-scale').scaleLinear

/*
q: {} the query parameters
res: http response
ds: {} the dataset object
*/
module.exports = (q, res, ds) => {
	if (!q.termid) throw 'termid missing'
	const term = ds.cohort.termdb.q.termjsonByOneid(q.termid)
	if (!term) throw 'invalid termid'
	if (!term.isfloat && !term.isinteger) throw 'not numerical term'

	const rows = termdbsql.get_rows_by_one_key({
		ds,
		key: q.termid,
		filter: q.filter ? (typeof q.filter == 'string' ? JSON.parse(q.filter) : q.filter) : null
	})
	// each row is {sample, value:STR}

	const values = []
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
		if (minvalue == null) {
			minvalue = maxvalue = v
		} else {
			minvalue = Math.min(minvalue, v)
			maxvalue = Math.max(maxvalue, v)
		}
	}

	// canvas dimension
	const width = 200,
		height = 100,
		xpad = 2,
		ypad = 2

	const canvas = createCanvas(width + xpad * 2, height + ypad * 2)
	const ctx = canvas.getContext('2d')

	const xscale = scaleLinear()
		.domain([minvalue, maxvalue])
		.range([xpad, xpad + width])

	const density = kernelDensityEstimator(kernelEpanechnikov(7), xscale.ticks(40))(values)
	let densitymax = 0
	for (const d of density) {
		// d: [ x value, density ]
		densitymax = Math.max(densitymax, d[1])
	}

	const yscale = scaleLinear()
		.domain([densitymax, 0])
		.range([ypad, ypad + height])
	ctx.beginPath()
	ctx.moveTo(ypad, ypad + height)
	let i = 0
	for (; i < density.length - 2; i++) {
		ctx.quadraticCurveTo(
			xscale(density[i][0]),
			yscale(density[i][1]),
			xscale((density[i][0] + density[i + 1][0]) / 2),
			yscale((density[i][1] + density[i + 1][1]) / 2)
		)
	}
	ctx.quadraticCurveTo(
		xscale(density[i][0]),
		yscale(density[i][1]),
		xscale(density[i + 1][0]),
		yscale(density[i + 1][1])
	)
	ctx.stroke()
	ctx.closePath()
	ctx.fillStyle = '#ededed'
	ctx.fill()

	const result = {
		width: width + xpad * 2,
		height: height + ypad * 2,
		xpad,
		ypad,
		minvalue,
		maxvalue,
		densitymax,
		samplecount: values.length,
		img: canvas.toDataURL()
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
