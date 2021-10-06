import { getCompInit } from '../common/rx.core'
import { Menu } from '../client'
import { getNormalRoot } from '../common/filter'
import { select, event } from 'd3-selection'

/* list all possible chart types in this array
each char type will generate a button under the nav bar
design idea is that button click event handler should not include chart-type specific logic

.label:
	text to show in the button

.chartType:
	values are controlled
	must include for deciding if to display a chart button for a dataset
	e.g. cumulative incidence plot will require "condition" term to be present in a dataset
	see main()

.clickTo:
	=tree_select1term
		show termdb tree to select a term
		once selected, dispatch "plot_show" action (with the selected term) to produce the plot
		example: barchart
	=prepPlot
		dispatch "plot_prep" action to produce a 'initiating' UI of this plot, for user to fill in additional details to launch the plot
		example: table, scatterplot which requires user to select two terms
	=menu
		show a menu
		each menu option will have its own clickTo to determine the behavior of clicking on it

.usecase:{}
	required for clickTo=tree_select1term
	provide to termdb app

.menuOptions:[]
	required for clickTo=menu

.payload:{}
	required for clickTo=prepPlot
	describe private details for creating a chart of a particular type
	to be attached to action and used by store
*/
const chartTypeList = [
	{
		label: 'Bar Chart',
		chartType: 'barchart',
		clickTo: 'tree_select1term',
		usecase: { target: 'barchart', detail: 'term' }
	},
	/*
	{
		label: 'Table',
		clickTo:'prepPlot',
	},
	{
		label: 'Scatterplot',
		clickTo:'prepPlot',
	},
	*/
	{
		// should only show for official dataset, but not custom
		label: 'Cumulative Incidence',
		chartType: 'cuminc',
		clickTo: 'tree_select1term',
		usecase: { target: 'cuminc', detail: 'term' }
	},
	{
		// should only show for official dataset, but not custom
		label: 'Survival',
		chartType: 'survival',
		clickTo: 'tree_select1term',
		usecase: { target: 'survival', detail: 'term' }
	},
	{
		// should only show for official dataset, but not custom
		label: 'Regression Analysis',
		chartType: 'regression',
		clickTo: 'menu',
		menuOptions: [
			{
				label: 'Linear',
				clickTo: 'prepPlot',
				chartType: 'regression',
				payload: {
					chartType: 'regression',
					regressionType: 'linear',
					independent: []
				}
			},
			{
				label: 'Logistic',
				clickTo: 'prepPlot',
				payload: {
					chartType: 'regression',
					regressionType: 'logistic',
					independent: []
				}
			}
		]
	}
]

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
		this.makeButtons()
	}

	// FIXME need reactsTo()?

	getState(appState) {
		// FIXME seems like it only needs supportedChartTypes and activeCohort, can delete the rest from state?
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

	main() {
		this.dom.btns.style('display', d => (this.state.supportedChartTypes.includes(d.chartType) ? '' : 'none'))
	}

	clickButton(chart, div) {
		switch (chart.clickTo) {
			case 'tree_select1term':
				this.showTree_select1term(chart, div)
				break
			case 'prepPlot':
				const action = { type: 'plot_prep', payload: chart.payload, id: idPrefix + id++ }
				this.app.dispatch(action)
				break
			case 'menu':
				this.showMenu(chart, div)
				break
			default:
				throw 'unknown value for clickTo: ' + chart.clickTo
		}
	}
}

export const chartsInit = getCompInit(MassCharts)

function setRenderers(self) {
	self.makeButtons = function() {
		// TODO improve button styling
		self.dom.btns = self.dom.holder
			.selectAll('button')
			.data(chartTypeList)
			.enter()
			.append('button')
			.style('margin', '5px')
			.style('padding', '5px')
			.html(d => d.label)
			.on('click', function(d) {
				// 'this' is the button element
				self.clickButton(d, this)
			})
	}
	self.showMenu = function(chart, btn) {
		self.dom.tip.clear().showunder(btn)
		if (!Array.isArray(chart.menuOptions)) throw 'menuOptions is not array'
		for (const opt of chart.menuOptions) {
			self.dom.tip.d
				.append('div')
				.attr('class', 'sja_menuoption')
				.text(opt.label)
				.on('click', () => {
					self.dom.tip.hide()
					self.clickButton(opt, btn)
				})
		}
	}

	self.showTree_select1term = async function(chart, btn) {
		self.dom.tip.clear().showunder(btn)
		if (chart.usecase.label) {
			self.dom.tip.d
				.append('div')
				.style('margin', '3px 5px')
				.style('padding', '3px 5px')
				.style('font-weight', 600)
				.html(chart.usecase.label)
		}

		const action = {
			type: 'plot_show',
			id: idPrefix + id++,
			config: { chartType: chart.chartType } // may be replaced by action.chart{}
		}

		const termdb = await import('../termdb/app')
		termdb.appInit({
			holder: self.dom.tip.d.append('div'),
			state: {
				vocab: self.opts.vocab,
				activeCohort: self.state.activeCohort,
				nav: {
					header_mode: 'search_only'
				},
				tree: { usecase: chart.usecase }
			},
			tree: {
				click_term: term => {
					action.config[chart.usecase.detail] = term
					self.dom.tip.hide()
					self.app.dispatch(action)
				}
			}
		})
	}
}

// term selection sequence by chart type or use default
// FIXME may encode this info in chartTypeList
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
