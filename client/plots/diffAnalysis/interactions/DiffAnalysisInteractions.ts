import type { DiffAnalysisDom } from '../DiffAnalysisTypes'

export class DiffAnalysisInteractions {
	dom: DiffAnalysisDom
	constructor(dom) {
		this.dom = dom
	}

	clearDom() {
		this.dom.plot.selectAll('*').remove()
		this.dom.yAxisLabel.text('')
	}
}
