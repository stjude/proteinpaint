import { getCompInit, copyMerge } from '#rx'
import { Menu } from '#src/client'
import { fillTermWrapper } from '../termsetting/termsetting'
import { recoverInit } from '../rx/src/recover'

import { select, selectAll } from 'd3-selection'

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
		this.state = this.getState(appState)
		this.config = JSON.parse(JSON.stringify(this.state.config))
		setRenderers(this)
		this.initUi(this.opts)

		this.components.recover = await recoverInit({
			app: this.app,
			holder: this.dom.localRecoverDiv,
			getState: appState => this.getState(appState),
			reactsTo: action => action.id == this.id && action.type == 'plot_edit' && action._scope_ != 'none',
			plot_id: this.id,
			maxHistoryLen: 10
		})

		//Moved from main to fix default barchart not appearing when summary plot sandbox is created
		if (!this.components.plots[this.config.childType]) {
			await this.setComponent(this.config)
		}

		for (const childType in this.components.plots) {
			const chart = this.components.plots[childType]
			// hide non-active charts first, so not to momentarily have two visible charts
			if (chart.type != this.config.childType) {
				this.dom.plotDivs[chart.type].style('display', 'none')
			}
		}

		this.dom.plotDivs[this.config.childType].style('display', '')
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
		const config = JSON.parse(JSON.stringify(this.state.config))
		this.config = config

		if (!this.components.plots[config.childType]) {
			await this.setComponent(config)
		}

		for (const childType in this.components.plots) {
			const chart = this.components.plots[childType]
		}

		this.render()
	}

	async setComponent(config) {
		// !!! quick fix for rollup to bundle,
		// will eventually need to move to a subnested folder structure
		let _
		if (config.childType == 'barchart') _ = await import(`./barchart.js`)
		else if (config.childType == 'violin') _ = await import(`./violin.js`)
		else if (config.childType == 'table') _ = await import(`./table.js`)
		else if (config.childType == 'boxplot') _ = await import(`./boxplot.js`)
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
	// console.log(self);
	self.initUi = function(opts) {
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
				.style('display', 'inline-block')
				.html(self.config.term.term.name)

			self.dom.chartToggles = self.dom.paneTitleDiv
				.append('div')
				.style('display', 'inline-block')
				.style('margin-left', '10px')
				.style('margin-bottom', '-6px')
				.selectAll('button')
				.data([
					{
						childType: 'barchart',
						label: 'Barchart',
						isVisible: () => true,
						disabled: d => false,
						getTw: tw => {
							if (!tw.qCacheByMode) tw.qCacheByMode = {}
							tw.qCacheByMode[tw.q.mode] = tw.q
							// If tw.q is empty/undefined, the default q
							// will be assigned by fillTw by term type
							tw.q = tw.qCacheByMode.discrete
							return tw
						},
						active: true
					},
					{
						childType: 'violin',
						label: 'Violin',
						disabled: d => false,
						isVisible: () =>
							self.config.term.term.type === 'integer' ||
							self.config.term.term.type === 'float' ||
							self.config.term2?.term.type === 'integer' ||
							self.config.term2?.term.type === 'float',
						getTw: tw => {
							if (!tw.qCacheByMode) tw.qCacheByMode = {}
							tw.qCacheByMode[tw.q.mode] = tw.q
							tw.q = tw.qCacheByMode.continuous || { mode: 'continuous' }
							return tw
						},
						active: false
					},
					{
						childType: 'table',
						label: 'Crosstab - in development',
						disabled: d => true,
						isVisible: () => false,
						active: false
					},
					{
						childType: 'boxplot',
						label: 'Boxplot - TODO',
						disabled: d => true,
						isVisible: () => self.config.term.type === 'integer' || self.config.term.type === 'float',
						active: false
					},
					{
						childType: 'scatter',
						label: 'Scatter - TODO',
						disabled: d => true,
						isVisible: () =>
							(self.config.term.type === 'integer' || self.config.term.type === 'float') &&
							(self.config.term2?.type === 'integer' || self.config.term2?.type === 'float'),
						active: false
					}
				])
				.enter()
				.append('button')

				.style('display', d => (d.isVisible() ? ' ' : 'none'))
				.style('padding', '5px 10px')

				//Styles for tab-like design
				.style('cursor', d => (d.disabled() ? 'not-allowed' : 'pointer'))
				.style('background-color', d => (d.active ? '#cfe2f3' : 'white'))
				.style('border-style', d => (d.active ? 'solid solid none' : 'none'))
				.style('border-color', '#ccc8c8')
				.style('border-width', '1px')
				.style('border-radius', '5px 5px 0px 0px')
				.style('margin', '0px 2px -1px')

				// TODO: may use other logic for disabling a chart type, insteead of hiding/showing
				.property('disabled', d => d.disabled())
				.html(d => d.label)
				.on('click', (event, d) => {
					if (!d.getTw) {
						alert(`TODO: ${d.label}`)
						return
					}

					const termKey =
						self.config.term?.term.type == 'float' ||
						self.config.term?.term.type == 'integer' ||
						this.config.term.q.mode == 'continuous'
							? 'term'
							: 'term2'

					const termT = self.config[termKey]

					const tw = JSON.parse(JSON.stringify(termT))
					self.app.dispatch({
						type: 'plot_edit',
						id: self.id,
						config: { childType: d.childType, [termKey]: d.getTw(tw) }
					})
				})

			// Placeholder for recover component
			self.dom.localRecoverDiv = self.dom.paneTitleDiv.append('div').style('display', 'inline-block')
		} catch (e) {
			throw e
			//self.dom.errdiv.text(e)
		}
	}

	self.render = function() {
		for (const childType in self.components.plots) {
			const chart = self.components.plots[childType]
			// hide non-active charts first, so not to momentarily have two visible charts
			if (chart.type != self.config.childType) {
				self.dom.plotDivs[chart.type].style('display', 'none')
			}
		}

		self.dom.chartToggles.each(function(d) {
			if (!d) return
			d.active = d.childType == self.config.childType
			// this === DOM element
			select(this)
				.style('display', d => (d.isVisible() ? '' : 'none'))
				.style('background-color', d => (d.active ? '#cfe2f3' : 'white'))
				.style('border-style', d => (d.active ? 'solid solid none' : 'none'))
		})

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
		id: opts.term.term.id,
		term: opts.term,
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
			// TODO: maybe import chart specific config
			barchart: {
				orientation: 'horizontal',
				unit: 'abs',
				overlay: 'none',
				divideBy: 'none',
				rowlabelw: 250,
				asterisksVisible: true
			},
			//TODO can import getPlotConfig from violinplot
			violin: {
				orientation: 'horizontal'
				// unit: 'abs',
				// overlay: 'none',
				// divideBy: 'none'
			}
		},
		mayAdjustConfig(config, edits = {}) {
			if (!edits.childType) {
				if (config.term?.q?.mode == 'continuous' || config.term2?.q?.mode == 'continuous') config.childType = 'violin'
				else config.childType = 'barchart'
			}
		}
	}

	//config.mayAdjustConfig(config)

	// may apply term-specific changes to the default object
	return copyMerge(config, opts)
}
