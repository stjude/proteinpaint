import type { ViolinRequest, ViolinResponse, RouteApi, ValidGetDataResponse, TermWrapper } from '#types'
import { violinPayload } from '#types/checkers'
import { scaleLinear, scaleLog } from 'd3'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { getData } from '../src/termdb.matrix.js'
import { createCanvas } from 'canvas'
import { getOrderedLabels } from '../src/termdb.barchart.js'
import summaryStats from '#shared/descriptive.stats.js'
import { isNumericTerm } from '#shared/terms.js'
import { getBinsDensity } from '#shared/violin.bins.js'
import { numericBins, parseValues } from './termdb.boxplot.ts'

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
			data = await trigger_getViolinPlotData(q, ds, g)
		} catch (e: any) {
			data = { error: e?.message || e }
			if (e instanceof Error && e.stack) console.log(e)
		}
		res.send(data satisfies ViolinResponse)
	}
}

export async function trigger_getViolinPlotData(
	q: ViolinRequest,
	ds: { [index: string]: any },
	genome: { [index: string]: any }
) {
	if (typeof q.tw?.term != 'object' || typeof q.tw?.q != 'object') throw 'q.tw not of {term,q}'
	const term = q.tw.term
	if (!q.tw.q.mode) q.tw.q.mode = 'continuous'
	if (!isNumericTerm(term) && term.type !== 'survival') throw 'term type is not numeric or survival'

	const terms = [q.tw]
	if (q.divideTw) terms.push(q.divideTw)

	const data = await getData(
		{ terms, filter: q.filter, filter0: q.filter0, currentGeneNames: q.currentGeneNames },
		ds,
		genome
	)
	const sampleType = `All ${data.sampleType?.plural_name || 'samples'}`
	if (data.error) throw data.error
	//get ordered labels to sort keys in key2values
	if (q.divideTw && data.refs.byTermId[q.divideTw.$id]) {
		data.refs.byTermId[q.divideTw.$id].orderedLabels = getOrderedLabels(
			q.divideTw,
			data.refs.byTermId[q.divideTw.$id]?.bins,
			undefined,
			q.divideTw.q
		)
	}

	if (q.scale) setScaleData(q, data as ValidGetDataResponse, q.tw)

	const valuesObject = divideValues(q, data as ValidGetDataResponse, sampleType)
	const result = setResponse(valuesObject, data as ValidGetDataResponse, q, sampleType)

	// wilcoxon test data to return to client
	await getWilcoxonData(q.divideTw, result)

	createCanvasImg(q, result, ds)

	return result
}

