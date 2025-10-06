import { getCompInit, copyMerge, type ComponentApi, type RxComponent } from '#rx'
import { PlotBase } from './PlotBase.ts'
import { Menu } from '#dom/menu'
import { fillTermWrapper } from '#termsetting'
import { recoverInit } from '../rx/src/recover'
// import { select } from 'd3-selection'
import { getDefaultViolinSettings } from './violin.js'
import { getDefaultBarSettings } from './barchart.js'
import { getDefaultBoxplotSettings } from './boxplot/BoxPlot.ts'
import { getDefaultScatterSettings } from './scatter/scatter.js'
import { Tabs } from '../dom/toggleButtons'
import { isNumericTerm } from '#shared/terms.js'
import { term0_term2_defaultQ } from './controls'
import { importPlot } from './importPlot.js'
import { filterRxCompInit } from '#filter'

class SummaryPlot extends PlotBase implements RxComponent {
	static type = 'summary'

	// expected RxComponent props, some are already declared/set in PlotBase
	type: string
	parentId?: string
	dom!: {
		[index: string]: any
	}
	components: {
		[name: string]: ComponentApi | { [name: string]: ComponentApi }
	} = {}

	// expected class-specific props
	chartsByType: { [chartType: string]: ComponentApi } = {}
	configTermKeys = ['term', 'term0', 'term2']
	config: any
	tabsData: any[]
	chartToggles: Tabs

	violinContTerm?: 'term' | 'term2'
	boxContTerm?: 'term' | 'term2'

	constructor(opts, api) {
		super(opts, api)
		this.type = SummaryPlot.type
		this.dom = this.getDom(opts)
		this.tabsData = this.getTabsData()
		this.chartToggles = new Tabs({ holder: this.dom.chartToggles, tabs: this.tabsData, noContent: true })
		this.components = {
			plots: {}
		}
	}

	getDom(opts) {
		const holder = opts.holder
		holder.header.style('padding', 0)

		const paneTitleDiv = holder.header
			.append('div')
			.style('display', 'inline-block')
			.style('color', '#999')
			.style('padding-left', '7px')

		return {
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
			plotDivs: {},
			paneTitleDiv,
			paneTitleText: paneTitleDiv
				.append('div')
				.classed('sjpp-term-header', true)
				.style('display', 'inline-block')
				.style('vertical-align', 'sub'),
			chartToggles: paneTitleDiv.append('div').style('display', 'inline-block').style('margin-left', '10px'),
			localRecoverDiv: paneTitleDiv.append('div').style('display', 'inline-block'),
			filterDiv: holder.header.append('div').style('display', 'inline-block')
		}
	}

