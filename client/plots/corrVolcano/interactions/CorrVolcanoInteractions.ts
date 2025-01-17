export class CorrVolcanoInteractions {
	app: any
	dom: any
	constructor(app, dom) {
		this.app = app
		this.dom = dom
	}

	clearDom() {
		this.dom.error.style('padding', '').text('')
		this.dom.svg.selectAll('*').remove()
		this.dom.title.text('')
	}
}
