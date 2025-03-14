import { getCompInit, copyMerge } from '../rx/index.js'
import { getProfilePlotConfig, profilePlot, getDefaultProfilePlotSettings } from './profilePlot.js'
import { fillTwLst } from '#termsetting'
import { axisTop } from 'd3-axis'
import { scaleLinear as d3Linear } from 'd3-scale'
import { loadFilterTerms } from './profilePlot.js'
import { Tabs } from '../dom/toggleButtons.js'

const YES_NO_TAB = 'Yes/No Barchart'
const IMPRESSIONS_TAB = 'Impressions'
const LIKERT_TAB = 'Likert Scale'
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
	activePlot: any
	activeTWs: any
	tabs: any

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
		this.twLst = await this.app.vocabApi.getMultivalueTWs({ parent_id: config.tw.term.id })
		const settings = config.settings.profileForms

		this.tabs = []
		for (const plot of config.plots) {
			const tws = this.twLst.filter(tw => tw.term.subtype == plot.subtype)
			if (!tws.length) continue //no terms for this plot
			const tab: any = {
				label: plot.name,
				callback: () => {
					this.app.dispatch({ type: 'plot_edit', id: this.id, config: { activeTab: plot.name } })
				},
				active: false
			}
			if (plot.name == config.activeTab) tab.active = true
			this.tabs.push(tab)
			if (plot.scTerms) this.twLst.push(...plot.scTerms)
		}

		const topDiv = rightDiv.append('div')
		const domain = config.tw.term.id.split('__').slice(1).join(' / ')
		topDiv.append('div').style('padding-bottom', '10px').style('font-weight', 'bold').text(domain)

		const headerDiv = rightDiv.append('div').style('padding-bottom', '10px')
		if (this.tabs.length > 1)
			await new Tabs({
				holder: topDiv,
				tabsPosition: 'horizontal',
				tabs: this.tabs
			}).main()

		const shift = 600
		const shiftTop = 60
		const svg = rightDiv
			.style('padding', '10px')
			.append('svg')
			.attr('width', settings.svgw + shift + 400)
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
			headerDiv,
			mainG,
			gridG,
			legendG,
			xAxisG
		})
	}

	async main() {
		super.main()
		const activeTab = this.state.config.activeTab || this.tabs[0].label
		this.activePlot = this.state.config.plots.find(p => p.name == activeTab)
		this.activeTWs = this.twLst.filter(tw => tw.term.subtype == this.activePlot.subtype)
		const height = this.activeTWs.length * 30
		this.dom.svg.attr('height', height + 120)

		await this.setControls()
		this.renderPlot()
		this.filterG.selectAll('*').remove()
		this.addFilterLegend()
	}

	getDict(key, sample) {
		if (!sample[key]) return null
		const termData = sample[key].value
		return JSON.parse(termData)
	}

	getPercentsDict(getDict, samples): { [key: string]: number } {
		const percentageDict = {}
		for (const sample of samples) {
			const percents: { [key: string]: number } = getDict(sample)
			if (!percents) continue
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
		this.dom.headerDiv.style('display', 'none')
		this.dom.mainG.selectAll('*').remove()
		this.dom.gridG.selectAll('*').remove()
		this.dom.xAxisG.selectAll('*').remove()
		this.dom.legendG.selectAll('*').remove()
		const samples = this.sampleData ? [this.sampleData] : this.data.lst

		switch (this.activePlot.name) {
			case IMPRESSIONS_TAB:
				this.renderImpressions(samples)
				break
			case LIKERT_TAB:
				this.renderLikert(samples)
				break
			case YES_NO_TAB:
				this.renderYesNo(samples)
		}
	}

	renderImpressions(samples) {}

	renderLikert(samples) {
		this.dom.headerDiv.style('display', 'block')
		this.dom.headerDiv.selectAll('*').remove()
		let y = 0
		const step = 30
		for (const tw of this.activeTWs) {
			if (tw.term.type != 'multivalue') continue
			const getDict = sample => this.getDict(tw.$id, sample)
			const dict = this.getPercentsDict(getDict, samples) //get the dict for each drug for the list of samples
			this.renderRect(dict, y, 25, tw)
			y += step
		}
	}

	renderYesNo(samples) {
		this.xAxisScale = d3Linear().domain([0, 100]).range([0, this.settings.svgw])
		this.dom.xAxisG.call(axisTop(this.xAxisScale))
		const height = 30
		let y = 0
		let showSCBar = false
		const activePlot = this.activePlot
		for (const tw of this.activeTWs) {
			const getDict = sample => this.getDict(tw.$id, sample)
			const percents: { [key: string]: number } = this.getPercentsDict(getDict, samples)
			const scTerm = activePlot.scTerms.find(t => t.term.id.includes(tw.term.id))
			const scPercents: { [key: string]: number } = this.getSCPercentsDict(scTerm, samples)
			const scPercentKeys = Object.keys(scPercents).sort((a, b) => a.localeCompare(b))
			const scTotal = Object.values(scPercents).reduce((a, b) => a + b, 0)
			showSCBar = scTotal > 1
			this.renderRects(percents, y, height, scTotal == 1 ? scPercentKeys : [])
			if (showSCBar) {
				y += height + 10
				this.renderRects(scPercents, y, height, [])
				this.dom.mainG
					.append('text')
					.text('SC')
					.style('font-size', '0.7em')
					.attr('x', this.settings.svgw + 8)
					.attr('y', y + height * 0.6)
			}

			this.dom.mainG
				.append('text')
				.text('POC')
				.style('font-size', '0.7em')
				.attr('x', this.settings.svgw + 8)
				.attr('y', showSCBar ? y - height + 0.35 * height : y + height * 0.6)
			this.dom.mainG
				.append('text')
				.attr('x', -15)
				.attr('y', showSCBar ? y : y + height / 2)
				.text(getText(tw.term.name))
				.attr('text-anchor', 'end')
				.attr('font-size', '0.8em')

			y += height + 40
		}
		this.renderLines(y - 20) //last padding not needed

		if (showSCBar) this.dom.legendG.attr('transform', `translate(${750}, ${30 + this.settings.svgh})`)
		else this.dom.legendG.attr('transform', `translate(${750}, ${this.settings.svgh * 0.8})`)

		let x = 0
		for (const key of this.keys) {
			this.drawLegendRect(x, 0, key, this.getColor(key), this.dom.legendG)
			x += 60
		}
		let text = this.dom.legendG
			.append('text')
			.attr('x', x + 80)
			.attr('y', 18)
		text.append('tspan').style('font-weight', 'bold').text('SC:')
		text.append('tspan').text('Site Coordinator')
		text = this.dom.legendG
			.append('text')
			.attr('x', x + 250)
			.attr('y', 18)
		text.append('tspan').style('font-weight', 'bold').text('POC:')
		text.append('tspan').text('Point of Care Staff')
	}

	onMouseOver(event) {
		if (event.target.tagName == 'rect') {
			const path = event.target
			const d = path.__data__
			const menu = this.tip.clear()
			menu.d.text(`${d.key}: ${d.value}`)
			menu.show(event.clientX, event.clientY, true, true)
		} else this.onMouseOut(event)
	}

	getColor(key: string) {
		return key == 'Yes' ? this.state.config.color : key == 'No' ? '#aaa' : `url(#${this.id}_diagonalHatch)`
	}

	renderRect(dict: { [key: string]: number }, y: number, height: number, tw) {
		const hasData = Object.values(dict).some(v => v > 0)
		const categories = this.activePlot.categories
		const itemG = this.dom.mainG.append('g').attr('transform', `translate(0, ${y})`)
		const total = Object.values(dict).reduce((a, b) => a + b, 0)
		let x = 0
		for (const category of categories) {
			const key = category.name
			const color = category.color
			this.keys.add(key)
			const value = dict[key]
			if (!value) continue
			const width = (value / total) * this.settings.svgw
			itemG
				.append('rect')
				.attr('x', x)
				.attr('width', width)
				.attr('height', height)
				.attr('stroke', 'gray')
				.attr('fill', color)
				.datum({ key, value })
				.on('mouseover', this.onMouseOver.bind(this))

			x += width
		}
		const text = getText(tw.term.name)
		itemG
			.append('text')
			.text(text)
			.attr('x', -5)
			.attr('y', (height * 2) / 3)
			.attr('text-anchor', 'end')
			.style('font-size', '0.8em')
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
				.datum({ key, value })

			if (scPercentKeys.includes(key))
				this.dom.mainG
					.append('text')
					.text('SC')
					.style('font-size', '0.7em')
					.attr('x', x + width / 2 - 5)
					.attr('y', y - 5)

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
	let config = formsConfig
	config.settings = getDefaultProfileFormsSettings()
	config.header = 'Templates: Visualization tools to provide insights and assist in leveraging data'
	config = copyMerge(structuredClone(config), opts)
	for (const plot of config.plots) {
		if (plot.terms) await fillTwLst(plot.terms, app.vocabApi)
		if (plot.scTerms) await fillTwLst(plot.scTerms, app.vocabApi)
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

function getText(name, size = 90) {
	if (name.length > size) name = name.slice(0, size) + '...'
	return name
}
