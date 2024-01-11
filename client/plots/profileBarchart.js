import { getCompInit, copyMerge } from '#rx'
import { fillTwLst } from '#termsetting'
import { scaleLinear as d3Linear } from 'd3-scale'
import { axisTop } from 'd3-axis'
import { profilePlot } from './profilePlot.js'
import { loadFilterTerms } from './profilePlot.js'
import { getDefaultProfilePlotSettings } from './profilePlot.js'

let stepx = 500
const barwidth = 400

class profileBarchart extends profilePlot {
	constructor() {
		super()
		this.type = 'profileBarchart'
	}

	async init(appState) {
		await super.init(appState)
		const config = appState.plots.find(p => p.id === this.id)
		this.componentNames = config.plotByComponent.map(elem => {
			return { value: elem.component.name, label: elem.component.name }
		})
		this.componentInput = {
			label: 'Component',
			type: 'dropdown',
			chartType: 'profileBarchart',
			options: this.componentNames,
			settingsKey: 'component',
			callback: value => this.setComponent(value)
		}
	}

	setComponent(value) {
		this.settings.component = value
		this.app.dispatch({ type: 'plot_edit', id: this.id, config: this.config })
	}

	async main() {
		await super.main()

		this.configComponent =
			this.config.plotByComponent.find(comp => comp.component.name == this.settings.component) ||
			this.config.plotByComponent[0]
		this.twLst = []
		this.rowCount = 0
		for (const group of this.configComponent.groups)
			for (const row of group.rows) {
				this.rowCount++
				if (row.sc) {
					this.twLst.push(row.sc.score)
					this.twLst.push(row.sc.maxScore)
				}
				if (row.poc) {
					this.twLst.push(row.poc.score)
					this.twLst.push(row.poc.maxScore)
				}
			}
		await this.setControls([this.componentInput])
		this.component = this.settings.component || this.componentNames[0].value
		this.plot()
	}

	onMouseOut(event) {
		if (event.target.tagName == 'rect' && event.target.getAttribute('fill-opacity') == 0.3) {
			const rect = event.target
			rect.setAttribute('fill-opacity', 0)
		}
	}

	onMouseOver(event) {
		if (event.target.tagName == 'rect' && event.target.getAttribute('fill-opacity') == 0) {
			const rect = event.target
			rect.setAttribute('fill-opacity', 0.3)
		}
	}

