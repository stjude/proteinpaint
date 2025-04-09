import { getCompInit, copyMerge } from '../rx/index.js'
import { fillTermWrapper } from '#termsetting'
import { Menu, shapesArray, select2Terms } from '#dom'
import { controlsInit } from './controls.js'
import { setRenderers } from './runChart.renderer.js'
import { setInteractivity } from './runChart.interactivity.js'
import { getCurrentCohortChartTypes } from '../mass/charts.js'
import { downloadSingleSVG } from '../common/svg.download.js'
import { select } from 'd3-selection'
import { plotColor } from '#shared/common.js'
import { filterJoin } from '#filter'
import { isNumericTerm } from '@sjcrh/proteinpaint-shared/terms.js'

/*
sample object returned by server:
{
	sample=str
	x=number
	y=number
	category=str
}

NOTE
"sample" and "category" attributes here are hardcoded

*/
export const minShapeSize = 0.2
export const maxShapeSize = 4
//icons have size 16x16
export const shapes = shapesArray

const numberOfSamplesCutoff = 20000 // if map is greater than cutoff, switch from svg to canvas rendering

class RunChart {
	type: string
	zoom: number
	startGradient: object
	stopGradient: object
	opts!: any
	dom: any
	app: any
	id!: any
	settings: any
	config!: any
	filtersData: any
	charts: any
	axisOffset: any
	coordsTW!: object[]
	range: any
	years!: number[]
	state: any
	components: any
	filterTWs: any
	processData!: () => Promise<void>
	render!: () => Promise<void>
	setTools!: () => Promise<void>

	constructor() {
		this.type = 'runChart'
		this.zoom = 1
		this.startGradient = {}
		this.stopGradient = {}
	}

