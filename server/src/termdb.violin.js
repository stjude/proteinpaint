const fs = require('fs')
const { scaleLinear } = require('d3-scale')
const { bin } = require('d3-array')
const serverconfig = require('./serverconfig')
const lines2R = require('./lines2R')
const path = require('path')
const utils = require('./utils')
import { median } from '../../server/shared/median'
const { getData } = require('./termdb.matrix')
const createCanvas = require('canvas').createCanvas

/*
q={}
.termid=str
	must be a numeric term; data is used to produce violin plot
.term2={ id=str, q={} }
	optional; a termwrapper object to divide samples to groups
	if provided, generate multiple violin plots
	else generate only one plot
.filter={}
*/
export async function trigger_getViolinPlotData(q, res, ds, genome) {
	const term = ds.cohort.termdb.q.termjsonByOneid(q.termid)

	if (!term) throw '.termid invalid'
	//term on backend should always be an integer term
	if (term.type != 'integer' && term.type != 'float') throw 'term type is not integer/float.'

	const twLst = [{ id: q.termid, term, q: { mode: 'continuous' } }]

	if (q.divideTw) {
		if (!('id' in q.divideTw)) {
			q.divideTw.id = q.divideTw.term.name
			q.divideTw.term.id = q.divideTw.term.name
		}
	}
	if (q.divideTw) {
		twLst.push(q.divideTw)
		q.term2_q = q.divideTw.q
	}

	const data = await getData({ terms: twLst, filter: q.filter, currentGeneNames: q.currentGeneNames }, ds, genome)
	if (data.error) throw data.error

	//create numeric bins for the overlay term to provide filtering options
	const divideTwBins = new Map()
	// TODO: handle .keyOrder as an alternative to .bins ???
	const divideBins = data.refs.byTermId[(q.divideTw?.term?.id)]?.bins
	if (divideBins) {
		for (const bin of divideBins) {
			divideTwBins.set(bin.label, bin)
			divideTwBins.set(bin.label, bin)
		}
	}

	let min = Number.MAX_VALUE,
		max = -Number.MAX_VALUE

	let key2values = new Map()

	for (const [c, v] of Object.entries(data.samples)) {
		// v = {<termId> : {key, value}, ...}

		//if there is no value for term then skip that.
		if (!v[term.id]) continue

		if (term.values?.[v[term.id]?.value]?.uncomputable) {
			//skip these values
			continue
		}

		if (q.divideTw) {
			if (!v[q.divideTw.id]) {
				// if there is no value for q.divideTw then skip this
				continue
			}

			if (!key2values.has(v[q.divideTw.id]?.key)) key2values.set(v[q.divideTw.id]?.key, [])
			key2values.get(v[q.divideTw.id]?.key).push(v[term.id]?.value)
		} else {
			if (!key2values.has('All samples')) key2values.set('All samples', [])
			key2values.get('All samples').push(v[term.id]?.value)
		}

		if (term.type == 'float' || (term.type == 'integer' && v[term.id])) {
			min = Math.min(min, v[term.id]?.value)
			max = Math.max(max, v[term.id]?.value)
		}
	}

	const keyOrder = data.refs.byTermId[(q.divideTw?.term?.id)]?.keyOrder
	key2values = new Map(
		[...key2values].sort(
			keyOrder
				? (a, b) => keyOrder.indexOf(a[0]) - keyOrder.indexOf(b[0])
				: q.divideTw?.term?.type === 'categorical'
				? (a, b) => b[1].length - a[1].length
				: (a, b) =>
						a
							.toString()
							.replace(/[^a-zA-Z0-9<]/g, '')
							.localeCompare(b.toString().replace(/[^a-zA-Z0-9<]/g, ''), undefined, { numeric: true })
		)
	)

	const result = {
		min: min,
		max: max,
		plots: [], // each element is data for one plot: {label=str, values=[]}
		pvalues: []
	}

	for (const [key, values] of key2values) {
		if (q.divideTw) {
			result.plots.push({
				label: (q.divideTw?.term?.values?.[key]?.label || key) + ', n=' + values.length,
				values,
				seriesId: key,
				plotValueCount: values?.length,
				color: q.divideTw?.term?.values?.[key]?.color || null,
				divideTwBins: divideTwBins.has(key) ? divideTwBins.get(key) : null
			})
		} else {
			result.plots.push({
				label: 'All samples, n=' + values.length,
				values,
				plotValueCount: values.length
			})
		}
	}
	// wilcoxon test data to return to client
	await wilcoxon(q.divideTw, result)

	//size on x-y for creating circle and ticks
	q.radius = Number(q.radius)

	const refSize = q.radius * 4
	//create scale object
	const axisScale = scaleLinear()
		.domain([result.min, result.max + result.max / refSize])
		.range(q.orientation == 'horizontal' ? [0, q.svgw] : [q.svgw, 0])

	const [width, height] =
		q.orientation == 'horizontal'
			? [q.svgw * q.devicePixelRatio, refSize * q.devicePixelRatio]
			: [refSize * q.devicePixelRatio, q.svgw * q.devicePixelRatio]

	const scaledRadius = q.radius / q.devicePixelRatio
	const arcEndAngle = scaledRadius * Math.PI

	for (const plot of result.plots) {
		// item: { label=str, values=[v1,v2,...] }

		//backend rendering bean/rug plot on top of violin plot based on orientation of chart
		const canvas = createCanvas(width, height)
		const ctx = canvas.getContext('2d')
		ctx.strokeStyle = 'rgba(0,0,0,0.8)'
		ctx.lineWidth = q.strokeWidth / q.devicePixelRatio
		ctx.globalAlpha = 0.5
		ctx.fillStyle = '#ffe6e6'

		//scaling for sharper image
		if (q.devicePixelRatio != 1) {
			ctx.scale(q.devicePixelRatio, q.devicePixelRatio)
		}

		q.datasymbol === 'rug'
			? plot.values.forEach(i => {
					ctx.beginPath()
					if (q.orientation == 'horizontal') {
						ctx.moveTo(+axisScale(i), 0)
						ctx.lineTo(+axisScale(i), scaledRadius * 2)
					} else {
						ctx.moveTo(0, +axisScale(i))
						ctx.lineTo(scaledRadius * 2, +axisScale(i))
					}
					ctx.stroke()
			  })
			: plot.values.forEach(i => {
					ctx.beginPath()
					if (q.orientation === 'horizontal') ctx.arc(+axisScale(i), q.radius, scaledRadius, 0, arcEndAngle)
					else ctx.arc(q.radius, +axisScale(i), scaledRadius, 0, arcEndAngle)
					ctx.fill()
					ctx.stroke()
			  })

		plot.src = canvas.toDataURL()

		//create bins for violins
		const bins0 = computeViolinData(axisScale, plot.values)
		// array; each element is an array of values belonging to this bin
		// NOTE .x0 .x1 attributes are also assigned to this array (safe to do?)

		// map messy bins0 to tidy set of bins and return to client
		const bins = []
		for (const b of bins0) {
			const b2 = {
				x0: b.x0,
				x1: b.x1
			}
			delete b.x0
			delete b.x1
			b2.binValueCount = b.length
			bins.push(b2)
		}
		//generate median values
		const medianValue = median(plot.values)

		plot.bins = bins

		plot.biggestBin = Math.max(...bins0.map(b => b.length))

		plot.median = medianValue

		delete plot.values
	}
	res.send(result)
}

