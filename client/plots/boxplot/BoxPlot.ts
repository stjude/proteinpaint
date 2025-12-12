import { getCompInit, copyMerge, type RxComponent } from '#rx'
import { PlotBase, defaultUiLabels } from '#plots/PlotBase.ts'
import { fillTermWrapper } from '#termsetting'
import { getCombinedTermFilter } from '#filter'
import { Menu, getMaxLabelWidth, DownloadMenu } from '#dom'
import type { Elem } from '../../types/d3'
import type { MassAppApi, MassState } from '#mass/types/mass'
import type { TdbBoxPlotOpts, BoxPlotDom, BoxPlotConfigOpts } from './BoxPlotTypes'
import { Model } from './model/Model'
import { ViewModel, getChartTitle } from './viewModel/ViewModel'
import { BoxPlotInteractions } from './interactions/BoxPlotInteractions'
import { LegendRenderer } from './view/LegendRender'
import { AssociationTableRender } from './view/AssociationTableRender'
import { View } from './view/View'
import { getDefaultBoxplotSettings } from './defaults'
import { setBoxPlotControlInputs } from './BoxPlotControlInputs'
import { controlsInit } from '#plots/controls.js'

export class TdbBoxplot extends PlotBase implements RxComponent {
	static type = 'boxplot'
	type: string
	components: { controls: any }
	dom: BoxPlotDom
	data: any
	interactions?: BoxPlotInteractions
	private useDefaultSettings = true
	parentId?: string
	api: any

	constructor(opts: TdbBoxPlotOpts, api: MassAppApi) {
		super(opts)
		this.opts = opts
		this.api = api
		this.type = TdbBoxplot.type
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
		const state = this.getState(this.app.getState())
		const inputs = setBoxPlotControlInputs(
			state,
			this.app,
			this.opts,
			() => {
				return this.data
			},
			this.useDefaultSettings
		)
		this.components.controls = await controlsInit({
			app: this.app,
			id: this.id,
			holder: this.dom.controls.style('display', 'inline-block'),
			inputs
		})

		this.components.controls.on('downloadClick.boxplot', event => {
			this.download(event)
		})
		this.components.controls.on('helpClick.boxplot', () => {
			this.interactions!.help()
		})

		if (state.vocab.dslabel.toLowerCase() == 'gdc') {
			//Remove for now. May add gdc specific user guide
			//in interactions.help later.
			this.dom.controls.select('div[aria-label="Documentation"]').remove()
		}
	}

	reactsTo(action) {
		if (action.type.startsWith('plot_')) {
			return (
				(action.id === this.id || action.id == this.parentId) &&
				(!action.config?.childType || action.config?.childType == this.type)
			)
		}
		return true
	}

	getState(appState: MassState) {
		const config = appState.plots.find((p: any) => p.id === this.id)
		if (!config) {
			throw new Error(
				`No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
			)
		}
		const parentConfig = appState.plots.find(p => p.id === this.parentId)
		const termfilter = getCombinedTermFilter(appState, config.filter || parentConfig?.filter)
		return {
			termdbConfig: appState.termdbConfig,
			termfilter,
			vocab: appState.vocab,
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
		await this.setControls()
	}

	async main() {
		const config = structuredClone(this.state.config)
		if (config.childType != this.type && config.chartType != this.type) return

		if (!this.interactions) throw new Error('Interactions not initialized [box plot main()]')

		const settings = config.settings.boxplot
		const model = new Model(this, config)

		try {
			const data = await model.getData()
			config.term.q.descrStats = data.descrStats

			if (data.error) throw new Error(data.error)
			if (!data.charts || !Object.keys(data.charts).length) {
				this.interactions!.clearDom()
				this.dom.error.style('padding', '20px 20px 20px 60px').text('No visible box plot data to render')
				return
			}
			this.data = data
			this.dom.charts.selectAll('*').remove()

			/** TODO: Refactor all of the code below into mvvm
			 * pattern. This breaks maintainability and separation of concerns. */
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
					/** Fix this. Move to ViewModel, figure out for all plots once, only call app.save once.*/

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
				//Temp fix
				const assocTableDiv = chartDiv
					.append('div')
					.attr('class', 'sjpp-boxplot-assocTableDiv')
					.style('display', 'inline-block')
				const chartDom = Object.assign({}, this.dom, {
					svg: chartSvg,
					chartTitle,
					plotTitle: chartSvg.append('text'),
					axis: chartSvg.append('g'),
					boxplots: chartSvg.append('g'),
					assocTableDiv: assocTableDiv
				})
				// render the view
				new View(viewModel.viewData, settings, chartDom, this.app, this.interactions)
				//Temp fix: This should be handled by the view
				if (chart.wilcoxon) new AssociationTableRender(chartDom.assocTableDiv, chart.wilcoxon)
			}
			// render legend (applies to all charts)
			this.dom.legend.selectAll('*').remove()
			const textColor = settings.displayMode == 'dark' ? 'white' : 'black'
			if (legend.length) new LegendRenderer(this.dom.legend, legend, this.interactions, textColor)
		} catch (e: any) {
			if (this.app.isAbortError(e)) return
			if (e.stack) console.log(e.stack)
			if (e instanceof Error) console.error(e.message || e)
			throw new Error(e)
		}
	}

	getChartImages() {
		const chartImages: any[] = []
		const charts: any[] = this.data.charts
		for (const [key, chart] of Object.entries(charts)) {
			const svg: any = chart.svg
			const title = getChartTitle(this.state.config, key)
			const name = `${this.state.config.term.term.name}  ${title}`
			chartImages.push({ name, svg })
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

export async function getPlotConfig(opts: BoxPlotConfigOpts, app: MassAppApi) {
	if (!opts.term) throw new Error('opts.term{} missing')
	try {
		await fillTermWrapper(opts.term, app.vocabApi)
		if (opts.term2) await fillTermWrapper(opts.term2, app.vocabApi)
		if (opts.term0) await fillTermWrapper(opts.term0, app.vocabApi)
	} catch (e) {
		console.error(new Error(`${e} [boxplot getPlotConfig()]`))
		throw new Error(`boxplot getPlotConfig() failed`)
	}

	const config = {
		id: opts.term.term.id,
		controlLabels: Object.assign({}, defaultUiLabels, app.vocabApi.termdbConfig.uiLabels || {}),
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
