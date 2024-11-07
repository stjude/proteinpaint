import type { BoxPlotRequest, BoxPlotResponse, BoxPlotData, RouteApi } from '#types'
import { boxplotPayload } from '#types'
import { getData } from '../src/termdb.matrix.js'
import { boxplot_getvalue } from '../src/utils.js'
import { sortKey2values } from '../src/termdb.violin.js'
import { roundValue } from '../../shared/utils/src/roundValue.js'

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
			if (q.divideTw) terms.push(q.divideTw)
			const data = await getData(
				{
					filter: q.filter,
					filter0: q.filter0,
					terms
				},
				ds,
				genome
			)
			if (data.error) throw data.error

			const sampleType = `All ${data.sampleType?.plural_name || 'samples'}`
			const key2values = new Map()
			const overlayTerm = q.divideTw
			for (const val of Object.values(data.samples as Record<string, { key: number; value: number }>)) {
				const value = val[q.tw.$id]
				if (!Number.isFinite(value?.value)) continue

				//skip these
				if (q.tw.term.values?.[value.value]?.uncomputable) continue

				if (overlayTerm) {
					if (!val[overlayTerm?.$id]) continue
					const value2 = val[overlayTerm.$id]

					//skip these
					if (overlayTerm.term?.values?.[value2.key]?.uncomputable) continue

					if (!key2values.has(value2.key)) key2values.set(value2.key, [])
					key2values.get(value2.key).push(value.value)
				} else {
					if (!key2values.has(sampleType)) key2values.set(sampleType, [])
					key2values.get(sampleType).push(value.value)
				}
			}

			const plots: any = []
			let absMin, absMax, maxLabelLgth
			for (const [key, values] of sortKey2values(data, key2values, overlayTerm)) {
				const sortedValues = values.sort((a, b) => a - b)

				if (absMin === null || absMin === undefined || sortedValues[0] < absMin) absMin = sortedValues[0]
				if (absMax === null || absMax === undefined || sortedValues[sortedValues.length - 1] > absMax)
					absMax = sortedValues[sortedValues.length - 1]

				const vs = sortedValues.map((v: number) => {
					const value = { value: v }
					return value
				})

				const boxplot = boxplot_getvalue(vs)
				if (!boxplot) throw 'boxplot_getvalue failed [termdb.boxplot init()]'
				const descrStats = setDescrStats(boxplot as BoxPlotData, sortedValues)
				const _plot = {
					// values,
					boxplot,
					descrStats
				}

				//Set rendering properties for the plot
				if (overlayTerm) {
					let label = overlayTerm?.term?.values?.[key]?.label || key
					label = `${label}, n=${values.length}`
					if (!maxLabelLgth || label.length > maxLabelLgth) maxLabelLgth = label.length
					const plot = Object.assign(_plot, {
						seriesId: key,
						color: overlayTerm?.term?.values?.[key]?.color || null
					})
					plot.boxplot.label = label
					plots.push(plot)
				} else {
					const label = `${sampleType}, n=${values.length}`
					if (!maxLabelLgth || label.length > maxLabelLgth.length) maxLabelLgth = label.length
					_plot.boxplot.label = label
					plots.push(_plot)
				}
			}

			const returnData: BoxPlotResponse = {
				absMin,
				absMax,
				maxLabelLgth,
				plots
			}
			res.send(returnData)
		} catch (e: any) {
			res.send({ error: e?.message || e })
			if (e instanceof Error && e.stack) console.error(e)
		}
	}
}

function setDescrStats(boxplot: BoxPlotData, sortedValues: number[]) {
	//boxplot_getvalue() already returns calculated stats
	//Format data rather than calculate again
	const mean = sortedValues.reduce((s, i) => s + i, 0) / sortedValues.length
	let s = 0
	for (const v of sortedValues) {
		s += Math.pow(v - mean, 2)
	}
	const sd = Math.sqrt(s / (sortedValues.length - 1))
	const squareDiffs = sortedValues.map(x => (x - mean) ** 2).reduce((a, b) => a + b, 0)
	const variance = squareDiffs / (sortedValues.length - 1)
	return [
		{ id: 'total', label: 'Total', value: sortedValues.length },
		{ id: 'min', label: 'Minimum', value: roundValue(sortedValues[0], 2) },
		{ id: 'p25', label: '1st quartile', value: roundValue(boxplot.p25, 2) },
		{ id: 'median', label: 'Median', value: roundValue(boxplot.p50, 2) },
		{ id: 'mean', label: 'Mean', value: roundValue(mean, 2) },
		{ id: 'p75', label: '3rd quartile', value: roundValue(boxplot.p75, 2) },
		{ id: 'max', label: 'Maximum', value: roundValue(sortedValues[sortedValues.length - 1], 2) },
		{ id: 'sd', label: 'Standard deviation', value: isNaN(sd) ? null : roundValue(sd, 2) },
		{ id: 'variance', label: 'Variance', value: roundValue(variance, 2) },
		{ id: 'iqr', label: 'Inter-quartile range', value: roundValue(boxplot.iqr, 2) }
	]
}
