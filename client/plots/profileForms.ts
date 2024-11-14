import { getCompInit, copyMerge } from '../rx/index.js'
import { getProfilePlotConfig, profilePlot, getDefaultProfilePlotSettings } from './profilePlot.js'
import { fillTwLst } from '#termsetting'
import { axisTop } from 'd3-axis'
import { scaleLinear as d3Linear } from 'd3-scale'
import { loadFilterTerms } from './profilePlot.js'

export class profileForms extends profilePlot {
	id: any
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
		rightDiv.append('h3').text(config.module)
		const shift = 750
		const shiftTop = 40
		const svg = rightDiv
			.style('padding', '10px')
			.append('svg')
			.attr('width', settings.svgw + shift + 10)
			.attr('height', settings.svgh + shiftTop * 2)
		const mainG = svg.append('g').attr('transform', `translate(${shift}, ${shiftTop})`)
		const gridG = svg.append('g').attr('transform', `translate(${shift}, ${shiftTop})`)

		const xAxisG = svg.append('g').attr('transform', `translate(${shift}, ${shiftTop / 2})`)
		this.xAxisScale = d3Linear().domain([0, 100]).range([0, settings.svgw])
		xAxisG.call(axisTop(this.xAxisScale))
		this.dom = copyMerge(this.dom, {
			svg,
			mainG,
			gridG
		})
		this.twLst = config.terms.concat(config.scTerms)
	}

	async main() {
		super.main()
		await this.setControls()
		this.renderPlot()
	}

	getPercentsDict(tw, samples): { [key: string]: number } {
		if (!tw) throw 'tw not defined'
		//not specified when called
		//if defined in the settings a site is provided and the user can decide what to see, otherwise it is admin view and if the site was set sampleData is not null
		const percentageDict = {}
		for (const sample of samples) {
			const termData = sample[tw.$id].value
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
		const height = 30
		let y = 0
		for (const tw of this.state.config.terms) {
			const percents: { [key: string]: number } = this.getPercentsDict(tw, samples)
			const scTerm = this.state.config.scTerms.find(t => t.term.id.includes(tw.term.id))
			const scPercents: { [key: string]: number } = this.getSCPercentsDict(scTerm, samples)
			const scPercentKeys = Object.keys(scPercents).sort((a, b) => a.localeCompare(b))
			const scTotal = Object.values(scPercents).reduce((a, b) => a + b, 0)

			this.renderRects(percents, y, height, scTotal == 1 ? scPercentKeys : [])
			if (scTotal > 1) {
				y += height
				this.renderRects(scPercents, y, height, [])
			}
			this.dom.mainG
				.append('text')
				.attr('x', -15)
				.attr('y', scTotal > 1 ? y : y + height / 2)
				.text(tw.term.name)
				.attr('text-anchor', 'end')
				.attr('font-size', '0.9em')
			y += height + 20
		}
		this.renderLines(y - 20) //last padding not needed
	}

	renderRects(percents: { [key: string]: number }, y: number, height: number, scPercentKeys: string[]) {
		const percentsOrdered = Object.keys(percents).sort((a, b) => -a.localeCompare(b))
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

	renderLines(y: number) {
		this.dom.gridG.selectAll('*').remove()
		const width = this.settings.svgw
		const color = 'lightgray'
		const opacity = 0.5
		const bins = 4
		const size = width / bins
		let x
		const gridG = this.dom.gridG
		for (let i = 0; i <= bins; i++) {
			x = i * size
			gridG
				.append('line')
				.attr('x1', x)
				.attr('x2', x)
				.attr('y1', 0)
				.attr('y2', y)
				.style('stroke', color)
				.style('stroke-opacity', opacity)
				.style('stroke-dasharray', '5, 5')
		}
	}
}

export async function getPlotConfig(opts, app) {
	let config = getProfilePlotConfig(app, opts)
	config = config.find(t => t.module == opts.tw.term.name)

	config.settings = getDefaultProfileFormsSettings()
	config = copyMerge(structuredClone(config), opts)
	await fillTwLst(config.terms, app.vocabApi)
	await fillTwLst(config.scTerms, app.vocabApi)
	await loadFilterTerms(config, app, opts)
	return config
}

export function getDefaultProfileFormsSettings() {
	const settings = {
		controls: {
			isOpen: false
		},
		profileForms: { svgw: 300, svgh: 380 }
	}
	const profilePlotSettings = getDefaultProfilePlotSettings()
	settings.profileForms = copyMerge(settings.profileForms, profilePlotSettings)

	return settings
}

export const profileFormsInit = getCompInit(profileForms)
// this alias will allow abstracted dynamic imports
export const componentInit = profileFormsInit
