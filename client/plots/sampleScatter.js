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
	symbolAsterisk,
	symbolDiamond,
	symbolDiamond2,
	symbolStar,
	symbolSquare2
} from 'd3-shape'
import { setRenderers } from './sampleScatter.renderer'
import { setInteractivity } from './sampleScatter.interactivity'
import { getActiveCohortStr } from '../mass/charts'

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
		this.k = 1
	}

	async init(opts) {
		const controls = this.opts.controls || this.opts.holder.append('div')
		const controlsDiv = this.opts.controls
			? opts.holder
			: this.opts.holder.append('div').style('display', 'inline-block')
		this.mainDiv = controlsDiv.append('div').style('display', 'inline-block')
		this.mainDiv.on('click', event => this.mouseclick(event))

		const offsetX = this.opts.parent?.type == 'summary' ? 80 : 50
		this.axisOffset = { x: offsetX, y: 30 }
		const controlsHolder = controls.attr('class', 'pp-termdb-plot-controls').style('display', 'inline-block')

		this.dom = {
			header: this.opts.header,
			//holder,
			controls,
			loadingDiv: this.opts.holder
				.append('div')
				.style('position', 'absolute')
				.style('left', '50%')
				.style('top', '50%'),
			tip: new Menu({ padding: '5px' }),
			tooltip: new Menu({ padding: '5px' }),
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
		if (c.term0) opts.divideByTW = c.term0
		return opts
	}

	// called in relevant dispatch when reactsTo==true
	// or current.state != replcament.state
	async main() {
		this.config = JSON.parse(JSON.stringify(this.state.config))
		if (this.dom.header)
			this.dom.header.html(
				this.config.name + ` <span style="opacity:.6;font-size:.7em;margin-left:10px;">SCATTER PLOT</span>`
			)
		copyMerge(this.settings, this.config.settings.sampleScatter)
		const reqOpts = this.getDataRequestOpts()
		if (reqOpts.coordTWs.length == 1) return //To allow removing a term in the controls, though nothing is rendered (summary tab with violin active)
		this.charts = []
		this.mainDiv.selectAll('*').remove()
		this.dom.loadingDiv.style('display', 'block').html('Processing data...')
		const results = await this.app.vocabApi.getScatterData(reqOpts)
		if (results.error) throw results.error
		for (const [key, data] of Object.entries(results)) {
			if (!Array.isArray(data.samples)) throw 'data.samples[] not array'
			this.createChart(key, data)
		}
		this.is3D = this.opts.parent?.type == 'summary' && this.config.term0?.q.mode == 'continuous'
		await this.setControls()
		await this.processData()
		this.render()
		this.dom.loadingDiv.style('display', 'none')

		if (!this.is3D) this.setTools()
		this.dom.tip.hide()
	}

	createChart(id, data) {
		const cohortSamples = data.samples.filter(sample => 'sampleId' in sample)
		const colorLegend = new Map(data.colorLegend)
		const shapeLegend = new Map(data.shapeLegend)
		this.charts.push({ id, data, cohortSamples, colorLegend, shapeLegend })
	}

	async setControls() {
		this.dom.controlsHolder.selectAll('*').remove()
		const shapeOption = {
			type: 'term',
			configKey: 'shapeTW',
			chartType: 'sampleScatter',
			usecase: { target: 'sampleScatter', detail: 'shapeTW' },
			title: 'Categories to assign a shape',
			label: 'Shape',
			vocabApi: this.app.vocabApi
		}
		const symbolSizeOption = {
			label: 'Symbol size',
			type: 'number',
			chartType: 'sampleScatter',
			settingsKey: 'size',
			title: 'It represents the area of a symbol in square pixels',
			min: 0
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
				type: 'term',
				configKey: 'term0',
				chartType: 'sampleScatter',
				usecase: { target: 'sampleScatter', detail: 'term0' },
				title: 'Categories to divide by',
				label: 'Divide by',
				vocabApi: this.app.vocabApi,
				numericEditMenuVersion: this.app.hasWebGL() ? ['discrete', 'continuous'] : ['discrete']
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
				boxLabel: 'Visible',
				label: 'Show axes',
				type: 'checkbox',
				chartType: 'sampleScatter',
				settingsKey: 'showAxes',
				title: `Option to show/hide plot axes`
			},
			{
				label: 'Opacity',
				type: 'number',
				chartType: 'sampleScatter',
				settingsKey: 'opacity',
				title: 'It represents the opacity of the symbols',
				min: 0,
				max: 1
			}
		]
		if (this.opts.parent?.type == 'summary') {
			inputs.unshift(
				...[
					{
						type: 'term',
						configKey: 'term',
						chartType: 'sampleScatter',
						usecase: { target: 'sampleScatter', detail: 'term' },
						title: 'X coordinate to plot the samples',
						label: 'X',
						vocabApi: this.app.vocabApi,
						menuOptions: '!remove',
						numericEditMenuVersion: ['continuous', 'discrete']
					},
					{
						type: 'term',
						configKey: 'term2',
						chartType: 'sampleScatter',
						usecase: { target: 'sampleScatter', detail: 'term2' },
						title: 'Y coordinate to plot the samples',
						label: 'Y',
						vocabApi: this.app.vocabApi,
						menuOptions: '!remove',
						numericEditMenuVersion: ['continuous', 'discrete']
					}
				]
			)
			if (!this.is3D) {
				inputs.splice(3, 0, shapeOption)
				inputs.push(symbolSizeOption)
				inputs.push({
					label: 'Show regression',
					type: 'dropdown',
					chartType: 'sampleScatter',
					settingsKey: 'regression',
					options: [
						{ label: 'None', value: 'None' },
						{ label: 'Loess', value: 'Loess' },
						{ label: 'Lowess-R', value: 'Lowess-R' },
						{ label: 'Polynomial', value: 'Polynomial' }
					]
				})
			} else {
				inputs.splice(6, 0, {
					label: 'Chart depth',
					type: 'number',
					chartType: 'sampleScatter',
					settingsKey: 'svgd'
				})
			}
			inputs.push({
				label: 'Default color',
				type: 'color',
				chartType: 'sampleScatter',
				settingsKey: 'defaultColor'
			})
		} else {
			inputs.splice(1, 0, shapeOption)
			inputs.push(symbolSizeOption)
			inputs.push({
				label: 'Reference size',
				type: 'number',
				chartType: 'sampleScatter',
				settingsKey: 'refSize',
				title: 'It represents the area of the reference symbol in square pixels',
				min: 0
			})
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
			for (const chart of this.charts) this.downloadSVG(chart.svg)
		})
		this.dom.toolsDiv = this.dom.controls.insert('div')
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
}

export function getDefaultScatterSettings() {
	return {
		size: 25,
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