	async init(appState) {
		const state = this.getState(appState)
		this.filterTWs = [state.config.countryTW, state.config.siteTW]
		this.filtersData = await this.app.vocabApi.getAnnotatedSampleData({
			terms: structuredClone(this.filterTWs),
			termsPerRequest: 10
		})
		const leftDiv = this.opts.holder.insert('div').style('display', 'inline-block')
		const controlsHolder = leftDiv
			.insert('div')
			.style('display', 'inline-block')
			.attr('class', 'pp-termdb-plot-controls')
		const mainDiv = this.opts.holder.insert('div').style('display', 'inline-block').style('vertical-align', 'top')

		const offsetX = 80
		this.axisOffset = { x: offsetX, y: 30 }

		this.dom = {
			header: this.opts.header,
			mainDiv,
			//holder,
			loadingDiv: this.opts.holder.append('div').style('position', 'absolute').style('left', '45%').style('top', '60%'),
			tip: new Menu({ padding: '0px' }),
			tooltip: new Menu({ padding: '2px', offsetX: 10, offsetY: 0 }),
			controlsHolder,
			toolsDiv: leftDiv.insert('div')
		}
		this.dom.header.html('Run Chart')
		this.settings = {}
		setInteractivity(this)
		setRenderers(this)
		document.addEventListener('scroll', event => this?.dom?.tooltip?.hide())
		select('.sjpp-output-sandbox-content').on('scroll', event => this.dom.tooltip.hide())
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
			currentCohortChartTypes: getCurrentCohortChartTypes(appState)
		}
	}

	// creates an opts object for the vocabApi.someMethod(),
	// may need to add a new method to client/termdb/vocabulary.js
	// for now, just add methods to TermdbVocab,
	// later on, add methods with same name to FrontendVocab
	getDataRequestOpts() {
		const c = this.config
		const coordTWs: object[] = []
		if (c.term) coordTWs.push(c.term)
		if (c.term2) coordTWs.push(c.term2)
		const filter = this.getFilter()
		const opts: any = {
			name: c.name, // the actual identifier of the plot, for retrieving data from server
			colorTW: c.colorTW,
			filter,
			coordTWs
		}
		if (c.shapeTW) opts.shapeTW = c.shapeTW
		if (c.scaleDotTW) {
			if (!c.scaleDotTW.q) c.scaleDotTW.q = {}
			c.scaleDotTW.q.mode = 'continuous'
			opts.scaleDotTW = c.scaleDotTW
		}
		if (c.term0) opts.divideByTW = c.term0

		return opts
	}

	// called in relevant dispatch when reactsTo==true
	// or current.state != replcament.state
	async main() {
		this.config = structuredClone(this.state.config)
		this.settings = this.config.settings.runChart
		if (this.config.settings.runChart.regression !== 'None' && this.config.term0) {
			if (this.charts) for (const chart of this.charts) chart.chartDiv.selectAll('*').remove()
			this.dom.loadingDiv.style('display', 'block').html('Processing data...')
		}

		copyMerge(this.settings, this.config.settings.runChart)
		const reqOpts = this.getDataRequestOpts()
		if (reqOpts.coordTWs.length == 1) return //To allow removing a term in the controls, though nothing is rendered (summary tab with violin active)

		const data = await this.app.vocabApi.getScatterData(reqOpts)
		if (data.error) throw data.error
		this.range = data.range
		this.charts = []
		for (const [key, chartData] of Object.entries(data.result)) {
			this.createChart(key, chartData)
		}
		await this.setControls()
		this.initRanges()
		await this.processData()
		this.render()
		this.dom.loadingDiv.style('display', 'none')

		this.setTools()
		this.dom.tip.hide()
	}

	createChart(id, data) {
		const samples = data.samples
		const colorLegend = new Map(data.colorLegend)
		const shapeLegend = new Map(data.shapeLegend)
		this.charts.push({ id, samples, colorLegend, shapeLegend })
	}

	initRanges() {
		const samples: any = []
		for (const chart of this.charts) samples.push(...chart.samples)
		if (samples.length == 0) return

		const s0: any = samples[0] //First sample to start reduce comparisons
		const [xMin, xMax, yMin, yMax, zMin, zMax, scaleMin, scaleMax] = samples.reduce(
			(s, d) => [
				d.x < s[0] ? d.x : s[0],
				d.x > s[1] ? d.x : s[1],
				d.y < s[2] ? d.y : s[2],
				d.y > s[3] ? d.y : s[3],
				d.z < s[4] ? d.z : s[4],
				d.z > s[5] ? d.z : s[5],
				'scale' in d ? (d.scale < s[6] ? d.scale : s[6]) : Number.POSITIVE_INFINITY,
				'scale' in d ? (d.scale > s[7] ? d.scale : s[7]) : Number.NEGATIVE_INFINITY
			],
			[s0.x, s0.x, s0.y, s0.y, s0.z, s0.z, s0.scale, s0.scale]
		)
		for (const chart of this.charts) {
			chart.xMin = xMin
			chart.xMax = xMax
			chart.yMin = yMin
			chart.yMax = yMax
			chart.zMin = zMin
			chart.zMax = zMax
			chart.scaleMin = scaleMin
			chart.scaleMax = scaleMax
		}
	}

	getFilter(tw: any = null) {
		const excluded: any = []
		if (tw) excluded.push(tw.$id)
		const lst = []
		for (const tw of this.filterTWs) this.processTW(tw, this.settings[tw.term.id], excluded, lst)

		const tvslst = {
			type: 'tvslst',
			in: true,
			join: 'and',
			lst
		}
		const filter = filterJoin([this.state.termfilter.filter, tvslst])
		return filter
	}

	processTW(tw, value, excluded, lst) {
		if (value && !excluded.includes(tw.$id))
			lst.push({
				type: 'tvs',
				tvs: {
					term: tw.term,
					values: [{ key: value }]
				}
			})
	}

	getList(tw, samplesPerFilter: any) {
		const values: any = Object.values(tw.term.values)
		values.sort((v1: any, v2: any) => v1.label.localeCompare(v2.label))
		const twSamples = samplesPerFilter[tw.term.id]
		const data: any = []
		for (const sample of twSamples) {
			data.push(this.filtersData.samples[sample])
		}
		//select samples with data for that term
		const sampleValues = Array.from(new Set(data.map(sample => sample[tw.$id]?.value)))
		for (const value of values) {
			value.value = value.label
			value.disabled = tw.term.id != this.config.countryTW.term.id ? !sampleValues.includes(value.label) : false
		}
		values.unshift({ label: '', value: '' })
		if (!(tw.term.id in this.settings)) this.settings[tw.term.id] = values[0].label
		return values
	}

	async setControls() {
		this.dom.controlsHolder.selectAll('*').remove()
		const filters = {}
		for (const tw of this.filterTWs) {
			const filter = this.getFilter(tw)
			if (filter) filters[tw.term.id] = filter
		}
		//Dictionary with samples applying all the filters but not the one from the current term id
		const samplesPerFilter = await this.app.vocabApi.getSamplesPerFilter({
			filters
		})

		const countries = this.getList(this.config.countryTW, samplesPerFilter)
		const sites = this.getList(this.config.siteTW, samplesPerFilter)
		const shapeOption = {
			type: 'term',
			configKey: 'shapeTW',
			chartType: 'runChart',
			usecase: { target: 'runChart', detail: 'shapeTW' },
			title: 'Categories to assign a shape',
			label: 'Shape',
			vocabApi: this.app.vocabApi,
			numericEditMenuVersion: ['discrete'],
			processInput: async tw => {
				//only discrete mode allowed so set discrete mode and fill term wrapper to add the bins
				if (isNumericTerm(tw?.term)) {
					tw.q = { mode: 'discrete' } //use discrete mode by default
					await fillTermWrapper(tw, this.app.vocabApi)
				}
			}
		}
		const shapeSizeOption = {
			label: 'Sample size',
			type: 'number',
			chartType: 'runChart',
			settingsKey: 'size',
			title: 'Sample size, represents the factor used to scale the sample',
			min: 0,
			step: 0.1
		}
		const step = (maxShapeSize - minShapeSize) / 10
		const minShapeSizeOption = {
			label: 'Min size',
			type: 'number',
			chartType: 'runChart',
			settingsKey: 'minShapeSize',
			title: 'Minimum sample size',
			min: minShapeSize,
			max: maxShapeSize,
			step
		}
		const maxShapeSizeOption = {
			label: 'Max size',
			type: 'number',
			chartType: 'runChart',
			settingsKey: 'maxShapeSize',
			title: 'Maximum sample size',
			min: minShapeSize,
			max: maxShapeSize * 2,
			step
		}

		const inputs = [
			{
				type: 'term',
				configKey: 'term',
				chartType: 'runChart',
				usecase: { target: 'runChart', detail: 'numeric' },
				title: 'X coordinate to plot the samples',
				label: 'X',
				vocabApi: this.app.vocabApi,
				menuOptions: '!remove',
				numericEditMenuVersion: ['continuous']
			},
			{
				type: 'term',
				configKey: 'term2',
				chartType: 'runChart',
				usecase: { target: 'runChart', detail: 'numeric' },
				title: 'Y coordinate to plot the samples',
				label: 'Y',
				vocabApi: this.app.vocabApi,
				menuOptions: '!remove',
				numericEditMenuVersion: ['continuous']
			},
			{
				label: 'Country',
				type: 'dropdown',
				chartType: 'runChart',
				settingsKey: this.config.countryTW.term.id,
				options: countries,
				callback: value => this.setCountry(value)
			},
			{
				label: 'Site',
				type: 'dropdown',
				chartType: 'runChart',
				settingsKey: this.config.siteTW.term.id,
				options: sites,
				callback: value => this.setFilterValue(this.config.siteTW.term.id, value)
			},

			{
				type: 'term',
				configKey: 'term0',
				chartType: 'runChart',
				usecase: { target: 'runChart', detail: 'term0' },
				title: 'Term to to divide by categories',
				label: 'Divide by',
				vocabApi: this.app.vocabApi,
				numericEditMenuVersion: ['discrete']
			},
			{
				type: 'term',
				configKey: 'colorTW',
				chartType: 'runChart',
				usecase: { target: 'runChart', detail: 'colorTW' },
				title: 'Categories to color the samples',
				label: 'Color',
				vocabApi: this.app.vocabApi,
				numericEditMenuVersion: ['continuous', 'discrete']
			},
			shapeOption,
			shapeSizeOption,

			{
				type: 'term',
				configKey: 'scaleDotTW',
				chartType: 'runChart',
				usecase: { target: 'runChart', detail: 'numeric' },
				title: 'Scale sample by term value',
				label: 'Scale by',
				vocabApi: this.app.vocabApi,
				numericEditMenuVersion: ['continuous']
			},

			{
				label: 'Show regression',
				type: 'dropdown',
				chartType: 'runChart',
				settingsKey: 'regression',
				options: [
					{ label: 'None', value: 'None' },
					//{ label: 'Loess', value: 'Loess' },
					{ label: 'Lowess', value: 'Lowess' },
					{ label: 'Polynomial', value: 'Polynomial' }
				]
			},
			{
				label: 'Opacity',
				type: 'number',
				chartType: 'runChart',
				settingsKey: 'opacity',
				title: 'It represents the opacity of the elements',
				min: 0,
				max: 1,
				step: 0.1
			},
			{
				label: 'Chart width',
				type: 'number',
				chartType: 'runChart',
				settingsKey: 'svgw'
			},
			{
				label: 'Chart height',
				type: 'number',
				chartType: 'runChart',
				settingsKey: 'svgh'
			},
			{
				label: 'Default color',
				type: 'color',
				chartType: 'runChart',
				settingsKey: 'defaultColor'
			}
		]
		if (this.config.scaleDotTW)
			inputs.splice(inputs.length - 5, 0, minShapeSizeOption, maxShapeSizeOption, {
				label: 'Scale order',
				type: 'radio',
				chartType: 'runChart',
				settingsKey: 'scaleDotOrder',
				options: [
					{ label: 'Ascending', value: 'Ascending' },
					{ label: 'Descending', value: 'Descending' }
				]
			})

		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: this.dom.controlsHolder,
				inputs
			})
		}
		// TODO: handle multiple chart download when there is a divide by term
		this.components.controls.on('downloadClick.scatter', () => {
			for (const chart of this.charts) downloadSingleSVG(chart.svg, 'scatter.svg', this.opts.holder.node())
		})
	}

	setCountry(country) {
		const config: any = this.config
		this.settings[config.countryTW.term.id] = country
		this.settings[config.siteTW.term.id] = '' //clear site if country is changed
		config.filter = this.getFilter()
		this.app.dispatch({ type: 'plot_edit', id: this.id, config })
	}

	getSites() {
		return []
	}

	setFilterValue(key, value) {
		const config: any = this.config
		this.settings[key] = value
		config.filter = this.getFilter()
		this.app.dispatch({ type: 'plot_edit', id: this.id, config: this.config })
	}
}

