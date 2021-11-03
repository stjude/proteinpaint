import { getCompInit } from '../common/rx.core'
import { Menu } from '../dom/menu'
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
		this.makeButtons()
	}

	// TODO later add reactsTo() to react to filter change

	getState(appState) {
		// need vocab, activeCohort and filter
		const activeCohort =
			appState.termdbConfig &&
			appState.termdbConfig.selectCohort &&
			appState.termdbConfig.selectCohort.values[appState.activeCohort]
		const cohortStr = activeCohort && [...activeCohort.keys].sort().join(',')

		const state = {
			vocab: appState.vocab,
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
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
}

export const chartsInit = getCompInit(MassCharts)

function getChartTypeList(self) {
	/* list all possible chart types in this array
	each char type will generate a button under the nav bar

	design goal is that chart specific logic should not leak into mass UI

	design idea is that a button click will trigger a callback to do one of following things
	in which chart-type specific logic is not included
	1. show tree
	2. show menu
	3. prep chart

	.label:
		text to show in the button

	.chartType:
		values are controlled
		must include for deciding if to display a chart button for a dataset
		e.g. cumulative incidence plot will require "condition" term to be present in a dataset
		see main()

	.clickTo:
		callback to handle the button click event, may use any of the following renderer methods:
	
		self.tree_select1term 
		- will show a term tree to select a term	

		self.prepPlot
		- dispatch "plot_prep" action to produce a 'initiating' UI of this plot, for user to fill in additional details to launch the plot
			example: regression, table, scatterplot which requires user to select two terms
		
		self.showMenu
			show a menu
			each option in chart.menuOptions will have its own clickTo to determine the behavior of clicking on it
			example: show a menu for the supported types of regression analysis  

	.usecase:{}
		required for clickTo=tree_select1term
		provide to termdb app

	.menuOptions:[]
		required for clickTo=showMenu
		each menu option will have its own clickTo to determine the behavior of clicking on it

	.payload:{}
		required for clickTo=prepPlot
		describe private details for creating a chart of a particular type
		to be attached to action and used by store
	*/
	return [
		{
			label: 'Bar Chart',
			chartType: 'barchart',
			clickTo: self.showTree_select1term,
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
			clickTo: self.showTree_select1term,
			usecase: { target: 'cuminc', detail: 'term' }
		},
		{
			// should only show for official dataset, but not custom
			label: 'Survival',
			chartType: 'survival',
			clickTo: self.showTree_select1term,
			usecase: { target: 'survival', detail: 'term' }
		},
		{
			// should only show for official dataset, but not custom
			label: 'Regression Analysis',
			chartType: 'regression',
			clickTo: self.showMenu,
			menuOptions: [
				{
					label: 'Linear',
					clickTo: self.prepPlot,
					chartType: 'regression',
					payload: {
						chartType: 'regression',
						regressionType: 'linear',
						independent: []
					}
				},
				{
					label: 'Logistic',
					clickTo: self.prepPlot,
					payload: {
						chartType: 'regression',
						regressionType: 'logistic',
						independent: []
					}
				}
			]
		}
	]
}

function setRenderers(self) {
	self.makeButtons = function() {
		const chartTypeList = getChartTypeList(self)

		self.dom.btns = self.dom.holder
			.selectAll('button')
			.data(chartTypeList)
			.enter()
			.append('button')
			.style('margin', '10px')
			.style('padding', '10px 15px')
			.style('border-radius', '20px')
			.style('border-color', '#ededed')
			.html(d => d.label)
			.on('click', function(chart) {
				self.dom.tip.clear().showunder(this)
				chart.clickTo(chart)
			})
	}

	/*
		show a menu
		each option in chart.menuOptions will have its own clickTo 
		example: show a menu for the supported types of regression analysis  
	*/
	self.showMenu = function(chart) {
		if (!Array.isArray(chart.menuOptions)) throw 'menuOptions is not array'
		for (const opt of chart.menuOptions) {
			self.dom.tip.d
				.append('div')
				.attr('class', 'sja_menuoption')
				.text(opt.label)
				.on('click', () => {
					self.dom.tip.hide()
					opt.clickTo(opt)
				})
		}
	}

	/*	
		show termdb tree to select a term
		once selected, dispatch "plot_create" action (with the selected term) to produce the plot
		example: barchart
	*/
	self.showTree_select1term = async chart => {
		if (chart.usecase.label) {
			self.dom.tip.d
				.append('div')
				.style('margin', '3px 5px')
				.style('padding', '3px 5px')
				.style('font-weight', 600)
				.html(chart.usecase.label)
		}

		const action = {
			type: 'plot_create',
			id: idPrefix + id++,
			config: { chartType: chart.chartType } // may replaced by payload to be consistent
		}

		const termdb = await import('../termdb/app')
		termdb.appInit({
			holder: self.dom.tip.d.append('div'),
			state: {
				vocab: self.state.vocab,
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

	/*
		dispatch "plot_prep" action to produce a 'initiating' UI of this plot, for user to fill in additional details to launch the plot
		example: table, scatterplot which requires user to select two terms
	*/
	self.prepPlot = function(chart) {
		const action = { type: 'plot_prep', payload: chart.payload, id: idPrefix + id++ }
		self.app.dispatch(action)
	}
}
