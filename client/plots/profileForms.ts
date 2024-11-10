import { getCompInit, copyMerge } from '../rx/index.js'
import { controlsInit } from './controls'
import { getProfilePlotConfig } from './profilePlot.js'
import { fillTwLst } from '#termsetting'
import { axisLeft, axisBottom } from 'd3-axis'
import { scaleLinear as d3Linear } from 'd3-scale'

export class profileForms {
	id: string
	type: string
	opts: { [key: string]: any }
	svg: any
	components: any
	state: any
	app: any
	data: any
	dom: any
	settings: any

	constructor(opts) {
		this.opts = opts
		this.type = 'profileForms'
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		return { config }
	}

	async init(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		const settings = config.settings.profileForms
		this.opts.header.text(config.tw.term.name)

		const controlsHolder = this.opts.holder
			.append('div')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
		const rightHolder = this.opts.holder.append('div').style('display', 'inline-block').style('vertical-align', 'top')
		const headerHolder = rightHolder.append('div').style('padding', '10px')
		const contentHolder = rightHolder.append('div')
		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: controlsHolder,
				inputs: []
			})
		}
		this.data = await this.app.vocabApi.getAnnotatedSampleData({
			terms: config.terms
		})
		const sampleHolder = headerHolder.append('div').style('padding', '10px')
		sampleHolder.append('span').text('Sample: ')
		const selectSample = sampleHolder.append('select')
		selectSample
			.selectAll('option')
			.data(this.data.lst)
			.enter()
			.append('option')
			.text(d => this.data.refs.bySampleId[d.sample].label)
			.attr('value', d => d.sample)
		selectSample.on('change', () => {
			const id = selectSample.node().value
			this.app.dispatch({ type: 'plot_edit', id: this.id, config: { sample: id } })
		})
		const questionHolder = headerHolder.append('div')
		questionHolder.append('span').text('Question: ').style('vertical-align', 'top')
		const selectQuestion = questionHolder.append('select').property('multiple', true)
		selectQuestion
			.selectAll('option')
			.data(config.terms)
			.enter()
			.append('option')
			.text(d => d.term.name)
			.attr('value', d => d.term.id)
		selectQuestion.on('change', () => {
			const id = selectQuestion.node().value
			this.app.dispatch({ type: 'plot_edit', id: this.id, config: { question: id } })
		})
		const svg = contentHolder.append('svg').attr('width', 500).attr('height', 500)
		const mainG = svg.append('g')
		const xAxisG = svg.append('g').attr('transform', `translate(0, ${settings.svgh})`)
		const yAxisG = svg.append('g')

		const xAxisScale = d3Linear().domain([0, settings.svgw]).range([0, settings.svgw])
		const xAxisBottom = axisBottom(xAxisScale)
		const yAxisScale = d3Linear().domain([100, 0]).range([0, settings.svgh])
		const yAxisLeft = axisLeft(yAxisScale)
		xAxisG.call(xAxisBottom)
		yAxisG.call(yAxisLeft)

		this.dom = {
			selectSample,
			mainG
		}
	}

	async main() {
		const config = this.state.config
		this.settings = this.state.config.settings.profileForms

		this.renderPlot()
	}

	renderPlot() {
		this.dom.mainG.selectAll('*').remove()
		const sample = this.state.config.sample || this.data.lst[0].sample
		const tw = this.state.config.terms.find(t => t.term.id == this.state.config.question) || this.state.config.terms[0]
		const sampleData = this.data.samples[sample]
		let termData = sampleData[tw.$id].value
		termData = termData.slice(1, -1) //Removed string quoutes
		const percents: { [key: string]: number } = JSON.parse(termData)
		const width = this.settings.svgw / 3
		const x = 50
		let y = 0
		const total = Object.values(percents).reduce((a, b) => a + b, 0)
		for (const key in percents) {
			const value = percents[key]
			const height = (value / total) * this.settings.svgh
			this.dom.mainG
				.append('rect')
				.attr('x', x)
				.attr('y', y)
				.attr('width', width)
				.attr('height', height)
				.attr('stroke', 'gray')
				.attr('fill', 'white')
			y += height
		}
	}
}

export async function getPlotConfig(opts, app) {
	let config = getProfilePlotConfig(app, opts)
	if (config) config = config.find(t => t.module == opts.tw.term.name)
	else config = {}
	config.settings = { controls: { isOpen: false }, profileForms: { svgw: 500, svgh: 500 } }
	config = copyMerge(structuredClone(config), opts)
	await fillTwLst(config.terms, app.vocabApi)

	return config
}

export function makeChartBtnMenu(holder, chartsInstance) {
	/*
	holder: the holder in the tooltip
	chartsInstance: MassCharts instance
		termdbConfig is accessible at chartsInstance.state.termdbConfig{}
		mass option is accessible at chartsInstance.app.opts{}
	*/
	const menuDiv = holder.append('div')
}
export const profileFormsInit = getCompInit(profileForms)
// this alias will allow abstracted dynamic imports
export const componentInit = profileFormsInit
