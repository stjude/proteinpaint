import { getCompInit, copyMerge } from '../../rx/index.js'
import { fillTermWrapper } from '#termsetting'
import { ScatterModel } from './model/scatterModel.js'
import { ScatterViewModel } from './viewmodel/scatterViewModel.js'
import { ScatterView } from './view/scatterView.js'
import { getCurrentCohortChartTypes } from '../../mass/charts.js'
import { rebaseGroupFilter } from '../../mass/groups.js'
import { plotColor } from '#shared/common.js'
import { RxComponentInner } from '../../types/rx.d.js'
import { filterJoin } from '#filter'
import { ScatterInteractivity, downloadImage } from './viewmodel/scatterInteractivity.js'
import { ScatterViewModel2DLarge } from './viewmodel/scatterViewModel2DLarge.js'
import { ScatterViewModel3D } from './viewmodel/scatterViewModel3D.js'
import { controlsInit } from '../controls'
import { downloadSingleSVG } from '../../common/svg.download.js'
import { select2Terms } from '#dom/select2Terms'

export class Scatter extends RxComponentInner {
	config: any
	view!: ScatterView
	model!: ScatterModel
	vm!: ScatterViewModel
	interactivity!: ScatterInteractivity
	components: any
	canvas: any
	settings: any
	charts: any
	opts: any
	state: any
	readonly type: string

	constructor() {
		super()
		this.type = 'sampleScatter'
	}

	async init(appState) {
		this.config = appState.plots.find(p => p.id === this.id)
		this.view = new ScatterView(this)
		this.model = new ScatterModel(this)
		this.interactivity = new ScatterInteractivity(this)
		if (this.model.is3D) this.vm = new ScatterViewModel3D(this)
		else if (this.config.isLarge) this.vm = new ScatterViewModel2DLarge(this)
		else this.vm = new ScatterViewModel(this)
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			config,
			termfilter: appState.termfilter,
			matrixplots: appState.termdbConfig.matrixplots,
			vocab: appState.vocab,
			termdbConfig: appState.termdbConfig,
			currentCohortChartTypes: getCurrentCohortChartTypes(appState),
			groups: rebaseGroupFilter(appState)
		}
	}

	async main() {
		this.config = structuredClone(this.state.config)
		if (this.config.settings.sampleScatter.regression !== 'None' && this.config.term0) {
			if (this.charts) for (const chart of this.charts) chart.chartDiv.selectAll('*').remove()
			this.view.dom.loadingDiv.style('display', 'block').html('Processing data...')
		}

		this.settings = structuredClone(this.config.settings.sampleScatter)
		await this.model.initData()

		if (!this.config.colorColumn) await this.setControls()
		await this.model.processData()
		this.vm.render()
		this.view.dom.loadingDiv.style('display', 'none')

		if (!this.model.is3D) this.vm.setTools()
	}

	getFilter() {
		const tvslst: any = {
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: []
		}
		const sampleCategory =
			'sampleCategory' in this.settings ? this.settings.sampleCategory : this.config.sampleCategory?.defaultValue

		if (sampleCategory) {
			const tw = this.config.sampleCategory.tw
			tvslst.lst.push({
				type: 'tvs',
				tvs: {
					term: tw.term,
					values: [{ key: sampleCategory }]
				}
			})
		}
		const filters = [this.state.termfilter.filter, tvslst]
		if (this.config.filter) filters.push(this.config.filter)
		const filter = filterJoin(filters)
		return filter
	}

	async setControls() {
		this.view.dom.controlsHolder.selectAll('*').remove()
		const inputs = this.view.getControlInputs()
		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: this.view.dom.controlsHolder,
				inputs
			})
		}
		// TODO: handle multiple chart download when there is a divide by term
		this.components.controls.on('downloadClick.scatter', () => {
			if (this.model.is2DLarge || this.model.is3D) {
				const url = this.canvas.toDataURL('image/png')
				downloadImage(url)
			} else for (const chart of this.charts) downloadSingleSVG(chart.svg, 'scatter.svg', this.opts.holder.node())
		})
	}
}

export async function getPlotConfig(opts, app) {
	//if (!opts.colorTW) throw 'sampleScatter getPlotConfig: opts.colorTW{} missing'
	//if (!opts.name && !(opts.term && opts.term2)) throw 'sampleScatter getPlotConfig: missing coordinates input'

	const plot: any = {
		groups: [],
		settings: {
			controls: {
				isOpen: false // control panel is hidden by default
			},
			sampleScatter: getDefaultScatterSettings(),
			startColor: {}, //dict to store the start color of the gradient for each chart when using continuous color
			stopColor: {} //dict to store the stop color of the gradient for each chart when using continuous color
		}
	}

	try {
		let defaultConfig = {}
		// observe default config specified in ds, if available
		if (opts.name) {
			const p = app.vocabApi?.termdbConfig?.scatterplots?.find(i => i.name == opts.name)
			if (p) defaultConfig = p
		}
		copyMerge(plot, defaultConfig, opts)

		if (plot.colorTW) await fillTermWrapper(plot.colorTW, app.vocabApi)
		if (plot.shapeTW) await fillTermWrapper(plot.shapeTW, app.vocabApi)
		if (plot.term) await fillTermWrapper(plot.term, app.vocabApi)
		if (plot.term2) await fillTermWrapper(plot.term2, app.vocabApi)
		if (plot.term0) await fillTermWrapper(plot.term0, app.vocabApi)
		if (plot.scaleDotTW) await fillTermWrapper(plot.scaleDotTW, app.vocabApi)
		if (plot.sampleCategory) await fillTermWrapper(plot.sampleCategory.tw, app.vocabApi)

		// apply term-specific changes to the default object
		if (!plot.term && !plot.term2) plot.settings.sampleScatter.showAxes = false

		if (plot.term0?.q?.mode == 'continuous' && !app.hasWebGL())
			throw 'Can not load Z/Divide by term in continuous mode as WebGL is not supported'

		return plot
	} catch (e) {
		console.log(e)
		throw `${e} [sampleScatter getPlotConfig()]`
	}
}

