import type { ViolinRequest, ViolinResponse, RouteApi, GetDataResponse } from '#types'
import { violinPayload } from '#types/checkers'
import { scaleLinear, scaleLog } from 'd3'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { getData } from '../src/termdb.matrix.js'
import { createCanvas } from 'canvas'
import { getOrderedLabels } from '../src/termdb.barchart.js'
import summaryStats from '#shared/descriptive.stats.js'
import { isNumericTerm } from '#shared/terms.js'
import { getBinsDensity } from '#shared/violin.bins.js'

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

export async function trigger_getViolinPlotData(q: ViolinRequest, ds, genome) {
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
	if (q.divideTw && data.refs.byTermId[q.divideTw.term.id]) {
		data.refs.byTermId[q.divideTw.term.id].orderedLabels = getOrderedLabels(
			q.divideTw,
			data.refs.byTermId[q.divideTw.term.id]?.bins,
			undefined,
			q.divideTw.q
		)
	}

	if (q.scale) scaleData(q, data, q.tw)

	const valuesObject = divideValues(q, data, q.tw, sampleType)
	const result = setResponse(valuesObject, data, q, sampleType)

	// wilcoxon test data to return to client
	await wilcoxon(q.divideTw, result)

	createCanvasImg(q, result, ds)

	return result
}

// compute pvalues using wilcoxon rank sum test
export async function wilcoxon(divideTw, result) {
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

//create numeric bins for the overlay term to provide filtering options
// TODO: handle .keyOrder as an alternative to .bins ???
function numericBins(overlayTerm, data) {
	const divideTwBins = new Map()
	/** Fix for broken `list samples` option no longer work for numeric terms */
	const divideBins = data.refs.byTermId[overlayTerm?.$id]?.bins
	if (divideBins) {
		for (const bin of divideBins) {
			divideTwBins.set(bin.label, bin)
		}
	}
	return divideTwBins
}

// scale sample data
// divide keys and values by scaling factor - this is important for regression UI when running association tests.
function scaleData(q, data: GetDataResponse, tw) {
	if (!q.scale) return
	const scale = Number(q.scale)
	for (const val of Object.values(data.samples)) {
		if (!val[tw.$id]) continue
		if (tw.term.values?.[val[tw.$id]?.value]?.uncomputable) continue
		val[tw.$id].key = val[tw.$id].key / scale
		val[tw.$id].value = val[tw.$id].value / scale
	}
}

function divideValues(q, data: GetDataResponse, tw, sampleType) {
	const overlayTerm = q.divideTw
	const useLog = q.unit == 'log'

	const key2values = new Map()
	let min = Infinity
	let max = -Infinity

	//create object to store uncomputable values and label
	const uncomputableValueObj = {}
	let skipNonPositiveCount = 0 // if useLog=true, record number of <=0 values skipped
	for (const v of Object.values(data.samples)) {
		//if there is no value for term then skip that.
		const value = v[tw.$id]
		if (!Number.isFinite(value?.value)) continue

		if (tw.term.values?.[value.value]?.uncomputable) {
			//skip these values from rendering in plot but show in legend as uncomputable categories
			const label = tw.term.values[value.value].label // label of this uncomputable category
			uncomputableValueObj[label] = (uncomputableValueObj[label] || 0) + 1
			continue
		}

		if (useLog && value.value <= 0) {
			skipNonPositiveCount++
			continue
		}

		if (min > value.value) min = value.value
		if (max < value.value) max = value.value

		if (useLog) {
			if (min === 0) min = Math.max(min, value.value)
		}
		if (overlayTerm) {
			if (!v[overlayTerm?.$id]) continue
			const value2 = v[overlayTerm.$id]
			// if there is no value for q.divideTw then skip this
			if (overlayTerm.term?.values?.[value2.key]?.uncomputable) {
				const label = overlayTerm.term.values[value2?.key]?.label // label of this uncomputable category
				uncomputableValueObj[label] = (uncomputableValueObj[label] || 0) + 1
			}

			if (!key2values.has(value2.key)) key2values.set(value2.key, [])
			key2values.get(value2.key).push(value.value)
		} else {
			if (!key2values.has(sampleType)) key2values.set(sampleType, [])
			key2values.get(sampleType).push(value.value)
		}
	}
	return {
		key2values,
		min,
		max,
		uncomputableValueObj: sortObj(uncomputableValueObj),
		skipNonPositiveCount
	}
}

function sortObj(object) {
	return Object.fromEntries(Object.entries(object).sort(([, a], [, b]) => a - b))
}

export function sortKey2values(data, key2values, overlayTerm) {
	const orderedLabels = data.refs.byTermId[overlayTerm?.$id]?.keyOrder

	key2values = new Map(
		[...key2values].sort(
			orderedLabels
				? (a, b) => orderedLabels.indexOf(a[0]) - orderedLabels.indexOf(b[0])
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

function setResponse(valuesObject, data, q, sampleType) {
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
	const pvalues = []

	for (const [key, values] of sortKey2values(data, valuesObject.key2values, overlayTerm)) {
		if (overlayTerm) {
			plots.push({
				label: overlayTerm?.term?.values?.[key]?.label || key,
				values,
				seriesId: key,
				plotValueCount: values?.length,
				color: overlayTerm?.term?.values?.[key]?.color || null,
				divideTwBins: numericBins(overlayTerm, data).has(key) ? numericBins(overlayTerm, data).get(key) : null,
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
		pvalues,
		uncomputableValueObj:
			Object.keys(valuesObject.uncomputableValueObj).length > 0 ? valuesObject.uncomputableValueObj : null
	}

	return result
}

function createCanvasImg(q, result, ds) {
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
