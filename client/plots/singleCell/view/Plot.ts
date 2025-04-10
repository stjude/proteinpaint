import type { Elem } from '../../../types/d3'
import type { SingleCellFormattedPlotData } from '../SingleCellTypes'
/**
 * TODOs:
 * - add types
 * - add comments
 * - make this a super class. Based on the number of cells/points/etc., pick svg rendering in a different class or three js rendering
 */
export class Plot {
	div: Elem
	plotData: SingleCellFormattedPlotData

	constructor(plotData: SingleCellFormattedPlotData, div: Elem) {
		this.plotData = plotData
		this.div = div

		console.log(plotData)
	}
}
