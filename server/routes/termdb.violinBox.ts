import type {
	ViolinBoxRequest,
	ViolinRequest,
	BoxRequest,
	ViolinBoxResponse,
	RouteApi,
	ValidGetDataResponse,
	TermWrapper
} from '#types'
import type { ReqQueryAddons } from './types.ts'
import { violinBoxPayload } from '#types/checkers'
import { scaleLinear, scaleLog } from 'd3'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { getData } from '../src/termdb.matrix.js'
import { createCanvas } from 'canvas'
import { getOrderedLabels } from '../src/termdb.barchart.js'
import { getDescrStats, getStdDev, getMean } from './termdb.descrstats.ts'
import { isNumericTerm } from '#shared/terms.js'
import { boxplot_getvalue } from '../src/utils.js'
import { run_R } from '@sjcrh/proteinpaint-r'
import { roundValueAuto } from '#shared/roundValue.js'

export const api: RouteApi = {
	endpoint: 'termdb/violinBox',
	methods: {
		get: {
			...violinBoxPayload,
			init
		},
		post: {
			...violinBoxPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		const q: ViolinBoxRequest & ReqQueryAddons = req.query
		let result
		try {
			const g = genomes[q.genome]
			if (!g) throw new Error('invalid genome name')
			const ds = g.datasets?.[q.dslabel]
			if (!ds) throw new Error('invalid ds')

			if (typeof q.tw?.term != 'object' || typeof q.tw?.q != 'object') throw new Error('q.tw not of {term,q}')
			const term = q.tw.term
			if (!isNumericTerm(term) && term.type !== 'survival') throw new Error('term type is not numeric or survival')

			const arg = {
				terms: [q.tw],
				filter: q.filter,
				filter0: q.filter0,
				currentGeneNames: q.currentGeneNames,
				__protected__: q.__protected__,
				__abortSignal: q.__abortSignal
			}
			if (q.overlayTw) arg.terms.push(q.overlayTw)
			if (q.divideTw) arg.terms.push(q.divideTw)
			const data = await getData(arg, ds)
			if (!data) throw new Error('getData() returns nothing')
			if (data.error) throw new Error(data.error)

			if (q.plotType === 'violin') {
				result = await getViolin(q, data, ds)
			} else if (q.plotType === 'box') {
				result = await getBoxPlot(q, data)
			} else {
				throw new Error('invalid plotType')
			}
		} catch (e: any) {
			result = { error: e?.message || e }
			if (e instanceof Error && e.stack) console.log(e)
		}
		res.send(result satisfies ViolinBoxResponse)
	}
}

/**********************************************************
 * VIOLIN PLOT FUNCTIONS
 **********************************************************/

async function getViolin(q: ViolinRequest & ReqQueryAddons, data: any, ds: any) {
	const samples = Object.values(data.samples)
	let values = samples
		.map(s => s?.[q.tw.$id!]?.value)
		.filter(v => typeof v === 'number' && !q.tw.term.values?.[v]?.uncomputable)
	if (q.unit == 'log') values = values.filter(v => v > 0)
	//calculate stats here and pass them to client to avoid second request on client for getting stats
	const descrStats = getDescrStats(values)
	const sampleType = `All ${data.sampleType?.plural_name || 'samples'}`
	if (data.error) throw new Error(data.error)
	//get ordered labels to sort keys in plot2values
	if (q.overlayTw && data.refs.byTermId[q.overlayTw.$id]) {
		data.refs.byTermId[q.overlayTw.$id].orderedLabels = getOrderedLabels(
			q.overlayTw,
			data.refs.byTermId[q.overlayTw.$id]?.bins,
			undefined,
			q.overlayTw.q
		)
	}

	if (q.scale) setScaleData(q, data as ValidGetDataResponse, q.tw)

	const valuesObject = divideValues(q, data as ValidGetDataResponse, sampleType)
	const result = setViolinResponse(valuesObject, data as ValidGetDataResponse, q)

	// wilcoxon test data to return to client
	if (q.overlayTw) await getViolinWilcoxonData(result)

	await createCanvasImg(q, result, ds)
	result['descrStats'] = descrStats
	return result
}

/** scale sample data
 * divide keys and values by scaling factor - this is important
 * for regression UI when running association tests. */
function setScaleData(q: ViolinRequest, data: ValidGetDataResponse, tw: TermWrapper) {
	if (!q.scale) return
	const scale = Number(q.scale)
	for (const val of Object.values(data.samples)) {
		if (!tw.$id || !val[tw.$id]) continue
		if (tw.term.values?.[val[tw.$id]?.value]?.uncomputable) continue
		val[tw.$id].key = val[tw.$id].key / scale
		val[tw.$id].value = val[tw.$id].value / scale
	}
}

function divideValues(q: ViolinRequest, data: ValidGetDataResponse, sampleType: string) {
	const overlayTerm = q.overlayTw
	const divideTerm = q.divideTw
	const useLog = q.unit == 'log'

	const { absMax, absMin, chart2plot2values, uncomputableValues } = parseValues(
		q,
		data,
		sampleType,
		useLog,
		overlayTerm,
		divideTerm
	)
	return {
		chart2plot2values,
		min: absMin,
		max: absMax,
		uncomputableValues: sortObj(uncomputableValues)
	}
}

function sortObj(object: { [index: string]: any }) {
	return Object.fromEntries(Object.entries(object).sort(([, a], [, b]) => (a as any) - (b as any)))
}

export function sortPlot2Values(
	data: ValidGetDataResponse,
	plot2values: Map<string, any[]>,
	overlayTerm?: TermWrapper
) {
	const orderedLabels = overlayTerm?.$id ? data.refs.byTermId[overlayTerm.$id]?.keyOrder : undefined

	plot2values = new Map(
		[...plot2values].sort(
			orderedLabels
				? (a, b) => orderedLabels.indexOf(a[0]) - orderedLabels.indexOf(b[0])
				: overlayTerm?.term?.type === 'categorical'
				? (a, b) => b[1].length - a[1].length
				: overlayTerm?.term?.type === 'condition'
				? (a, b) => Number(a[0]) - Number(b[0])
				: (a, b) =>
						a
							.toString()
							.replace(/[^a-zA-Z0-9<]/g, '')
							.localeCompare(b.toString().replace(/[^a-zA-Z0-9<]/g, ''), undefined, { numeric: true })
		)
	)
	return plot2values
}

function setViolinResponse(valuesObject: any, data: ValidGetDataResponse, q: ViolinRequest) {
	const charts: any = {}
	const overlayTerm = q.overlayTw
	const divideTw = q.divideTw
	for (const [chart, plot2values] of valuesObject.chart2plot2values) {
		//temp plot type
		const plots: {
			label: string
			values: number[]
			seriesId: string
			chartId: string
			plotValueCount: number
			color?: string
		}[] = []

		for (const [plot, values] of sortPlot2Values(data, plot2values, overlayTerm)) {
			plots.push({
				label: overlayTerm?.term?.values?.[plot]?.label || plot,
				values,
				seriesId: plot,
				chartId: chart, //quick fix to get list samples working
				plotValueCount: values?.length,
				color: overlayTerm?.term?.values?.[plot]?.color || null
			})
		}

		charts[chart] = { chartId: chart, plots }
	}

	/** bins are used for constructing filter objs. Specifically for
	 * listing samples, filterting, etc. */
	const bins: { [index: string]: any } = {
		term1: numericBins(q.tw, data)
	}
	if (overlayTerm) bins.term2 = numericBins(overlayTerm, data)
	if (divideTw) bins.term0 = numericBins(divideTw, data)

	const result = {
		min: valuesObject.min,
		max: valuesObject.max,
		bins,
		charts,
		uncomputableValues: Object.keys(valuesObject.uncomputableValues).length > 0 ? valuesObject.uncomputableValues : null
	}

	return result
}

async function createCanvasImg(q: ViolinRequest, result: { [index: string]: any }, ds: { [index: string]: any }) {
	if (!q.radius) q.radius = 5
	// assign defaults as needed
	if (q.radius <= 0) throw new Error('q.radius is not a number')
	else q.radius = +q.radius // ensure numeric value, not string
	const isH = q.orientation == 'horizontal'

	for (const k of Object.keys(result.charts)) {
		const chart = result.charts[k]
		const plot2Values = {}
		for (const plot of chart.plots) plot2Values[plot.label] = plot.values
		const useLog = q.unit == 'log'
		const logBase = ds.cohort.termdb.logscaleBase2 ? 2 : 10
		const densities = await getDensities(plot2Values, useLog, logBase)

		let axisScale
		if (useLog) {
			axisScale = scaleLog()
				.base(ds.cohort.termdb.logscaleBase2 ? 2 : 10)
				.domain([result.min, result.max])
				.range(isH ? [0, q.svgw] : [q.svgw, 0])
		} else {
			axisScale = scaleLinear()
				.domain([result.min, result.max])
				.range(isH ? [0, q.svgw] : [q.svgw, 0])
		}

		const [width, height] = isH
			? [q.svgw * q.devicePixelRatio, q.radius * q.devicePixelRatio]
			: [q.radius * q.devicePixelRatio, q.svgw * q.devicePixelRatio]

		for (const plot of chart.plots) {
			// plot: { label=str, values=[v1,v2,...] }
			plot.density = densities[plot.label] // set the plot density

			//backend rendering bean/rug plot on top of violin plot based on orientation of plot
			const canvas = createCanvas(width, height)
			const ctx = canvas.getContext('2d')
			if (q.devicePixelRatio != 1) ctx.scale(q.devicePixelRatio, q.devicePixelRatio) //scaling for sharper image
			ctx.strokeStyle = 'black'
			ctx.lineWidth = 1

			if (q.datasymbol === 'rug') {
				ctx.globalAlpha = 0.8
				plot.values.forEach((i: number) => {
					const s = axisScale(i)
					ctx.beginPath()
					if (isH) {
						ctx.moveTo(s, 0)
						ctx.lineTo(s, q.radius)
						// may not use Math.floor()+.5 for "crisp" line as the max value line will be out of picture
						//ctx.moveTo(Math.floor(s)+.5, 0); ctx.lineTo(Math.floor(s)+.5, scaledRadius * 2)
					} else {
						ctx.moveTo(0, s)
						ctx.lineTo(q.radius, s)
					}
					ctx.stroke()
				})
			} else if (q.datasymbol === 'bean') {
				ctx.globalAlpha = 0.6
				ctx.fillStyle = '#ffe6e6' //only applied with rug
				plot.values.forEach((i: number) => {
					const s = axisScale(i)
					ctx.beginPath()
					if (isH) ctx.arc(s, q.radius / 2, q.radius / 2, 0, 2 * Math.PI)
					else ctx.arc(q.radius / 2, s, q.radius / 2, 0, 2 * Math.PI)
					ctx.fill()
					ctx.stroke()
				})
			}

			plot.src = canvas.toDataURL()

			//generate summary stat values
			plot.summaryStats = getDescrStats(plot.values)
			//delete plot.values
		}
	}
}

// compute pvalues using wilcoxon rank sum test
export async function getViolinWilcoxonData(result: { [index: string]: any }) {
	for (const k of Object.keys(result.charts)) {
		const chart = result.charts[k]
		const numPlots = chart.plots.length
		if (numPlots < 2) continue

		const wilcoxInput: { [index: string]: any }[] = []

		for (let i = 0; i < numPlots; i++) {
			const group1_id = chart.plots[i].label
			const group1_values = chart.plots[i].values
			for (let j = i + 1; j < numPlots; j++) {
				const group2_id = chart.plots[j].label
				const group2_values = chart.plots[j].values
				wilcoxInput.push({ group1_id, group1_values, group2_id, group2_values })
			}
		}
		const wilcoxOutput = JSON.parse(await run_rust('wilcoxon', JSON.stringify(wilcoxInput)))
		chart.pvalues = []
		for (const test of wilcoxOutput) {
			if (test.pvalue == null || test.pvalue == 'null') {
				chart.pvalues.push([{ value: test.group1_id }, { value: test.group2_id }, { html: 'NA' }])
			} else {
				chart.pvalues.push([{ value: test.group1_id }, { value: test.group2_id }, { html: test.pvalue.toPrecision(4) }])
			}
		}
	}
}

export async function getDensity(
	values: number[]
): Promise<{ bins: any[]; densityMin: number; densityMax: number; minvalue: number; maxvalue: number }> {
	const result = await getDensities({ plot: values })
	return result.plot
}

export async function getDensities(
	plot2Values,
	useLog: boolean = false,
	logBase: number = 10
): Promise<{ [plot: string]: any }> {
	// If using log scale, transform values to log space before density calculation
	let transformedPlot2Values = {}
	if (useLog) {
		for (const plot in plot2Values) {
			// Filter out non-positive values and transform to log space
			// Log is undefined for values <= 0, so we filter them out
			transformedPlot2Values[plot] = plot2Values[plot].filter(v => v > 0).map(v => Math.log(v) / Math.log(logBase))
		}
	} else {
		transformedPlot2Values = plot2Values
	}

	const plot2Density: any = JSON.parse(
		await run_R('density.R', JSON.stringify({ plot2Values: transformedPlot2Values }))
	)
	const densities = {}
	for (const plot in plot2Density) {
		const result: { x: number[]; y: number[] } = plot2Density[plot]
		const bins: any = []
		let densityMin = Infinity
		let densityMax = -Infinity
		let xMin = Infinity
		let xMax = -Infinity
		for (const [i, x] of Object.entries(result.x)) {
			const density = result.y[i]
			// Transform x back to original space if using log scale
			const x0 = useLog ? Math.pow(logBase, x) : x
			xMin = Math.min(xMin, x0)
			xMax = Math.max(xMax, x0)
			densityMin = Math.min(densityMin, density)
			densityMax = Math.max(densityMax, density)
			bins.push({ x0, density })
		}
		bins.unshift({ x0: xMin, density: densityMin }) //close the path
		bins.push({ x0: xMax, density: densityMin }) //close the path
		const density = { bins, densityMin, densityMax, minvalue: xMin, maxvalue: xMax }
		densities[plot] = density
	}
	return densities
}

/**********************************************************
 * BOXPLOT FUNCTIONS
 **********************************************************/

async function getBoxPlot(q: BoxRequest & ReqQueryAddons, data: any) {
	const { absMin, absMax, bins, charts, uncomputableValues, descrStats, outlierMin, outlierMax } =
		await processBoxPlotData(data, q)

	const returnData = {
		absMin: q.removeOutliers ? outlierMin : absMin,
		absMax: q.removeOutliers ? outlierMax : absMax,
		bins,
		charts,
		uncomputableValues: setUncomputableValues(uncomputableValues),
		descrStats
	}

	return returnData
}

/** Process the returned data from getData() for entire box plot chart.*/
async function processBoxPlotData(data, q: BoxRequest) {
	const samples = Object.values(data.samples)
	const values = samples
		.map(s => s?.[q.tw.$id!]?.value)
		.filter(v => typeof v === 'number' && !q.tw.term.values?.[v]?.uncomputable)
	//calculate stats here and pass them to client to avoid second request on client for getting stats
	const descrStats = getDescrStats(values, q.removeOutliers)

	const sampleType = `All ${data.sampleType?.plural_name || 'samples'}`
	const overlayTw = q.overlayTw
	const divideTw = q.divideTw
	const { absMin, absMax, chart2plot2values, uncomputableValues } = parseValues(
		q,
		data as ValidGetDataResponse,
		sampleType,
		q.isLogScale,
		overlayTw,
		divideTw
	)

	if (!absMin && absMin !== 0) throw new Error('absMin is undefined')
	if (!absMax && absMax !== 0) throw new Error('absMax is undefined')
	const charts: any = {}
	let outlierMin = Number.POSITIVE_INFINITY,
		outlierMax = Number.NEGATIVE_INFINITY
	for (const [chart, plot2values] of chart2plot2values) {
		const plots: any = []
		for (const [key, values] of sortPlot2Values(data as ValidGetDataResponse, plot2values, overlayTw)) {
			;[outlierMax, outlierMin] = setPlotData(
				plots,
				values,
				key,
				sampleType,
				descrStats,
				q,
				outlierMin,
				outlierMax,
				overlayTw
			)
		}
		if (q.tw.term?.values) setHiddenPlots(q.tw, plots)
		if (overlayTw && overlayTw.term?.values) setHiddenPlots(overlayTw, plots)
		if (divideTw && divideTw.term?.values) setHiddenPlots(divideTw, plots)

		if (q.orderByMedian == true) {
			plots.sort((a, b) => a.boxplot.p50 - b.boxplot.p50)
		}
		/** Descr stats not calculated per chart. Set the total num of samples per chart */
		const sampleCount = plots.reduce((total, p) => {
			if (p.hidden) return total
			return total + p.descrStats.total.value
		}, 0)

		charts[chart] = { chartId: chart, plots, sampleCount: sampleCount }
	}

	const bins: { [index: string]: any } = {
		term1: numericBins(q.tw, data)
	}

	if (overlayTw) bins.term2 = numericBins(overlayTw, data)
	if (divideTw) bins.term0 = numericBins(divideTw, data)

	if (q.showAssocTests && overlayTw) await getBoxPlotWilcoxonData(charts)
	//quick fix to not return values to the client
	//will fix when addressing issues with descriptive stats and other logic errs
	Object.keys(charts).forEach(c => charts[c].plots.forEach(p => delete p.tempValues))

	return { absMin, absMax, bins, charts, uncomputableValues, descrStats, outlierMin, outlierMax }
}

/** Set the data (e.g. values, titles, outliers, etc.)
 * for individual box plots within a chart */
function setPlotData(
	plots: any[],
	values: number[],
	key: string,
	sampleType: string,
	descrStats: any,
	q: BoxRequest,
	outlierMin: number,
	outlierMax: number,
	overlayTw?: any
) {
	const sortedValues = values.sort((a, b) => a - b)

	const vs = sortedValues.map((v: number) => {
		const value = { value: v }
		return value
	})

	if (q.removeOutliers) {
		outlierMin = Math.min(outlierMin, descrStats.outlierMin.value)
		outlierMax = Math.max(outlierMax, descrStats.outlierMax.value)
	}

	const boxplot = boxplot_getvalue(vs, q.removeOutliers)
	if (!boxplot) throw new Error('boxplot_getvalue failed [termdb.violinBox init()]')
	const plot: { [index: string]: any } = {
		boxplot,
		descrStats: setIndividualBoxPlotStats(boxplot, sortedValues),
		//quick fix
		//to delete later
		tempValues: sortedValues
	}

	//Set rendering properties for the plot
	if (overlayTw) {
		const _key = overlayTw?.term?.values?.[key]?.label || key

		plot.color = overlayTw?.term?.values?.[key]?.color || null
		plot.key = _key
		plot.seriesId = key
		plot.boxplot.label = `${_key}, n=${values.length}`
	} else {
		plot.key = sampleType
		plot.boxplot.label = `${sampleType}, n=${values.length}`
	}
	plots.push(plot)

	return [outlierMax, outlierMin]
}

/** DO NOT attach the overall stats for the entire chart to
 * individual plots again. That is incorrect.
 *
 * boxplot_getvalue() already calculates most of these values.
 * This function formats the data appropriately for the client.
 */
function setIndividualBoxPlotStats(
	boxplot,
	values: number[]
): { [key: string]: { key: string; label: string; value: number } } {
	const stats = {
		total: { key: 'total', label: 'Total', value: values.length },
		min: { key: 'min', label: 'Minimum', value: values[0] },
		p25: { key: 'p25', label: '1st quartile', value: boxplot.p25 },
		median: { key: 'median', label: 'Median', value: boxplot.p50 },
		p75: { key: 'p75', label: '3rd quartile', value: boxplot.p75 },
		mean: { key: 'mean', label: 'Mean', value: getMean(values) },
		max: { key: 'max', label: 'Maximum', value: values[values.length - 1] },
		stdDev: { key: 'stdDev', label: 'Standard deviation', value: getStdDev(values) }
	}

	for (const key of Object.keys(stats)) {
		stats[key].value = roundValueAuto(stats[key].value)
	}
	return stats
}

/** Set hidden status for plots */
function setHiddenPlots(term: any, plots: any) {
	for (const v of Object.values(term.term?.values as { label: string; uncomputable: boolean }[])) {
		const plot = plots.find(p => p.key === v.label)
		if (plot) plot.isHidden = v?.uncomputable
	}
	if (term.q?.hiddenValues) {
		for (const key of Object.keys(term.q.hiddenValues)) {
			const plot = plots.find(p => p.key === key)
			if (plot) plot.isHidden = true
		}
	}
	return plots
}

/** Only return a simplified object for the legend data */
function setUncomputableValues(values: Record<string, number>) {
	if (Object.entries(values)?.length) {
		return Object.entries(values).map(([label, v]) => ({ label, value: v as number }))
	} else return null
}

async function getBoxPlotWilcoxonData(charts: { [chartId: string]: any }) {
	for (const chart of Object.values(charts)) {
		const numPlots = chart.plots?.length
		if (numPlots < 2) continue

		const wilcoxonInput: { [index: string]: any }[] = []

		for (let i = 0; i < numPlots; i++) {
			const group1_id = chart.plots[i].boxplot.label.replace(/, n=\d+$/, '')
			const group1_values = chart.plots[i].tempValues
			for (let j = i + 1; j < numPlots; j++) {
				const group2_id = chart.plots[j].boxplot.label.replace(/, n=\d+$/, '')
				const group2_values = chart.plots[j].tempValues
				wilcoxonInput.push({ group1_id, group1_values, group2_id, group2_values })
			}
		}
		const wilcoxonOutput = JSON.parse(await run_rust('wilcoxon', JSON.stringify(wilcoxonInput)))
		//May change this if there are other tests to add in the future
		chart.wilcoxon = []
		for (const test of wilcoxonOutput) {
			//Output is formated for #dom/table.js to render
			if (test.pvalue == null || test.pvalue == 'null') {
				chart.wilcoxon.push([{ value: test.group1_id }, { value: test.group2_id }, { html: 'NA' }])
			} else {
				chart.wilcoxon.push([
					{ value: test.group1_id },
					{ value: test.group2_id },
					{ html: test.pvalue.toPrecision(4) }
				])
			}
		}
	}
}

/**********************************************************
 * Functions used in both box plot and violin plot routes *
 **********************************************************/

export function parseValues(
	q: any,
	data: ValidGetDataResponse,
	sampleType: string,
	isLog: boolean,
	overlayTw?: any,
	divideTw?: any
) {
	/** Map samples to terms */
	const chart2plot2values = new Map()
	/** Record uncomputable values not used for plot rendering
	 * but displayed in the legend */
	const uncomputableValues = {}

	/** Find the absolute min and max values to render
	 * the plot scale */
	let absMin = Infinity,
		absMax = -Infinity
	for (const val of Object.values(data.samples)) {
		const value = val[q.tw.$id]
		if (!Number.isFinite(value?.value)) continue

		if (q.tw.term.values?.[value.value]?.uncomputable) {
			/** Record uncomputable values for the legend and skip */
			const label = q.tw.term.values[value.value].label
			uncomputableValues[label] = (uncomputableValues[label] || 0) + 1
			continue
		}

		/** Only use positive values for log scales */
		if (isLog && value.value <= 0) continue

		let chart: any = '' // chart containing violin plots
		let plot: any = sampleType // violin plot
		if (divideTw) {
			if (!val[divideTw?.$id]) continue
			const value0 = val[divideTw.$id]
			if (divideTw.term?.values?.[value0.key]?.uncomputable) {
				/** same as above but for divide term */
				const label = divideTw.term.values[value0?.key]?.label
				uncomputableValues[label] = (uncomputableValues[label] || 0) + 1
			}
			chart = value0.key
		}
		if (overlayTw) {
			if (!val[overlayTw?.$id]) continue
			const value2 = val[overlayTw.$id]
			if (overlayTw.term?.values?.[value2.key]?.uncomputable) {
				/** same as above but for overlay term */
				const label = overlayTw.term.values[value2?.key]?.label
				uncomputableValues[label] = (uncomputableValues[label] || 0) + 1
			}
			plot = value2.key
		}

		if (!chart2plot2values.has(chart)) chart2plot2values.set(chart, new Map())
		const plot2values = chart2plot2values.get(chart)
		if (!plot2values.has(plot)) plot2values.set(plot, [])
		const values = plot2values.get(plot)
		values.push(value.value)

		if (value.value < absMin) absMin = value.value
		if (value.value > absMax) absMax = value.value
	}

	return { absMax, absMin, chart2plot2values, uncomputableValues }
}

/** Return bins for filtering and list sample label menu options */
export function numericBins(tw: any, data: any) {
	const bins = {}
	if (!isNumericTerm(tw?.term)) return bins
	for (const bin of data.refs.byTermId[tw?.$id]?.bins || []) {
		bins[bin.label] = bin
	}
	return bins
}
