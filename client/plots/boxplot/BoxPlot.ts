import { getCompInit, copyMerge, type RxComponent } from '#rx'
import { PlotBase, defaultUiLabels } from '#plots/PlotBase.ts'
import { fillTermWrapper } from '#termsetting'
import { getCombinedTermFilter } from '#filter'
import { controlsInit } from '#plots/controls.js'
import { Menu, getMaxLabelWidth, DownloadMenu } from '#dom'
import type { Elem } from '../../types/d3'
import type { MassAppApi, MassState } from '#mass/types/mass'
import type { TdbBoxPlotOpts, BoxPlotDom, BoxPlotConfigOpts } from './BoxPlotTypes'
import { Model } from './model/Model'
import { ViewModel } from './viewModel/ViewModel'
import { getChartSubtitle } from './viewModel/ChartsDataMapper'
import { BoxPlotInteractions } from './interactions/BoxPlotInteractions'
import { View } from './view/View'
import { getDefaultBoxplotSettings } from './defaults'
import { setBoxPlotControlInputs } from './BoxPlotControlInputs'

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
	configTermKeys = ['term', 'term0', 'term2']

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
		const errorDiv = div.append('div').attr('class', 'sjpp-boxplot-error') //.style('opacity', 0.75)
		const loading = div.append('div').style('padding', '24px').text('Loading ...')
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
			loading,
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
				return this.data?.charts || []
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
		this.interactions = new BoxPlotInteractions(this.app, this.dom, this.id, () => {
			return this.data
		})
		await this.setControls()
	}

	async main() {
		const c = this.state.config
		if (c.childType != this.type && c.chartType != this.type) return
		if (!this.interactions) throw new Error('Interactions not initialized [box plot main()]')

		this.toggleLoadingDiv()

		const config = await this.getMutableConfig()
		const settings = config.settings.boxplot
		const model = new Model(this, config)

		try {
			const data = await model.getData()
			config.term.q.descrStats = data.descrStats
			config.bins = data.bins

			if (data.error) throw new Error(data.error)
			if (!data.charts || !Object.keys(data.charts).length) {
				this.interactions.clearDom()
				this.dom.error.style('padding', '20px 20px 20px 60px').text('No visible box plot data to render')
				this.toggleLoadingDiv('none')
				return
			}
			this.data = data
		} catch (e: any) {
			this.toggleLoadingDiv('none')
			if (this.app.isAbortError(e)) return
			if (e.stack) console.log(e.stack)
			if (e instanceof Error) console.error(e.message || e)
			throw new Error(e)
		}

		this.interactions.clearDom()

		/** The space needed for the labels must be calculated
		 * before calculating the plot dimensions in the view model. */
		const labels: string[] = Object.values(this.data.charts).reduce((labels: string[], chart: any) => {
			const chartLabels = chart.plots.filter(p => !p.isHidden).map(p => p.boxplot.label)
			labels.push(...chartLabels)
			return labels
		}, [])
		const tempsvg = this.dom.charts.append('svg')
		const maxLabelLgth = getMaxLabelWidth(tempsvg.append('g'), labels)
		tempsvg.remove()

		const viewModel = new ViewModel(config, this.data, settings, maxLabelLgth, this.useDefaultSettings)
		if (!viewModel.viewData) throw new Error('No viewData from ViewModel')

		if (
			(viewModel.rowSpace !== settings.rowSpace || viewModel.rowHeight !== settings.rowHeight) &&
			this.useDefaultSettings == true
		) {
			/** TODO: Get rid of this work around
			 *
			 * If the row height or space changed during data processing,
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
		this.toggleLoadingDiv('none')
		new View(viewModel.viewData, settings, this.dom, this.app, this.interactions)
		/** Enables downloading the chart images for DownloadMenu after rendering. */
		this.data.charts = viewModel.viewData.charts
	}

	getChartImages() {
		const chartImages: any[] = []
		const charts: any[] = this.data.charts
		for (const [key, chart] of Object.entries(charts)) {
			const svg: any = chart.svg
			const title = getChartSubtitle(this.state.config, key)
			const name = `${this.state.config.term.term.name}  ${title}`
			chartImages.push({ name, svg })
		}
		return chartImages
	}

	download(event) {
		if (!this.state) return
		const name2svg = this.getChartImages()
		const dm = new DownloadMenu(name2svg, this.state.config.term.term.name)
		dm.show(event.clientX, event.clientY, event.target)
	}

	toggleLoadingDiv(display = '') {
		if (display != 'none') {
			this.dom.loading.style('opacity', 0).style('display', display).transition().duration(3000).style('opacity', 1)
		} else {
			this.dom.loading.style('display', display)
		}
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
