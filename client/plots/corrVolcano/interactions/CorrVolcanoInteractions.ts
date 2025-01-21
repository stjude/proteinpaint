export class CorrVolcanoInteractions {
	app: any
	dom: any
	id: string
	variableTwLst: any
	constructor(app, dom, id, variableTwLst) {
		this.app = app
		this.dom = dom
		this.id = id
		//TODO: should be in the state somehow
		this.variableTwLst = variableTwLst
	}

	//When clicking on dot, launch the sample scatter by gene and drug
	launchSampleScatter(item) {
		const config = this.app.getState()
		const plot = config.plots.find(p => p.id === this.id)
		const scatterConfig = {
			chartType: 'sampleScatter',
			name: 'Sample Scatter',
			term: { term: plot.featureTw.term },
			term2: this.variableTwLst.find((t: any) => t.$id === item.tw$id).term,
			filter: config.termfilter.filter
		}
		this.app.dispatch({
			type: 'plot_create',
			config: scatterConfig
		})
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
