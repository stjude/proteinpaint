import type { ViolinRequest, ViolinResponse, RouteApi, ValidGetDataResponse, TermWrapper } from '#types'
import { violinPayload } from '#types/checkers'
import { scaleLinear, scaleLog, extent } from 'd3'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { getData } from '../src/termdb.matrix.js'
import { createCanvas } from 'canvas'
import { getOrderedLabels } from '../src/termdb.barchart.js'
import { getDescrStats } from './termdb.descrstats.ts'
import { isNumericTerm } from '#shared/terms.js'
import { numericBins, parseValues } from './termdb.boxplot.ts'
import { run_R } from '@sjcrh/proteinpaint-r'

// mark as unused by eslint, TODO: delete permanently
// const minSampleSize = 5 // a group below cutoff will not compute violin

export const api: RouteApi = {
	endpoint: 'termdb/violin',
	methods: {
		get: {
			...violinPayload,
			init
		},
		post: {
			...violinPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		const q: ViolinRequest = req.query
		let data
		try {
			const g = genomes[q.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets?.[q.dslabel]
			if (!ds) throw 'invalid ds'
			data = await trigger_getViolinPlotData(q, ds)
		} catch (e: any) {
			data = { error: e?.message || e }
			if (e instanceof Error && e.stack) console.log(e)
		}
		res.send(data satisfies ViolinResponse)
	}
}

export async function trigger_getViolinPlotData(q: ViolinRequest, ds: any) {
	if (typeof q.tw?.term != 'object' || typeof q.tw?.q != 'object') throw 'q.tw not of {term,q}'
	const term = q.tw.term
	if (!q.tw.q.mode) q.tw.q.mode = 'continuous'
	if (!isNumericTerm(term) && term.type !== 'survival') throw 'term type is not numeric or survival'

	const terms = [q.tw]
	if (q.overlayTw) terms.push(q.overlayTw)
	if (q.divideTw) terms.push(q.divideTw)

	const data = await getData(
		{
			terms,
			filter: q.filter,
			filter0: q.filter0,
			currentGeneNames: q.currentGeneNames,
			__protected__: q.__protected__
		},
		ds
	)

	const samples = Object.values(data.samples)
	let values = samples
		.map(s => s?.[q.tw.$id!]?.value)
		.filter(v => typeof v === 'number' && !q.tw.term.values?.[v]?.uncomputable)
	if (q.unit == 'log') values = values.filter(v => v > 0)
	//calculate stats here and pass them to client to avoid second request on client for getting stats
	const descrStats = getDescrStats(values)
	const sampleType = `All ${data.sampleType?.plural_name || 'samples'}`
	if (data.error) throw data.error
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
	const result = setResponse(valuesObject, data as ValidGetDataResponse, q)

	// wilcoxon test data to return to client
	if (q.overlayTw) await getWilcoxonData(result)

	await createCanvasImg(q, result, ds)
	result['descrStats'] = descrStats
	return result
}

// compute pvalues using wilcoxon rank sum test
export async function getWilcoxonData(result: { [index: string]: any }) {
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

function setResponse(valuesObject: any, data: ValidGetDataResponse, q: ViolinRequest) {
	const charts: any = {}
	const overlayTerm = q.overlayTw
	for (const [chart, plot2values] of valuesObject.chart2plot2values) {
		//temp plot type
		const plots: {
			label: string
			values: number[]
			seriesId?: string
			plotValueCount: number
			color?: string
			overlayTwBins?: any
		}[] = []

		for (const [plot, values] of sortPlot2Values(data, plot2values, overlayTerm)) {
			plots.push({
				label: overlayTerm?.term?.values?.[plot]?.label || plot,
				values,
				seriesId: plot,
				plotValueCount: values?.length,
				color: overlayTerm?.term?.values?.[plot]?.color || null,
				overlayTwBins: isNumericTerm(overlayTerm?.term) ? numericBins(overlayTerm, data) : null
			})
		}

		charts[chart] = { chartId: chart, plots }
	}

	const result = {
		min: valuesObject.min,
		max: valuesObject.max,
		charts,
		uncomputableValues:
			Object.keys(valuesObject.uncomputableValues).length > 0 ? valuesObject.uncomputableValues : null,
		// what??
		radius: q.radius
	}

	return result
}

async function createCanvasImg(q: ViolinRequest, result: { [index: string]: any }, ds: { [index: string]: any }) {
	if (!q.radius) q.radius = 5
	// assign defaults as needed
	if (q.radius <= 0) throw 'q.radius is not a number'
	else q.radius = +q.radius // ensure numeric value, not string
	if (!q.strokeWidth) q.strokeWidth = 0.2
	const isH = q.orientation == 'horizontal'

	for (const k of Object.keys(result.charts)) {
		const chart = result.charts[k]
		const plot2Values = {}
		for (const plot of chart.plots) plot2Values[plot.label] = plot.values
		const densities = await getDensities(plot2Values, result.min, result.max)

		let axisScale
		const useLog = q.unit == 'log'
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

export async function getDensity(
	values: number[]
): Promise<{ bins: any[]; densityMin: number; densityMax: number; minvalue: number; maxvalue: number }> {
	const [min, max] = extent(values) as [number, number]
	const result = await getDensities({ plot: values }, min, max)
	return result.plot
}

export async function getDensities(plot2Values, min: number, max: number): Promise<{ [plot: string]: any }> {
	const plot2Density: any = JSON.parse(await run_R('density.R', JSON.stringify({ plot2Values, min, max })))
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
			xMin = Math.min(xMin, x)
			xMax = Math.max(xMax, x)
			densityMin = Math.min(densityMin, density)
			densityMax = Math.max(densityMax, density)
			bins.push({ x0: x, density })
		}
		bins.unshift({ x0: xMin, density: densityMin }) //close the path
		bins.push({ x0: xMax, density: densityMin }) //close the path
		const density = { bins, densityMin, densityMax, minvalue: xMin, maxvalue: xMax }
		densities[plot] = density
	}
	return densities
}
