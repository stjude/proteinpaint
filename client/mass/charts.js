import { getCompInit } from '../rx'
import { Menu } from '../dom/menu'
import { getNormalRoot } from '../filter/filter'
import { select, event } from 'd3-selection'

// to assign chart ID to distinguish
// between chart instances
const idPrefix = '_CHART_AUTOID_' // to distinguish from user-assigned chart IDs
let id = +new Date()

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
		const cohortStr = (activeCohort && [...activeCohort.keys].sort().join(',')) || ''
		const chartTypes = JSON.parse(JSON.stringify(appState.termdbConfig?.supportedChartTypes || {}))

		const state = {
			vocab: appState.vocab,
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			supportedChartTypes: chartTypes[cohortStr] || ['barchart'],
			termdbConfig: appState.termdbConfig
		}
		if (appState.termfilter && appState.termfilter.filter) {
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
			clickTo: self.showMenu,
			withBackBtn: true,
			menuOptions: [
				{
					label: 'Term tree & search',
					clickTo: self.showTree_selectlst,
					chartType: 'matrix',
					usecase: { target: 'matrix', detail: 'termgroups' },
					processSelection: lst => {
						return [
							{
								name: '',
								lst: lst.map(term => {
									return { term }
								})
							}
						]
					}
				},
				{
					label: 'Text input',
					chartType: 'matrix',
					clickTo: self.showTextAreaInput,
					usecase: { target: 'matrix', detail: 'termgroups' },
					placeholder: 'term\tgroup',
					processInput: async text => {
						const lines = text.split('\n').map(line => line.split('\t'))
						const ids = lines.map(cols => cols[0]).filter(t => !!t)
						const terms = await self.app.vocabApi.getTermTypes(ids)
						console.log(terms)
						const groups = {}
						for (const [id, name] of lines) {
							if (!(id in terms)) continue
							if (!(name in groups)) groups[name] = { name, lst: [] }
							groups[name].lst.push({ term: terms[id] })
						}
						return Object.values(groups)
					}
				}
			]
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
			label: 'Sample Scatter',
			chartType: 'sampleScatter',
			clickTo: self.showFileLst
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
			config: { chartType: chart.chartType }
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

	self.showTree_selectlst = async chart => {
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

	self.showTextAreaInput = opt => {
		self.dom.submenu = self.dom.tip.d.append('div').style('text-align', 'center')

		self.dom.submenu.append('span').html(opt.label)

		self.dom.submenu
			.append('button')
			.style('margin', '0 5px')
			.html('Submit')
			.on('click', async () => {
				const data = await opt.processInput(ta.property('value'))
				console.log(data)

				self.dom.tip.hide()
				const action = {
					type: 'plot_create',
					id: idPrefix + id++,
					config: {
						chartType: opt.usecase.target,
						[opt.usecase.detail]: data
					}
				}
				self.app.dispatch(action)
			})

		const ta = self.dom.submenu
			.append('div')
			.style('text-align', 'left')
			.append('textarea')
			.attr('placeholder', opt.placeholder)
			.style('width', '300px')
			.style('height', '300px')
			.style('margin', '5px')
			.style('padding', '5px')
			.on('keydown', () => {
				const keyCode = event.keyCode || event.which
				// handle tab key press, otherwise it will cause the focus to move to another input
				if (keyCode == 9) {
					event.preventDefault()
					const t = event.target
					const s = t.selectionStart
					t.value = t.value.substring(0, t.selectionStart) + '\t' + t.value.substring(t.selectionEnd)
					t.selectionEnd = s + 1
				}
			})
	}

	/*
		dispatch "plot_prep" action to produce a 'initiating' UI of this plot, for user to fill in additional details to launch the plot
		example: table, scatterplot which requires user to select two terms
	*/
	self.prepPlot = function(chart) {
		const action = { type: 'plot_prep', config: chart.config, id: idPrefix + id++ }
		self.app.dispatch(action)
	}

	self.showFileLst = function() {
		const menuDiv = self.dom.tip.d.append('div')
		for (const plot of self.state.termdbConfig.scatterplots.plot) {
			menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text(plot.name)
				.on('click', () => {
					self.app.dispatch({
						type: 'plot_create',
						config: { chartType: 'sampleScatter', term: { id: plot.term.id }, file: plot.file, name: plot.name }
					})
				})
		}
	}
}
