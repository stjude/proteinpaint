import { getCompInit, copyMerge } from '../rx'
import { fillTermWrapper } from '#termsetting'
import { Menu, shapesArray, select2Terms } from '#dom'
import { controlsInit } from './controls'
import { setRenderers } from './sampleScatter.renderer'
import { setInteractivity } from './sampleScatter.interactivity'
import { getCurrentCohortChartTypes } from '../mass/charts'
import { downloadSingleSVG } from '../common/svg.download.js'
import { select } from 'd3-selection'
import { rebaseGroupFilter, getFilter } from '../mass/groups'
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

class Scatter {
	constructor() {
		this.type = 'sampleScatter'
		this.lassoOn = false
		this.zoom = 1
		this.startGradient = {}
		this.stopGradient = {}
	}

	async init(appState) {
		const leftDiv = this.opts.holder.insert('div').style('display', 'inline-block')
		const controlsHolder = leftDiv
			.insert('div')
			.style('display', 'inline-block')
			.attr('class', 'pp-termdb-plot-controls')
		this.mainDiv = this.opts.holder.insert('div').style('display', 'inline-block').style('vertical-align', 'top')

		const offsetX = 80
		this.axisOffset = { x: offsetX, y: 30 }

		this.dom = {
			header: this.opts.header,
			//holder,
			loadingDiv: this.opts.holder.append('div').style('position', 'absolute').style('left', '45%').style('top', '60%'),
			tip: new Menu({ padding: '0px' }),
			tooltip: new Menu({ padding: '2px', offsetX: 10, offsetY: 0 }),
			controlsHolder,
			toolsDiv: leftDiv.insert('div')
		}

		this.settings = {}
		if (this.dom.header) this.dom.header.html('Scatter Plot')
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
			currentCohortChartTypes: getCurrentCohortChartTypes(appState),
			groups: rebaseGroupFilter(appState)
		}
	}

	// creates an opts object for the vocabApi.someMethod(),
	// may need to add a new method to client/termdb/vocabulary.js
	// for now, just add methods to TermdbVocab,
	// later on, add methods with same name to FrontendVocab
	getDataRequestOpts() {
		const c = this.config
		const coordTWs = []
		if (c.term) coordTWs.push(c.term)
		if (c.term2) coordTWs.push(c.term2)
		const opts = {
			name: c.name, // the actual identifier of the plot, for retrieving data from server
			colorTW: c.colorTW,
			filter: this.getFilter(),
			coordTWs
		}
		if (this.state.termfilter.filter0) opts.filter0 = this.state.termfilter.filter0
		if (c.colorColumn) opts.colorColumn = c.colorColumn
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
		if (this.config.settings.sampleScatter.regression !== 'None' && this.config.term0) {
			if (this.charts) for (const chart of this.charts) chart.chartDiv.selectAll('*').remove()
			this.dom.loadingDiv.style('display', 'block').html('Processing data...')
		}

		if (this.dom.header)
			this.dom.header.html(
				this.config.name + ` <span style="opacity:.6;font-size:.7em;margin-left:10px;">SCATTER PLOT</span>`
			)
		copyMerge(this.settings, this.config.settings.sampleScatter)
		const reqOpts = this.getDataRequestOpts()
		if (reqOpts.coordTWs.length == 1) return //To allow removing a term in the controls, though nothing is rendered (summary tab with violin active)

		const data = await this.app.vocabApi.getScatterData(reqOpts)
		if (data.error) throw data.error
		this.range = data.range
		this.charts = []
		let i = 0
		for (const [key, chartData] of Object.entries(data.result)) {
			if (!Array.isArray(chartData.samples)) throw 'data.samples[] not array'
			if (data.isLast) this.createChart(key, data, i)
			else this.createChart(key, chartData, 0)
		}
		this.initRanges()
		this.is3D = this.config.term0?.q.mode == 'continuous'
		if (!this.config.colorColumn) await this.setControls()
		await this.processData()
		this.render()
		this.dom.loadingDiv.style('display', 'none')

		if (!this.is3D) this.setTools()
		this.dom.tip.hide()
	}

	createChart(id, data, i) {
		const cohortSamples = data.samples.filter(sample => 'sampleId' in sample)
		if (cohortSamples.length > numberOfSamplesCutoff) this.is2DLarge = true
		const colorLegend = new Map(data.colorLegend)
		const shapeLegend = new Map(data.shapeLegend)
		this.charts.splice(i, 0, { id, data, cohortSamples, colorLegend, shapeLegend })
	}

	initRanges() {
		const samples = []
		for (const chart of this.charts) samples.push(...chart.data.samples)
		if (samples.length == 0) return
		const s0 = samples[0] //First sample to start reduce comparisons
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

	async setControls() {
		this.dom.controlsHolder.selectAll('*').remove()
		const hasRef = this.charts[0]?.data.samples.find(s => !('sampleId' in s)) || false
		const scaleDotOption = {
			type: 'term',
			configKey: 'scaleDotTW',
			chartType: 'sampleScatter',
			usecase: { target: 'sampleScatter', detail: 'numeric' },
			title: 'Scale sample by term value',
			label: 'Scale by',
			vocabApi: this.app.vocabApi,
			numericEditMenuVersion: ['continuous']
		}
		const shapeOption = {
			type: 'term',
			configKey: 'shapeTW',
			chartType: 'sampleScatter',
			usecase: { target: 'sampleScatter', detail: 'shapeTW' },
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
			chartType: 'sampleScatter',
			settingsKey: 'size',
			title: 'Sample size, represents the factor used to scale the sample',
			min: 0,
			step: 0.1
		}
		const step = (maxShapeSize - minShapeSize) / 10
		const minShapeSizeOption = {
			label: 'Min size',
			type: 'number',
			chartType: 'sampleScatter',
			settingsKey: 'minShapeSize',
			title: 'Minimum sample size',
			min: minShapeSize,
			max: maxShapeSize,
			step
		}
		const maxShapeSizeOption = {
			label: 'Max size',
			type: 'number',
			chartType: 'sampleScatter',
			settingsKey: 'maxShapeSize',
			title: 'Maximum sample size',
			min: minShapeSize,
			max: maxShapeSize * 2,
			step
		}
		const orientation = {
			label: 'Scale order',
			type: 'radio',
			chartType: 'sampleScatter',
			settingsKey: 'scaleDotOrder',
			options: [
				{ label: 'Ascending', value: 'Ascending' },
				{ label: 'Descending', value: 'Descending' }
			]
		}
		const refSizeOption = {
			label: 'Reference size',
			type: 'number',
			chartType: 'sampleScatter',
			settingsKey: 'refSize',
			title: 'It represents the area of the reference symbol in square pixels',
			min: 0,
			step: 0.1
		}
		const showAxes = {
			boxLabel: '',
			label: 'Show axes',
			type: 'checkbox',
			chartType: 'sampleScatter',
			settingsKey: 'showAxes',
			title: `Option to show/hide plot axes`,
			testid: 'showAxes'
		}

		const inputs = [
			{
				type: 'term',
				configKey: 'colorTW',
				chartType: 'sampleScatter',
				usecase: { target: 'sampleScatter', detail: 'colorTW' },
				title: 'Categories to color the samples',
				label: 'Color',
				vocabApi: this.app.vocabApi,
				numericEditMenuVersion: ['continuous', 'discrete']
			},

			{
				label: 'Opacity',
				type: 'number',
				chartType: 'sampleScatter',
				settingsKey: 'opacity',
				title: 'It represents the opacity of the elements',
				min: 0,
				max: 1,
				step: 0.1
			},
			{
				label: 'Chart width',
				type: 'number',
				chartType: 'sampleScatter',
				settingsKey: 'svgw'
			},
			{
				label: 'Chart height',
				type: 'number',
				chartType: 'sampleScatter',
				settingsKey: 'svgh'
			},
			{
				label: 'Show contour map',
				boxLabel: '',
				type: 'checkbox',
				chartType: 'sampleScatter',
				settingsKey: 'showContour',
				title:
					"Shows the density of point clouds. If 'Color' is used in continous mode, it uses it to weight the points when calculating the density contours. If 'Z/Divide by' is added in continous mode, it used it instead."
			}
		]
		if (this.settings.showContour)
			inputs.push(
				{
					label: 'Color contours',
					boxLabel: '',
					type: 'checkbox',
					chartType: 'sampleScatter',
					settingsKey: 'colorContours'
				},
				{
					label: 'Contour bandwidth',
					type: 'number',
					chartType: 'sampleScatter',
					settingsKey: 'contourBandwidth',
					title: 'Reduce to increase resolution. ',
					min: 5,
					max: 50,
					step: 5
				},
				{
					label: 'Contour thresholds',
					type: 'number',
					chartType: 'sampleScatter',
					settingsKey: 'contourThresholds',
					title: 'Dot size',
					min: 5,
					max: 30,
					step: 5
				}
			)
		if (this.config.sampleCategory) {
			const options = Object.values(this.config.sampleCategory.tw.term.values).map(v => ({
				label: v.label || v.key,
				value: v.key
			}))
			if (this.config.sampleCategory.order)
				options.sort((elem1, elem2) => {
					const i1 = this.config.sampleCategory.order.indexOf(elem1.value)
					const i2 = this.config.sampleCategory.order.indexOf(elem2.value)
					if (i1 < i2) return -1
					return 1
				})
			if (!this.settings.sampleCategory) this.settings.sampleCategory = this.config.sampleCategory.defaultValue || ''
			options.push({ label: 'All', value: '' })
			const sampleCategory = {
				label: 'Sample type',
				type: 'dropdown',
				chartType: 'sampleScatter',
				settingsKey: 'sampleCategory',
				options
			}
			inputs.push(sampleCategory)
		}

		if (!this.is2DLarge) {
			const isPremade = this.config.name !== undefined && !this.config.term
			inputs.unshift({
				type: 'term',
				configKey: 'term0',
				chartType: 'sampleScatter',
				usecase: { target: 'sampleScatter', detail: 'term0' },
				title: 'Term to to divide by categories or to use as Z coordinate',
				label: 'Z / Divide by',
				vocabApi: this.app.vocabApi,
				numericEditMenuVersion: ['discrete', 'continuous'],
				processInput: tw => {
					if (!isPremade && isNumericTerm(tw?.term)) tw.q = { mode: 'continuous' } //use continuous mode by default if not premade plot
				}
			})
		} else {
			inputs.push({
				label: 'Sample size',
				type: 'number',
				chartType: 'sampleScatter',
				settingsKey: 'threeSize',
				title: 'Sample size',
				min: 0,
				max: 1,
				step: 0.001
			}),
				inputs.push({
					label: 'Field of Vision',
					type: 'number',
					chartType: 'sampleScatter',
					settingsKey: 'threeFOV',
					title: 'Field of Vision',
					min: 50,
					max: 90,
					step: 1
				})
		}
		if (this.config.term) {
			inputs.unshift(
				...[
					{
						type: 'term',
						configKey: 'term',
						chartType: 'sampleScatter',
						usecase: { target: 'sampleScatter', detail: 'numeric' },
						title: 'X coordinate to plot the samples',
						label: 'X',
						vocabApi: this.app.vocabApi,
						menuOptions: '!remove',
						numericEditMenuVersion: ['continuous']
					},
					{
						type: 'term',
						configKey: 'term2',
						chartType: 'sampleScatter',
						usecase: { target: 'sampleScatter', detail: 'numeric' },
						title: 'Y coordinate to plot the samples',
						label: 'Y',
						vocabApi: this.app.vocabApi,
						menuOptions: '!remove',
						numericEditMenuVersion: ['continuous']
					}
				]
			)
			if (!this.is3D) {
				inputs.splice(4, 0, shapeOption)
				inputs.splice(5, 0, scaleDotOption)
				if (this.config.scaleDotTW) {
					inputs.splice(6, 0, minShapeSizeOption)
					inputs.splice(7, 0, maxShapeSizeOption)
					inputs.splice(8, 0, orientation)
					if (hasRef) inputs.splice(9, 0, refSizeOption)
				} else {
					inputs.splice(6, 0, shapeSizeOption)
					if (hasRef) inputs.splice(7, 0, refSizeOption)
				}

				inputs.push({
					label: 'Show regression',
					type: 'dropdown',
					chartType: 'sampleScatter',
					settingsKey: 'regression',
					options: [
						{ label: 'None', value: 'None' },
						//{ label: 'Loess', value: 'Loess' },
						{ label: 'Lowess', value: 'Lowess' },
						{ label: 'Polynomial', value: 'Polynomial' }
					]
				})
			} else {
				inputs.push({
					label: 'Chart depth',
					type: 'number',
					chartType: 'sampleScatter',
					settingsKey: 'svgd'
				})
				inputs.push({
					label: 'Field of vision',
					title: 'Camera field of view, in degrees',
					type: 'number',
					chartType: 'sampleScatter',
					settingsKey: 'fov'
				})
			}
			inputs.push(showAxes)

			inputs.push({
				label: 'Default color',
				type: 'color',
				chartType: 'sampleScatter',
				settingsKey: 'defaultColor'
			})
		} else if (!this.is2DLarge) {
			inputs.splice(2, 0, shapeOption)
			inputs.splice(3, 0, scaleDotOption)
			if (this.config.scaleDotTW) {
				inputs.splice(4, 0, minShapeSizeOption)
				inputs.splice(5, 0, maxShapeSizeOption)
				inputs.splice(6, 0, orientation)
				if (hasRef) inputs.splice(7, 0, refSizeOption)
			} else {
				inputs.splice(4, 0, shapeSizeOption)
				if (hasRef) inputs.splice(5, 0, refSizeOption)
			}
			inputs.push(showAxes)
		}

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
			if (this.is2DLarge || this.is3D) {
				const url = this.canvas.toDataURL('image/png')
				downloadImage(url)
			} else for (const chart of this.charts) downloadSingleSVG(chart.svg, 'scatter.svg', this.opts.holder.node())
		})
	}

	getFilter() {
		const tvslst = {
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
}
export function openScatterPlot(app, plot, filter = null) {
	let config = {
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

export function downloadImage(imageURL) {
	const link = document.createElement('a')
	// If you don't know the name or want to use
	// the webserver default set name = ''
	link.setAttribute('download', 'image')
	document.body.appendChild(link)
	link.click()
	link.remove()
	link.href = imageURL
	link.click()
	link.remove()
}

export async function getPlotConfig(opts, app) {
	//if (!opts.colorTW) throw 'sampleScatter getPlotConfig: opts.colorTW{} missing'
	//if (!opts.name && !(opts.term && opts.term2)) throw 'sampleScatter getPlotConfig: missing coordinates input'

	const plot = {
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
	/*
	holder: the holder in the tooltip
	chartsInstance: MassCharts instance
		termdbConfig is accessible at chartsInstance.state.termdbConfig{}
		mass option is accessible at chartsInstance.app.opts{}
	*/
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
	const formDiv = menuDiv.append('div')

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
		contourThresholds: 10
	}
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
	const plotImport = await import('#plots/plot.app.js')
	const plotAppApi = await plotImport.appInit(opts)
}
