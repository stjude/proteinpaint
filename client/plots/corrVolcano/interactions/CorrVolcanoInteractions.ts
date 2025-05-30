import { to_svg } from '#src/client'
import { termType2label } from '#shared/terms.js'
import { appInit } from '#termdb/app'
import type { MassAppApi } from '#mass/types/mass'
import type { CorrVolcanoDom } from '../CorrelationVolcanoTypes'
import type { TermWrapper } from '#types'

export class CorrVolcanoInteractions {
	app: MassAppApi
	dom: CorrVolcanoDom
	id: string
	variableTwLst: TermWrapper[]
	constructor(app: MassAppApi, dom: CorrVolcanoDom, id: string) {
		this.app = app
		this.dom = dom
		this.id = id
		this.variableTwLst = []
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
		const term2 = this.variableTwLst?.find((t: any) => t.$id === item.tw$id)?.term
		if (!term2) throw `No term found for ${item.tw$id}`
		const scatterConfig = {
			chartType: 'sampleScatter',
			name: `${plot.featureTw.term.name} ${termType2label(plot.featureTw.term.type)} v ${term2.name}`,
			term: { term: plot.featureTw.term },
			term2: { id: term2.id },
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
