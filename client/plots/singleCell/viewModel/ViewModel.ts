import { getColors } from '#shared/common.js'

/**
 * TODOs:
 * - add types (import from #types??)
 * - add comments
 * - add unit tests
 */
export class ViewModel {
	config: any
	data: any
	viewData: any

	constructor(config: any, data: any) {
		this.config = config
		this.data = data

		this.viewData = {
			plotsData: this.setPlotsData(),
			//May not be needed
			actions: this.setActionData()
		}
	}

	setPlotsData() {
		const data: any = []
		for (const plotRes of this.data.plots) {
			const plotData = plotRes
			const expCells = plotRes.expCells.sort((a, b) => a.geneExp - b.geneExp)
			plotData.cells = [...plotRes.noExpCells, ...expCells]
			plotData.id = plotRes.name.replace(/\s+/g, '')
			const clusters: Set<string> = new Set(plotRes.cells.map(c => c.category))
			plotData.clusters = Array.from(clusters).sort((a: string, b: string) => {
				const num1 = parseInt(a.split(' ')[1])
				const num2 = parseInt(b.split(' ')[1])
				return num1 - num2
			})

			const cat2Color = getColors(plotRes.clusters.length + 2) //Helps to use the same color scheme in different samples
			plotData.colorMap = {}
			for (const cluster of plotData.clusters)
				plotData.colorMap[cluster] = plotData.colorMap?.[cluster] ? plotData.colorMap[cluster] : cat2Color(cluster)

			data.push(plotData)
		}
		return data
	}

	setActionData() {
		const opts: any = {}
		if (this.config.plots.length) {
			opts.plots = this.config.plots.map(p => {
				return { name: p.name, selected: p.selected }
			})
		}

		return opts
	}
}
