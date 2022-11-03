const fs = require('fs')
const termdbsql = require('./termdb.sql')
const { scaleLinear } = require('d3-scale')
const { bin } = require('d3-array')
const serverconfig = require('./serverconfig')
const lines2R = require('./lines2R')
const path = require('path')
const utils = require('./utils')

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
export function trigger_getViolinPlotData(q, res, ds) {
	const term = ds.cohort.termdb.q.termjsonByOneid(q.termid)
	if (!term) throw '.termid invalid'
	if (term.type != 'integer' && term.type != 'float') throw 'termid type is not integer/float'

	const getRowsParam = {
		ds,
		filter: q.filter,
		term1_id: q.termid,
		term1_q: { mode: 'continuous' } // hardcode to retrieve numeric values for violin/boxplot computing on this term
	}
	// term2 is optional
	let term2

	if (q.term2) {
		if (typeof q.term2 == 'string') q.term2 = JSON.parse(decodeURIComponent(q.term2)) // look into why term2 is not parsed beforehand
		if (!q.term2.id) {
			if (q.term2.term.type != 'samplelst') throw 'term2.id missing'
			else {
				getRowsParam.term2 = q.term2.term
				getRowsParam.term2_q = q.term2.q
			}
		} else {
			term2 = ds.cohort.termdb.q.termjsonByOneid(q.term2.id)
			if (!term2) throw '.term2.id invalid'
			getRowsParam.term2_id = q.term2.id
			getRowsParam.term2_q = q.term2.q
		}
		if (typeof q.term2.q != 'object') throw 'term2.q{} missing'
	}

	const rows = termdbsql.get_rows(getRowsParam)
	/*
	rows = {
	  lst: [
	  	{
			sample=int
			key0,val0,
			key1,val1, // key1 and val1 are the same, with numeric values from term1
			key2,val2
				// if q.term2 is given, key2 is the group/bin label based on term2, using which the samples will be divided
				// if q.term2 is missing, key2 is empty string and won't divide into groups
		},
		...
	  ]
	}
	*/

	// plot data to return to client
	const result = {
		min: rows.lst[0]?.key1,
		max: rows.lst[0]?.key1,
		plots: [] // each element is data for one plot: {label=str, values=[]}
	}

	const updatedResult = []
	for (const v of rows.lst) {
		// TODO: db terms table for numeric value should not have
		// terms.values{} entries for computable values
		if (term?.values?.[v.key1]?.uncomputable) {
			// this value is uncomputable from term1, skip
		} else {
			// keep
			updatedResult.push(v)
			result.min = Math.min(result.min, v.key1)
			result.max = Math.max(result.max, v.key1)
		}
	}

	if (q.term2) {
		const key2_to_values = new Map() // k: key2 value, v: list of term1 values

		for (const i of updatedResult) {
			if (i.key2 == undefined || i.key2 == null) {
				// missing key2
				throw 'key2 missing'
			}
			if (!key2_to_values.has(i.key2)) key2_to_values.set(i.key2, [])
			key2_to_values.get(i.key2).push(i.key1)
		}

		for (const [key, values] of key2_to_values) {
			result.plots.push({
				label: (term2?.values?.[key]?.label || key) + ', n=' + values.length,
				values,
				plotValueCount: values.length
			})
		}
	} else {
		// all numeric values go into one array
		const values = updatedResult.map(i => i.key1)
		result.plots.push({
			label: 'All samples, n=' + values.length,
			values,
			plotValueCount: values.length
		})
	}

	async function wilcoxon() {
		const wilcoxInput = {} // { plot.label: {plot.values for term1: [], plot.values for term2: []} }

		const group1values = [],
			group2values = []

		if (term2) {
			for (let [i, v] of result.plots.entries()) {
				for (let x = i; x < Object.keys(result.plots).length; x++) {
					if (x === i) continue
					group1values.push(...result.plots[i].values)
					group2values.push(...result.plots[x].values)

					wilcoxInput[`${result.plots[i].label} vs ${result.plots[x].label}`] = { group1values, group2values }
				}
			}
		}

		const tmpfile = path.join(serverconfig.cachedir, Math.random().toString() + '.json')
		await utils.write_file(tmpfile, JSON.stringify(wilcoxInput))
		const wilcoxOutput = await lines2R(path.join(serverconfig.binpath, 'utils/wilcoxon.R'), [], [tmpfile])
		fs.unlink(tmpfile, () => {})

		const pvalues = JSON.parse(wilcoxOutput)

		// console.log(pvalues)
		return pvalues
	}
	// wilcoxon()

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

		plot.bins = bins

		plot.biggestBin = Math.max(...bins0.map(b => b.length))

		delete plot.values
	}
	// console.log(Object.keys(wilcox).length);
	// console.log(wilcoxInput);

	res.send(result)
}

// compute bins using d3
// need unit test!!!
export function computeViolinData(values) {
	let min = Math.min(...values),
		max = Math.max(...values)

	const yScale = scaleLinear().domain([min, max])

	let ticksCompute // purpuse??
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
