/**
 * TODOs:
 * - add types
 * - add comments
 * - make this a super class. Based on the number of cells/points/etc., pick svg rendering in a different class or three js rendering
 */
export class Plot {
	div: any
	plotData: any

	constructor(plotData, div) {
		this.plotData = plotData
		this.div = div

		console.log(plotData)
	}
}
