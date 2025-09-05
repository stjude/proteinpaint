import type { FormattedPlotEntry, LegendData, LegendItemEntry, BoxPlotConfig } from '../BoxPlotTypes'
import type { BoxPlotResponse } from '#types'

export class LegendDataMapper {
	legendData: LegendData = []
	constructor(config: BoxPlotConfig, data: BoxPlotResponse, plots: FormattedPlotEntry[]) {
		const isTerm2 = config?.term2
		if (config.term.q?.descrStats) {
			this.legendData.push({
				label: `Descriptive Statistics${isTerm2 ? `: ${config.term.term.name}` : ''}`,
				items: this.setDescrStatArr(config.term.q.descrStats)
			})
		}
		if (isTerm2 && isTerm2.q?.descrStats) {
			this.legendData.push({
				label: `Descriptive Statistics: ${config.term2.term.name}`,
				items: this.setDescrStatArr(isTerm2.q.descrStats)
			})
		}
		const hiddenPlots =
			plots
				.filter(p => p.isHidden)
				?.map(p => {
					const total = p.descrStats.find(d => d.id === 'total')
					if (!total || !total.value) throw `Missing total value for ${p.key}`
					return { key: p.key, text: p.key, n: total.value, isHidden: true, isPlot: true }
				}) || []
		if (config.term.term?.values) {
			const term1Label = config.term2 ? config.term.term.name : 'Other categories'
			const term1Data = this.setHiddenCategoryItems(config.term, term1Label, hiddenPlots, data.uncomputableValues || [])
			if (term1Data) this.legendData.push(term1Data)
		}

		if (config.term2?.term?.values) {
			const term2Data = this.setHiddenCategoryItems(
				config.term2,
				config.term2.term.name,
				hiddenPlots,
				data.uncomputableValues || []
			)
			if (term2Data) this.legendData.push(term2Data)
		}
	}

	setDescrStatArr(statsArr: { id: string; label: string; value: number }[]) {
		return statsArr.map(s => ({ key: s.id, text: `${s.label}: ${s.value}`, isHidden: false, isPlot: false }))
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
