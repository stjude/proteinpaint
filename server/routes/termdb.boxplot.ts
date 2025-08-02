import type { BoxPlotRequest, BoxPlotResponse, BoxPlotData, RouteApi, ValidGetDataResponse } from '#types'
import { boxplotPayload } from '#types/checkers'
import { getData } from '../src/termdb.matrix.js'
import { boxplot_getvalue } from '../src/utils.js'
import { sortKey2values } from './termdb.violin.ts'
import { roundValueAuto } from '#shared/roundValue.js'
import { getMean, getVariance } from '#shared/descriptive.stats.js'

const minSampleSize = 5 // a group below cutoff will not compute boxplot

export const api: RouteApi = {
	endpoint: 'termdb/boxplot',
	methods: {
		get: {
			...boxplotPayload,
			init
		},
		post: {
			...boxplotPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res) => {
		const q: BoxPlotRequest = req.query
		try {
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome name'
			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw 'invalid ds'
			const terms = [q.tw]
			if (q.overlayTw) terms.push(q.overlayTw)
			const data = await getData({ filter: q.filter, filter0: q.filter0, terms, __protected__: q.__protected__ }, ds)
			if (data.error) throw data.error

			const sampleType = `All ${data.sampleType?.plural_name || 'samples'}`
			const overlayTerm = q.overlayTw
			const { absMin, absMax, key2values, uncomputableValues } = parseValues(
				q,
				data as ValidGetDataResponse,
				sampleType,
				q.isLogScale,
				overlayTerm
			)

			const plots: any = []
			for (const [key, values] of sortKey2values(data as ValidGetDataResponse, key2values, overlayTerm)) {
				const sortedValues = values.sort((a, b) => a - b)

				const vs = sortedValues.map((v: number) => {
					const value = { value: v }
					return value
				})

				const boxplot = boxplot_getvalue(vs)
				if (!boxplot) throw 'boxplot_getvalue failed [termdb.boxplot init()]'
				const descrStats = setDescrStats(boxplot as BoxPlotData, sortedValues)
				const _plot = {
					boxplot,
					descrStats
				}

				//Set rendering properties for the plot
				if (overlayTerm) {
					const _key = overlayTerm?.term?.values?.[key]?.label || key
					const plotLabel = `${_key}, n=${values.length}`
					const overlayBins = numericBins(overlayTerm, data)
					const plot = Object.assign(_plot, {
						color: overlayTerm?.term?.values?.[key]?.color || null,
						key: _key,
						overlayBins: overlayBins.has(key) ? overlayBins.get(key) : null,
						seriesId: key
					})
					plot.boxplot.label = plotLabel
					plots.push(plot)
				} else {
					const plotLabel = `${sampleType}, n=${values.length}`
					const plot = Object.assign(_plot, {
						key: sampleType
					})
					plot.boxplot.label = plotLabel
					plots.push(plot)
				}
			}

			if (absMin == null || absMax == null) throw 'absMin or absMax is null [termdb.boxplot init()]'

			if (q.tw.term?.values) setHiddenPlots(q.tw, plots)
			if (overlayTerm && overlayTerm.term?.values) setHiddenPlots(overlayTerm, plots)

			if (q.orderByMedian == true) {
				plots.sort((a, b) => a.boxplot.p50 - b.boxplot.p50)
			}

			const returnData: BoxPlotResponse = {
				absMin,
				absMax,
				plots,
				uncomputableValues: setUncomputableValues(uncomputableValues)
			}

			res.send(returnData)
		} catch (e: any) {
			res.send({ error: e?.message || e })
			if (e instanceof Error && e.stack) console.error(e)
		}
	}
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

function setDescrStats(boxplot: BoxPlotData, sortedValues: number[]) {
	/** Return the total value for legend rendering */
	if (sortedValues.length < minSampleSize) return [{ id: 'total', label: 'Total', value: sortedValues.length }]
	//boxplot_getvalue() already returns calculated stats
	//Format data rather than recalculate
	const mean = getMean(sortedValues)
	const variance = getVariance(sortedValues)
	const sd = Math.sqrt(variance)

	return [
		{ id: 'total', label: 'Total', value: sortedValues.length },
		{ id: 'min', label: 'Minimum', value: roundValueAuto(sortedValues[0], true) },
		{ id: 'p25', label: '1st quartile', value: roundValueAuto(boxplot.p25, true) },
		{ id: 'median', label: 'Median', value: roundValueAuto(boxplot.p50, true) },
		{ id: 'mean', label: 'Mean', value: roundValueAuto(mean, true) },
		{ id: 'p75', label: '3rd quartile', value: roundValueAuto(boxplot.p75, true) },
		{ id: 'max', label: 'Maximum', value: roundValueAuto(sortedValues[sortedValues.length - 1], true) },
		{ id: 'sd', label: 'Standard deviation', value: isNaN(sd) ? null : roundValueAuto(sd, true) },
		{ id: 'variance', label: 'Variance', value: roundValueAuto(variance, true) },
		{ id: 'iqr', label: 'Inter-quartile range', value: roundValueAuto(boxplot.iqr, true) }
	]
}

/** Only return a simplified object for the legend data */
function setUncomputableValues(values: Record<string, number>) {
	if (Object.entries(values)?.length) {
		return Object.entries(values).map(([label, v]) => ({ label, value: v as number }))
	} else return null
}

/**********************************************************
 * Functions used in both box plot and violin plot routes *
 **********************************************************/

export function parseValues(q: any, data: ValidGetDataResponse, sampleType: string, isLog: boolean, overlayTerm?: any) {
	/** Map samples to terms */
	const key2values = new Map()
	/** Record uncomputable values not used for plot rendering
	 * but displayed in the legend */
	const uncomputableValues = {}

	/** Find the absolute min and max values to render
	 * the plot scale */
	let absMin: number | null = null,
		absMax: number | null = null

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

		if (overlayTerm) {
			if (!val[overlayTerm?.$id]) continue
			const value2 = val[overlayTerm.$id]

			if (overlayTerm.term?.values?.[value2.key]?.uncomputable) {
				/** Sample as above but for overlay term */
				const label = overlayTerm.term.values[value2?.key]?.label
				uncomputableValues[label] = (uncomputableValues[label] || 0) + 1
			}

			if (!key2values.has(value2.key)) key2values.set(value2.key, [])
			key2values.get(value2.key).push(value.value)
		} else {
			if (!key2values.has(sampleType)) key2values.set(sampleType, [])
			key2values.get(sampleType).push(value.value)
		}

		if (absMin === null || value.value < absMin) absMin = value.value
		if (absMax === null || value.value > absMax) absMax = value.value
	}

	return { absMax, absMin, key2values, uncomputableValues }
}

/** Return bins for filtering and list sample label menu options */
export function numericBins(overlayTerm: any, data: any) {
	const overlayBins = data.refs.byTermId[overlayTerm?.$id]?.bins ?? []
	return new Map(overlayBins.map(bin => [bin.label, bin]))
}