	getTabsData() {
		const callback = (event, tab) => this.tabClickCallback(event, tab)
		return [
			{
				childType: 'barchart',
				label: 'Barchart',
				isVisible: () => true,
				disabled: () => false,
				getConfig: async () => {
					if (!this.config) return
					const config: any = { id: this.id, childType: 'barchart' }
					const term = this.config?.term
					const term2 = this.config?.term2
					if (term) {
						const mode = isNumericTerm(term?.term) ? 'discrete' : term?.q.mode || 'discrete'
						config.term = await this.getWrappedTermCopy(term, mode)
					}

					if (term2) {
						const mode = isNumericTerm(term2.term) ? 'discrete' : term2.q.mode || 'discrete'
						config.term2 = await this.getWrappedTermCopy(term2, mode)
					}
					return config
				},
				active: true,
				callback
			},
			{
				childType: 'violin',
				label: 'Violin',
				disabled: () => false,
				isVisible: () => isNumericTerm(this.config?.term?.term) || isNumericTerm(this.config?.term2?.term),
				getConfig: async () => {
					const term = this.config?.term
					const term2 = this.config.term2

					let _term, _term2
					this.violinContTerm = isNumericTerm(term?.term) ? 'term' : 'term2'

					//If the first term was continuous or is coming as continuous
					if ((this.violinContTerm && this.violinContTerm === 'term') || term.q?.mode == 'continuous') {
						// must mean coming from scatter plot
						_term = await this.getWrappedTermCopy(term, 'continuous')
						_term2 = await this.getWrappedTermCopy(term2, 'discrete')
						this.violinContTerm = 'term'
					}
					//If the second term was continuous or is coming as continuous
					else if ((this.violinContTerm && this.violinContTerm === 'term2') || term2?.q?.mode == 'continuous') {
						// must mean coming from barchart
						_term = await this.getWrappedTermCopy(term, 'discrete')
						_term2 = await this.getWrappedTermCopy(term2, 'continuous')
						this.violinContTerm = 'term2'
					}
					//If the second term is coming as discrete from the scatter
					else if (term2?.q?.mode == 'discrete') {
						// must mean coming from barchart
						_term = await this.getWrappedTermCopy(term, 'discrete')
						_term2 = await this.getWrappedTermCopy(term2, 'continuous')
						this.violinContTerm = 'term2'
					}
					//by default
					else {
						_term = await this.getWrappedTermCopy(term, 'continuous')
						_term2 = await this.getWrappedTermCopy(term2, 'discrete')
						this.violinContTerm = 'term'
					}
					const config = { childType: 'violin', term: _term, term2: _term2 }
					return config
				},
				active: false,
				callback
			},
			{
				childType: 'boxplot',
				label: 'Boxplot',
				disabled: () => false,
				isVisible: () => isNumericTerm(this.config?.term?.term) || isNumericTerm(this.config?.term2?.term),
				getConfig: async () => {
					const _term = this.config?.term
					const _term2 = this.config.term2

					let termMode = 'continuous',
						term2Mode = 'discrete'
					this.boxContTerm = isNumericTerm(_term?.term) ? 'term' : 'term2'

					//If the first term was continuous or is coming as continuous
					if ((this.boxContTerm && this.boxContTerm === 'term') || _term.q?.mode == 'continuous') {
						// must mean coming from scatter plot
						termMode = 'continuous'
						term2Mode = 'discrete'
						this.boxContTerm = 'term'
					}
					//If the second term was continuous or is coming as continuous
					else if ((this.boxContTerm && this.boxContTerm === 'term2') || _term2?.q?.mode == 'continuous') {
						// must mean coming from barchart
						termMode = 'discrete'
						term2Mode = 'continuous'
						this.boxContTerm = 'term2'
					}
					//If the second term is coming as discrete from the scatter
					else if (_term2?.q?.mode == 'discrete') {
						// must mean coming from barchart
						termMode = 'discrete'
						term2Mode = 'continuous'
						this.boxContTerm = 'term2'
					}

					const term = await this.getWrappedTermCopy(_term, termMode)
					const term2 = await this.getWrappedTermCopy(_term2, term2Mode)
					const config = {
						childType: 'boxplot',
						term,
						term2
					}
					return config
				},
				active: false,
				callback
			},
			{
				childType: 'sampleScatter',
				label: 'Scatter',
				disabled: () => false,
				isVisible: () => {
					return isNumericTerm(this.config?.term.term) && isNumericTerm(this.config?.term2?.term)
				},
				getConfig: async () => {
					const _term = await this.getWrappedTermCopy(this.config?.term, 'continuous')
					const _term2 = await this.getWrappedTermCopy(this.config?.term2, 'continuous')
					const config = {
						childType: 'sampleScatter',
						term: _term,
						term2: _term2,
						groups: [],
						term0: this.config.term0
					}
					return config
				},
				active: false,
				callback
			}
		]
	}

	async init(appState) {
		const state = this.getState(appState)
		const config = structuredClone(state.config)
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
		this.components.filter = await filterRxCompInit({
			app: this.app,
			vocabApi: this.app.vocabApi,
			parentId: this.id,
			holder: this.dom.filterDiv,
			hideLabel: true,

			emptyLabel: '+Add new filter',
			callback: filter => {
				this.app.dispatch({
					id: this.id,
					type: 'plot_edit',
					config: { filter }
				})
			}
		})
	}

	reactsTo(action) {
		if (action.type.includes('cache_termq')) return true
		if (action.type.startsWith('plot_')) {
			if (action.type.startsWith('plot_')) {
				return action.id === this.id || action.id == this.parentId
			}
		}
		if (action.type.startsWith('filter')) return true
		if (action.type.startsWith('cohort')) return true
		if (action.type == 'app_refresh') return true
		return false
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			termfilter: appState.termfilter,
			config,
			// quick fix to skip history tracking as needed
			_scope_: appState._scope_
		}
	}

	async main() {
		this.dom.errdiv.style('display', 'none').style('background-color', 'rgba(255,100,100,0.2)').html('')
		this.config = await this.getMutableConfig()
		this.maySetSandboxHeader()

		if (!this.components.plots[this.config.childType]) {
			await this.setComponent(this.config)
		}

		this.render()

		const activeTabIndex = this.tabsData.findIndex(tab => tab.childType == this.config.childType)
		this.chartToggles.update(activeTabIndex)

		//Only show tabs when more than one are present
		const numVisTabs = this.tabsData.filter(d => d.isVisible()).length
		if (numVisTabs > 1) this.dom.chartToggles.style('display', 'inline-block')
		else this.dom.chartToggles.style('display', 'none')
	}

	maySetSandboxHeader() {
		const { term, term2 } = this.config
		const mainTerm = term.getTitleText?.() || term.term.name
		if (term2?.type) {
			this.dom.paneTitleText.html(`${term2.getTitleText?.() || term2.term.name} vs ${mainTerm}`)
		} else {
			this.dom.paneTitleText.html(mainTerm)
		}
	}

	async setComponent(config) {
		// !!! quick fix for rollup to bundle,
		// will eventually need to move to a subnested folder structure
		const _ = await importPlot(config.childType, `unsupported childType='${config.childType}'`)
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

	initUi(opts, config) {
		this.dom.paneTitleText.html(config.term.term.name)
		this.chartToggles.main()
	}

	async tabClickCallback(event, tab) {
		if (!tab || !tab.getConfig) return
		const config = await tab.getConfig()
		if (config)
			this.app.dispatch({
				type: 'plot_edit',
				id: this.id,
				config: config
			})
	}

	async getWrappedTermCopy(term, mode) {
		if (!term) return
		const tw = structuredClone(term)
		// TODO: this is not type safe, assumes any q{} can be set to any mode
		tw.q.mode = mode // {mode, isAtomic: true}
		// If tw.q is empty/undefined, the default q
		// will be assigned by fillTw by term type
		await fillTermWrapper(tw, this.app.vocabApi)
		return tw
	}

	render() {
		for (const childType of Object.keys(this.components.plots)) {
			const chart = this.components.plots[childType]
			// hide non-active charts first, so not to momentarily have two visible charts
			if (chart.type != this.config.childType) {
				this.dom.plotDivs[chart.type].style('display', 'none')
			}
		}

		this.dom.plotDivs[this.config.childType].style('display', '')
	}

	getChartImages() {
		const chart = this.components.plots[this.config.childType]
		if (chart?.getChartImages) {
			return chart.getChartImages()
		}
		return null
	}
}