// // compute bins using d3
// // need unit test!!!
export function computeViolinData(scale, values) {
	const ticksCompute = values.length <= 200 ? 10 : values.length < 800 ? 30 : 15

	const binBuilder = bin()
		.domain(scale.domain()) /* extent of the data that is lowest to highest*/
		.thresholds(scale.ticks(ticksCompute)) /* buckets are created which are separated by the threshold*/
		.value(d => d) /* bin the data points into this bucket*/

	return binBuilder(values)
}

// compute pvalues using wilcoxon rank sum test
export async function wilcoxon(term, result) {
	if (!term) {
		return
	}
	const wilcoxInput = {} // { plot.label: {plot.values for term1: [], plot.values for term2: []} }

	//if term2 is present then run two loops. the second loop index begins with the index of the first loop.
	for (let [i, v] of result.plots.entries()) {
		for (let x = i; x < Object.keys(result.plots).length; x++) {
			if (x === i) continue

			const group1values = result.plots[i].values,
				group2values = result.plots[x].values

			wilcoxInput[`${result.plots[i].label.split(',')[0]} , ${result.plots[x].label.split(',')[0]}`] = {
				group1values,
				group2values
			}
		}
	}

	const tmpfile = path.join(serverconfig.cachedir, Math.random().toString() + '.json')
	await utils.write_file(tmpfile, JSON.stringify(wilcoxInput))
	const wilcoxOutput = await lines2R(path.join(serverconfig.binpath, 'utils/wilcoxon.R'), [], [tmpfile])
	fs.unlink(tmpfile, () => {})

	for (const [k, v] of Object.entries(JSON.parse(wilcoxOutput))) {
		result.pvalues.push([{ value: k.split(',')[0] }, { value: k.split(',')[1] }, { html: v }])
	}
}
