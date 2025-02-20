import type { DiffAnalysisDom } from '../DiffAnalysisTypes'

export class DiffAnalysisInteractions {
	dom: DiffAnalysisDom
	constructor(dom: DiffAnalysisDom) {
		this.dom = dom
	}

	clearDom() {
		this.dom.div.selectAll('table').remove()
		this.dom.plot.selectAll('*').remove()
		this.dom.xAxis.selectAll('*').remove()
		this.dom.yAxisLabel.text('')
		this.dom.yAxis.selectAll('*').remove()
	}
}
