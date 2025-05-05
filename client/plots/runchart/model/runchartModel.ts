import { ScatterModel } from '../../scatter/model/scatterModel'
import { median } from 'd3-array'
import { getDateFromNumber } from '#shared/terms.js'
import type { ColorLegendItem, ShapeLegendItem } from '#plots/scatter/scatterTypes.ts'

export class RunchartModel extends ScatterModel {
	createChart(id, data) {
		const aggregate = this.scatter.settings.aggregateData
		const samples = data.samples
		if (aggregate !== 'None') {
			const groupedSamples = new Map()
			for (const sample of samples) {
				const date = new Date(getDateFromNumber(sample.x))
				const year = date.getFullYear()
				const month = date.getMonth() + 1
				const key = `${year}-${month}`
				if (!groupedSamples.has(key)) groupedSamples.set(key, { ysum: sample.y, xsum: sample.x, samples: [sample] })
				else {
					const value = groupedSamples.get(key)
					groupedSamples.set(key, {
						ysum: value.ysum + sample.y,
						xsum: value.xsum + sample.x,
						samples: [...value.samples, sample]
					})
				}
			}
			for (const value of groupedSamples.values()) {
				let x, y
				if (aggregate == 'Median') {
					x = median(value.samples.map(d => d.x))
					y = median(value.samples.map(d => d.y))
				} else if (aggregate == 'Mean') {
					y = value.ysum / value.samples.length
					x = value.xsum / value.samples.length
				}
				for (const sample of value.samples) {
					sample.x = x //grouped samples by month and year
					sample.y = y //grouped samples by month and year
				}
			}
		}
		const colorLegend = new Map(data.colorLegend) as Map<string, ColorLegendItem>
		const shapeLegend = new Map(data.shapeLegend) as Map<string, ShapeLegendItem>
		this.charts.push({ id, data, cohortSamples: samples, colorLegend, shapeLegend })
	}
}
