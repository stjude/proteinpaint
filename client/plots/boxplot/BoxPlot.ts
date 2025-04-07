import { getCompInit, copyMerge } from '#rx'
import { fillTermWrapper } from '#termsetting'
import { controlsInit, term0_term2_defaultQ, renderTerm1Label } from '../controls'
import { RxComponentInner } from '../../types/rx.d'
import { plotColor } from '#shared/common.js'
import { Menu, getMaxLabelWidth } from '#dom'
import type { Elem } from '../../types/d3'
import type { BasePlotConfig, MassAppApi, MassState, PlotConfig } from '#mass/types/mass'
import type { TdbBoxPlotOpts, BoxPlotSettings, BoxPlotDom } from './BoxPlotTypes'
import { Model } from './model/Model'
import { ViewModel } from './viewModel/ViewModel'
import { View } from './view/View'
import { BoxPlotInteractions } from './interactions/BoxPlotInteractions'

class TdbBoxplot extends RxComponentInner {
	readonly type = 'boxplot'
	components: { controls: any }
	dom: BoxPlotDom
	interactions?: BoxPlotInteractions
	private useDefaultSettings = true
	constructor(opts: TdbBoxPlotOpts) {
		super()
		this.opts = opts
		this.components = {
			controls: {}
		}
		const holder = opts.holder.classed('sjpp-boxplot-main', true)
		const controls = opts.controls ? holder : holder.append('div')
		const div = holder.append('div').style('padding', '5px')
		const errorDiv = div.append('div').attr('id', 'sjpp-boxplot-error').style('opacity', 0.75)
		const svg = div.append('svg').style('display', 'inline-block').attr('id', 'sjpp-boxplot-svg')
		this.dom = {
			controls: controls as Elem,
			div,
			error: errorDiv,
			svg,
			plotTitle: svg.append('text'),
			axis: svg.append('g'),
			boxplots: svg.append('g'),
			legend: div.append('div').attr('id', 'sjpp-boxplot-legend'),
			tip: new Menu()
		}
		if (opts.header) this.dom.header = opts.header.html('Box plot')
	}

	async setControls() {
		const inputs = [
			{
				type: 'term',
				configKey: 'term',
				chartType: 'boxplot',
				usecase: { target: 'boxplot', detail: 'term' },
				label: renderTerm1Label,
				vocabApi: this.app.vocabApi,
				menuOptions: 'edit'
			},
			{
				type: 'term',
				configKey: 'term2',
				chartType: 'boxplot',
				usecase: { target: 'boxplot', detail: 'term2' },
				title: 'Overlay data',
				label: 'Overlay',
				vocabApi: this.app.vocabApi,
				numericEditMenuVersion: this.opts.numericEditMenuVersion || ['continuous', 'discrete'],
				defaultQ4fillTW: term0_term2_defaultQ
			},
			{
				label: 'Order by',
				title: 'Order box plots by parameters',
				type: 'radio',
				chartType: 'boxplot',
				settingsKey: 'orderByMedian',
				options: [
					{ label: 'Default', value: false },
					{ label: 'Median values', value: true }
				],
				getDisplayStyle: (plot: PlotConfig) => (plot.term2 ? '' : 'none')
			},
			{
				label: 'Scale',
				title: 'Change the axis scale',
				type: 'radio',
				chartType: 'boxplot',
				settingsKey: 'isLogScale',
				options: [
					{ label: 'Linear', value: false },
					{ label: 'Log10', value: true }
				]
			},
			{
				label: 'Orientation',
				title: 'Change the orientation of the box plots',
				type: 'radio',
				chartType: 'boxplot',
				settingsKey: 'isVertical',
				options: [
					{ label: 'Vertical', value: true },
					{ label: 'Horizontal', value: false }
				]
			},
			{
				label: 'Width',
				title: 'Set the width of the entire plot',
				type: 'number',
				chartType: 'boxplot',
				settingsKey: 'boxplotWidth',
				debounceInterval: 500
			},
			{
				label: 'Plot height',
				title: 'Set the height of each box plot between 20 and 50',
				type: 'number',
				chartType: 'boxplot',
				settingsKey: 'rowHeight',
				step: 1,
				max: 50,
				min: 20,
				debounceInterval: 500,
				processInput: (val: number) => {
					/**TODO: This is a hack. */
					if (this.useDefaultSettings == true) this.useDefaultSettings = false
					return val
				}
			},
			{
				label: 'Plot padding',
				title: 'Set the space between each box plot. Number must be between 10 and 20',
				type: 'number',
				chartType: 'boxplot',
				settingsKey: 'rowSpace',
				step: 1,
				max: 20,
				min: 10,
				debounceInterval: 500,
				processInput: (val: number) => {
					/**TODO: This is a hack. */
					if (this.useDefaultSettings == true) this.useDefaultSettings = false
					return val
				}
			},
			{
				label: 'Default color',
				type: 'color',
				chartType: 'boxplot',
				settingsKey: 'color',
				getDisplayStyle: (plot: PlotConfig) => (plot.term2 ? 'none' : '')
			},
			{
				label: 'Display mode',
				title: 'Apply a dark theme to the plot',
				type: 'radio',
				chartType: 'boxplot',
				settingsKey: 'displayMode',
				options: [
					{ label: 'Default', value: 'default' },
					{ label: 'Filled', value: 'filled' },
					{ label: 'Dark mode', value: 'dark' }
				]
			}
		]
		this.components.controls = await controlsInit({
			app: this.app,
			id: this.id,
			holder: this.dom.controls.attr('class', 'pp-termdb-plot-controls').style('display', 'inline-block'),
			inputs
		})

		this.components.controls.on('downloadClick.boxplot', () => {
			this.interactions!.download()
		})
		this.components.controls.on('helpClick.boxplot', () => {
			this.interactions!.help()
		})
	}

