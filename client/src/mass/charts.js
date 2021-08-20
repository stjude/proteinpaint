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
		const state = {
			vocab: appState.vocab,
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			config: appState.tree.plots[this.id],
			exclude_types: [...appState.tree.exclude_types]
		}
		if (appState.termfilter && appState.termfilter.filter) {
			state.filter = getNormalRoot(appState.termfilter.filter)
		}
		return state
	}

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
				{ label: 'Outcome variable', prompt: 'Select outcome variable', detail: 'term', limit: 1 },
				{ label: 'Independent variable(s)', prompt: 'Add independent variable', detail: 'independent', limit: 10 }
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
		if (termSequence.length == 1) self.showTree(usecase, dom, termSequence, action)
		else self.showMultipart(usecase, dom, termSequence, action)
	}

	self.showTree = async function(usecase, dom, termSequence, action) {
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
				click_term: term => {
					action[usecase.detail] = term
					self.dom.tip.hide()
					self.app.dispatch(action)
				}
			}
		})
	}

	self.showMultipart = async function(usecase, dom, termSequence, action) {
		const disable_terms = []
		const pills = []

		dom.body
			.selectAll('div')
			.data(termSequence)
			.enter()
			.append('div')
			.style('margin', '3px 5px')
			.style('padding', '3px 5px')
			.each(function(d) {
				const div = select(this)
				div
					.append('div')
					.style('margin', '3px 5px')
					.style('padding', '3px 5px')
					.style('font-weight', 600)
					.text(d.label)

				const updateBtns = () => {
					const hasMissingTerms = termSequence.filter(t => !t.selected || (t.limit > 1 && !t.selected.length)).length
					submitBtn
						.property('disabled', hasMissingTerms)
						.style('background-color', hasMissingTerms ? '' : 'rgba(143, 188, 139, 0.7)')
						.style('color', hasMissingTerms ? '' : '#000')
				}
				self.newPill(d, usecase, div, pills, disable_terms, updateBtns)
			})

		const submitBtn = dom.foot
			.style('margin', '3px 5px')
			.style('padding', '3px 5px')
			.append('button')
			.attr('disabled', true)
			.html('Run analysis')
			.on('click', () => {
				self.dom.tip.hide()
				for (const t of termSequence) {
					action[t.detail] = t.selected
				}
				console.log(action)
				self.app.dispatch(action)
			})
	}

	self.newPill = function(d, usecase, div, pills, disable_terms, updateBtns) {
		const pillDiv = div.append('div')

		const newPillDiv = pillDiv
			.append('div')
			.style('margin', '3px 15px')
			.style('padding', '3px 5px')

		const use = JSON.parse(JSON.stringify(usecase))
		use.detail = d.detail

		const pill = termsettingInit({
			placeholder: d.prompt,
			holder: newPillDiv,
			vocabApi: self.app.vocabApi,
			vocab: self.state.vocab,
			activeCohort: self.state.activeCohort,
			use_bins_less: true,
			debug: self.opts.debug,
			showFullMenu: true, // to show edit/replace/remove menu upon clicking pill
			usecase: use,
			disable_terms,
			callback: term => {
				if (!term) {
					const i = pills.indexOf(pill)
					if (Array.isArray(d.selected)) d.selected.splice(i, 1)
					else delete d.selected
					console.log(210, 'null term', i)
					pills.splice(i, 1)
					disable_terms.splice(i, 1)
					if (d.limit > 1) {
						newPillDiv.remove()
					}
					updateBtns()
				} else {
					if (!disable_terms.includes(term.term.id)) {
						disable_terms.push(term.term.id)
					}
					pill.main(term)
					if (d.limit > 1) {
						if (!d.selected) d.selected = []
						d.selected.push(term)
						if (d.selected.length < d.limit) {
							self.newPill(d, usecase, div, pills, disable_terms, updateBtns)
						}
					} else {
						d.selected = term
					}
					updateBtns()
				}
			}
		})

		pills.push(pill)
	}
}
