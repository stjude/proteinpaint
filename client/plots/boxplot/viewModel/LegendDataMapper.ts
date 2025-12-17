import type { LegendData, LegendItemEntry, BoxPlotConfig } from '../BoxPlotTypes'
import type { BoxPlotChartEntry, DescrStats } from '#types'

/** Combines the overall .descrStats{} response with 1) the
 * uncomputable and/or hidden term values; and 2) any
 * previously hidden plots. Formats the result for the
 * View -> LegendRender. */
export class LegendDataMapper {
	legendData: LegendData = []
	config: BoxPlotConfig

	constructor(config: BoxPlotConfig) {
		this.config = config

		const isTerm2 = config?.term2
		const isTerm0 = config?.term0

		if (config.term.q?.descrStats) {
			this.legendData.push({
				label: `Descriptive Statistics${isTerm2 ? `: ${config.term.term.name}` : ''}`,
				items: this.setDescrStatItems(config.term.q.descrStats)
			})
		}
		if (isTerm2 && isTerm2.q?.descrStats && !isTerm0) {
			this.legendData.push({
				label: `Descriptive Statistics: ${config.term2.term.name}`,
				items: this.setDescrStatItems(isTerm2.q.descrStats)
			})
		}
	}

	map(charts: { [index: string]: BoxPlotChartEntry }, uncomputableValues: { label: string; value: number }[]) {
		const hiddenPlots = this.getHiddenPlots(charts)

		if (this.config.term.term?.values) {
			const term1Label = this.config.term2 ? this.config.term.term.name : 'Other categories'
			const term1Data = this.setHiddenCategoryItems(this.config.term, term1Label, hiddenPlots, uncomputableValues || [])
			if (term1Data) this.legendData.push(term1Data)
		}

		if (this.config.term2?.term?.values) {
			const term2Data = this.setHiddenCategoryItems(
				this.config.term2,
				this.config.term2.term.name,
				hiddenPlots,
				uncomputableValues || []
			)
			if (term2Data) this.legendData.push(term2Data)
		}

		return this.legendData
	}

	getHiddenPlots(charts: { [index: string]: BoxPlotChartEntry }) {
		const hiddenPlots = Object.values(charts)
			.reduce((plotMap: Map<string, any>, chart: any) => {
				for (const p of chart.plots ?? []) {
					if (!p.isHidden || plotMap.has(p.key)) continue

					plotMap.set(p.key, {
						key: p.key,
						text: p.key,
						isHidden: true,
						isPlot: true
					})
				}
				return plotMap
			}, new Map<string, any>())
			.values()
		return Array.from(hiddenPlots)
	}

	setDescrStatItems(stats: DescrStats) {
		return Object.values(stats).map(s => ({
			key: s.key,
			text: `${s.label}: ${s.value}`,
			isHidden: false,
			isPlot: false
		}))
	}

	setHiddenCategoryItems(
		tw: any,
		label: string,
		hiddenPlots: LegendItemEntry[],
		uncomputableValues?: { label: string; value: number }[]
	) {
		const termData: { label: string; items: LegendItemEntry[] } = { label, items: [] }

		if (hiddenPlots.length) {
			for (const key of Object.keys(tw.q.hiddenValues || {})) {
				const plot = hiddenPlots.find(p => p.key === key)
				if (plot) termData.items.push(plot)
			}
		}
		if (uncomputableValues && uncomputableValues.length) {
			for (const v of Object.values((tw.term.values || {}) as { label: string }[])) {
				const uncomputableItem = uncomputableValues.find(u => u.label === v.label)
				if (uncomputableItem) {
					termData.items.push({
						key: uncomputableItem.label,
						text: `${uncomputableItem.label}, n=${uncomputableItem.value}`,
						isHidden: true,
						isPlot: false
					})
				}
			}
		}
		return termData.items.length ? termData : null
	}
}