	getState(appState: MassState) {
		const config = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			termfilter: appState.termfilter,
			config: Object.assign({}, config, {
				settings: {
					boxplot: config.settings.boxplot
				}
			})
		}
	}

	async init() {
		this.dom.div.style('display', 'inline-block').style('margin', '10px')
		this.interactions = new BoxPlotInteractions(this.app, this.dom, this.id)
		try {
			await this.setControls()
		} catch (e: any) {
			console.error(new Error(e.message || e))
		}
	}

	async main() {
		try {
			const config = structuredClone(this.state.config)
			if (config.childType != this.type && config.chartType != this.type) return

			if (!this.interactions) throw 'Interactions not initialized [box plot main()]'

			const settings = config.settings.boxplot
			const model = new Model(config, this.state, this.app, settings)
			const data = await model.getData()
			if (!data?.plots?.length || data['error']) {
				this.interactions!.clearDom()
				this.dom.error.style('padding', '20px 20px 20px 60px').text('No visible box plot data to render')
				return
			}
			const maxLabelLgth = getMaxLabelWidth(
				this.dom.boxplots,
				data.plots.filter(p => !p.isHidden).map(p => p.boxplot.label)
			)
			const viewModel = new ViewModel(config, data, settings, maxLabelLgth, this.useDefaultSettings)

			if (
				(viewModel.rowSpace !== settings.rowSpace || viewModel.rowHeight !== settings.rowHeight) &&
				this.useDefaultSettings == true
			) {
				/** If the row height or space changed during data processing,
				 * save the new settings without calling app.dispatch.
				 * Will show updated value in the controls. */
				settings.rowSpace = viewModel.rowSpace
				settings.rowHeight = viewModel.rowHeight

				this.app.save({
					type: 'plot_edit',
					id: this.id,
					config: {
						settings: {
							boxplot: {
								rowSpace: viewModel.rowSpace,
								rowHeight: viewModel.rowHeight
							}
						}
					}
				})
			}
			new View(viewModel.viewData, settings, this.dom, this.app, this.interactions)
		} catch (e: any) {
			if (e instanceof Error) console.error(e.message || e)
			else if (e.stack) console.log(e.stack)
			throw e
		}
	}
}

export const boxplotInit = getCompInit(TdbBoxplot)
export const componentInit = boxplotInit

export function getDefaultBoxplotSettings(app, overrides = {}) {
	const defaults: BoxPlotSettings = {
		boxplotWidth: 550,
		color: plotColor,
		displayMode: 'default',
		labelPad: 10,
		isLogScale: false,
		isVertical: false,
		orderByMedian: false,
		rowHeight: 50,
		rowSpace: 15
	}
	return Object.assign(defaults, overrides)
}

export async function getPlotConfig(opts, app: MassAppApi) {
	if (!opts.term) throw 'opts.term{} missing [boxplot getPlotConfig()]'
	try {
		await fillTermWrapper(opts.term, app.vocabApi)
		if (opts.term2) await fillTermWrapper(opts.term2, app.vocabApi)
		if (opts.term0) await fillTermWrapper(opts.term0, app.vocabApi)
	} catch (e) {
		console.error(new Error(`${e} [boxplot getPlotConfig()]`))
		throw `boxplot getPlotConfig() failed`
	}

	const config = {
		id: opts.term.term.id,
		settings: {
			controls: {
				term2: null,
				term0: null
			},
			boxplot: getDefaultBoxplotSettings(app, opts.overrides || {})
		}
	}
	return copyMerge(config, opts)
}
