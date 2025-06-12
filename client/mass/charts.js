import { getCompInit } from '#rx'
import { Menu } from '#dom'
import { getNormalRoot } from '#filter/filter'
import { NumericModes, TermTypes } from '#shared/terms.js'
import { GeneSetEditUI } from '../dom/GeneSetEdit/GeneSetEditUI.ts' // cannot use '#dom/', breaks

class MassCharts {
	constructor(opts = {}) {
		this.type = 'charts'
		setRenderers(this)
	}

	async init(appState) {
		this.dom = {
			holder: this.opts.holder,
			tip: new Menu({ padding: '0px' }),
			tooltip: new Menu({ padding: '4px' })
		}

		this.makeButtons(appState)
	}

	// TODO later add reactsTo() to react to filter change

	getState(appState) {
		const state = {
			vocab: appState.vocab, // TODO delete it as vocabApi should be used instead
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			currentCohortChartTypes: getCurrentCohortChartTypes(appState),
			termdbConfig: appState.termdbConfig
		}
		if (appState?.termfilter?.filter) {
			state.filter = getNormalRoot(appState.termfilter.filter)
		}
		return state
	}

	main() {
		//this.dom.holder.style('display', 'block')
		this.dom.btns.style('display', d => (this.state.currentCohortChartTypes.includes(d.chartType) ? '' : 'none'))
	}

	getRegressionBtnLabel(state) {
		/* define button label based conditions:
		if ds allows multiple regression methods, use generic name, click btn will display menu of options
		if ds allows just one method, directly show method name on button, click btn will show sandbox
		*/
		const lst = getCurrentCohortChartTypes(state)
		if (!lst.includes('regression')) return '' // plot not supported. label doesn't matter as button will be hidden
		const ms = []
		if (lst.includes('linear')) ms.push('linear')
		if (lst.includes('logistic')) ms.push('logistic')
		if (lst.includes('cox')) ms.push('cox')
		if (ms.length > 1) return 'Regression Analysis' // more than 1 methods. return general name
		// only 1 method
		return `${ms[0] == 'linear' ? 'Linear' : ms[0] == 'cox' ? 'Cox' : 'Logistic'} Regression`
	}
	getSamplescatterBtnLabel(state) {
		// define button label
		const lst = getCurrentCohortChartTypes(state)
		if (state.termdbConfig.scatterplots?.length == 1 && !lst.includes('dynamicScatter')) {
			// has 1 premade plot and no dynamic scatter. just show premade plot name as button name
			return state.termdbConfig.scatterplots[0].name
		}
		// either has >1 premade plots or dynamic scatter. show generic name
		return 'Sample Scatter'
	}
}

export const chartsInit = getCompInit(MassCharts)