export const summaryInit = getCompInit(SummaryPlot)
export const componentInit = summaryInit

export async function getPlotConfig(opts, app) {
	if (!opts.term) throw 'summary getPlotConfig: opts.term{} missing'
	try {
		await fillTermWrapper(opts.term, app.vocabApi, opts.term.q || { geneVariant: { type: 'predefined-groupset' } })
		// supply term0_term2_defaultQ if opts.term0/2.bins/q is undefined
		// e.g. for scatterplot, opts.term2.q.mode='continuous' so will not
		// want to override with q.mode from term0_term2_defaultQ
		if (opts.term2)
			await fillTermWrapper(
				opts.term2,
				app.vocabApi,
				opts.term2.bins || opts.term2.q ? undefined : term0_term2_defaultQ
			)
		if (opts.term0)
			await fillTermWrapper(
				opts.term0,
				app.vocabApi,
				opts.term0.bins || opts.term0.q ? undefined : term0_term2_defaultQ
			)
		// dynamic scatterplot is a child type of summary and following args are possible; if present, initialize them
		if (opts.colorTW) await fillTermWrapper(opts.colorTW, app.vocabApi)
		if (opts.shapeTW) await fillTermWrapper(opts.shapeTW, app.vocabApi)
		if (opts.scaleDotTW) await fillTermWrapper(opts.scaleDotTW, app.vocabApi)
	} catch (e: any) {
		if (e.stack) console.log(e.stack)
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
				isOpen: false
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

			boxplot: getDefaultBoxplotSettings(app),

			sampleScatter: getDefaultScatterSettings()
		},
		mayAdjustConfig(config, edits: { childType?: string } = {}) {
			/*
				when recovering from state rehydration:
				- Mass store must call mayAdjustConfig(), if available, since the recovered state
				may be partial such as from an example url. Even a previously saved "full" state
				may still need to be filled or reshaped with new state config/settings.
			*/

			if (edits.childType) {
				// no need to set config.childType if a value is already specified
				// in an edits object (optional second argument), as processed by mass store
				if (config.childType != edits.childType)
					throw `action.config.childType was not applied in mass store.plot_edit()`
				return
			}

			// config.childType may be stale, OR edits.childType may not be available,
			// when the summary plot_edit is triggered by replacing a term, such as replacing
			// categorical overlay with numeric, in which case the dispatched action might not
			// know in advance what the chiltType should be. It is much more reliable and consistent
			// to determine the default plots here, depending on the processed config.
			if (config.term?.q?.mode == 'continuous' && config.term2?.q?.mode == 'continuous') {
				// TODO: may need more logic later if more than one summary childType,
				// besides scatter, can support 2 continuous terms
				config.childType = 'sampleScatter'
			} else if (config.term?.q?.mode == 'continuous' || config.term2?.q?.mode == 'continuous') {
				if (!discreteByContinuousPlots.has(config.childType)) {
					// only change config.childType if the current value is not supported by discrete + continuous tw
					if (opts.childType && !discreteByContinuousPlots.has(opts.childType)) {
						console.warn(
							`ignoring summary opts.childType='${opts.childType}' since it does not support plotting discrete by continuous tw's`
						)
						config.childType = 'violin'
					} else {
						config.childType = opts.childType || 'violin'
					}
				}
			} else {
				// TODO: may need more logic later if more than one summary childType,
				// besides barchart, can support discrete tw only
				config.childType = 'barchart'
			}
		}
	}
	//config.mayAdjustConfig(config)

	// TODO: may do similar thing for custom term
	if (config.term.term.type == 'geneVariant') config.settings.barchart.colorBars = true

	// may apply term-specific changes to the default object
	return copyMerge(config, opts)
}

const discreteByContinuousPlots = new Set(['violin', 'boxplot'])
