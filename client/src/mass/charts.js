import * as rx from '../common/rx.core'
import { Menu } from '../client'

const defaults = {
	// holder: d3-selection, required option
}

// to assign chart ID to distinguish
// between chart instances
let id = 0

class MassCharts {
	constructor(app, opts = {}) {
		this.type = 'charts'
		this.api = rx.getComponentApi(this)
		this.app = app
		this.opts = Object.assign({}, defaults, opts)

		this.setDom()
		setRenderers(this)
	}

	getState(appState) {}

	main(data) {}

	setDom() {
		this.dom = {
			holder: this.opts.holder,
			tip: new Menu({ padding: '0px' })
		}

		const btnData = [
			{ label: 'Bar Chart', chartType: 'barchart' },
			//{ label: 'Table', chartType: 'table' },
			//{ label: 'Boxplot', chartType: 'boxplot' },
			//{ label: 'Scatter Plot', chartType: 'scatter' },
			{ label: 'Cumulative Incidence', chartType: 'cuminc' },
			{ label: 'Survival', chartType: 'survival' },
			{ label: 'Regression Analysis', chartType: 'regression' }
		]
		const self = this

		const btns = this.dom.holder
			.selectAll('button')
			.data(btnData)
			.enter()
			.append('button')
			.style('margin', '5px')
			.style('padding', '5px')
			.html(d => d.label)
			.on('click', function(d) {
				self.setTreeMenu(d.chartType, this)
			})
	}
}

export const chartsInit = rx.getInitFxn(MassCharts)

function setRenderers(self) {
	self.setTreeMenu = async function(chartType, btn) {
		const appState = this.app.getState()
		if (appState.termdbConfig.selectCohort) {
			self.activeCohort = appState.activeCohort
		}

		const termdb = await import('../termdb/app')
		self.dom.tip.clear().showunder(btn)
		termdb.appInit(null, {
			holder: self.dom.tip.d,
			state: {
				vocab: self.opts.vocab,
				activeCohort: 'activeCohort' in self ? self.activeCohort : -1,
				nav: {
					header_mode: 'search_only'
				},
				tree: {
					usecase: { target: chartType, detail: 'term1' }
				}
			},
			tree: {
				// disable_terms: self.disable_terms,
				click_term: term => {
					self.dom.tip.hide()
					self.app.dispatch({ type: 'plot_show', chartType, id: id++, term })
				}
			}
		})
	}
}