export function getActiveCohortStr(appState) {
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

export function getCurrentCohortChartTypes(appState) {
	const activeCohortStr = getActiveCohortStr(appState)
	const chartTypesByCohort = structuredClone(appState.termdbConfig?.supportedChartTypes || {})
	// {}, key is cohortstr, value is list of supported chart types under this cohort
	return chartTypesByCohort[activeCohortStr] || ['summary']
}

function getChartTypeList(self, state) {
	/* returns a list all possible chart types supported in mass
	each char type will generate a button under the nav bar
	a dataset can support a subset of these charts

	allow some chart button objects to be dynamically generated based on state

	design goal is that chart specific logic should not leak into mass UI

	design idea is that a button click will trigger a callback to do one of following things
	in which chart-type specific logic is not included

	1. show dictionary tree
		by calling showTree_select1term() or showTree_selectlst()
	2. prep chart
		by calling prepPlot()
	3. display chart-specific menu by importing from ../plots/<chartType>.js
		and call the imported function loadChartSpecificMenu()

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
		
	.usecase:{}
		required for clickTo=tree_select1term
		provide to termdb app

	.config:{}
		required for clickTo=prepPlot
		describe private details for creating a chart of a particular type
		to be attached to action and used by store

	.updateActionBySelectedTerms:
		optional callback. used for geneExpression and metabolicIntensity "intermediary" chart types which do not correspond to actual chart, but will route to an actual chart (summary/scatter/hierclust) based on number of selected terms. this callback will update the action based on selected terms to do the routing

	TODO order of buttons is hardcoded, may allow to customize order
	*/

	const buttons = [
		////////////////////// PROFILE PLOTS START //////////////////////
		{
			label: 'Polar',
			chartType: 'profilePolar',
			clickTo: self.prepPlot,
			config: { chartType: 'profilePolar' }
		},
		{
			label: 'Barchart',
			clickTo: self.prepPlot,
			chartType: 'profileBarchart',
			config: { chartType: 'profileBarchart' }
		},
		{
			label: 'Facility Radar',
			chartType: 'profileRadarFacility',
			clickTo: self.loadChartSpecificMenu
		},
		{
			label: 'Radar',
			chartType: 'profileRadar',
			clickTo: self.loadChartSpecificMenu
		},
		{
			label: 'Templates',
			chartType: 'profileForms',
			clickTo: self.showTree_select1term,
			usecase: { target: 'profileForms', detail: 'tw' },
			config: { chartType: 'profileForms' }
		},
		////////////////////// PROFILE PLOTS END //////////////////////
		{
			label: 'Data Dictionary',
			clickTo: self.prepPlot,
			chartType: 'dictionary',
			config: {
				chartType: 'dictionary'
			}
		},
		{
			label: 'Summary Report',
			chartType: 'summaryReport',
			clickTo: self.loadChartSpecificMenu
		},
		{
			label: 'Sample View',
			clickTo: self.prepPlot,
			chartType: 'sampleView',
			config: {
				chartType: 'sampleView'
			}
		},

		{
			label: 'Summary Plots',
			chartType: 'summary',
			clickTo: self.showTree_select1term,
			usecase: { target: 'summary', detail: 'term' }
		},
		{
			label: self.getSamplescatterBtnLabel(state),
			chartType: 'sampleScatter',
			clickTo: self.loadChartSpecificMenu
		},
		{
			label: 'Run Chart',
			chartType: 'runChart',
			clickTo: self.loadChartSpecificMenu
		},
		{
			label: 'Event Count',
			chartType: 'eventCount',
			clickTo: self.showTree_select1term,
			usecase: { target: 'eventCount', detail: 'term' }
		},

		{
			label: 'Cumulative Incidence',
			chartType: 'cuminc',
			clickTo: self.showTree_select1term,
			usecase: { target: 'cuminc', detail: 'term' }
		},
		{
			label: 'Survival',
			chartType: 'survival',
			clickTo: self.showTree_select1term,
			usecase: { target: 'survival', detail: 'term' }
		},

		{
			label: self.getRegressionBtnLabel(state),
			chartType: 'regression',
			clickTo: self.loadChartSpecificMenu
		},

		{
			label: 'Sample Matrix',
			chartType: 'matrix',
			clickTo: self.loadChartSpecificMenu
		},
		{
			label: 'Genome Browser',
			chartType: 'genomeBrowser',
			clickTo: self.loadChartSpecificMenu
		},

		// Commenting out this button since DE does not work without specifying two groups
		//{
		//	label: 'Differential Expression',
		//	chartType: 'DEanalysis',
		//	clickTo: self.loadChartSpecificMenu
		//},

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
			label: 'Facet Table',
			clickTo: self.loadChartSpecificMenu,
			chartType: 'facet',
			config: {
				chartType: 'facet'
			}
		},
		{
			label: 'Brain Imaging',
			clickTo: self.loadChartSpecificMenu,
			chartType: 'brainImaging',
			config: {
				chartType: 'brainImaging'
			}
		},
		{
			label: 'Single Cell Plot',
			clickTo: self.prepPlot,
			chartType: 'singleCellPlot',
			config: {
				chartType: 'singleCellPlot'
			}
		},
		{
			//This chart may be later on extended to support other gene expression data types
			label: 'Gene Expression',
			chartType: 'geneExpression',
			clickTo: self.showGenesetEditUI,
			usecase: { target: 'geneExpression' }
		},
		{
			label: 'Metabolite Intensity',
			chartType: 'metaboliteIntensity', // TODO change to metaboliteIntensity
			clickTo: self.showTree_selectlst,
			usecase: { target: 'metaboliteIntensity', detail: 'term' },
			updateActionBySelectedTerms: (action, termlst) => {
				const twlst = termlst.map(term => ({
					term: structuredClone(term),
					q: { mode: NumericModes.continuous }
				}))
				if (twlst.length == 1) {
					// violin
					action.config.chartType = 'summary'
					action.config.term = twlst[0]
					return
				}
				if (twlst.length == 2) {
					// scatter
					action.config.chartType = 'summary'
					action.config.term = twlst[0]
					action.config.term2 = twlst[1]
					return
				}
				// 3 or more terms, launch clustering
				action.config.chartType = 'hierCluster'
				action.config.dataType = TermTypes.METABOLITE_INTENSITY
				action.config.termgroups = [{ name: 'Metabolite Intensity Cluster', lst: twlst, type: 'hierCluster' }]
			}
		},
		{
			//use the app name defined in dataset file
			label: state.termdbConfig.numericDictTermCluster?.appName || 'Numeric Dictionary Term cluster',
			chartType: 'numericDictTermCluster',
			clickTo: self.loadChartSpecificMenu
		},
		{
			label: 'Correlation Volcano',
			chartType: 'correlationVolcano',
			usecase: { target: 'correlationVolcano', detail: 'numeric' },
			clickTo: self.showTree_select1term
		}
	]

	for (const field in state?.termdbConfig.renamedChartTypes || []) {
		const btn = buttons.find(b => b.chartType === field)
		if (btn) {
			btn.label = state.termdbConfig.renamedChartTypes[field]
		}
	}
	return buttons
}