export async function getPlotConfig(opts, app) {
	//if (!opts.colorTW) throw 'runChart getPlotConfig: opts.colorTW{} missing'
	//if (!opts.name && !(opts.term && opts.term2)) throw 'runChart getPlotConfig: missing coordinates input'

	const plot: any = {
		settings: {
			controls: {
				isOpen: false // control panel is hidden by default
			},
			runChart: getDefaultRunChartSettings(),
			startColor: {}, //dict to store the start color of the gradient for each chart when using continuous color
			stopColor: {} //dict to store the stop color of the gradient for each chart when using continuous color
		}
	}

	try {
		const defaultConfig = app.vocabApi.termdbConfig?.plotConfigByCohort.default[opts.chartType]
		copyMerge(plot, defaultConfig, opts)

		if (plot.colorTW) await fillTermWrapper(plot.colorTW, app.vocabApi)
		if (plot.shapeTW) await fillTermWrapper(plot.shapeTW, app.vocabApi)
		await fillTermWrapper(plot.term, app.vocabApi)
		await fillTermWrapper(plot.term2, app.vocabApi)
		if (plot.term0) await fillTermWrapper(plot.term0, app.vocabApi)
		if (plot.scaleDotTW) await fillTermWrapper(plot.scaleDotTW, app.vocabApi)
		await fillTermWrapper(plot.countryTW, app.vocabApi)
		await fillTermWrapper(plot.siteTW, app.vocabApi)

		return plot
	} catch (e) {
		console.log(e)
		throw `${e} [runChart getPlotConfig()]`
	}
}

