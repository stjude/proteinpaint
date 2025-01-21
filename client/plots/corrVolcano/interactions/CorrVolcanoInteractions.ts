export class CorrVolcanoInteractions {
	app: any
	dom: any
	constructor(app, dom) {
		this.app = app
		this.dom = dom
	}

	clearDom() {
		this.dom.error.style('padding', '').text('')
		this.dom.plot.selectAll('*').remove()
		this.dom.legend.selectAll('*').remove()
		this.dom.svg.selectAll('line').remove()
		this.dom.title.text('')
		this.dom.yAxisLabel.text('')
	}
}
