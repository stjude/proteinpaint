import { getCompInit, copyMerge } from '../rx'
import { fillTermWrapper } from '#termsetting'
import { Menu } from '#dom/menu'
import { controlsInit } from './controls'
import {
	symbol,
	symbolCircle,
	symbolTriangle,
	symbolCross,
	symbolSquare,
	symbolWye,
	symbolDiamond,
	symbolDiamond2,
	symbolStar,
	symbolSquare2
} from 'd3-shape'
import { setRenderers } from './sampleScatter.renderer'
import { setInteractivity } from './sampleScatter.interactivity'
import { getActiveCohortStr } from '../mass/charts'
import { addDynamicScatterForm } from '#dom/dynamicScatter'
import { downloadSingleSVG } from '../common/svg.download.js'

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
export const minDotSize = 9
export const maxDotSize = 300
class Scatter {
	constructor() {
		this.type = 'sampleScatter'
		this.lassoOn = false
		const mySymbols = [
			symbolCircle,
			symbolSquare,
			symbolCross,
			symbolWye,
			symbolTriangle,
			//symbolAsterisk,
			symbolDiamond,
			symbolDiamond2,
			symbolStar,
			symbolSquare2
		]
		this.symbols = mySymbols.map(s => symbol(s))
		this.zoom = 1
		this.startGradient = {}
		this.stopGradient = {}
	}

	async init(appState) {
		const controlsDiv = this.opts.holder.insert('div').style('display', 'inline-block')
		this.mainDiv = this.opts.holder.insert('div').style('display', 'inline-block').style('vertical-align', 'top')

		const offsetX = 80
		this.axisOffset = { x: offsetX, y: 30 }
		const controlsHolder = controlsDiv.attr('class', 'pp-termdb-plot-controls').style('display', 'inline-block')

		this.dom = {
			header: this.opts.header,
			//holder,
			loadingDiv: this.opts.holder.append('div').style('position', 'absolute').style('left', '45%').style('top', '60%'),
			tip: new Menu({ padding: '0px' }),
			tooltip: new Menu({ padding: '2px', offsetX: 10, offsetY: 0 }),
			controlsHolder
		}

		this.settings = {}
		if (this.dom.header) this.dom.header.html('Scatter Plot')
		setInteractivity(this)
		setRenderers(this)
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		const cohortKey = getActiveCohortStr(appState)
		return {
			config,
			termfilter: appState.termfilter,
			supportedChartTypes: appState.termdbConfig.supportedChartTypes[cohortKey],
			matrixplots: appState.termdbConfig.matrixplots,
			vocab: appState.vocab,
			termdbConfig: appState.termdbConfig
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
			filter: this.state.termfilter.filter,
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
		this.config = JSON.parse(JSON.stringify(this.state.config))
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
		this.charts = []
		const results = await this.app.vocabApi.getScatterData(reqOpts)
		if (results.error) throw results.error
		let i = 0
		for (const [key, data] of Object.entries(results)) {
			if (!Array.isArray(data.samples)) throw 'data.samples[] not array'
			if (data.isLast) this.createChart(key, data, i)
			else this.createChart(key, data, 0)
		}
		this.is3D = this.config.term && this.config.term0?.q.mode == 'continuous'
		await this.setControls()
		await this.processData()
		this.render()
		this.dom.loadingDiv.style('display', 'none')

		if (!this.is3D) this.setTools()
		this.dom.tip.hide()
	}

	createChart(id, data, i) {
		const cohortSamples = data.samples.filter(sample => 'sampleId' in sample)
		if (cohortSamples.length > 10000) this.is2DLarge = true
		const colorLegend = new Map(data.colorLegend)
		const shapeLegend = new Map(data.shapeLegend)
		this.charts.splice(i, 0, { id, data, cohortSamples, colorLegend, shapeLegend })
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
			vocabApi: this.app.vocabApi
		}
		const dotSizeOption = {
			label: 'Sample area',
			type: 'number',
			chartType: 'sampleScatter',
			settingsKey: 'size',
			title: 'Sample area, in square pixels',
			min: 0
		}
		const minDotSizeOption = {
			label: 'Min area',
			type: 'number',
			chartType: 'sampleScatter',
			settingsKey: 'minDotSize',
			title: 'Minimum area, in square pixels',
			min: minDotSize,
			max: maxDotSize
		}
		const maxDotSizeOption = {
			label: 'Max area',
			type: 'number',
			chartType: 'sampleScatter',
			settingsKey: 'maxDotSize',
			title: 'Maximum area, in square pixels',
			min: minDotSize,
			max: maxDotSize
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
			min: 0
		}
		const showAxes = {
			boxLabel: 'Visible',
			label: 'Show axes',
			type: 'checkbox',
			chartType: 'sampleScatter',
			settingsKey: 'showAxes',
			title: `Option to show/hide plot axes`
		}
		const inputs = [
			{
				type: 'term',
				configKey: 'term0',
				chartType: 'sampleScatter',
				usecase: { target: 'sampleScatter', detail: 'term0' },
				title: 'Categories to divide by',
				label: this.config.term0?.q?.mode == 'continuous' ? 'Z' : 'Divide by',
				vocabApi: this.app.vocabApi,
				numericEditMenuVersion: this.app.hasWebGL?.() ? ['discrete', 'continuous'] : ['discrete']
			},

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
				title: 'It represents the opacity of the symbols',
				min: 0,
				max: 1
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
			}
		]

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
					inputs.splice(6, 0, minDotSizeOption)
					inputs.splice(7, 0, maxDotSizeOption)
					inputs.splice(8, 0, orientation)
					if (hasRef) inputs.splice(9, 0, refSizeOption)
				} else {
					inputs.splice(6, 0, dotSizeOption)
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
				inputs.splice(4, 0, minDotSizeOption)
				inputs.splice(5, 0, maxDotSizeOption)
				inputs.splice(6, 0, orientation)
				if (hasRef) inputs.splice(7, 0, refSizeOption)
			} else {
				inputs.splice(4, 0, dotSizeOption)
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
			for (const chart of this.charts) downloadSingleSVG(chart.svg, 'scatter.svg', this.opts.holder.node())
		})
		this.dom.toolsDiv = this.dom.controlsHolder.insert('div')
	}
}

