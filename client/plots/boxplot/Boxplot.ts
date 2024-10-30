import { getCompInit, copyMerge } from '../../rx'
import { fillTermWrapper } from '#termsetting'
import { controlsInit, term0_term2_defaultQ } from '../controls'
import { RxComponent } from '../../types/rx.d'
import { Model } from './Model'
import { ViewModel } from './ViewModel'
import { View } from './View'
import { plotColor } from '#shared/common.js'
import type { Elem } from '../../types/d3'

/** TODOs:
 *	Old code `this.components.controls.on('downloadClick.boxplot', this.download)`. Needed?
 *	Add other controls
 *	Hover effect?
 *	Descriptive stats tables?
 *	Fix issues toggling between summary plots
 *	Types for config and data
 */

export type BoxplotSettings = {
	/** Width of the boxplots and scale, excluding labels */
	boxplotWidth: number
	/** TODO: colors? or use schema? Default is common plot color.  */
	color: string
	/** Padding between the left hand label and boxplot */
	labelPad: number
	/** Height of individual boxplots */
	rowHeight: number
	/** Space between the boxplots */
	rowSpace: number
}

export type BoxplotDom = {
	/** Div for boxplots below the scale */
	boxplots: Elem
	/** Controls div for the hamburger menu */
	controls: Elem
	/** Main div */
	div: Elem
	/** Sandbox header */
	header?: Elem
	/** Displays the term1 name as the plot title */
	plotTitle: Elem
	/** Main svg holder */
	svg: Elem
	/** Y-axis shown above the boxplots */
	yAxis: any
}

class TdbBoxplot extends RxComponent {
	readonly type = 'boxplot'
	components: { controls: any }
	dom: BoxplotDom
	constructor(opts) {
		super()
		this.opts = opts
		this.components = {
			controls: {}
		}
		const holder = opts.holder.classed('sjpp-boxplot-main', true)
		const controls = opts.controls ? holder : holder.append('div')
		const div = opts.controls ? holder : holder.append('div')
		const svg = div.append('svg').style('display', 'inline-block').attr('class', 'sjpp-boxplot-svg')
		this.dom = {
			controls,
			div,
			svg,
			plotTitle: svg.append('text'),
			yAxis: svg.append('g'),
			boxplots: svg.append('g')
		}
		if (opts.header) this.dom.header = opts.header.html('Boxplot')
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
			}
		]
		this.components.controls = await controlsInit({
			app: this.app,
			id: this.id,
			holder: this.dom.controls.attr('class', 'pp-termdb-plot-controls').style('display', 'inline-block'),
			inputs
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
			this.dom.plotTitle.selectAll('*').remove()
			this.dom.yAxis.selectAll('*').remove()
			this.dom.boxplots.selectAll('*').remove()

			const state = this.app.getState()
			const config = structuredClone(state.plots.find((p: any) => p.id === this.id))
			if (config.childType != 'boxplot') return
			const settings = config.settings.boxplot

			const model = new Model(config, state, this.app, settings)
			const data = await model.getData()
			if (!data.plots.length) {
				this.app.printError('No data found for boxplot')
			}
			const viewData = new ViewModel(config, data, settings)
			new View(viewData, settings, this.dom)
		} catch (e: any) {
			console.error(new Error(e.message || e))
		}
	}
}

export const boxplotInit = getCompInit(TdbBoxplot)
export const componentInit = boxplotInit

export function getDefaultBoxplotSettings(app, overrides = {}) {
	const defaults: BoxplotSettings = {
		boxplotWidth: 550,
		color: plotColor,
		labelPad: 10,
		rowHeight: 60,
		rowSpace: 5
	}
	return Object.assign(defaults, overrides)
}

export async function getPlotConfig(opts, app) {
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
