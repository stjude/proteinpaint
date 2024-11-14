export type LegendItemEntry = {
	label: string
	/** Total number of samples, cells, etc. */
	count?: number
	/** If true, line-through text */
	isHidden: boolean
	/** If true, indicates plot data available and enables callback. */
	isPlot?: boolean
	/** Value for stat */
	value?: number
}

export class LegendDataMapper {
	legendData: { label: string; items: LegendItemEntry[] }[] = []
	constructor(config, data) {
		const isTerm2 = config?.term2
		if (config.term.q?.descrStats) {
			this.legendData.push({
				label: `Descriptive Statistics${isTerm2 ? `: ${config.term.term.name}` : ''}`,
				items: config.term.q.descrStats
			})
		}
		if (isTerm2 && isTerm2.q?.descrStats) {
			this.legendData.push({
				label: `Descriptive Statistics: ${config.term2.term.name}`,
				items: isTerm2.q.descrStats
			})
		}
		const hiddenPlots =
			data.plots
				.filter(p => p.isHidden)
				?.map(p => {
					const total = p.descrStats.find(d => d.id === 'total')
					return { label: p.key, count: total!.value, isHidden: true, isPlot: true }
				}) || []
		if (config.term.term?.values) {
			const term1Label = config.term2 ? config.term.term.name : 'Other categories'
			const term1Data = this.setHiddenCategoryItems(config.term, term1Label, hiddenPlots, data.uncomputableValues || [])
			if (term1Data) this.legendData.push(term1Data)
		}

		if (config.term2?.term?.values) {
			//TODO: Only show items with plot data?
			const term2Data = this.setHiddenCategoryItems(
				config.term2,
				config.term2.term.name,
				hiddenPlots,
				data.uncomputableValues || []
			)
			if (term2Data) this.legendData.push(term2Data)
		}
	}

	setHiddenCategoryItems(
		tw: any,
		label: string,
		hiddenPlots: LegendItemEntry[],
		uncomputableValues?: { label: string; value: number }[]
	) {
		const termData: { label: string; items: LegendItemEntry[] } = { label, items: [] }

		if (hiddenPlots.length) {
			for (const key of Object.keys(tw.q.hiddenValues)) {
				const plot = hiddenPlots.find(p => p.label === key)
				if (plot) termData.items.push(plot)
			}
		}
		if (uncomputableValues && uncomputableValues.length) {
			for (const v of Object.values((tw.term.values || {}) as { label: string }[])) {
				const uncomputableItem = uncomputableValues.find(u => u.label === v.label)
				if (uncomputableItem) {
					termData.items.push({ label: uncomputableItem.label, count: uncomputableItem.value, isHidden: true })
				}
			}
		}
		return termData.items.length ? termData : null
	}
}
