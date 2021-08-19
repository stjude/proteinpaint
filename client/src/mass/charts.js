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
				self.showMenu(d.chartType, this)
			})
	}
}

export const chartsInit = rx.getInitFxn(MassCharts)

function setRenderers(self) {
	// term selection sequence by chart type
	// if not defined here, will just default to
	function getTermSelectionSequence(chartType) {
		if (chartType == 'regression') {
			return [
				{ label: 'Outcome variable', detail: 'term', limit: 1 },
				{ label: 'Independent variable(s)', detail: 'independent', limit: 10 }
			]
		} else {
			return [{ label: '', detail: 'term', limit: 1 }]
		}
	}

	self.showMenu = function(chartType, btn) {
		const appState = this.app.getState()
		if (appState.termdbConfig.selectCohort) {
			self.activeCohort = appState.activeCohort
		}

		self.dom.tip.clear().showunder(btn)
		const dom = {
			head: self.dom.tip.d.append('div'),
			body: self.dom.tip.d.append('div'),
			foot: self.dom.tip.d.append('div')
		}
		const usecase = { target: chartType }
		const termSequence = getTermSelectionSequence(chartType)
		const action = { type: 'plot_show', chartType, id: id++ }
		const disable_terms = []
		self.showTree(usecase, dom, termSequence, action, disable_terms)
	}

	self.showTree = async function(usecase, dom, termSequence, action, disable_terms) {
		const curr = termSequence.shift()
		usecase.detail = curr.detail

		if (curr.label) {
			dom.head
				.append('div')
				.style('margin', '3px 5px')
				.style('padding', '3px 5px')
				.style('font-weight', 600)
				.html(curr.label)
		}
		dom.body.selectAll('*').remove()

		const termdb = await import('../termdb/app')
		termdb.appInit(null, {
			holder: dom.body,
			state: {
				vocab: self.opts.vocab,
				activeCohort: 'activeCohort' in self ? self.activeCohort : -1,
				nav: {
					header_mode: 'search_only'
				},
				tree: { usecase }
			},
			tree: {
				disable_terms,
				click_term: term => {
					if (curr.limit === 1) action[usecase.detail] = term
					else {
						if (!action[usecase.detail]) action[usecase.detail] = []
						action[usecase.detail].push(term)
					}

					if (termSequence.length) {
						disable_terms.push(term.id)
						dom.head
							.append('div')
							.style('margin', '3px 15px')
							.style('padding', '3px 5px')
							.html(term.name)
						self.showTree(usecase, dom, termSequence, action)
					} else {
						self.dom.tip.hide()
						self.app.dispatch(action)
					}
				}
			}
		})
	}
}
