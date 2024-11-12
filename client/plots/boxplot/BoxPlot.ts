import { getCompInit, copyMerge } from '../../rx'
import { fillTermWrapper } from '#termsetting'
import { controlsInit, term0_term2_defaultQ } from '../controls'
import { RxComponent } from '../../types/rx.d'
import { plotColor } from '#shared/common.js'
import type { Div, Elem, SvgG, SvgSvg, SvgText } from '../../types/d3'
import type { MassAppApi } from '#mass/types/mass'
import { Model } from './Model'
import { ViewModel } from './ViewModel'
import { View } from './View'
import { BoxPlotInteractions } from './BoxPlotInteractions'
import getMaxLabelLgth from './MaxLabelLength'

/** TODOs:
 *	Type for config
 *	Add functionality to change orientation
 *	Add controls for: 
	- multicolor boxplots when !term2
 */

type TdbBoxPlotOpts = {
	holder: Elem
	controls?: Elem
	header?: Elem
	numericEditMenuVersion?: string[]
}

export type BoxPlotSettings = {
	/** Width of the boxplots and scale, excluding labels */
	boxplotWidth: number
	/** Default is common plot color.  */
	color: string
	/** Padding between the left hand label and boxplot */
	labelPad: number
	/** Height of individual boxplots */
	rowHeight: number
	/** Space between the boxplots */
	rowSpace: number
	useDefaultSettings: boolean
}

export type BoxPlotDom = {
	/** Div for boxplots below the scale */
	boxplots: SvgG
	/** Controls div for the hamburger menu */
	controls: Elem
	/** Main div */
	div: Div
	/** Sandbox header */
	header?: Elem
	/** Legend */
	legend: Div
	/** Displays the term1 name as the plot title */
	plotTitle: SvgText
	/** Main svg holder */
	svg: SvgSvg
	/** Y-axis shown above the boxplots */
	yAxis: any
}

class TdbBoxplot extends RxComponent {
	readonly type = 'boxplot'
	components: { controls: any }
	dom: BoxPlotDom
	interactions: BoxPlotInteractions
	useDefaultSettings = true
	constructor(opts: TdbBoxPlotOpts) {
		super()
		this.opts = opts
		this.components = {
			controls: {}
		}
		const holder = opts.holder.classed('sjpp-boxplot-main', true)
		const controls = opts.controls ? holder : holder.append('div')
		const div = holder.append('div')
		const svg = div.append('svg').style('display', 'inline-block').attr('id', 'sjpp-boxplot-svg')
		this.dom = {
			controls: controls as Elem,
			div,
			svg,
			plotTitle: svg.append('text'),
			yAxis: svg.append('g'),
			boxplots: svg.append('g'),
			legend: div.append('div').attr('id', 'sjpp-boxplot-legend')
		}
		this.interactions = new BoxPlotInteractions(this.dom)
		if (opts.header) this.dom.header = opts.header.html('Box plot')
	}

	async setControls() {
		const inputs = [
			{
				type: 'term',
				configKey: 'term',
				chartType: 'boxplot',
				usecase: { target: 'boxplot', detail: 'term' },
				label: 'Customize',
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
				label: 'Width',
				title: 'Width of the entire plot',
				type: 'number',
				chartType: 'boxplot',
				settingsKey: 'boxplotWidth',
				debounceInterval: 500
			},
			{
				label: 'Plot height',
				title: 'Height of each box plot',
				type: 'number',
				chartType: 'boxplot',
				settingsKey: 'rowHeight',
				step: 1,
				max: 50,
				min: 20,
				debounceInterval: 500
			},
			{
				label: 'Plot padding',
				title: 'Space between each box plot',
				type: 'number',
				chartType: 'boxplot',
				settingsKey: 'rowSpace',
				step: 1,
				max: 20,
				min: 10,
				debounceInterval: 500
			},
			{
				label: 'Default color',
				type: 'color',
				chartType: 'boxplot',
				settingsKey: 'color',
				getDisplayStyle: plot => (plot.term2 ? 'none' : '')
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
			config: {
				term: config.term,
				term2: config.term2,
				settings: {
					boxplot: config.settings.boxplot
				}
			}
		}
	}

	async init() {
		this.dom.div.style('display', 'inline-block').style('margin', '10px')
		try {
			await this.setControls()
		} catch (e: any) {
			console.error(new Error(e.message || e))
		}
	}

	async main() {
		try {
			const state = this.app.getState()
			const config = structuredClone(state.plots.find((p: any) => p.id === this.id))
			if (config.childType != 'boxplot') return

			const settings = config.settings.boxplot
			const model = new Model(config, state, this.app, settings)
			const data = await model.getData()
			if (!data?.plots?.length) {
				this.app.printError('No data found for box plot')
			}
			const maxLabelLgth = getMaxLabelLgth(
				this.dom,
				data.plots.filter(p => !p.uncomputable)
			)
			const viewModel = new ViewModel(config, data, settings, maxLabelLgth)

			if (viewModel.rowSpace !== settings.rowSpace || viewModel.rowHeight !== settings.rowHeight) {
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
								rowHeight: viewModel.rowHeight,
								useDefaultSettings: false
							}
						}
					}
				})
			}
			new View(viewModel.viewData, settings, this.dom)
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
		labelPad: 10,
		rowHeight: 50,
		rowSpace: 15,
		useDefaultSettings: true
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