function setRenderers(self) {
	self.makeButtons = function (state) {
		const chartTypeList = getChartTypeList(self, state)
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
			.on('click', function (event, chart) {
				self.dom.tip.clear().showunder(this)
				chart.clickTo(chart)
			})
			.on('mouseover', (e, d) => {
				if (d.tooltip) self.dom.tooltip.clear().showunder(e.target).d.text(d.tooltip)
			})
			.on('mouseleave', (e, d) => {
				if (d.tooltip) self.dom.tooltip.hide()
			})
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
			config: { chartType: chart.chartType, activeCohort: self.state.activeCohort }
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
					const tw = term.term ? term : { term }
					action.config[chart.usecase.detail] = tw
					self.dom.tip.hide()
					self.app.dispatch(action)
				}
			}
		})
	}

	self.showGenesetEditUI = async chart => {
		const geneList = []
		const app = self.app
		const tip = self.dom.tip
		const holder = self.dom.tip.d
		holder.selectAll('*').remove()
		const div = holder.append('div').style('padding', '5px')
		const label = div.append('label')
		label.append('span').text('Create ')
		let name
		const nameInput = label
			.append('input')
			.style('margin', '2px 5px')
			.style('width', '210px')
			.attr('placeholder', 'Group Name')
			.on('input', () => {
				name = nameInput.property('value')
			})
		const selectedGroup = {
			index: 0,
			name,
			label: name,
			lst: [],
			status: 'new'
		}

		new GeneSetEditUI({
			holder: holder.append('div'),
			/* running hier clustering and the editing group is the group used for clustering
		pass this mode value to inform ui to support the optional button "top variably exp gene"
		this is hardcoded for the purpose of gene expression and should be improved
		*/
			genome: app.opts.genome,
			geneList,
			mode: 'geneExpression',
			vocabApi: app.vocabApi,
			callback: async ({ geneList, groupName }) => {
				if (!selectedGroup) throw `missing selectedGroup`
				tip.hide()
				const group = { name: groupName || name, lst: [], type: 'hierCluster' }
				const lst = group.lst.filter(tw => tw.term.type != 'geneVariant')
				const tws = await Promise.all(
					geneList.map(async d => {
						const term = {
							gene: d.symbol || d.gene,
							name: d.symbol || d.gene,
							type: 'geneExpression'
						}
						//if it was present use the previous term, genomic range terms require chr, start and stop fields, found in the original term
						let tw = group.lst.find(tw => tw.term.name == d.symbol || tw.term.name == d.gene)
						if (!tw) {
							tw = { term, q: {} }
						}
						return tw
					})
				)

				if (tws.length == 1) {
					const tw = tws[0]
					app.dispatch({
						type: 'plot_create',
						config: {
							chartType: 'summary',
							term: tw
						}
					})
					return
				}

				if (tws.length == 2) {
					const tw = tws[0]
					const tw2 = tws[1]
					app.dispatch({
						type: 'plot_create',
						config: {
							chartType: 'summary',
							term: tw,
							term2: tw2
						}
					})
					return
				}
				group.lst = [...lst, ...tws]
				if (!group.lst.length) tg.splice(selectedGroup.index, 1)

				// close geneset edit ui after clicking submit
				holder.selectAll('*').remove()

				app.dispatch({
					type: 'plot_create',
					config: {
						chartType: 'hierCluster',
						termgroups: [group],
						dataType: TermTypes.GENE_EXPRESSION
					}
				})
			}
		})
	}

	self.showTree_selectlst = async chart => {
		if (chart.usecase?.label) {
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
			config: { chartType: chart.chartType } // NOTE if chartType is intermediary, action will be updated on term selection
		}
		const termdb = await import('../termdb/app')
		self.dom.submenu = self.dom.tip.d.append('div')
		termdb.appInit({
			holder: self.dom.submenu,
			vocabApi: self.app.vocabApi,
			state: {
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
					if (chart.updateActionBySelectedTerms) chart.updateActionBySelectedTerms(action, termlst)
					self.dom.tip.hide()
					self.app.dispatch(action)
				}
			}
		})
	}

	self.loadChartSpecificMenu = async chart => {
		self.dom.tip.clear()
		const _ = await import(`../plots/${chart.chartType}.js`)
		_.makeChartBtnMenu(self.dom.tip.d, self, chart.chartType)
	}

	/*
		dispatch "plot_prep" action to produce a 'initiating' UI of this plot, for user to fill in additional details to launch the plot
		example: table, scatterplot which requires user to select two terms
	*/
	self.prepPlot = function (chart) {
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