export const runChartInit = getCompInit(RunChart)
// this alias will allow abstracted dynamic imports
export const componentInit = runChartInit

export function makeChartBtnMenu(holder, chartsInstance) {
	/*
	holder: the holder in the tooltip
	chartsInstance: MassCharts instance
		termdbConfig is accessible at chartsInstance.state.termdbConfig{}
		mass option is accessible at chartsInstance.app.opts{}
	*/
	const menuDiv = holder.append('div')
	const callback = (xterm, yterm) => {
		chartsInstance.app.dispatch({
			type: 'plot_create',
			config: {
				chartType: 'runChart',
				term: { term: xterm, q: { mode: 'continuous' } },
				term2: { term: yterm, q: { mode: 'continuous' } },
				name: `${xterm.name} vs ${yterm.name}`
			}
		})
	}
	//the first time should be a date and the second one a numeric non date term
	select2Terms(chartsInstance.dom.tip, chartsInstance.app, 'runChart', 'date', callback, 'numeric')
}

export function getDefaultRunChartSettings() {
	return {
		size: 0.8,
		minShapeSize: 0.5,
		maxShapeSize: 4,
		scaleDotOrder: 'Ascending',
		refSize: 0.8,
		svgw: 1000,
		svgh: 500,
		axisTitleFontSize: 16,
		opacity: 0.6,
		defaultColor: plotColor,
		regression: 'None',
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
		colorScaleMaxFixed: null // User-defined maximum value for fixed mode
		// Null indicates this hasn't been set yet
		//3D Plot settings
	}
}
