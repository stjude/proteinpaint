import { getCompInit } from '../common/rx.core'
import { Menu } from '../client'
import { getNormalRoot } from '../common/filter'
import { select, event } from 'd3-selection'

// to assign chart ID to distinguish
// between chart instances
const idPrefix = '_AUTOID_' // to distinguish from user-assigned chart IDs
let id = 0

class MassCharts {
	constructor(opts = {}) {
		this.type = 'charts'
		setRenderers(this)
	}

	async init() {
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

		this.dom.btns = this.dom.holder
			.selectAll('button')
			.data(btnData)
			.enter()
			.append('button')
			.style('margin', '5px')
			.style('padding', '5px')
			.html(d => d.label)
			.on('click', function(d) {
				// 'this' is the button element
				self.showMenu(d.chartType, this)
			})
	}

	getState(appState) {
		const activeCohort =
			appState.termdbConfig &&
			appState.termdbConfig.selectCohort &&
			appState.termdbConfig.selectCohort.values[appState.activeCohort]
		const cohortStr = activeCohort && activeCohort.keys.sort().join(',')

		const state = {
			vocab: appState.vocab,
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			config: appState.plots.find(p => p.id === this.id),
			exclude_types: [...appState.tree.exclude_types],
			supportedChartTypes: (appState.termdbConfig.supportedChartTypes &&
				appState.termdbConfig.supportedChartTypes[cohortStr]) || ['barchart']
		}
		if (appState.termfilter && appState.termfilter.filter) {
			state.filter = getNormalRoot(appState.termfilter.filter)
		}
		return state
	}

	main(data) {
		this.dom.btns.style('display', d => (this.state.supportedChartTypes.includes(d.chartType) ? '' : 'none'))
	}
}

export const chartsInit = getCompInit(MassCharts)

function setRenderers(self) {
	self.showMenu = function(chartType, btn) {
		const appState = this.app.getState()
		if (appState.termdbConfig.selectCohort) {
			self.activeCohort = appState.activeCohort
		}

		self.dom.tip.clear().showunder(btn)

		const termSequence = getTermSelectionSequence(chartType)
		if (termSequence.length == 1) {
			const action = { type: 'plot_show', id: idPrefix + id++, config: { chartType } }
			self.showTree(chartType, termSequence, action)
		} else {
			const action = { type: 'plot_prep', chartType, id: idPrefix + id++, termSequence }
			self.showRegressionMenu(action)
		}
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
		termdb.appInit({
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
					action.config[usecase.detail] = term
					self.dom.tip.hide()
					self.app.dispatch(action)
				}
			}
		})
	}

	// regression type selection menu from 'Regression Analysis' button click
	self.showRegressionMenu = async function(action) {
		const regTypes = [
			'linear',
			'logistic'
			// 'cox', 'polynomial'
		]
		self.dom.tip.d.selectAll('*').remove()

		self.dom.tip.d
			.selectAll('div')
			.data(regTypes)
			.enter()
			.append('div')
			.attr('class', 'sja_menuoption')
			.text(d => d.charAt(0).toUpperCase() + d.slice(1))
			.on('click', d => {
				self.dom.tip.hide()
				action.id = idPrefix + id++
				action.regressionType = d
				self.app.dispatch(action)
			})
	}
}

// term selection sequence by chart type or use default
export function getTermSelectionSequence(chartType) {
	if (chartType == 'regression') {
		return [
			{
				label: 'Outcome variable',
				prompt: 'Select outcome variable',
				detail: 'term',
				limit: 1,
				cutoffTermTypes: ['condition', 'integer', 'float']
			},
			{ label: 'Independent variable(s)', prompt: 'Add independent variable', detail: 'independent', limit: 10 }
		]
	} else {
		return [{ label: '', detail: 'term', limit: 1 }]
	}
}
