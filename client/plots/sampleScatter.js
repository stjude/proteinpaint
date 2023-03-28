import { getCompInit, copyMerge } from '../rx'
import { fillTermWrapper } from '#termsetting'

import { Menu } from '#dom/menu'
import { scaleLinear as d3Linear } from 'd3-scale'
import { rgb } from 'd3-color'
import { controlsInit } from './controls'
import { axisLeft, axisBottom } from 'd3-axis'
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
		const mainDiv = controlsDiv.append('div').style('display', 'inline-block')

		const chartDiv = mainDiv.append('div').style('display', 'inline-block')
		const legendDiv = mainDiv
			.append('div')
			.style('display', 'inline-block')
			.style('float', 'right')
			.style('margin-left', '100px')

		const holder = chartDiv.insert('div')

		this.dom = {
			header: this.opts.header,
			holder,
			controls,
			legendDiv,
			tip: new Menu({ padding: '5px' }),
			tooltip: new Menu({ padding: '5px' }),
			termstip: new Menu({ padding: '5px', offsetX: 170, offsetY: -34 })
		}

		this.settings = {}
		if (this.dom.header) this.dom.header.html('Scatter Plot')
		await this.setControls()
		setInteractivity(this)
		setRenderers(this)
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			config,
			termfilter: appState.termfilter,
			allowedTermTypes: appState.termdbConfig.allowedTermTypes,
			matrixplots: appState.termdbConfig.matrixplots,
			vocab: appState.vocab
		}
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
		this.data = await this.app.vocabApi.getScatterData(reqOpts)

		if (this.data.error) throw this.data.error
		if (!Array.isArray(this.data.samples)) throw 'data.samples[] not array'

		this.colorLegend = new Map(Object.entries(this.data.colorLegend))
		this.shapeLegend = new Map(Object.entries(this.data.shapeLegend))
		this.axisOffset = { x: 80, y: 20 }
		this.cohortSamples = this.data.samples.filter(sample => 'sampleId' in sample)

		this.initAxes()
		this.render()
		this.setTools()
		this.lassoReset()
		this.updateGroupsButton()
		this.dom.tip.hide()
		this.dom.termstip.hide()
	}

	initAxes() {
		if (this.data.samples.length == 0) return
		const s0 = this.data.samples[0] //First sample to start reduce comparisons
		const [xMin, xMax, yMin, yMax] = this.data.samples.reduce(
			(s, d) => [d.x < s[0] ? d.x : s[0], d.x > s[1] ? d.x : s[1], d.y < s[2] ? d.y : s[2], d.y > s[3] ? d.y : s[3]],
			[s0.x, s0.x, s0.y, s0.y]
		)
		this.xAxisScale = d3Linear()
			.domain([xMin, xMax])
			.range([this.axisOffset.x, this.settings.svgw + this.axisOffset.x])

		this.axisBottom = axisBottom(this.xAxisScale)
		this.yAxisScale = d3Linear()
			.domain([yMax, yMin])
			.range([this.axisOffset.y, this.settings.svgh + this.axisOffset.y])
		this.axisLeft = axisLeft(this.yAxisScale)
		if (!this.config.gradientColor) this.config.gradientColor = '#008000'
		this.startColor = rgb(this.config.gradientColor)
			.brighter()
			.brighter()
		this.stopColor = rgb(this.config.gradientColor)
			.darker()
			.darker()
		if (this.config.colorTW?.q.mode === 'continuous') {
			const [min, max] = this.cohortSamples.reduce(
				(s, d) => [d.value < s[0] ? d.category : s[0], d.category > s[1] ? d.category : s[1]],
				[this.cohortSamples[0].category, this.cohortSamples[0].category]
			)

			this.colorGenerator = d3Linear()
				.domain([min, max])
				.range([this.startColor, this.stopColor])
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
		return opts
	}

	async setControls() {
		const controlsHolder = this.dom.controls.attr('class', 'pp-termdb-plot-controls').style('display', 'inline-block')

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
				configKey: 'shapeTW',
				chartType: 'sampleScatter',
				usecase: { target: 'sampleScatter', detail: 'shapeTW' },
				title: 'Categories to assign a shape',
				label: 'Shape',
				vocabApi: this.app.vocabApi
			},

			{
				label: 'Symbol size',
				type: 'number',
				chartType: 'sampleScatter',
				settingsKey: 'size',
				title: 'It represents the area of a symbol in square pixels',
				min: 0
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
				label: 'Reference size',
				type: 'number',
				chartType: 'sampleScatter',
				settingsKey: 'refSize',
				title: 'It represents the area of the reference symbol in square pixels',
				min: 0
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
		if (this.opts.parent?.type == 'summary')
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

		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: controlsHolder,
				inputs
			})
		}

		this.components.controls.on('downloadClick.scatter', () => this.downloadSVG(this.svg))
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
			gradientColor: '#008000',
			settings: {
				controls: {
					isOpen: false // control panel is hidden by default
				},
				sampleScatter: settings
			}
		}
		// may apply term-specific changes to the default object
		const result = copyMerge(config, opts)
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
		axisTitleFontSize: 16,
		showAxes: true,
		showRef: true,
		opacity: 0.8
	}
}
