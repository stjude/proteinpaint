const fs = require('fs')
const { scaleLinear, scaleLog } = require('d3-scale')
const serverconfig = require('./serverconfig')
const lines2R = require('./lines2R')
const path = require('path')
const utils = require('./utils')
const { getData } = require('./termdb.matrix')
const createCanvas = require('canvas').createCanvas
const { violinBinsObj } = require('../../server/shared/violin.bins')
const { summaryStats } = require('../../server/shared/descriptive.stats')
import roundValue from '../shared/roundValue'

/*
q = {
  getViolinPlotData: '1',
  genome: str, //hg38 or hg19
  dslabel: str, //dataset
  termid: str, 
  	//term. must be a numeric term; data is used to produce violin plot
  svgw: number, //width of svg
  orientation: str, //horizontal vs vertical
  datasymbol: str, //bean vs tick
  devicePixelRatio: number,
  axisHeight: number,
  rightMargin: number,
  radius: number,
  strokeWidth: number,
  filter: { type: 'tvslst', in: true, join: '', lst: [] },
  scale: number, // if defined, then data will be divided by this number
  divideTw: {
	  //a termwrapper object to divide samples to groups, basically term2
	  //if provided, generate multiple violin plots else generate only one plot
    id: str, 
    term: {
      id: str,
      name: str,
      type: str, //categorical vs float
      values: [Object],
      groupsetting: [Object],
      isleaf: true,
      included_types: [Array],
      child_types: []
    },
    q: {
      isAtomic: true,
      hiddenValues: {},
      type: str, //values or ?
      groupsetting: [Object]
    },
    isAtomic: true,
    '$id': '1_ts_22415712' //termWrapper.$id generated by termsetting.js
  }
}
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

	if (q.scale) scaleData(q, data, term)

	const valuesObject = divideValues(q, data, term, q.divideTw)

	const result = resultObj(valuesObject, data, q)

	// wilcoxon test data to return to client
	await wilcoxon(q.divideTw, result)

	createCanvasImg(q, result)

	res.send(result)
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

//create numeric bins for the overlay term to provide filtering options
// TODO: handle .keyOrder as an alternative to .bins ???
function numericBins(overlayTerm, data) {
	const divideTwBins = new Map()
	const divideBins = data.refs.byTermId[(overlayTerm?.term?.id)]?.bins
	if (divideBins) {
		for (const bin of divideBins) {
			divideTwBins.set(bin.label, bin)
		}
	}
	return divideTwBins
}

// scale sample data
// divide keys and values by scaling factor - this is important for regression UI when running association tests.
function scaleData(q, data, term) {
	if (!q.scale) return
	const scale = Number(q.scale)
	for (const [k, v] of Object.entries(data.samples)) {
		if (!v[term.id]) continue
		if (term.values?.[v[term.id]?.value]?.uncomputable) continue
		v[term.id].key = v[term.id].key / scale
		v[term.id].value = v[term.id].value / scale
	}
}

function divideValues(q, data, term, overlayTerm) {
	const useLog = q.unit == 'log'

	const key2values = new Map()
	let min = Infinity
	let max = -Infinity

	//create object to store uncomputable values and label
	const uncomputableValueObj = {}
	let skipNonPositiveCount = 0 // if useLog=true, record number of <=0 values skipped

	for (const [c, v] of Object.entries(data.samples)) {
		//if there is no value for term then skip that.
		const value = roundValue(v[term.id]?.value, 1)
		if (!Number.isFinite(value)) continue

		if (term.values?.[value]?.uncomputable) {
			//skip these values from rendering in plot but show in legend as uncomputable categories
			const label = term.values[value].label // label of this uncomputable category
			uncomputableValueObj[label] = (uncomputableValueObj[label] || 0) + 1
			continue
		}

		if (useLog && value <= 0) {
			skipNonPositiveCount++
			continue
		}

		if (min > value) min = value
		if (max < value) max = value

		if (useLog === 'log') {
			if (min === 0) min = Math.max(min, value)
		}

		if (overlayTerm) {
			if (!v[(overlayTerm?.id)]) continue
			// if there is no value for q.divideTw then skip this
			if (overlayTerm.term.values[(v[overlayTerm.id]?.key)]?.uncomputable) {
				const label = overlayTerm.term.values[(v[overlayTerm.id]?.value)]?.label // label of this uncomputable category
				uncomputableValueObj[label] = (uncomputableValueObj[label] || 0) + 1
			}

			if (!key2values.has(v[overlayTerm.id]?.key)) key2values.set(v[overlayTerm.id]?.key, [])
			key2values.get(v[overlayTerm.id]?.key).push(value)
		} else {
			if (!key2values.has('All samples')) key2values.set('All samples', [])
			key2values.get('All samples').push(value)
		}
	}
	return {
		key2values,
		minMaxValues: { min, max },
		uncomputableValueObj: sortObj(uncomputableValueObj),
		skipNonPositiveCount
	}
}

function sortObj(object) {
	return Object.fromEntries(Object.entries(object).sort(([, a], [, b]) => a - b))
}

function sortKey2values(data, key2values, overlayTerm) {
	const keyOrder = data.refs.byTermId[(overlayTerm?.term?.id)]?.keyOrder

	key2values = new Map(
		[...key2values].sort(
			keyOrder
				? (a, b) => keyOrder.indexOf(a[0]) - keyOrder.indexOf(b[0])
				: overlayTerm?.term?.type === 'categorical'
				? (a, b) => b[1].length - a[1].length
				: overlayTerm?.term?.type === 'condition'
				? (a, b) => a[0] - b[0]
				: (a, b) =>
						a
							.toString()
							.replace(/[^a-zA-Z0-9<]/g, '')
							.localeCompare(b.toString().replace(/[^a-zA-Z0-9<]/g, ''), undefined, { numeric: true })
		)
	)
	return key2values
}

function resultObj(valuesObject, data, q) {
	const overlayTerm = q.divideTw
	const result = {
		min: valuesObject.minMaxValues.min,
		max: valuesObject.minMaxValues.max,
		plots: [], // each element is data for one plot: {label=str, values=[]}
		pvalues: [],
		plotThickness: Number,
		uncomputableValueObj:
			Object.keys(valuesObject.uncomputableValueObj).length > 0 ? valuesObject.uncomputableValueObj : null
	}

	for (const [key, values] of sortKey2values(data, valuesObject.key2values, overlayTerm)) {
		if (overlayTerm) {
			result.plots.push({
				label: (overlayTerm?.term?.values?.[key]?.label || key) + ', n=' + values.length,
				values,
				seriesId: key,
				plotValueCount: values?.length,
				color: overlayTerm?.term?.values?.[key]?.color || null,
				divideTwBins: numericBins(overlayTerm, data).has(key) ? numericBins(overlayTerm, data).get(key) : null,
				uncomputableValueObj:
					Object.keys(valuesObject.uncomputableValueObj).length > 0 ? valuesObject.uncomputableValueObj : null
			})
		} else {
			result.plots.push({
				label: 'All samples, n=' + values.length,
				values,
				plotValueCount: values.length
			})
		}
	}
	if (result.plots.length >= 1) {
		result.plotThickness = q.plotThickness ? Number(q.plotThickness) : plotThickness(result)
	}
	return result
}

function createCanvasImg(q, result) {
	// size on x-y for creating circle and ticks
	if (!q.radius) q.radius = 5
	// assign defaults as needed
	if (q.radius <= 0) throw 'q.radius is not a number'
	else q.radius = +q.radius // ensure numeric value, not string

	if (!q.strokeWidth) q.strokeWidth = 0.2

	const refSize = q.radius * 4
	//create scale object
	let axisScale

	const useLog = q.unit == 'log'

	if (useLog) {
		axisScale = scaleLog()
			.base(2)
			.domain([result.min, result.max + result.max])
			.range(q.orientation === 'horizontal' ? [0, q.svgw] : [q.svgw, 0])
	} else {
		axisScale = scaleLinear()
			.domain([result.min, result.max + result.max / refSize])
			.range(q.orientation === 'horizontal' ? [0, q.svgw] : [q.svgw, 0])
	}

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

		// create bins for violins
		const finalVpBins = violinBinsObj(axisScale, plot)

		plot.bins = finalVpBins.bins

		plot.biggestBin = Math.max(...finalVpBins.bins0.map(b => b.length))

		//generate summary stat values
		plot.summaryStats = summaryStats(plot.values)

		delete plot.values
	}
}

function plotThickness(result) {
	const plotThickness =
		result.plots.length < 2
			? 150
			: result.plots.length >= 2 && result.plots.length < 5
			? 120
			: result.plots.length >= 5 && result.plots.length < 8
			? 90
			: result.plots.length >= 8 && result.plots.length < 11
			? 75
			: 60
	return plotThickness
}
