import { getCompInit, copyMerge } from '#rx'
import { fillTermWrapper } from '#termsetting'
import { controlsInit, term0_term2_defaultQ, renderTerm1Label } from '../controls'
import { RxComponentInner } from '../../types/rx.d'
import { plotColor } from '#shared/common.js'
import { Menu } from '#dom'
import type { Div, Elem, SvgG, SvgSvg, SvgText } from '../../types/d3'
import type { MassAppApi } from '#mass/types/mass'
import { Model } from './model/Model'
import { ViewModel } from './viewModel/ViewModel'
import { View } from './view/View'
import { BoxPlotInteractions } from './interactions/BoxPlotInteractions'
import getMaxLabelLgth from './viewModel/MaxLabelLength'

/** Opts sent from mass */
type TdbBoxPlotOpts = {
	holder: Elem
	controls?: Elem
	header?: Elem
	numericEditMenuVersion?: string[]
}

/** User controlled settings. Some settings are calculated based on
 * the number of boxplots */
export type BoxPlotSettings = {
	/** Width of the boxplots and scale, excluding labels */
	boxplotWidth: number
	/** Default is common plot color.  */
	color: string
	/** Toggle between a white and black background */
	darkMode: boolean
	/** Padding between the left hand label and boxplot */
	labelPad: number
	/** If true, order box plots from smallest to largest median value
	 * Default is by alphanumeric order */
	orderByMedian: boolean
	/** Toggle between vertical and horizontal orientation.
	 * The default is false */
	isVertical: boolean
	/** Height of individual boxplots */
	rowHeight: number
	/** Space between the boxplots */
	rowSpace: number
}

/** Descriptions of the dom elements for the box plot */
export type BoxPlotDom = {
	/** Div for boxplots below the scale */
	boxplots: SvgG
	/** Controls div for the hamburger menu */
	controls: Elem
	/** Main div */
	div: Div
	/** Error messages */
	error: Div
	/** Sandbox header */
	header?: Elem
	/** Legend */
	legend: Div
	/** Displays the term1 name as the plot title */
	plotTitle: SvgText
	/** Main svg holder */
	svg: SvgSvg
	/** Y-axis shown above the boxplots */
	axis: any
	/** box plot tooltip (e.g. over the outliers) */
	tip: Menu
}

class TdbBoxplot extends RxComponentInner {
	readonly type = 'boxplot'
	components: { controls: any }
	dom: BoxPlotDom
	interactions: BoxPlotInteractions
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
		this.interactions = new BoxPlotInteractions(this.app, this.dom, this.id)
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
				label: 'Order by median',
				title: 'Order box plots by median value',
				type: 'checkbox',
				chartType: 'boxplot',
				boxLabel: '',
				settingsKey: 'orderByMedian',
				getDisplayStyle: plot => (plot.term2 ? '' : 'none')
			},
			{
				label: 'Orientation',
				title: 'Change the orientation of the box plots',
				type: 'radio',
				chartType: 'boxplot',
				settingsKey: 'isVertical',
				options: [
					{ label: 'Horizontal', value: false },
					{ label: 'Vertical', value: true }
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
				getDisplayStyle: plot => (plot.term2 ? 'none' : '')
			},
			{
				label: 'Dark mode',
				title: 'Apply a dark theme to the plot',
				type: 'checkbox',
				chartType: 'boxplot',
				boxLabel: '',
				settingsKey: 'darkMode'
			}
		]
		this.components.controls = await controlsInit({
			app: this.app,
			id: this.id,
			holder: this.dom.controls.attr('class', 'pp-termdb-plot-controls').style('display', 'inline-block'),
			inputs
		})

		this.components.controls.on('downloadClick.boxplot', () => {
			this.interactions.download()
		})
		this.components.controls.on('helpClick.boxplot', () => {
			this.interactions.help()
		})
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
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
		try {
			await this.setControls()
		} catch (e: any) {
			console.error(new Error(e.message || e))
		}
		//Not the best approach. Come up with a better way.
		this.interactions.setVarAfterInit(this.app, this.id)
	}

	async main() {
		try {
			const config = structuredClone(this.state.config)
			if (config.childType != this.type && config.chartType != this.type) return

			const settings = config.settings.boxplot
			const model = new Model(config, this.state, this.app, settings)
			const data = await model.getData()
			if (!data?.plots?.length || data['error']) {
				this.interactions.clearDom()
				this.dom.error.style('padding', '20px 20px 20px 60px').text('No visible box plot data to render')
				return
			}
			const maxLabelLgth = getMaxLabelLgth(
				this.dom.boxplots,
				data.plots.filter(p => !p.isHidden)
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
		darkMode: false,
		labelPad: 10,
		orderByMedian: false,
		isVertical: true,
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
