import { to_svg } from '#src/client'

export class CorrVolcanoInteractions {
	app: any
	dom: any
	id: string
	variableTwLst: any
	constructor(app, dom, id) {
		this.app = app
		this.dom = dom
		this.id = id
		//TODO: should be in the state somehow
		this.variableTwLst = []
	}

	setVars(app, id, variableTwLst) {
		/** This is a hack
		 * app and id are set after init and therefore not available
		 * until plot init completes. Need to fix. */
		this.app = app
		this.id = id
		this.variableTwLst = variableTwLst
	}

	download() {
		const svg = this.dom.svg.node() as Node
		to_svg(svg, `correlationVolcano`, { apply_dom_styles: true })
	}

	//When clicking on dot, launch the sample scatter by gene and drug
	launchSampleScatter(item) {
		const config = this.app.getState()
		const plot = config.plots.find(p => p.id === this.id)
		const term2 = this.variableTwLst.find((t: any) => t.$id === item.tw$id).term
		const scatterConfig = {
			chartType: 'sampleScatter',
			name: `${plot.featureTw.term.name} v ${term2.name}`,
			term: { term: plot.featureTw.term },
			term2,
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
