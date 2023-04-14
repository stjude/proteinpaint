import { getCompInit } from '#rx'
import { Menu } from '#dom/menu'
import { getNormalRoot } from '#filter/filter'
import { select } from 'd3-selection'

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

		const activeCohortStr = getActiveCohortStr(appState)

		const chartTypesByCohort = JSON.parse(JSON.stringify(appState.termdbConfig?.supportedChartTypes || {}))
		// {}, key is cohortstr, value is list of supported chart types under this cohort

		const state = {
			vocab: appState.vocab,
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			supportedChartTypes: chartTypesByCohort[activeCohortStr] || ['summary'],
			termdbConfig: appState.termdbConfig
		}
		if (appState?.termfilter?.filter) {
			state.filter = getNormalRoot(appState.termfilter.filter)
		}
		if (!state.supportedChartTypes.includes('dictionary')) {
			// force to show a dictionary chart button
			// TODO: may want the server to decide this, and as defined for a dataset
			state.supportedChartTypes.push('dictionary')
		}
		return state
	}

	main() {
		//this.dom.holder.style('display', 'block')
		this.dom.btns.style('display', d => (this.state.supportedChartTypes.includes(d.chartType) ? '' : 'none'))
	}
}

export const chartsInit = getCompInit(MassCharts)

function getActiveCohortStr(appState) {
	if (appState?.termdbConfig?.selectCohort?.values) {
		// dataset allows subcohort selection
		if (!Number.isInteger(appState.activeCohort)) throw 'appState.activeCohort is not integer array index'
		const activeCohortObject = appState.termdbConfig.selectCohort.values[appState.activeCohort]
		if (!activeCohortObject) throw 'appState.activeCohort array index out of bound'
		// get a valid cohort obj
		return [...activeCohortObject.keys].sort().join(',')
	}
	// if not, is undefined
	return ''
}

function getChartTypeList(self) {
	/* returns a list all possible chart types supported in mass
	each char type will generate a button under the nav bar
	a dataset can support a subset of these charts

	design goal is that chart specific logic should not leak into mass UI

	design idea is that a button click will trigger a callback to do one of following things
	in which chart-type specific logic is not included

	1. show dictionary tree
		by calling showTree_select1term() or showTree_selectlst()
	2. show menu
		by calling showMenu()
	3. prep chart
		by calling prepPlot()
	4. display chart-specific menu by importing from ../plots/<chartType>.js
		by calling loadChartSpecificMenu()

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

	.config:{}
		required for clickTo=prepPlot
		describe private details for creating a chart of a particular type
		to be attached to action and used by store
	*/
	return [
		{
			label: 'Dictionary',
			clickTo: self.prepPlot,
			chartType: 'dictionary',
			config: {
				chartType: 'dictionary'
			}
		},
		{
			label: 'Summary Plots',
			chartType: 'summary',
			clickTo: self.showTree_select1term,
			usecase: { detail: 'term' }
		},
		/*
		{
			label: 'Table',
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
					config: {
						chartType: 'regression',
						regressionType: 'linear',
						independent: []
					}
				},
				{
					label: 'Logistic',
					clickTo: self.prepPlot,
					config: {
						chartType: 'regression',
						regressionType: 'logistic',
						independent: []
					}
				},
				{
					label: 'Cox',
					clickTo: self.prepPlot,
					config: {
						chartType: 'regression',
						regressionType: 'cox',
						independent: []
					}
				}
			]
		},
		{
			label: 'Sample Matrix',
			chartType: 'matrix',
			clickTo: self.loadChartSpecificMenu
		},
		{
			label: 'Data Download',
			clickTo: self.prepPlot,
			chartType: 'dataDownload',
			config: {
				chartType: 'dataDownload',
				terms: []
			}
		},
		{
			label: 'Scatter Plot',
			chartType: 'sampleScatter',
			clickTo: self.loadChartSpecificMenu
		},
		{
			label: 'Genome browser',
			chartType: 'genomeBrowser',
			clickTo: self.loadChartSpecificMenu
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
			.on('click', function(event, chart) {
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
		//const holder = chart.withBackBtn ? self.dom.tip.d.append('div') : self.dom.tip.d

		let backBtn
		if (chart.withBackBtn) {
			backBtn = self.dom.tip.d
				.append('button')
				.style('display', 'none')
				.style('margin', '5px')
				.style('padding', '2px')
				.html('&lt;&lt;Back')
				.on('click', () => {
					backBtn.style('display', 'none')
					self.dom.submenu.remove()
					delete self.dom.submenu // delete reference
					menuDiv.style('display', 'block')
				})
		}

		const menuDiv = self.dom.tip.d.append('div')
		for (const opt of chart.menuOptions) {
			menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text(opt.label)
				.on('click', () => {
					if (backBtn) {
						menuDiv.style('display', 'none')
						backBtn.style('display', 'block')
					} else {
						self.dom.tip.hide()
					}
					opt.clickTo(opt)
				})
		}
	}

	/*	
		show termdb tree to select a term
		once selected, dispatch "plot_create" action (with the selected term) to produce the plot
		example: summary
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
			id: getId(),
			config: { chartType: chart.chartType }
		}

		if (chart.parentId) action.parentId = chart.parentId

		const termdb = await import('../termdb/app')
		termdb.appInit({
			vocabApi: self.app.vocabApi,
			holder: self.dom.tip.d.append('div'),
			state: {
				activeCohort: self.state.activeCohort,
				nav: {
					header_mode: 'search_only'
				},
				tree: { usecase: chart.usecase }
			},
			tree: {
				click_term: term => {
					// summary/survival/cuminc all expect config.term{} to be a termsetting object, but not term (which is confusing)
					// thus convert term into a termwrapper (termsetting obj)
					// tw.q{} is missing and will be fill in with default settings
					const tw = { id: term.id, term }
					action.config[chart.usecase.detail] = tw
					self.dom.tip.hide()
					self.app.dispatch(action)
				}
			}
		})
	}

	self.showTree_selectlst = async chart => {
		self.dom.tip.clear()
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
			id: getId(),
			config: { chartType: chart.chartType }
		}

		const termdb = await import('../termdb/app')
		self.dom.submenu = self.dom.tip.d.append('div')
		termdb.appInit({
			holder: self.dom.submenu,
			state: {
				vocab: self.state.vocab,
				activeCohort: self.state.activeCohort,
				nav: {
					header_mode: 'search_only'
				},
				tree: { usecase: chart.usecase }
			},
			tree: {
				submit_lst: termlst => {
					const data = chart.processSelection ? chart.processSelection(termlst) : termlst
					action.config[chart.usecase.detail] = data
					self.dom.tip.hide()
					self.app.dispatch(action)
				}
			}
		})
	}

	self.loadChartSpecificMenu = async chart => {
		self.dom.tip.clear()
		const _ = await import(`../plots/${chart.chartType}.js`)
		_.makeChartBtnMenu(self.dom.tip.d, self)
	}

	/*
		dispatch "plot_prep" action to produce a 'initiating' UI of this plot, for user to fill in additional details to launch the plot
		example: table, scatterplot which requires user to select two terms
	*/
	self.prepPlot = function(chart) {
		const action = { type: 'plot_prep', config: chart.config, id: getId() }
		self.app.dispatch(action)
	}
}

// to assign chart ID to distinguish between chart instances
const idPrefix = '_CHART_AUTOID_' // to distinguish from user-assigned chart IDs
let id = Date.now()

function getId() {
	return idPrefix + id++
}
