import { getCompInit, copyMerge } from '#rx'
import { Menu } from '#dom/menu'
import { fillTermWrapper } from '../termsetting/termsetting'
import { recoverInit } from '../rx/src/recover'
import { select } from 'd3-selection'
import { getDefaultViolinSettings } from './violin.js'
import { getDefaultBarSettings } from './barchart.js'
import { getDefaultScatterSettings } from './sampleScatter.js'
import { Tabs } from '#dom/toggleButtons'

//import {  } from ''

class SummaryPlot {
	constructor(opts) {
		this.type = 'summary'
		this.components = {
			recover: {},
			plots: {}
		}
		this.chartsByType = {}
	}

	async init(appState) {
		const state = this.getState(appState)
		const config = structuredClone(state.config)
		setRenderers(this)
		this.initUi(this.opts, config)

		this.components.recover = await recoverInit({
			app: this.app,
			holder: this.dom.localRecoverDiv,
			getState: appState => this.getState(appState),
			reactsTo: action => action.id == this.id && action.type == 'plot_edit' && action._scope_ != 'none',
			plot_id: this.id,
			maxHistoryLen: 10,
			margin: '5px 10px' //Prevents a gap appearing between the tabs and sandbox content
		})
	}

	reactsTo(action) {
		if (action.type.includes('cache_termq')) return true
		if (action.type.startsWith('plot_')) {
			return action.id === this.id
		}
		if (action.type.startsWith('filter')) return true
		if (action.type.startsWith('cohort')) return true
		if (action.type == 'app_refresh') return true
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			config,
			// quick fix to skip history tracking as needed
			_scope_: appState._scope_
		}
	}

	async main() {
		this.dom.errdiv.style('display', 'none')
		this.config = structuredClone(this.state.config)

		if (!this.components.plots[this.config.childType]) {
			await this.setComponent(this.config)
		}

		for (const childType in this.components.plots) {
			const chart = this.components.plots[childType]
		}

		this.render()

		const activeTabIndex = this.tabsData.findIndex(tab => tab.childType == this.config.childType)
		this.chartToggles.update(activeTabIndex, this.config)
	}

	async setComponent(config) {
		// !!! quick fix for rollup to bundle,
		// will eventually need to move to a subnested folder structure
		let _
		if (config.childType == 'barchart') _ = await import(`./barchart.js`)
		else if (config.childType == 'violin') _ = await import(`./violin.js`)
		else if (config.childType == 'table') _ = await import(`./table.js`)
		else if (config.childType == 'boxplot') _ = await import(`./boxplot.js`)
		else if (config.childType == 'sampleScatter') _ = await import(`./sampleScatter.js`)
		else throw `unsupported childType='${config.childType}'`

		this.dom.plotDivs[config.childType] = this.dom.viz.append('div')

		// assumes only 1 chart per chartType would be rendered in the summary sandbox
		this.components.plots[config.childType] = await _.componentInit({
			app: this.app,
			holder: this.dom.plotDivs[config.childType],
			id: this.id,
			parent: this.api
		})
	}

	destroy() {
		// the dom.holder itself is not a d3-selection,
		// so need to specify a destroy function here
		// since the default rx.componentApi.destroy()
		// does not work when dom.holder is not a d3-selection
		this.dom.holder.app_div.selectAll('*').remove()
		this.dom.holder.app_div.remove()
		for (const key in this.dom) {
			delete this.dom[key]
		}
	}
}

export const summaryInit = getCompInit(SummaryPlot)

