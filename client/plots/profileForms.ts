import { getCompInit, copyMerge } from '../rx/index.js'
import { getProfilePlotConfig, profilePlot, getDefaultProfilePlotSettings } from './profilePlot.js'
import { fillTwLst } from '#termsetting'
import { axisBottom, axisTop } from 'd3-axis'
import { scaleLinear as d3Linear } from 'd3-scale'
import { Tabs } from '../dom/toggleButtons.js'
import { roundValueAuto } from '@sjcrh/proteinpaint-shared/roundValue.js'

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
	activePlot: any
	scScoreTerms: any
	tabs: any
	shiftTop: any
	categories: any
	module: any
	legendG: any

	constructor(opts) {
		super()
		this.opts = opts
		this.type = 'profileForms'
	}

	async init(appState) {
		super.init(appState)
		const rightDiv = this.dom.rightDiv
		const config = structuredClone(appState.plots.find(p => p.id === this.id))
		this.twLst = await this.app.vocabApi.getMultivalueTWs({ parent_id: config.tw.term.id })
		const settings = config.settings.profileForms
		this.tabs = []
		for (const plot of config.options) {
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
		const domainDiv = topDiv.append('div').style('padding-bottom', '10px').style('font-weight', 'bold')

		const headerDiv = rightDiv.append('div').style('padding-bottom', '10px')
		if (this.tabs.length > 1)
			await new Tabs({
				holder: topDiv,
				tabsPosition: 'horizontal',
				tabs: this.tabs
			}).main()

		const shift = 620
		const shiftTop = 50
		const width = settings.svgw + shift + 500
		const svg = rightDiv.style('padding', '20px').append('svg').attr('width', width)
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
		this.shiftTop = shiftTop
		this.shift = shift
		const mainG = svg.append('g').attr('transform', `translate(${shift}, ${shiftTop})`)
		const gridG = svg.append('g').attr('transform', `translate(${shift}, ${shiftTop})`)
		this.filterG = svg.append('g').attr('transform', `translate(${shift + settings.svgw + 60}, ${shiftTop + 40})`)
		this.legendG = svg.append('g') //each plot will translate it to the right position

		const xAxisG = svg.append('g').attr('transform', `translate(${shift}, ${shiftTop / 2})`)

		this.dom = copyMerge(this.dom, {
			svg,
			headerDiv,
			mainG,
			gridG,
			legendG: this.legendG,
			xAxisG,
			domainDiv
		})
	}

	async main() {
		super.main()
		if (this.tabs.length == 0) return // no plots to show
		const activeTab = this.state.config.activeTab || this.tabs[0].label
		this.activePlot = this.state.config.options.find(p => p.name == activeTab)
		this.scoreTerms = this.twLst.filter(tw => tw.term.subtype == this.activePlot.subtype)
		this.scScoreTerms = this.activePlot.scTerms
		const parents = this.config.tw.term.id.split('__')
		this.module = parents[1]
		const domain = parents.slice(1).join(' / ')
		this.dom.domainDiv.text(domain)
		this.categories = new Set()

		await this.setControls()
		this.renderPlot()
		this.filterG.selectAll('*').remove()
		this.addFilterLegend()
	}

	renderPlot() {
		try {
			this.dom.headerDiv.style('display', 'none')
			this.dom.mainG.selectAll('*').remove()
			this.dom.gridG.selectAll('*').remove()
			this.dom.xAxisG.selectAll('*').remove()
			this.dom.legendG.selectAll('*').remove()

			switch (this.activePlot.name) {
				case IMPRESSIONS_TAB:
					this.renderImpressions()
					break
				case LIKERT_TAB:
					this.renderLikert()
					break
				case YES_NO_TAB:
					this.renderYesNo()
			}
		} catch (e) {
			console.error('Error rendering profile forms plot:', e)
		}
	}

	renderImpressions() {}

	renderLikert() {
		this.dom.headerDiv.style('display', 'block')
		this.dom.headerDiv.selectAll('*').remove()
		let y = 0
		const step = 30
		const height = (this.scoreTerms.length + 2) * step
		this.dom.svg.attr('height', height + 120)
		this.categories = new Set<string>()

		for (const tw of this.scoreTerms) {
			if (tw.term.type != 'multivalue') continue
			const dict = this.getPercentageDict(tw) //get the dict with the counts for each category  for the list of samples
			this.renderLikertBar(dict, y, 25, tw)
			y += step
		}
		y += step * 2
		const width = this.settings.svgw
		const posScale = d3Linear()
			.domain([0, 100])
			.range([this.shift, this.shift + width])
		const posAxisBottom = axisBottom(posScale)
			.ticks(10)
			.tickFormat(d => d + '%')
		const scaleG = this.dom.svg.append('g').attr('transform', `translate(0, ${y})`)
		posAxisBottom(scaleG)

		const legendG = this.dom.legendG.attr('transform', `translate(100, ${y + 50})`)
		let x = 0

		for (const category of this.categories) {
			this.drawLegendRect(x, 0, category, legendG)
			x += 220
		}
	}

	renderYesNo() {
		this.xAxisScale = d3Linear().domain([0, 100]).range([0, this.settings.svgw])
		this.dom.xAxisG.call(axisTop(this.xAxisScale))
		const step = 30
		const height = this.scoreTerms.length * step
		this.dom.svg.attr('height', height * 3 + 200) //space for the sc, for the poc and between items

		let y = 0
		let showSCBar = false
		const activePlot = this.activePlot
		for (const tw of this.scoreTerms) {
			const percents: { [key: string]: number } = this.getPercentageDict(tw)

			const scTerm = activePlot.scTerms.find(t => tw.term.id.includes(t.term.id))
			const scPercents: { [key: string]: number } = this.getPercentageDict(scTerm)

			const scPercentKeys = Object.keys(scPercents).sort((a, b) => a.localeCompare(b))
			const scTotal = Object.values(scPercents).reduce((a, b) => a + b, 0)
			showSCBar = scTotal > 1
			this.renderYesNoBar(percents, y, step, scTotal == 1 ? scPercentKeys : [])
			if (showSCBar) {
				y += step + 10
				this.renderYesNoBar(scPercents, y, step, [])
				this.dom.mainG
					.append('text')
					.text('SC')
					.style('font-size', '0.7em')
					.attr('x', this.settings.svgw + 8)
					.attr('y', y + step * 0.6)
			}

			this.dom.mainG
				.append('text')
				.text('POC')
				.style('font-size', '0.7em')
				.attr('x', this.settings.svgw + 8)
				.attr('y', showSCBar ? y - step + 0.35 * step : y + step * 0.6)
			this.dom.mainG
				.append('text')
				.attr('x', -this.shift)
				.attr('y', showSCBar ? y : y + step / 2)
				.text(getText(tw.term.name, 100))
				.attr('font-size', '0.8em')
				.on('mouseenter', event => this.showText(event, tw.term.name, 100))
				.on('mouseleave', () => this.tip.hide())

			y += step + 40
		}
		this.renderLines(y - 20) //last padding not needed

		if (showSCBar) this.dom.legendG.attr('transform', `translate(${550}, ${30 + this.settings.svgh})`)
		else this.dom.legendG.attr('transform', `translate(${550}, ${this.settings.svgh * 0.8})`)

		let x = 0
		for (const category of this.activePlot.categories) {
			this.drawLegendRect(x, 0, category.name, this.dom.legendG, true)
			x += 80
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
			const percent = roundValueAuto(d.value, true, 1)
			menu.d.text(`${d.category}: ${percent}%`)
			menu.show(event.clientX, event.clientY, true, true)
		} else this.onMouseOut(event)
	}

	getColor(key: string) {
		return key == 'Yes' ? this.activePlot.color : key == 'No' ? '#aaa' : `url(#${this.id}_diagonalHatch)`
	}

	renderLikertBar(dict: { [key: string]: number }, y: number, height: number, tw: any) {
		const itemG = this.dom.mainG.append('g')
		let total = 0
		for (const key in dict) total += dict[key]

		let x = 0
		const keys = Object.keys(tw.term.values)
			.filter(key => key !== '')
			.sort((a, b) => Number(a) - Number(b))
		for (const key of keys) {
			const category = tw.term.values[key].label
			this.categories.add(category)
			const width = this.renderCategory(category, dict, itemG, x, height, total)
			x += width
		}
		const text = getText(tw.term.name)
		const textG = this.dom.svg.append('g').attr('transform', `translate(0, ${y + this.shiftTop})`)
		textG
			.append('text')
			.text(text)
			.attr('y', (height * 2) / 3)
			.style('font-size', '0.85em')
			.on('mouseenter', event => this.showText(event, tw.term.name, 80))
			.on('mouseleave', () => this.tip.hide())

		itemG.attr('transform', `translate(0, ${y})`)
	}

	renderCategory(category, dict, itemG, x, height, total, showPercent = false) {
		const key = category.toUpperCase()
		const module = this.module
		const colorMap = this.state.termdbConfig.colorMap
		const color = colorMap[module][key] || colorMap['*'][key]
		const entry: any = Object.entries(dict).find(k => k[0].toUpperCase() == key)
		if (!entry) return 0
		const value: number = entry[1]
		this.categories.add(category)

		const percent = (value / total) * 100
		const width = (percent / 100) * this.settings.svgw
		itemG
			.append('rect')
			.attr('x', x)
			.attr('width', width)
			.attr('height', height)
			.attr('stroke', 'gray')
			.attr('stroke-width', 0.5)
			.attr('stroke-opacity', 0.5)
			.attr('fill', color)
			.datum({ category, value: percent })
			.on('mouseover', event => this.onMouseOver(event))
		if (showPercent)
			itemG
				.append('text')
				.text(`${roundValueAuto(percent, true, 1)}%`)
				.style('font-size', '0.8em')
				.attr('x', x + width + 10)
				.attr('y', height * 0.6)
		return width
	}

	renderYesNoBar(percents: { [key: string]: number }, y: number, height: number, scPercentKeys: string[]) {
		const percentsOrdered = Object.keys(percents).sort((a, b) => -a.localeCompare(b))
		const total = Object.values(percents).reduce((a, b) => a + b, 0)
		let x = 0
		for (const key of percentsOrdered) {
			const color = this.getColor(key)

			const value = percents[key]
			const width = (value / total) * this.settings.svgw
			const percent = (value / total) * 100
			this.dom.mainG
				.append('rect')
				.attr('x', x)
				.attr('y', y)
				.attr('width', width)
				.attr('height', height)
				.attr('stroke', 'gray')
				.attr('fill', color)
				.datum({ key, value: percent })

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

	drawLegendRect(x, y, text, legendG, isYesNo = false) {
		const key = text.toUpperCase()
		const colorMap = this.state.termdbConfig.colorMap
		const noAnswerColor = isYesNo ? 'url(#' + this.id + '_diagonalHatch)' : colorMap['*'][text]
		const color = colorMap[this.module][key] || colorMap['*'][key] || noAnswerColor

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
			.attr('stroke-width', 0.5)
			.attr('stroke-opacity', 0.5)
		itemG
			.append('text')
			.attr('transform', `translate(${size + 10}, ${y + size})`)
			.style('font-size', '0.85em')
			.text(text)
	}

	showText(event, text, size) {
		if (text.length <= size) return
		const menu = this.tip.clear()
		menu.d.style('padding', '5px').text(text)
		menu.showunder(event.target)
	}

	getPercentageDict(tw) {
		return this.data.term2Score[tw.term.id]
	}
}

export async function getPlotConfig(opts, app, _activeCohort) {
	const activeCohort = _activeCohort === undefined ? app.getState().activeCohort : _activeCohort
	const formsConfig = await getProfilePlotConfig(activeCohort, app, opts)
	let config = formsConfig
	config.settings = getDefaultProfileFormsSettings()
	config.headerTitle = 'Templates: Visualization tools to provide insights and assist in leveraging data'
	config = copyMerge(structuredClone(config), opts)
	for (const plot of config.options) {
		if (plot.terms) await fillTwLst(plot.terms, app.vocabApi)
		if (plot.scTerms) await fillTwLst(plot.scTerms, app.vocabApi)
	}

	return config
}

export function getDefaultProfileFormsSettings() {
	const settings = {
		controls: {
			isOpen: false
		},
		profileForms: { svgw: 420, svgh: 480 }
	}
	const profilePlotSettings = getDefaultProfilePlotSettings()
	settings.profileForms = copyMerge(settings.profileForms, profilePlotSettings)

	return settings
}

export const profileFormsInit = getCompInit(profileForms)
// this alias will allow abstracted dynamic imports
export const componentInit = profileFormsInit

function getText(name, size = 80) {
	if (name.length > size) name = name.slice(0, size) + '...'
	return name
}
