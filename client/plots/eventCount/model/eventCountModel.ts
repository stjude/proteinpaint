import { RunchartModel } from '#plots/runchart/model/runchartModel.ts'
import { getDateFromNumber, getNumberFromDate } from '#shared/terms.js'
import type { ColorLegendItem, ShapeLegendItem } from '#plots/scatter/scatterTypes.ts'

export class EventCountModel extends RunchartModel {
	createChart(id, data) {
		const samples = data.samples
		const groupedSamples = new Map()
		for (const sample of samples) {
			const date = new Date(getDateFromNumber(sample.x))
			const year = date.getFullYear()
			const month = date.getMonth() + 1
			const key = `${year}-${month}`
			if (!groupedSamples.has(key)) groupedSamples.set(key, { samples: [sample] })
			else {
				const value = groupedSamples.get(key)
				value.samples.push(sample)
			}
		}
		for (const [key, value] of groupedSamples.entries()) {
			const [year, month] = key.split('-')
			for (const sample of value.samples) {
				sample.x = getNumberFromDate(new Date(year, month, 15))
				sample.y = value.samples.length
			}
		}

		const colorLegend = new Map(data.colorLegend) as Map<string, ColorLegendItem>
		const shapeLegend = new Map(data.shapeLegend) as Map<string, ShapeLegendItem>
		this.charts.push({ id, data, cohortSamples: samples, colorLegend, shapeLegend })
	}
}
