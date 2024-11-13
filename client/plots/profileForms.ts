import { getCompInit, copyMerge } from '../rx/index.js'
import { getProfilePlotConfig, profilePlot, getDefaultProfilePlotSettings } from './profilePlot.js'
import { fillTwLst } from '#termsetting'
import { axisLeft, axisTop } from 'd3-axis'
import { scaleLinear as d3Linear } from 'd3-scale'
import { loadFilterTerms } from './profilePlot.js'
import { render } from '#src/block.mds2.vcf.plain'

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
		const config = structuredClone(appState.plots.find(p => p.id === this.id))
		const settings = config.settings.profileForms

		const questionHolder = rightDiv.append('div')
		questionHolder.append('span').text('Question: ').style('vertical-align', 'top')
		const selectQuestion = questionHolder.append('select').property('multiple', true)

		selectQuestion.on('change', () => {
			const id = selectQuestion.node().value
			this.app.dispatch({ type: 'plot_edit', id: this.id, config: { question: id } })
		})
		const shift = 700
		const shiftTop = 30
		const svg = rightDiv
			.append('svg')
			.attr('width', settings.svgw + shift + 10)
			.attr('height', settings.svgh + shift + 10)
		const mainG = svg.append('g').attr('transform', `translate(${shift}, ${shiftTop})`)
		const xAxisG = svg.append('g').attr('transform', `translate(${shift}, ${shiftTop})`)
		const yAxisG = svg.append('g').attr('transform', `translate(${shift}, ${shiftTop})`)
		this.xAxisScale = d3Linear().domain([0, 100]).range([0, settings.svgw])
		const xAxisBottom = axisTop(this.xAxisScale)
		const yAxisScale = d3Linear()
			.domain([0, config.terms.length + 1])
			.range([0, settings.svgh])
		const yAxisLeft = axisLeft(yAxisScale).ticks(config.terms.length)
		xAxisG.call(xAxisBottom)
		yAxisG.call(yAxisLeft)

		this.dom = copyMerge(this.dom, {
			mainG,
			selectQuestion
		})
		this.twLst = config.terms.concat(config.scTerms)
	}

	async main() {
		super.main()
		await this.setControls()
		this.renderHeaderOptions()
		this.renderPlot()
	}

	renderHeaderOptions() {
		this.dom.selectQuestion
			.selectAll('option')
			.data(this.config.terms)
			.enter()
			.append('option')
			.text((d, i) => i + 1 + '. ' + d.term.name)
			.attr('value', d => d.term.id)
	}

	getPercentsDict(tw, samples): { [key: string]: number } {
		if (!tw) throw 'tw not defined'
		//not specified when called
		//if defined in the settings a site is provided and the user can decide what to see, otherwise it is admin view and if the site was set sampleData is not null
		const percentageDict = {}
		for (const sample of samples) {
			let termData = sample[tw.$id].value
			termData = termData.slice(1, -1) //Removed string quoutes
			const percents: { [key: string]: number } = JSON.parse(termData)
			for (const key in percents) {
				const value = percents[key]
				if (!percentageDict[key]) percentageDict[key] = 0
				percentageDict[key] += value
			}
		}
		return percentageDict
	}

	getSCPercentsDict(tw, samples): { [key: string]: number } {
		if (!tw) throw 'tw not defined'
		//not specified when called
		//if defined in the settings a site is provided and the user can decide what to see, otherwise it is admin view and if the site was set sampleData is not null
		const percentageDict = {}
		for (const sample of samples) {
			const key = sample[tw.$id].value
			if (!percentageDict[key]) percentageDict[key] = 0
			percentageDict[key] += 1
		}
		return percentageDict
	}

	renderPlot() {
		this.dom.mainG.selectAll('*').remove()

		const samples = this.settings.site ? [this.data.samples[this.settings.site]] : this.data.lst
		let i = 1
		const step = this.settings.svgh / (this.state.config.terms.length + 1)
		const height = 40

		for (const tw of this.state.config.terms) {
			const percents: { [key: string]: number } = this.getPercentsDict(tw, samples)
			const scTerm = this.state.config.scTerms.find(t => t.term.id.includes(tw.term.id))
			const scPercents: { [key: string]: number } = this.getSCPercentsDict(scTerm, samples)
			const scPercentKeys = Object.keys(scPercents).sort((a, b) => a.localeCompare(b))
			const y = this.settings.svgh - i * step - height / 2
			const scTotal = Object.values(scPercents).reduce((a, b) => a + b, 0)

			this.renderRects(percents, y - height / 2, height, scTotal == 1 ? scPercentKeys : [])
			if (scTotal > 1) this.renderRects(scPercents, y + height / 2, height, [])

			i++
		}
	}

	renderRects(percents: { [key: string]: number }, y: number, height: number, scPercentKeys: string[]) {
		const percentsOrdered = Object.keys(percents).sort((a, b) => -a.localeCompare(b))
		console.log(percentsOrdered, y, height)
		const total = Object.values(percents).reduce((a, b) => a + b, 0)
		let x = 0
		for (const key of percentsOrdered) {
			const color = key == 'Yes' ? this.state.config.color : key == 'No' ? '#aaa' : 'white'
			const value = percents[key]
			const width = (value / total) * this.settings.svgw
			this.dom.mainG
				.append('rect')
				.attr('x', x)
				.attr('y', y)
				.attr('width', width)
				.attr('height', height)
				.attr('stroke', 'gray')
				.attr('fill', color)
			if (scPercentKeys.includes(key))
				this.dom.mainG
					.append('text')
					.text('*')
					.attr('x', x + width / 2)
					.attr('y', y)

			x += width
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
	await fillTwLst(config.scTerms, app.vocabApi)
	await loadFilterTerms(config, app, opts)
	return config
}

export function getDefaultProfileFormsSettings() {
	return {
		controls: {
			isOpen: false
		},
		profileForms: copyMerge({ svgw: 400, svgh: 280 }, getDefaultProfilePlotSettings())
	}
}

export const profileFormsInit = getCompInit(profileForms)
// this alias will allow abstracted dynamic imports
export const componentInit = profileFormsInit
