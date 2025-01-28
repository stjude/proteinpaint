import type { TermWrapper } from '#types'
import { to_svg } from '#src/client'
import { getReadableType } from '#shared/terms.js'
import { appInit } from '#termdb/app'

//TODO - finish typing this file
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

	setVars(app: any, id: string, variableTwLst: TermWrapper[]) {
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

	//If no featureTw is set, show the tree to select a feature
	async showTree() {
		this.dom.div.selectAll('*').remove()
		await appInit({
			vocabApi: this.app.vocabApi,
			holder: this.dom.div,
			state: this.app.getState(),
			tree: {
				click_term: _term => {
					const term = _term.term || _term
					this.app.dispatch({
						type: 'plot_create',
						config: {
							chartType: 'correlationVolcano',
							featureTw: _term.term ? _term : { term }
						}
					})

					this.app.dispatch({
						type: 'plot_delete',
						id: this.id
					})
				}
			}
		})
	}

	//When clicking on dot, launch the sample scatter by gene and drug
	launchSampleScatter(item: any) {
		const config = this.app.getState()
		const plot = config.plots.find(p => p.id === this.id)
		const term2 = this.variableTwLst.find((t: any) => t.$id === item.tw$id).term
		const scatterConfig = {
			chartType: 'sampleScatter',
			name: `${plot.featureTw.term.name} ${getReadableType(plot.featureTw.term.type)} v ${term2.name}`,
			term: { term: plot.featureTw.term },
			term2,
			filter: config.termfilter.filter
		}
		this.app.dispatch({
			type: 'plot_create',
			config: scatterConfig
		})
	}

	//Obj is returned from LegendCircleReference callback
	async changeRadius(obj: { min: number; max: number }) {
		this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config: {
				settings: {
					correlationVolcano: {
						radiusMax: obj.max,
						radiusMin: obj.min
					}
				}
			}
		})
	}

	clearDom() {
		this.dom.error.style('padding', '').text('')
		this.dom.plot.selectAll('*').remove()
		this.dom.legend.selectAll('*').remove()
		this.dom.svg.selectAll('line').remove()
		this.dom.title.text('')
		this.dom.yAxisLabel.text('')
		this.dom.xAxisLabel.text('')
	}
}
