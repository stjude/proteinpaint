import { getCompInit, copyMerge } from '../rx/index.js'
import { controlsInit } from './controls'
import { getProfilePlotConfig, profilePlot, getDefaultProfilePlotSettings } from './profilePlot.js'
import { fillTwLst } from '#termsetting'
import { axisLeft, axisBottom } from 'd3-axis'
import { scaleLinear as d3Linear } from 'd3-scale'
import { loadFilterTerms } from './profilePlot.js'

export class profileForms extends profilePlot {
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
	xAxisScale: any
	shift: any
	twLst: any

	constructor(opts) {
		super()
		this.opts = opts
		this.type = 'profileForms'
	}

	async init(appState) {
		super.init(appState)
		const rightDiv = this.dom.rightDiv
		const config = appState.plots.find(p => p.id === this.id)
		const settings = config.settings.profileForms
		const sampleHolder = rightDiv.append('div').style('padding', '10px')
		sampleHolder.append('span').text('Sample: ')
		const selectSample = sampleHolder.append('select')

		selectSample.on('change', () => {
			const id = selectSample.node().value
			this.app.dispatch({ type: 'plot_edit', id: this.id, config: { sample: id } })
		})
		const questionHolder = rightDiv.append('div')
		questionHolder.append('span').text('Question: ').style('vertical-align', 'top')
		const selectQuestion = questionHolder.append('select').property('multiple', true)

		selectQuestion.on('change', () => {
			const id = selectQuestion.node().value
			this.app.dispatch({ type: 'plot_edit', id: this.id, config: { question: id } })
		})
		const shift = 50
		const svg = rightDiv
			.append('svg')
			.attr('width', settings.svgw + shift + 10)
			.attr('height', settings.svgh + shift * 2 + 10)
		const mainG = svg.append('g').attr('transform', `translate(${shift}, 10)`)
		const xAxisG = svg.append('g').attr('transform', `translate(${shift}, ${settings.svgh + 10})`)
		const yAxisG = svg.append('g').attr('transform', `translate(${shift}, 10)`)
		this.xAxisScale = d3Linear()
			.domain([0, config.terms.length + 1])
			.range([0, settings.svgw])
		const xAxisBottom = axisBottom(this.xAxisScale).ticks(config.terms.length)
		const yAxisScale = d3Linear().domain([100, 0]).range([0, settings.svgh])
		const yAxisLeft = axisLeft(yAxisScale)
		xAxisG.call(xAxisBottom)
		yAxisG.call(yAxisLeft)

		this.dom = copyMerge(this.dom, {
			selectSample,
			mainG,
			selectQuestion
		})
		this.twLst = config.terms
	}

	async main() {
		super.main()
		await this.setControls()
		this.renderHeaderOptions()
		this.renderPlot()
	}

	renderHeaderOptions() {
		this.dom.selectSample.selectAll('option').remove()
		this.dom.selectSample
			.selectAll('option')
			.data(this.data.lst)
			.enter()
			.append('option')
			.text(d => this.data.refs.bySampleId[d.sample].label)
			.attr('value', d => d.sample)
		this.dom.selectQuestion
			.selectAll('option')
			.data(this.config.terms)
			.enter()
			.append('option')
			.text((d, i) => i + 1 + '. ' + d.term.name)
			.attr('value', d => d.term.id)
	}

	renderPlot() {
		this.dom.mainG.selectAll('*').remove()
		const sample = this.state.config.sample || this.data.lst[0].sample
		const tw = this.state.config.terms.find(t => t.term.id == this.state.config.question) || this.state.config.terms[0]
		const sampleData = this.data.samples[sample]
		const step = this.settings.svgw / (this.state.config.terms.length + 1)
		let i = 1
		const width = 40

		for (const tw of this.state.config.terms) {
			let termData = sampleData[tw.$id].value
			termData = termData.slice(1, -1) //Removed string quoutes
			const percents: { [key: string]: number } = JSON.parse(termData)
			const x = i * step - width / 2

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
				this.dom.mainG
					.append('text')
					.attr('x', x + width + 2)
					.attr('y', y + height / 2)
					.text(key)
				y += height
			}
			i++
		}
	}
}

export async function getPlotConfig(opts, app) {
	let config = getProfilePlotConfig(app, opts)
	if (config) config = config.find(t => t.module == opts.tw.term.name)
	else config = {}
	config.settings = getDefaultProfileFormsSettings()
	config = copyMerge(structuredClone(config), opts)
	await fillTwLst(config.terms, app.vocabApi)
	await loadFilterTerms(config, app, opts)
	return config
}

export function getDefaultProfileFormsSettings() {
	return {
		controls: {
			isOpen: false
		},
		profileForms: copyMerge({ svgw: 800, svgh: 300 }, getDefaultProfilePlotSettings())
	}
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
