import type { BoxPlotRequest, BoxPlotResponse, RouteApi, ValidGetDataResponse, DescrStats } from '#types'
import type { ReqQueryAddons } from './types.ts'
import { boxplotPayload } from '#types/checkers'
import { getData } from '../src/termdb.matrix.js'
import { boxplot_getvalue } from '../src/utils.js'
import { sortPlot2Values } from './termdb.violin.ts'
import { getDescrStats, getStdDev, getMean } from './termdb.descrstats.ts'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { roundValueAuto } from '#shared/roundValue.js'
import { isNumericTerm } from '@sjcrh/proteinpaint-shared'

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
		const q: BoxPlotRequest & ReqQueryAddons = req.query
		const genome = genomes[q.genome]
		if (!genome) throw new Error('invalid genome name')
		const ds = genome.datasets?.[q.dslabel]
		if (!ds) throw new Error('invalid ds')
		const terms = [q.tw]
		if (q.overlayTw) terms.push(q.overlayTw)
		if (q.divideTw) terms.push(q.divideTw)

		try {
			const data = await getData(
				{ filter: q.filter, filter0: q.filter0, terms, __protected__: q.__protected__, __abortSignal: q.__abortSignal },
				ds
			)
			if (data.error) throw new Error(data.error)

			const { absMin, absMax, bins, charts, uncomputableValues, descrStats, outlierMin, outlierMax } =
				await processData(data, q)

			const returnData: BoxPlotResponse = {
				absMin: q.removeOutliers ? outlierMin : absMin,
				absMax: q.removeOutliers ? outlierMax : absMax,
				bins,
				charts,
				uncomputableValues: setUncomputableValues(uncomputableValues),
				descrStats
			}

			res.send(returnData)
		} catch (e: any) {
			res.send({ error: e?.message || e })
			if (e instanceof Error && e.stack) console.error(e)
		}
	}
}

/** Process the returned data from getData() for entire box plot chart.*/
async function processData(data, q) {
	const samples = Object.values(data.samples)
	const values = samples
		.map(s => s?.[q.tw.$id!]?.value)
		.filter(v => typeof v === 'number' && !q.tw.term.values?.[v]?.uncomputable)
	//calculate stats here and pass them to client to avoid second request on client for getting stats
	const descrStats: DescrStats = getDescrStats(values, q.removeOutliers)

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

	if (q.showAssocTests && overlayTw) await getWilcoxonData(charts)
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
	descrStats: DescrStats,
	q: BoxPlotRequest,
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
	if (!boxplot) throw new Error('boxplot_getvalue failed [termdb.boxplot init()]')
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

async function getWilcoxonData(charts: { [chartId: string]: any }) {
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