export async function getPlotConfig(opts, app) {
	//if (!opts.colorTW) throw 'sampleScatter getPlotConfig: opts.colorTW{} missing'
	//if (!opts.name && !(opts.term && opts.term2)) throw 'sampleScatter getPlotConfig: missing coordinates input'
	try {
		if (opts.colorTW) await fillTermWrapper(opts.colorTW, app.vocabApi)
		if (opts.shapeTW) await fillTermWrapper(opts.shapeTW, app.vocabApi)
		if (opts.term) await fillTermWrapper(opts.term, app.vocabApi)
		if (opts.term2) await fillTermWrapper(opts.term2, app.vocabApi)
		if (opts.term0) await fillTermWrapper(opts.term0, app.vocabApi)
		if (opts.scaleDotTW) await fillTermWrapper(opts.scaleDotTW, app.vocabApi)

		const settings = getDefaultScatterSettings()
		if (!opts.term && !opts.term2) settings.showAxes = false
		const config = {
			groups: [],
			settings: {
				controls: {
					isOpen: false // control panel is hidden by default
				},
				sampleScatter: settings
			}
		}
		// may apply term-specific changes to the default object
		const result = copyMerge(config, opts)
		if (result.term0?.q?.mode == 'continuous' && !app.hasWebGL())
			throw 'Can not load Z/Divide by term in continuous mode as WebGL is not supported'
		return result
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
		for (const plot of chartsInstance.state.termdbConfig.scatterplots) {
			/* plot: 
		{
			name=str,
			dimensions=int,
			term={ id, ... }
		}
		*/
			menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text(plot.name)
				.on('click', () => {
					let config = {
						chartType: 'sampleScatter',
						colorTW: JSON.parse(JSON.stringify(plot.colorTW)),
						name: plot.name
					}
					if ('shapeTW' in plot) config.shapeTW = JSON.parse(JSON.stringify(plot.shapeTW))
					chartsInstance.app.dispatch({
						type: 'plot_create',
						config: config
					})
					chartsInstance.dom.tip.hide()
				})
		}
	const formDiv = menuDiv.append('div')
	addDynamicScatterForm(chartsInstance.dom.tip, chartsInstance.app)
}

export function getDefaultScatterSettings() {
	return {
		size: 25,
		minDotSize: 16,
		maxDotSize: 144,
		scaleDotOrder: 'Ascending',
		refSize: 9,
		svgw: 550,
		svgh: 550,
		svgd: 550,
		axisTitleFontSize: 16,
		showAxes: true,
		showRef: true,
		opacity: 0.8,
		defaultColor: 'rgb(144, 23, 57)',
		regression: 'None'
	}
}

export async function renderScatter(holder, state) {
	const opts = {
		holder,
		state: {
			vocab: state.vocab,
			plots: [
				{
					chartType: 'sampleScatter',
					subfolder: 'plots',
					name: 'Methylome TSNE',
					colorTW: { id: 'TSNE Category' }
				}
			]
		}
	}
	const plot = await import('#plots/plot.app.js')
	const plotAppApi = await plot.appInit(opts)
}
