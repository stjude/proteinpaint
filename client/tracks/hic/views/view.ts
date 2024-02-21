import { getCompInit } from '#rx'
import { Div, Elem } from '../../../types/d3'
import { MainPlotDiv } from '../../../types/hic.ts'

/**
 * Super class for all views
 */
class HicView {
	// dom: {
	// 	plotDiv: MainPlotDiv
	// }
	type: 'view'
	store: any

	constructor(opts) {
		// this.dom.plotDiv = opts.dom.plotDiv.append('table').classed('sjpp-hic-plot-main', true)
		// const tr1 = this.dom.plotDiv.append('tr')
		// const tr2 = this.dom.plotDiv.append('tr')
		// this.dom.plotDiv = {
		// 	plot: tr1.append('td').classed('sjpp-hic-plot', true),
		// 	yAxis: tr1.append('td').classed('sjpp-hic-plot-xaxis', true),
		// 	xAxis: tr2.append('td').classed('sjpp-hic-plot-yaxis', true),
		// 	blank: tr2.append('td')
		// } as MainPlotDiv
		this.type = 'view'
	}

	getAppState() {
		return this.store.getState()
	}

	colorizeElement() {
		//Transfer colorizeElement here
	}

	main() {
		console.log('HicView launched')
	}
}

export const hicViewInit = getCompInit(HicView)
