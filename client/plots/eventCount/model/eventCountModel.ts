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
		let count = 0
		const sortedKeys = Array.from(groupedSamples.keys()).sort((a, b) => {
			const [yearA, monthA] = a.split('-').map(Number)
			const [yearB, monthB] = b.split('-').map(Number)
			if (yearA !== yearB) return yearA - yearB
			return monthA - monthB
		})
		const events: any[] = []
		for (const key of sortedKeys) {
			const [year, month] = key.split('-')
			const value = groupedSamples.get(key)
			count += value.samples.length

			for (const sample of value.samples) {
				sample.x = getNumberFromDate(new Date(year, month, 15))
				sample.y = this.scatter.settings.showAccrual ? count : value.samples.length
				events.push(sample.y)
			}
		}

		const colorLegend = new Map(data.colorLegend) as Map<string, ColorLegendItem>
		const shapeLegend = new Map(data.shapeLegend) as Map<string, ShapeLegendItem>
		this.charts.push({ id, data, cohortSamples: samples, colorLegend, shapeLegend, events })
	}
}