function setRenderers(self) {
	self.initUi = function(opts, config) {
		const holder = opts.holder
		try {
			self.dom = {
				tip: new Menu({ padding: '0px' }),
				holder,
				body: holder.body
					// .style('margin-top', '-1px')
					.style('white-space', 'nowrap')
					.style('overflow-x', 'auto'),

				// will hold no data notice or the page title in multichart views
				errdiv: holder.body
					.append('div')
					.style('display', 'none')
					.style('padding', '5px')
					.style('background-color', 'rgba(255,100,100,0.2)'),

				// dom.viz will hold the rendered view
				viz: holder.body.append('div'),
				plotDivs: {}
			}

			holder.header.style('padding', 0)

			// holder is assumed to be a sandbox, which has a header
			self.dom.paneTitleDiv = self.dom.holder.header
				.append('div')
				.style('display', 'inline-block')
				.style('color', '#999')
				.style('padding-left', '7px')

			self.dom.paneTitleDiv
				.append('div')
				.classed('sjpp-term-header', true)
				.style('display', 'inline-block')
				.style('vertical-align', 'sub')
				.html(config.term.term.name)

			self.tabsData = [
				{
					childType: 'barchart',
					label: 'Barchart',
					isVisible: () => true,
					disabled: d => false,
					getConfig: async () => {
						if (!self.config) return
						const config = { id: self.id, childType: 'barchart' }

						const term = self.config.term
						if (term) {
							const mode =
								term?.term.type == 'float' || term?.term.type == 'integer' ? 'discrete' : term?.q.mode || 'discrete'
							config.term = await self.getWrappedTermCopy(term, mode)
						}

						const term2 = self.config.term2
						if (term2) {
							const mode =
								term2.term.type == 'float' || term2.term.type == 'integer' ? 'discrete' : term2.q.mode || 'discrete'
							config.term2 = await self.getWrappedTermCopy(term2, mode)
						}
						return config
					},
					active: true,
					callback: self.tabClickCallback
				},
				{
					childType: 'violin',
					label: 'Violin',
					disabled: d => false,
					isVisible: () =>
						self.config?.term.term.type === 'integer' ||
						self.config?.term.term.type === 'float' ||
						self.config?.term2?.term.type === 'integer' ||
						self.config?.term2?.term.type === 'float',
					getConfig: async () => {
						let _term, _term2
						//If the first term was continuous or is coming as continuous
						if (self.violinContTerm === 'term' || this.config.term.q?.mode == 'continuous') {
							// must mean coming from scatter
							_term = await self.getWrappedTermCopy(self.config?.term, 'continuous')
							_term2 = await self.getWrappedTermCopy(self.config?.term2, 'discrete')
							self.violinContTerm = 'term'
						}
						//If the second term was continuous or is coming as continuous
						else if (self.violinContTerm === 'term2' || this.config.term2?.q?.mode == 'continuous') {
							// must mean coming from barchart
							_term = await self.getWrappedTermCopy(self.config.term, 'discrete')
							_term2 = await self.getWrappedTermCopy(self.config.term2, 'continuous')
							self.violinContTerm = 'term2'
						}
						//If the second term is coming as discrete from the scatter
						else if (this.config.term2?.q?.mode == 'discrete') {
							// must mean coming from barchart
							_term = await self.getWrappedTermCopy(self.config.term, 'discrete')
							_term2 = await self.getWrappedTermCopy(self.config.term2, 'continuous')
							self.violinContTerm = 'term2'
						}
						//by default
						else {
							_term = await self.getWrappedTermCopy(self.config.term, 'continuous')
							_term2 = await self.getWrappedTermCopy(self.config.term2, 'discrete')
							self.violinContTerm = 'term'
						}
						const config = { childType: 'violin', term: _term, term2: _term2 }
						return config
					},
					active: false,
					callback: self.tabClickCallback
				},
				{
					childType: 'table',
					label: 'Crosstab - in development',
					disabled: d => true,
					isVisible: () => false,
					active: false,
					callback: self.tabClickCallback
				},
				{
					childType: 'boxplot',
					label: 'Boxplot - TODO',
					disabled: d => true,
					isVisible: () => false, // remove during development
					// isVisible: () => self.config.term.type === 'integer' || self.config.term.type === 'float',
					active: false,
					callback: self.tabClickCallback
				},
				{
					childType: 'sampleScatter',
					label: 'Scatter',
					disabled: d => false,
					isVisible: () => {
						return (
							(self.config?.term.term.type === 'integer' || self.config?.term.term.type === 'float') &&
							(self.config?.term2?.term.type === 'integer' || self.config?.term2?.term.type === 'float')
						)
					},
					getConfig: async () => {
						const _term = await self.getWrappedTermCopy(self.config?.term, 'continuous')
						const _term2 = await self.getWrappedTermCopy(self.config?.term2, 'continuous')
						let config = {
							childType: 'sampleScatter',
							term: _term,
							term2: _term2,
							groups: [],
							term0: self.config.term0
						}
						return config
					},
					active: false,
					callback: self.tabClickCallback
				}
			]
			self.dom.chartToggles = self.dom.paneTitleDiv
				.append('div')
				.style('display', 'inline-block')
				.style('margin-left', '10px')

			self.chartToggles = new Tabs({ holder: self.dom.chartToggles, tabs: self.tabsData, noContent: true })
			self.chartToggles.main()

			// Placeholder for recover component
			self.dom.localRecoverDiv = self.dom.paneTitleDiv.append('div').style('display', 'inline-block')
		} catch (e) {
			throw e
			//self.dom.errdiv.text(e)
		}
	}

	self.tabClickCallback = async (event, tab) => {
		if (!tab || !tab.getConfig) return
		const config = await tab.getConfig()
		if (config)
			self.app.dispatch({
				type: 'plot_edit',
				id: self.id,
				config: config
			})
	}

	self.getWrappedTermCopy = async function(term, mode) {
		if (!term) return
		const tw = structuredClone(term)
		tw.q.mode = mode
		// If tw.q is empty/undefined, the default q
		// will be assigned by fillTw by term type
		await fillTermWrapper(tw, self.app.vocabApi)
		return tw
	}

	self.render = function() {
		for (const childType in self.components.plots) {
			const chart = self.components.plots[childType]
			// hide non-active charts first, so not to momentarily have two visible charts
			if (chart.type != self.config.childType) {
				self.dom.plotDivs[chart.type].style('display', 'none')
			}
		}

		self.dom.plotDivs[self.config.childType].style('display', '')
	}
}

