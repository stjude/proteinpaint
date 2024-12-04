import { getCompInit, copyMerge } from '../rx/index.js'
import { getProfilePlotConfig, profilePlot, getDefaultProfilePlotSettings } from './profilePlot.js'
import { fillTwLst } from '#termsetting'
import { axisTop } from 'd3-axis'
import { scaleLinear as d3Linear } from 'd3-scale'
import { loadFilterTerms } from './profilePlot.js'
import { Tabs } from '../dom/toggleButtons.js'

const YES_NO_TAB = 'Yes/No Barchart'
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
	filterG: any
	keys: any

	constructor(opts) {
		super()
		this.opts = opts
		this.type = 'profileForms'
		this.keys = new Set()
	}

	async init(appState) {
		super.init(appState)
		const rightDiv = this.dom.rightDiv
		const config = structuredClone(appState.plots.find(p => p.id === this.id))
		const settings = config.settings.profileForms

		const tabs: any[] = []
		this.twLst = []
		for (const plot of config.plots) {
			const tab: any = {
				label: plot.name,
				callback: () => {
					this.app.dispatch({ type: 'plot_edit', id: this.id, config: { activeTab: plot.name } })
				},
				active: false
			}
			if (plot.name == config.activeTab) tab.active = true
			tabs.push(tab)
			this.twLst.push(...plot.terms, ...plot.scTerms)
		}

		const topDiv = rightDiv.append('div')
		await new Tabs({
			holder: topDiv,
			tabsPosition: 'horizontal',
			tabs
		}).main()

		rightDiv.append('div').style('font-weight', 'bold').text(config.tw.term.name)
		const shift = 750
		const shiftTop = 60
		const svg = rightDiv
			.style('padding', '10px')
			.append('svg')
			.attr('width', settings.svgw + shift + 400)
			.attr('height', settings.svgh + shiftTop * 2)
		svg
			.append('defs')
			.append('pattern')
			.attr('id', `${this.id}_diagonalHatch`)
			.attr('patternUnits', 'userSpaceOnUse')
			.attr('width', 4)
			.attr('height', 4)
			.append('path')
			.attr('d', 'M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2')
			.attr('stroke-width', 1)
			.attr('stroke', 'gray')
		const mainG = svg.append('g').attr('transform', `translate(${shift}, ${shiftTop})`)
		const gridG = svg.append('g').attr('transform', `translate(${shift}, ${shiftTop})`)
		this.filterG = svg.append('g').attr('transform', `translate(${shift + settings.svgw + 100}, ${shiftTop})`)
		const legendG = svg.append('g').attr('transform', `translate(${shift}, ${20 + settings.svgh})`)

		const xAxisG = svg.append('g').attr('transform', `translate(${shift}, ${shiftTop / 2})`)

		this.dom = copyMerge(this.dom, {
			svg,
			mainG,
			gridG,
			legendG,
			xAxisG
		})
	}

	async main() {
		super.main()
		await this.setControls()
		this.renderPlot()
		this.filterG.selectAll('*').remove()
		this.addFilterLegend()
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
		this.dom.gridG.selectAll('*').remove()
		this.dom.xAxisG.selectAll('*').remove()
		this.dom.legendG.selectAll('*').remove()
		const samples = this.settings.isAggregate || !this.sampleData ? this.data.lst : [this.sampleData]
		if (this.state.config.activeTab === undefined || this.state.config.activeTab == YES_NO_TAB)
			this.renderPlotYesNo(samples)
	}

	renderPlotYesNo(samples) {
		this.xAxisScale = d3Linear().domain([0, 100]).range([0, this.settings.svgw])
		this.dom.xAxisG.call(axisTop(this.xAxisScale))
		const height = 30
		let y = 0
		const activePlot = this.state.config.activeTab
			? this.state.config.plots.find(p => p.name == this.state.config.activeTab)
			: this.state.config.plots[0]
		for (const tw of activePlot.terms) {
			const percents: { [key: string]: number } = this.getPercentsDict(tw, samples)
			const scTerm = activePlot.scTerms.find(t => t.term.id.includes(tw.term.id))
			const scPercents: { [key: string]: number } = this.getSCPercentsDict(scTerm, samples)
			const scPercentKeys = Object.keys(scPercents).sort((a, b) => a.localeCompare(b))
			const scTotal = Object.values(scPercents).reduce((a, b) => a + b, 0)

			this.renderRects(percents, y, height, scTotal == 1 ? scPercentKeys : [])
			if (scTotal > 1) {
				y += height + 10
				this.renderRects(scPercents, y, height, [])
				this.dom.mainG
					.append('text')
					.text('*')
					.attr('x', this.settings.svgw + 8)
					.attr('y', y + height * 0.75)
			}
			this.dom.mainG
				.append('text')
				.attr('x', -15)
				.attr('y', scTotal > 1 ? y : y + height / 2)
				.text(tw.term.name)
				.attr('text-anchor', 'end')
				.attr('font-size', '0.9em')

			y += height + 40
		}
		this.renderLines(y - 20) //last padding not needed

		let x = 0
		for (const key of this.keys) {
			this.drawLegendRect(x, 0, key, this.getColor(key), this.dom.legendG)
			x += 60
		}
		this.dom.legendG
			.append('text')
			.attr('x', x + 80)
			.attr('y', 18)
			.style('font-weight', 'bold')
			.text('* Site coordinator')
	}

	getColor(key: string) {
		return key == 'Yes' ? this.state.config.color : key == 'No' ? '#aaa' : `url(#${this.id}_diagonalHatch)`
	}

	renderRects(percents: { [key: string]: number }, y: number, height: number, scPercentKeys: string[]) {
		const percentsOrdered = Object.keys(percents).sort((a, b) => -a.localeCompare(b))
		const total = Object.values(percents).reduce((a, b) => a + b, 0)
		let x = 0
		for (const key of percentsOrdered) {
			this.keys.add(key)
			const color = this.getColor(key)

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

	drawLegendRect(x, y, text, color, legendG) {
		const size = 20
		const itemG = legendG.append('g').attr('transform', `translate(${x}, ${y})`)
		itemG
			.append('rect')
			.attr('x', 0)
			.attr('y', 0)
			.attr('width', size)
			.attr('height', size)
			.attr('fill', color)
			.attr('stroke', 'gray')
		itemG
			.append('text')
			.attr('transform', `translate(${size + 10}, ${y + size})`)
			.text(text)
	}
}

export async function getPlotConfig(opts, app, _activeCohort) {
	const activeCohort = _activeCohort === undefined ? app.getState().activeCohort : _activeCohort
	const formsConfig = getProfilePlotConfig(activeCohort, app, opts)
	const module = opts.tw.term.name
	let config = formsConfig[module]
	if (!config) throw 'No data available for the module ' + module
	config.settings = getDefaultProfileFormsSettings()
	config.header = 'Templates'
	config = copyMerge(structuredClone(config), opts)
	for (const plot of config.plots) {
		await fillTwLst(plot.terms, app.vocabApi)
		await fillTwLst(plot.scTerms, app.vocabApi)
	}

	await loadFilterTerms(config, activeCohort, app)
	return config
}

export function getDefaultProfileFormsSettings() {
	const settings = {
		controls: {
			isOpen: false
		},
		profileForms: { svgw: 300, svgh: 480 }
	}
	const profilePlotSettings = getDefaultProfilePlotSettings()
	settings.profileForms = copyMerge(settings.profileForms, profilePlotSettings)

	return settings
}

export const profileFormsInit = getCompInit(profileForms)
// this alias will allow abstracted dynamic imports
export const componentInit = profileFormsInit