	plot() {
		const config = this.config
		this.dom.plotDiv.selectAll('*').remove()
		const hasSubjectiveData = this.configComponent.hasSubjectiveData
		const width = 1400
		const height = this.rowCount * 32 + 480
		this.svg = this.dom.plotDiv.append('svg').attr('width', width).attr('height', height)
		const title =
			this.state.dslabel == 'ProfileAbbrev'
				? `Score-based Results for the ${this.component} Component by Module and Domain Compared with End-User Impression`
				: `Objective and Subjective Score-Based Results for the ${this.component} Component by Module and Domain`
		this.svg.append('text').attr('transform', `translate(50, 30)`).attr('font-weight', 'bold').text(title)
		const svg = this.svg
		const color = this.configComponent.component.color
		this.svg
			.append('defs')
			.append('pattern')
			.attr('id', `${this.id}_diagonalHatch`)
			.attr('patternUnits', 'userSpaceOnUse')
			.attr('width', 4)
			.attr('height', 4)
			.append('path')
			.attr('d', 'M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2')
			.attr('stroke-width', 1)
			.attr('stroke', color)

		let x
		let y
		let step = 30

		for (const [i, c] of config.columnNames.entries()) {
			if (i == 1 && !hasSubjectiveData) break

			x = i % 2 == 0 ? 400 : 900
			x += 10
			y = 70
			svg
				.append('text')
				.attr('transform', `translate(${x}, ${y})`)
				.attr('text-anchor', 'start')
				.style('font-weight', 'bold')
				.text(c)
			drawAxes(x, y + 30)

			x += stepx
		}
		y = 70
		for (const group of this.configComponent.groups) {
			svg
				.append('text')
				.attr('transform', `translate(${50}, ${y + 40})`)
				.attr('text-anchor', 'start')
				.text(`${group.label}`)
				.style('font-weight', 'bold')

			y += step + 20
			for (const row of group.rows) {
				const g = svg.append('g')
				g.append('rect')
					.attr('transform', `translate(${20}, ${y - 6})`)

					.attr('x', 0)
					.attr('y', 0)
					.attr('width', hasSubjectiveData ? 1500 : 850)
					.attr('height', 30)
					.attr('fill', '#f8d335')
					.attr('fill-opacity', 0)
				x = 400
				if (row.sc) this.drawRect(x, y, row, 'sc', g)
				if (row.poc) this.drawRect(x + stepx, y, row, 'poc', g)
				y += step
			}
		}

		drawLine(410, 120, 50, y, 'B')
		drawLine(410, 120, 75, y, 'A')

		this.legendG = this.svg.append('g').attr('transform', `translate(${50},${y + 90})`)
		this.filterG = this.svg.append('g').attr('transform', `translate(${440},${y + 90})`)

		this.legendG
			.append('text')
			.attr('text-anchor', 'left')
			.style('font-weight', 'bold')
			.text('Overall Score')
			.attr('transform', `translate(0, -5)`)

		this.addLegendItem('A', 'More than 75% of possible scorable items', 1)
		this.addLegendItem('B', '50-75% of possible scorable items', 2)
		this.addLegendItem('C', 'Less than 50% of possible scorable items', 3)
		const textElem = this.legendG.append('text').attr('transform', `translate(0, 120)`).attr('font-size', '0.9em')
		this.addFilterLegend()
		if (this.state.dslabel == 'ProfileAbbrev') {
			textElem.append('tspan').attr('font-weight', 'bold').text('End-user Impression:')
			textElem
				.append('tspan')
				.text(
					'It is provided by the local liaison who completed the assessment in consultation with the PHO medical director or directly by the PHO medical director.'
				)
			this.legendG
				.append('text')
				.attr('transform', `translate(0, 140)`)
				.text(
					'The end-user was asked to rate the current status of the domains and subdomains included for this module.'
				)
		}

		if (!hasSubjectiveData) return
		drawLine(910, 120, 50, y, 'B')
		drawLine(910, 120, 75, y, 'A')
		y += 40
		x = 600
		this.drawLegendRect(x, y, 'and', color)
		x += 300
		this.drawLegendRect(x, y, 'or', color)

		function drawAxes(x, y) {
			const xAxisScale = d3Linear().domain([0, 100]).range([0, barwidth])

			svg.append('g').attr('transform', `translate(${x}, ${y})`).call(axisTop(xAxisScale))
		}

		function drawLine(x, y, percent, y2, text) {
			const x1 = x + (percent / 100) * barwidth
			svg
				.append('line')
				.style('stroke', '#aaa')
				.style('stroke-width', 1)
				.style('stroke-dasharray', '5, 5')
				.attr('x1', x1)
				.attr('y1', y)
				.attr('x2', x1)
				.attr('y2', y2)
			svg
				.append('text')
				.attr('transform', `translate(${x1 + 0.125 * barwidth}, ${y2 + 20})`)
				.attr('text-anchor', 'middle')
				.text(text)
				.style('font-weight', 'bold')
			if (percent == 50)
				svg
					.append('text')
					.attr('transform', `translate(${x1 - 0.25 * barwidth}, ${y2 + 20})`)
					.attr('text-anchor', 'middle')
					.text('C')
					.style('font-weight', 'bold')
		}
	}

