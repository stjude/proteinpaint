const fs = require('fs')
const termdbsql = require('./termdb.sql')
const { scaleLinear } = require('d3-scale')
const { bin } = require('d3-array')
const serverconfig = require('./serverconfig')
const lines2R = require('./lines2R')
const path = require('path')
const utils = require('./utils')
import { median } from '../../server/shared/median'
const { getData } = require('./termdb.matrix')

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

	const twLst = [{ id: q.termid, term, q: { mode: 'continuous' } }]

	let divideTw

	if (q.divideTw) {
		typeof q.divideTw == 'string' ? (divideTw = JSON.parse(q.divideTw)) : (divideTw = q.divideTw)
		twLst.push(divideTw)
	}

	const data = await getData({ terms: twLst, filter: q.filter }, ds, genome)
	if (data.error) throw data.error

	let min = Number.MAX_VALUE,
		max = -Number.MAX_VALUE

	let key2values = new Map()

	for (const [c, v] of Object.entries(data.samples)) {
		if ((term.values && term.values[(v[term.id]?.value)]?.uncomputable) || !v[term.id]) {
			//skip these values
			continue
		}

		if (q.divideTw && v[term.id]) {
			if (!key2values.has(v[divideTw.id]?.key)) key2values.set(v[divideTw.id]?.key, [])
			key2values.get(v[divideTw.id]?.key).push(v[term.id]?.value)
		} else {
			if (!key2values.has('All samples')) key2values.set('All samples', [])
			key2values.get('All samples').push(v[term.id]?.value)
		}

		if (term.type == 'float' || (term.type == 'integer' && v[term.id])) {
			min = Math.min(min, v[term.id]?.value)
			max = Math.max(max, v[term.id]?.value)
		}
	}

	const result = {
		min: min,
		max: max,
		plots: [], // each element is data for one plot: {label=str, values=[]}
		pvalues: []
	}

	for (const [key, values] of key2values) {
		if (q.divideTw) {
			result.plots.push({
				label: (divideTw.term.values ? divideTw.term.values[key].label : key) + ', n=' + values.length,
				values,
				plotValueCount: values.length
			})
		} else {
			result.plots.push({
				label: 'All samples, n=' + values.length,
				values,
				plotValueCount: values.length
			})
		}
	}

	// plot data to return to client
	await wilcoxon(divideTw, result)

	for (const plot of result.plots) {
		// item: { label=str, values=[v1,v2,...] }

		const bins0 = computeViolinData(plot.values)
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
export function computeViolinData(values) {
	let min = Math.min(...values),
		max = Math.max(...values)

	const yScale = scaleLinear().domain([min, max])

	let ticksCompute
	if (values.length < 50) {
		ticksCompute = 5
	} else {
		ticksCompute = 12
	}

	const binBuilder = bin()
		.domain([min, max]) /* extent of the data that is lowest to highest*/
		.thresholds(yScale.ticks(ticksCompute)) /* buckets are created which are separated by the threshold*/
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
		result.pvalues.push({ series1: k.split(',')[0], series2: k.split(',')[1], pvalue: v })
	}
}
