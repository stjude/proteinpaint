import type { SingleCellDataPlotsResponse } from '#types'
import { getColors } from '#shared/common.js'
import { scaleLinear } from 'd3-scale'
import type {
	SingleCellConfig,
	SingleCellSettings,
	SingleCellViewData,
	SingleCellFormattedPlotData
} from '../SingleCellTypes'

/**
 * TODOs:
 * - add comments
 * - add unit tests
 */
export class ViewModel {
	config: SingleCellConfig
	data: SingleCellDataPlotsResponse
	settings: SingleCellSettings
	viewData: SingleCellViewData

	constructor(config: SingleCellConfig, settings: SingleCellSettings, data: SingleCellDataPlotsResponse) {
		this.config = config
		this.data = data
		this.settings = settings

		this.viewData = {
			plotsData: this.setPlotsData(),
			//May not be needed
			actions: this.setActionData()
		}
	}

	setPlotsData() {
		const data: SingleCellFormattedPlotData[] = []
		for (const plotRes of this.data.plots) {
			const plotData = plotRes as SingleCellFormattedPlotData
			const expCells = (plotRes.expCells || []).sort((a: any, b: any) => a.geneExp - b.geneExp)
			plotData.cells = [...(plotRes.noExpCells || []), ...expCells]
			//Do not include plots with no data
			if (!plotData.cells.length) return []

			plotData.id = plotRes.name.replace(/\s+/g, '')
			const clusters: Set<string> = new Set(plotData.cells.map(c => c.category))
			plotData.clusters = Array.from(clusters).sort((a: string, b: string) => {
				const num1 = parseInt(a.split(' ')[1])
				const num2 = parseInt(b.split(' ')[1])
				return num1 - num2
			})

			const cat2Color = getColors(plotData.clusters.length + 2) //Helps to use the same color scheme in different samples
			plotData.colorMap = {}
			for (const cluster of plotData.clusters)
				plotData.colorMap[cluster] = plotData.colorMap?.[cluster] ? plotData.colorMap[cluster] : cat2Color(cluster)

			//Plot dimensions
			const s0 = plotData.cells[0]
			const [xMin, xMax, yMin, yMax] = plotData.cells.reduce(
				(s, d) => [d.x < s[0] ? d.x : s[0], d.x > s[1] ? d.x : s[1], d.y < s[2] ? d.y : s[2], d.y > s[3] ? d.y : s[3]],
				[s0.x, s0.x, s0.y, s0.y]
			)
			plotData.xScale = scaleLinear().domain([xMin, xMax]).range([-1, 1])
			plotData.yScale = scaleLinear().domain([yMin, yMax]).range([-1, 1])

			data.push(plotData)
		}
		return data
	}

	setActionData() {
		const opts: any = {}
		if (!this.config.plots.length) return opts
		opts.plots = this.config.plots.map(p => {
			return { name: p.name, selected: p.selected }
		})
		return opts
	}
}