	drawRect(x, y, row, field, g) {
		const hasSubjectiveData = this.configComponent.hasSubjectiveData
		const d = row[field]
		let subjectiveTerm = false
		if ((row.name == 'Total Module' || row.name == 'End-user Impression*') && !row.poc) subjectiveTerm = true
		const termColor = d.score.term.color
		const value = this.getPercentage(d)
		const isFirst = field == 'sc' || (field == 'poc' && !row.sc)
		const pairValue = field == 'sc' ? this.getPercentage(row.poc) : this.getPercentage(row.sc)
		const width = value ? (value / 100) * barwidth : 0

		if (value) {
			const rect = g
				.append('rect')
				.attr('transform', `translate(${x + 10}, ${y})`)
				.attr('pointer-events', 'none')
				.attr('x', 0)
				.attr('y', 0)
				.attr('width', width)
				.attr('height', 20)
			if (!subjectiveTerm && (pairValue || !hasSubjectiveData)) rect.attr('fill', termColor)
			else {
				const termid = this.id + d.score.term.name.replace(/[^a-zA-Z0-9]/g, '')
				g.append('defs')
					.append('pattern')
					.attr('id', termid)
					.attr('patternUnits', 'userSpaceOnUse')
					.attr('width', 4)
					.attr('height', 4)
					.append('path')
					.attr('d', 'M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2')
					.attr('stroke-width', 1)
					.attr('stroke', termColor)
				rect.attr('fill', `url(#${termid})`)
			}
		}
		const text = g
			.append('text')
			.attr('pointer-events', 'none')
			.attr('text-anchor', 'end')
			.text(`${value || 0}%`)
		if (width > 0) text.attr('transform', `translate(${x + width + 55}, ${y + 15})`)
		else if (!pairValue && field == 'sc') text.attr('transform', `translate(${x + 35}, ${y + 15})`)
		//else text.attr('transform', `translate(${x + 35}, ${y + 15})`)

		if (isFirst)
			g.append('text')
				.attr('transform', `translate(${field == 'sc' ? x : x - stepx}, ${y + 15})`)
				.attr('text-anchor', 'end')
				.text(row.name)
				.attr('pointer-events', 'none')
	}

	drawLegendRect(x, y, operator, color) {
		const rect = this.svg
			.append('g')
			.attr('transform', `translate(${x}, ${y})`)
			.append('rect')
			.attr('x', 0)
			.attr('y', 0)
			.attr('width', 20)
			.attr('height', 20)
		if (operator == 'and') rect.attr('fill', color)
		else {
			rect.attr('fill', `url(#${this.id}_diagonalHatch)`)
		}

		const text = this.svg
			.append('text')
			.attr('transform', `translate(${x + 25}, ${y + 15})`)
			.attr('text-anchor', 'start')
			.text('Objective ')
		text.append('tspan').attr('font-weight', 'bold').text(operator)
		text.append('tspan').text(' Subjective data')
	}
}

export async function getPlotConfig(opts, app) {
	try {
		const defaults = app.vocabApi.termdbConfig?.chartConfigByType?.profileBarchart
		if (!defaults) throw 'default config not found in termdbConfig.chartConfigByType.profileBarchart'
		const config = copyMerge(structuredClone(defaults), opts)
		const settings = getDefaultProfilePlotSettings()

		config.settings = {
			controls: {
				isOpen: true // control panel is hidden by default
			},
			profileBarchart: settings
		}
		const twlst = []
		for (const component of config.plotByComponent) {
			component.hasSubjectiveData = false
			for (const group of component.groups)
				for (const row of group.rows) {
					if (row.sc) {
						row.sc.score.q = row.sc.maxScore.q = { mode: 'continuous' }
						twlst.push(row.sc.score)
						twlst.push(row.sc.maxScore)
					}
					if (row.poc) {
						row.poc.score.q = row.poc.maxScore.q = { mode: 'continuous' }
						twlst.push(row.poc.score)
						twlst.push(row.poc.maxScore)
					}
					if (row.sc && row.poc) component.hasSubjectiveData = true
				}
		}
		await fillTwLst(twlst, app.vocabApi)
		await loadFilterTerms(config, app)

		return config
	} catch (e) {
		throw `${e} [profileBarchart getPlotConfig()]`
	}
}

export const profileBarchartInit = getCompInit(profileBarchart)
// this alias will allow abstracted dynamic imports
export const componentInit = profileBarchartInit

export function getDefaultProfileBarchartSettings() {
	return {}
}
