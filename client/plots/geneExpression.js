import { getCompInit, copyMerge } from '#rx'
import { dofetch3 } from '#common/dofetch'

class geneExpression {
	constructor() {
		this.type = 'geneExpression'
	}
	async init(opts) {
		const holder = this.opts.holder.append('div')
		this.dom = {
			holder,
			controlsDiv: holder.append('div')
		}
		this.components = {}
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found`
		}
		return {
			config
		}
	}

	async main() {
		const body = this.getParam()
		const data = await dofetch3('mds3', { body })
		console.log(data)
	}

	getParam() {
		const body = {
			genome: this.app.opts.state.vocab.genome,
			dslabel: this.app.opts.state.vocab.dslabel,
			geneExpression: 1,
			genes: this.state.config.genes
		}
		return body
	}
}

export async function getPlotConfig(opts, app) {
	try {
		const config = {}

		return copyMerge(config, opts)
	} catch (e) {
		throw `${e} [geneExpression getPlotConfig()]`
	}
}

export const geneExpressionInit = getCompInit(geneExpression)
// this alias will allow abstracted dynamic imports
export const componentInit = geneExpressionInit

export function makeChartBtnMenu(holder, chartsInstance) {
	/*
	holder: the holder in the tooltip
	chartsInstance: MassCharts instance
        termdbConfig is accessible at chartsInstance.state.termdbConfig{}
        mass option is accessible at chartsInstance.app.opts{}
	*/

	// to fill in menu, create options in holder
	/*
	holder.append('div')
		.attr('class','sja_menuoption sja_sharp_border')
		.text('Single gene expression')
		.on('click',()=>{
			chartsInstance.dom.tip.hide()
			
		})
		*/

	holder
		.append('div')
		.attr('class', 'sja_menuoption sja_sharp_border')
		.text('Clustering analysis')
		.on('click', () => {
			chartsInstance.dom.tip.hide()
			chartsInstance.prepPlot({
				config: {
					chartType: 'geneExpression'
				}
			})
		})
}
