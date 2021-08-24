import * as rx from '../common/rx.core'
import { Menu } from '../client'
import { termsettingInit } from '../common/termsetting'
import { getNormalRoot } from '../common/filter'
import { select, event } from 'd3-selection'

const defaults = {
	// holder: d3-selection, required option
}

// to assign chart ID to distinguish
// between chart instances
const idPrefix = '_AUTOID_' // to distinguish from user-assigned chart IDs
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

	getState(appState) {
		const activeCohort = appState.termdbConfig?.selectCohort?.values[appState.activeCohort]
		const cohortStr = activeCohort && activeCohort.keys.sort().join(',')

		const state = {
			vocab: appState.vocab,
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			config: appState.tree.plots[this.id],
			exclude_types: [...appState.tree.exclude_types],
			supportedChartTypes: appState.termdbConfig.supportedChartTypes?.[cohortStr] || ['barchart']
		}
		if (appState.termfilter && appState.termfilter.filter) {
			state.filter = getNormalRoot(appState.termfilter.filter)
		}
		return state
	}

	main(data) {
		this.dom.btns.style('display', d => (this.state.supportedChartTypes.includes(d.chartType) ? '' : 'none'))
	}

	setDom() {
		this.dom = {
			holder: this.opts.holder,
			tip: new Menu({ padding: '0px' })
		}

		const btnData = [
			{ label: 'Bar Chart', chartType: 'barchart' },
			{ label: 'Table', chartType: 'table' },
			{ label: 'Boxplot', chartType: 'boxplot' },
			{ label: 'Scatter Plot', chartType: 'scatter' },
			{ label: 'Cumulative Incidence', chartType: 'cuminc' },
			{ label: 'Survival', chartType: 'survival' },
			{ label: 'Regression Analysis', chartType: 'regression' }
		]
		const self = this

		this.dom.btns = this.dom.holder
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
	self.showMenu = function(chartType, btn) {
		const appState = this.app.getState()
		if (appState.termdbConfig.selectCohort) {
			self.activeCohort = appState.activeCohort
		}

		self.dom.tip.clear().showunder(btn)

		const termSequence = getTermSelectionSequence(chartType)
		if (termSequence.length == 1) {
			const action = { type: 'plot_show', chartType, id: idPrefix + id++ }
			self.showTree(chartType, termSequence, action)
		} else {
			self.app.dispatch({
				type: 'plot_prep',
				chartType,
				id: idPrefix + id++,
				termSequence
			})
		} //self.showMultipart(usecase, dom, termSequence, action)
	}

	self.showTree = async function(chartType, termSequence, action) {
		self.dom.tip.d.selectAll('*').remove()
		const curr = termSequence.shift()
		const usecase = { target: chartType, detail: curr.detail }
		if (curr.label) {
			self.dom.tip.d
				.append('div')
				.style('margin', '3px 5px')
				.style('padding', '3px 5px')
				.style('font-weight', 600)
				.html(curr.label)
		}

		const termdb = await import('../termdb/app')
		termdb.appInit(null, {
			holder: self.dom.tip.d.append('div'),
			state: {
				vocab: self.opts.vocab,
				activeCohort: 'activeCohort' in self ? self.activeCohort : -1,
				nav: {
					header_mode: 'search_only'
				},
				tree: { usecase }
			},
			tree: {
				click_term: term => {
					action[usecase.detail] = term
					self.dom.tip.hide()
					self.app.dispatch(action)
				}
			}
		})
	}
}

// term selection sequence by chart type or use default
export function getTermSelectionSequence(chartType) {
	if (chartType == 'regression') {
		return [
			{ label: 'Outcome variable', prompt: 'Select outcome variable', detail: 'term', limit: 1 },
			{ label: 'Independent variable(s)', prompt: 'Add independent variable', detail: 'independent', limit: 10 }
		]
	} else {
		return [{ label: '', detail: 'term', limit: 1 }]
	}
}