export const scatterInit = getCompInit(Scatter)
// this alias will allow abstracted dynamic imports
export const componentInit = scatterInit

export function makeChartBtnMenu(holder, chartsInstance) {
	const menuDiv = holder.append('div')
	if (chartsInstance.state.termdbConfig.scatterplots)
		if (
			chartsInstance.state.termdbConfig.scatterplots.length == 1 &&
			!chartsInstance.state.currentCohortChartTypes.includes('dynamicScatter')
		)
			openScatterPlot(chartsInstance.app, chartsInstance.state.termdbConfig.scatterplots[0])
		else {
			for (const plot of chartsInstance.state.termdbConfig.scatterplots) {
				/* plot: 
				{
					name=str,
					dimensions=int,
					term={ id, ... }
				}
				*/
				menuDiv
					.append('button')
					.style('margin', '5px')
					.style('padding', '10px 15px')
					.style('border-radius', '20px')
					.style('border-color', '#ededed')
					.style('display', 'block')
					.text(plot.name)
					.on('click', () => {
						openScatterPlot(chartsInstance.app, plot)
						chartsInstance.dom.tip.hide()
					})
			}
		}

	// if "dynamicScatter" child type is present in currentCohortChartTypes, render the numeric term selection ui for dynamicScatter. if not, do not render ui
	if (chartsInstance.state.currentCohortChartTypes.includes('dynamicScatter')) {
		// dynamicScatter is enabled for this cohort. render ui and break loop
		const callback = (xterm, yterm) => {
			chartsInstance.app.dispatch({
				type: 'plot_create',
				config: {
					chartType: 'sampleScatter',
					term: { term: xterm, q: { mode: 'continuous' } },
					term2: { term: yterm, q: { mode: 'continuous' } },
					name: `${xterm.name} vs ${yterm.name}`
				}
			})
		}
		select2Terms(chartsInstance.dom.tip, chartsInstance.app, 'sampleScatter', 'numeric', callback)
	}
}

export function getDefaultScatterSettings() {
	return {
		size: 0.8,
		minShapeSize: 0.5,
		maxShapeSize: 4,
		scaleDotOrder: 'Ascending',
		refSize: 0.8,
		svgw: 600,
		svgh: 600,
		svgd: 600,
		axisTitleFontSize: 16,
		showAxes: true,
		showRef: true,
		opacity: 0.6,
		defaultColor: plotColor,
		regression: 'None',
		fov: 50,
		threeSize: 0.005,
		threeFOV: 70,
		// Color scale configuration settings
		// These settings control how numerical values are mapped to colors
		colorScaleMode: 'auto', // Default to automatic scaling based on data range
		// Other options: 'fixed' (user-defined range) or
		// 'percentile' (scale based on data distribution)

		colorScalePercentile: 95, // Default percentile for percentile mode
		// This means we'll scale colors based on values
		// up to the 95th percentile by default
		colorScaleMinFixed: null, // User-defined minimum value for fixed mode
		// Null indicates this hasn't been set yet
		colorScaleMaxFixed: null, // User-defined maximum value for fixed mode
		// Null indicates this hasn't been set yet
		//3D Plot settings
		showContour: false,
		colorContours: false,
		contourBandwidth: 30,
		contourThresholds: 10,
		duration: 500
	}
}

export function openScatterPlot(app, plot, filter = null) {
	const config: any = {
		chartType: 'sampleScatter',
		name: plot.name,
		filter
	}
	if (plot.sampleCategory)
		config.sampleCategory = {
			tw: structuredClone(plot.sampleCategory.tw),
			order: plot.sampleCategory.order,
			defaultValue: plot.sampleCategory.defaultValue
		}
	if (plot.sampleType) config.sampleType = plot.sampleType
	if (plot.colorTW) config.colorTW = structuredClone(plot.colorTW)
	else if (plot.colorColumn) config.colorColumn = structuredClone(plot.colorColumn)

	if ('shapeTW' in plot) config.shapeTW = structuredClone(plot.shapeTW)
	if (plot.settings) config.settings = structuredClone(plot.settings)
	app.dispatch({
		type: 'plot_create',
		config: config
	})
}

export async function renderScatter(holder, state, plot) {
	const opts = {
		holder,
		state: {
			vocab: state.vocab,
			plots: [
				{
					chartType: 'sampleScatter',
					subfolder: 'plots',
					name: plot.name,
					colorTW: plot.colorTW,
					sampleType: plot.sampleType,
					sampleCategory: {
						tw: structuredClone(plot.sampleCategory.tw),
						order: plot.sampleCategory.order,
						defaultValue: plot.sampleCategory.defaultValue
					}
				}
			]
		}
	}
}