// compute pvalues using wilcoxon rank sum test
export async function getWilcoxonData(divideTw: TermWrapper, result: { [index: string]: any }) {
	if (!divideTw) return
	const numPlots = result.plots.length
	if (numPlots < 2) return

	const wilcoxInput: { [index: string]: any }[] = []

	for (let i = 0; i < numPlots; i++) {
		const group1_id = result.plots[i].label
		const group1_values = result.plots[i].values
		for (let j = i + 1; j < numPlots; j++) {
			const group2_id = result.plots[j].label
			const group2_values = result.plots[j].values
			wilcoxInput.push({ group1_id, group1_values, group2_id, group2_values })
		}
	}

	const wilcoxOutput = JSON.parse(await run_rust('wilcoxon', JSON.stringify(wilcoxInput)))
	for (const test of wilcoxOutput) {
		if (test.pvalue == null || test.pvalue == 'null') {
			result.pvalues.push([{ value: test.group1_id }, { value: test.group2_id }, { html: 'NA' }])
		} else {
			result.pvalues.push([{ value: test.group1_id }, { value: test.group2_id }, { html: test.pvalue.toPrecision(4) }])
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
	const overlayTerm = q.divideTw
	const useLog = q.unit == 'log'

	const { absMax, absMin, key2values, uncomputableValues } = parseValues(q, data, sampleType, useLog, overlayTerm)
	return {
		key2values,
		min: absMin,
		max: absMax,
		uncomputableValueObj: sortObj(uncomputableValues)
	}
}

function sortObj(object: { [index: string]: any }) {
	return Object.fromEntries(Object.entries(object).sort(([, a], [, b]) => (a as any) - (b as any)))
}

export function sortKey2values(data: ValidGetDataResponse, key2values: Map<string, any[]>, overlayTerm: TermWrapper) {
	const orderedLabels = overlayTerm?.$id ? data.refs.byTermId[overlayTerm.$id]?.keyOrder : undefined

	key2values = new Map(
		[...key2values].sort(
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
	return key2values
}

function setResponse(valuesObject: any, data: ValidGetDataResponse, q: ViolinRequest, sampleType: string) {
	const overlayTerm = q.divideTw
	//temp plot type
	const plots: {
		label: string
		values: number[]
		seriesId?: string
		plotValueCount: number
		color?: string
		divideTwBins?: any
		uncomputableValueObj?: { [index: string]: number } | null
	}[] = []

	for (const [key, values] of sortKey2values(data, valuesObject.key2values, overlayTerm)) {
		if (overlayTerm) {
			plots.push({
				label: overlayTerm?.term?.values?.[key]?.label || key,
				values,
				seriesId: key,
				plotValueCount: values?.length,
				color: overlayTerm?.term?.values?.[key]?.color || null,
				divideTwBins: isNumericTerm(overlayTerm.term) ? numericBins(overlayTerm, data) : null,
				uncomputableValueObj:
					Object.keys(valuesObject.uncomputableValueObj).length > 0 ? valuesObject.uncomputableValueObj : null
			})
		} else {
			const plot = {
				label: sampleType,
				values,
				plotValueCount: values.length
			}

			plots.push(plot)
		}
	}

	const result = {
		min: valuesObject.min,
		max: valuesObject.max,
		plots,
		pvalues: [],
		uncomputableValueObj:
			Object.keys(valuesObject.uncomputableValueObj).length > 0 ? valuesObject.uncomputableValueObj : null
	}

	return result
}

function createCanvasImg(q: ViolinRequest, result: { [index: string]: any }, ds: { [index: string]: any }) {
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
			.base(ds.cohort.termdb.logscaleBase2 ? 2 : 10)
			.domain([result.min, result.max])
			.range(q.orientation === 'horizontal' ? [0, q.svgw] : [q.svgw, 0])
	} else {
		axisScale = scaleLinear()
			.domain([result.min, result.max])
			.range(q.orientation === 'horizontal' ? [0, q.svgw] : [q.svgw, 0])
	}
	const [width, height] =
		q.orientation == 'horizontal'
			? [q.svgw * q.devicePixelRatio, refSize * q.devicePixelRatio]
			: [refSize * q.devicePixelRatio, q.svgw * q.devicePixelRatio]

	const scaledRadius = q.radius / q.devicePixelRatio
	const arcEndAngle = scaledRadius * Math.PI
	// let biggestBin = 0 //Never updated??
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
		if (q.datasymbol === 'rug')
			plot.values.forEach((i: number) => {
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
		else if (q.datasymbol === 'bean')
			plot.values.forEach((i: number) => {
				ctx.beginPath()
				if (q.orientation === 'horizontal') ctx.arc(+axisScale(i), q.radius, scaledRadius, 0, arcEndAngle)
				else ctx.arc(q.radius, +axisScale(i), scaledRadius, 0, arcEndAngle)
				ctx.fill()
				ctx.stroke()
			})

		plot.src = canvas.toDataURL()
		// create bins for violins
		const isKDE = q.isKDE
		plot.density = getBinsDensity(axisScale, plot, isKDE, q.ticks)

		//generate summary stat values
		plot.summaryStats = summaryStats(plot.values)
		delete plot.values
	}
	// result.biggestBin = biggestBin
	result.biggestBin = 0 //Never updated??
}
