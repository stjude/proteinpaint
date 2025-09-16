import type { BoxPlotRequest, BoxPlotResponse, RouteApi, ValidGetDataResponse } from '#types'
import { boxplotPayload } from '#types/checkers'
import { getData } from '../src/termdb.matrix.js'
import { boxplot_getvalue } from '../src/utils.js'
import { sortPlot2Values } from './termdb.violin.ts'
import { summaryStats, getDescriptiveStats, summaryStatsFromStats } from '#shared/descriptive.stats.js'

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
			if (q.divideTw) terms.push(q.divideTw)
			const data = await getData({ filter: q.filter, filter0: q.filter0, terms, __protected__: q.__protected__ }, ds)
			if (data.error) throw data.error
			const samples = Object.values(data.samples)
			const values = samples.map(s => s[q.tw.$id!]?.value).filter(v => typeof v === 'number')
			//calculate stats here and pass them to client to avoid second request on client for getting stats
			const statsAllSummary = summaryStats(values).values

			const sampleType = `All ${data.sampleType?.plural_name || 'samples'}`
			const overlayTerm = q.overlayTw
			const divideTerm = q.divideTw
			const { absMin, absMax, chart2plot2values, uncomputableValues } = parseValues(
				q,
				data as ValidGetDataResponse,
				sampleType,
				q.isLogScale,
				overlayTerm,
				divideTerm
			)

			if (!absMin && absMin !== 0) throw 'absMin is undefined [termdb.boxplot init()]'
			if (!absMax && absMax !== 0) throw 'absMax is undefined [termdb.boxplot init()]'
			const charts: any = {}
			let outlierMin = Number.POSITIVE_INFINITY,
				outlierMax = Number.NEGATIVE_INFINITY
			for (const [chart, plot2values] of chart2plot2values) {
				const plots: any = []
				for (const [key, values] of sortPlot2Values(data as ValidGetDataResponse, plot2values, overlayTerm)) {
					const sortedValues = values.sort((a, b) => a - b)

					const vs = sortedValues.map((v: number) => {
						const value = { value: v }
						return value
					})
					const stats = getDescriptiveStats(sortedValues)
					if (q.removeOutliers) {
						outlierMin = Math.min(outlierMin, stats.outlierMin)
						outlierMax = Math.max(outlierMax, stats.outlierMax)
					}
					const descrStats = summaryStatsFromStats(stats, true).values

					const boxplot = boxplot_getvalue(vs, q.removeOutliers)
					if (!boxplot) throw 'boxplot_getvalue failed [termdb.boxplot init()]'
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

				if (q.tw.term?.values) setHiddenPlots(q.tw, plots)
				if (overlayTerm && overlayTerm.term?.values) setHiddenPlots(overlayTerm, plots)

				if (q.orderByMedian == true) {
					plots.sort((a, b) => a.boxplot.p50 - b.boxplot.p50)
				}

				charts[chart] = { chartId: chart, plots }
			}

			const returnData: BoxPlotResponse = {
				absMin: q.removeOutliers ? outlierMin : absMin,
				absMax: q.removeOutliers ? outlierMax : absMax,
				charts,
				uncomputableValues: setUncomputableValues(uncomputableValues),
				descrStats: statsAllSummary
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

/** Only return a simplified object for the legend data */
function setUncomputableValues(values: Record<string, number>) {
	if (Object.entries(values)?.length) {
		return Object.entries(values).map(([label, v]) => ({ label, value: v as number }))
	} else return null
}

/**********************************************************
 * Functions used in both box plot and violin plot routes *
 **********************************************************/

export function parseValues(
	q: any,
	data: ValidGetDataResponse,
	sampleType: string,
	isLog: boolean,
	overlayTerm?: any,
	divideTerm?: any
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
		if (divideTerm) {
			if (!val[divideTerm?.$id]) continue
			const value0 = val[divideTerm.$id]
			if (divideTerm.term?.values?.[value0.key]?.uncomputable) {
				/** same as above but for divide term */
				const label = divideTerm.term.values[value0?.key]?.label
				uncomputableValues[label] = (uncomputableValues[label] || 0) + 1
			}
			chart = value0.key
		}
		if (overlayTerm) {
			if (!val[overlayTerm?.$id]) continue
			const value2 = val[overlayTerm.$id]
			if (overlayTerm.term?.values?.[value2.key]?.uncomputable) {
				/** same as above but for overlay term */
				const label = overlayTerm.term.values[value2?.key]?.label
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
export function numericBins(overlayTerm: any, data: any) {
	const overlayBins = data.refs.byTermId[overlayTerm?.$id]?.bins ?? []
	return new Map(overlayBins.map(bin => [bin.label, bin]))
}
