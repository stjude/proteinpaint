import { getCompInit, copyMerge } from '#rx'
import { fillTermWrapper } from '#termsetting'
import { controlsInit, term0_term2_defaultQ, renderTerm1Label } from '../controls'
import { RxComponentInner } from '../../types/rx.d'
import { plotColor } from '#shared/common.js'
import { Menu, getMaxLabelWidth } from '#dom'
import type { Elem } from '../../types/d3'
import type { MassAppApi, MassState } from '#mass/types/mass'
import type { TdbBoxPlotOpts, BoxPlotSettings, BoxPlotDom, BoxPlotConfigOpts } from './BoxPlotTypes'
import { Model } from './model/Model'
import { ViewModel } from './viewModel/ViewModel'
import { View } from './view/View'
import { BoxPlotInteractions } from './interactions/BoxPlotInteractions'
import { LegendRenderer } from './view/LegendRender'
import { DownloadMenu } from '#dom'
import { getChartTitle } from './viewModel/ViewModel'
class TdbBoxplot extends RxComponentInner {
	readonly type = 'boxplot'
	components: { controls: any }
	dom: BoxPlotDom
	data: any
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
		const div = holder.append('div')
		const errorDiv = div.append('div').attr('class', 'sjpp-boxplot-error').style('opacity', 0.75)
		const chartsDiv = div
			.append('div')
			.attr('class', 'sjpp-boxplot-charts')
			.style('display', 'flex')
			.style('flex-direction', 'row')
			.style('flex-wrap', 'wrap')
			.style('max-width', '100vw')
		this.dom = {
			controls: controls as Elem,
			div,
			error: errorDiv,
			charts: chartsDiv,
			legend: div.append('div').attr('class', 'sjpp-boxplot-legend').style('margin-top', '25px'),
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
				type: 'term',
				configKey: 'term0',
				chartType: 'boxplot',
				usecase: { target: 'boxplot', detail: 'term0' },
				title: 'Divide by data',
				label: 'Divide by',
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
				getDisplayStyle: () => {
					let style = 'none'
					for (const k of Object.keys(this.data.charts)) {
						const chart = this.data.charts[k]
						if (chart.plots.length > 1) style = ''
					}
					return style
				}
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
				getDisplayStyle: () => {
					let style = ''
					for (const k of Object.keys(this.data.charts)) {
						const chart = this.data.charts[k]
						if (chart.plots.length > 1) style = 'none'
					}
					return style
				}
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

		this.components.controls.on('downloadClick.boxplot', event => {
			this.download(event)
		})
		this.components.controls.on('helpClick.boxplot', () => {
			this.interactions!.help()
		})
	}

	getState(appState: MassState) {
		const config = appState.plots.find((p: any) => p.id === this.id)
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
		this.dom.div.style('display', 'inline-block').style('margin-left', '20px')
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
			if (data.error) throw data.error
			if (!data.charts || !Object.keys(data.charts).length) {
				this.interactions!.clearDom()
				this.dom.error.style('padding', '20px 20px 20px 60px').text('No visible box plot data to render')
				return
			}
			this.data = data

			this.dom.charts.selectAll('*').remove()

			// determine max label length across all charts
			const labels: any = []
			const tempsvg = this.dom.charts.append('svg')
			for (const key of Object.keys(data.charts)) {
				const chart = data.charts[key]
				const chartLabels = chart.plots.filter(p => !p.isHidden).map(p => p.boxplot.label)
				labels.push(...chartLabels)
			}
			const maxLabelLgth = getMaxLabelWidth(tempsvg.append('g'), labels)
			tempsvg.remove()

			// plot charts
			const legend: any = [] // legend items across charts
			for (const key of Object.keys(data.charts)) {
				const chart = data.charts[key]
				chart.absMin = data.absMin
				chart.absMax = data.absMax
				chart.uncomputableValues = data.uncomputableValues
				// get view model of chart
				const viewModel = new ViewModel(config, chart, settings, maxLabelLgth, this.useDefaultSettings)
				// collect legend items
				for (const l of viewModel.viewData.legend) {
					if (!legend.find(x => x.label == l.label)) legend.push(l)
				}
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
				// render view of chart
				// setup a dom{} object for the chart
				const chartDiv = this.dom.charts
					.append('div')
					.attr('class', 'sjpp-boxplot-chartDiv')
					.style('padding', Object.keys(data.charts).length > 1 ? '20px 20px 0px 0px' : '0px')
				const chartSvg = chartDiv.append('svg')
				chart.svg = chartSvg // for downloading svg
				const chartTitle = chartDiv
					.append('div')
					.attr('class', 'pp-chart-title')
					.style('display', config.term0 ? 'block' : 'none')
					.style('text-align', 'center')
					.style('font-size', '1.1em')
					.style('margin-bottom', '20px')
				const chartDom = Object.assign({}, this.dom, {
					svg: chartSvg,
					chartTitle,
					plotTitle: chartSvg.append('text'),
					axis: chartSvg.append('g'),
					boxplots: chartSvg.append('g')
				})
				// render the view
				new View(viewModel.viewData, settings, chartDom, this.app, this.interactions)
			}
			// render legend (applies to all charts)
			this.dom.legend.selectAll('*').remove()
			const textColor = settings.displayMode == 'dark' ? 'white' : 'black'
			if (legend.length) new LegendRenderer(this.dom.legend, legend, this.interactions, textColor)
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			if (e instanceof Error) console.error(e.message || e)
			throw e
		}
	}

	getChartImages() {
		const chartImages: any[] = []
		const charts: any[] = this.data.charts
		for (const [key, chart] of Object.entries(charts)) {
			const svg: any = chart.svg
			const title = getChartTitle(this.state.config, key)
			const name = `${this.state.config.term.term.name}  ${title}`
			chartImages.push({ name, svg, parent: svg.node() })
		}
		return chartImages
	}

	download(event) {
		if (!this.state) return

		const name2svg = this.getChartImages()
		const dm = new DownloadMenu(name2svg, this.state.config.term.term.name)
		dm.show(event.clientX, event.clientY)
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

export async function getPlotConfig(opts: BoxPlotConfigOpts, app: MassAppApi) {
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