export async function getPlotConfig(opts, app) {
	if (!opts.term) throw 'summary getPlotConfig: opts.term{} missing'
	try {
		await fillTermWrapper(opts.term, app.vocabApi)
		if (opts.term2) await fillTermWrapper(opts.term2, app.vocabApi)
		if (opts.term0) await fillTermWrapper(opts.term0, app.vocabApi)
	} catch (e) {
		throw `${e} [summary getPlotConfig()]`
	}

	const config = {
		chartType: 'summary',
		childType: 'barchart',
		//id: opts.term.term.id,
		term: opts.term,
		groups: [],
		settings: {
			controls: {
				isOpen: false, // control panel is hidden by default
				term2: null, // the previous overlay value may be displayed as a convenience for toggling
				term0: null
			},
			common: {
				use_logscale: false, // flag for y-axis scale type, 0=linear, 1=log
				use_percentage: false,
				barheight: 300, // maximum bar length
				barwidth: 20, // bar thickness
				barspace: 2 // space between two bars
			},

			barchart: getDefaultBarSettings(app),

			violin: getDefaultViolinSettings(app),

			sampleScatter: getDefaultScatterSettings(app)
		},
		mayAdjustConfig(config, edits = {}) {
			console.log(config)
			/*
				when recovering from state:
				  - mayAdjustConfig should not even run: how to know initial
			*/
			if (!edits.childType) {
				if (config.term?.q?.mode == 'continuous' && config.term2?.q?.mode == 'continuous') {
					config.childType = 'sampleScatter'
				} else if (config.term?.q?.mode == 'continuous' || config.term2?.q?.mode == 'continuous')
					config.childType = 'violin'
				else config.childType = 'barchart'
			}
		}
	}

	//config.mayAdjustConfig(config)

	// may apply term-specific changes to the default object
	return copyMerge(config, opts)
}
