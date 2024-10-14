import { getCompInit, copyMerge } from '#rx'
import { fillTwLst } from '#termsetting'
import { scaleLinear as d3Linear } from 'd3-scale'
import { axisTop } from 'd3-axis'
import { profilePlot } from './profilePlot.js'
import { loadFilterTerms } from './profilePlot.js'
import { getDefaultProfilePlotSettings, getProfilePlotConfig } from './profilePlot.js'

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
		const state = this.getState(appState)
		const suffix = state.logged ? (config.site ? config.site : 'Admin') : 'Public'
		this.opts.header.text('Barchart Graph' + ` / ${suffix}`)
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
				if (row.term1) {
					this.twLst.push(row.term1.score)
					this.twLst.push(row.term1.maxScore)
				}
				if (row.term2) {
					this.twLst.push(row.term2.score)
					this.twLst.push(row.term2.maxScore)
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
		const height = this.rowCount * 32 + 600
		this.svg = this.dom.plotDiv.append('svg').attr('width', width).attr('height', height)
		const title =
			this.state.dslabel == 'ProfileAbbrev'
				? `Score-based Results for the ${this.component} Component by Module and Domain Compared with End-User Impression`
				: `Objective ${this.component == 'Patients and Outcomes' ? '' : 'and Subjective '}Score-based Results for the ${
						this.component
				  } Component by Module and Domain`
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
			.attr('stroke', 'gray')

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
				if (row.term1) this.drawRect(x, y, row, 'term1', g)
				if (row.term2) this.drawRect(x + stepx, y, row, 'term2', g)
				y += step
			}
		}

		drawLine(410, 120, 50, y, 'B')
		drawLine(410, 120, 75, y, 'A')

		this.legendG = this.svg.append('g').attr('transform', `translate(${50},${y + 60})`)
		this.filterG = this.svg.append('g').attr('transform', `translate(${50},${y + 180})`)

		this.legendG
			.append('text')
			.attr('text-anchor', 'left')
			.style('font-weight', 'bold')
			.text('Overall Score')
			.attr('transform', `translate(0, -5)`)

		this.addLegendItem('A', 'More than 75% of possible scorable items', 1)
		this.addLegendItem('B', '50-75% of possible scorable items', 2)
		this.addLegendItem('C', 'Less than 50% of possible scorable items', 3)
		this.addFilterLegend()
		if (this.state.dslabel == 'ProfileAbbrev') {
			const uiG = this.legendG.append('g').attr('transform', `translate(420, 0)`)
			this.addEndUserImpressionNote(uiG)
		} else this.addPOCNote(this.legendG.append('g').attr('transform', `translate(550, -80)`))

		if (!hasSubjectiveData) return
		drawLine(910, 120, 50, y, 'B')
		drawLine(910, 120, 75, y, 'A')
		y += 40
		x = 600
		const lineG = svg.append('g')
		this.drawLegendRect(x, y, 'and', color, lineG)
		x += 300
		this.drawLegendRect(x, y, 'or', color, lineG)

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
		if ((row.name == 'Total Module' || row.name == 'End-user Impression*') && !row.term2) subjectiveTerm = true
		const termColor = d.score.term.color
		const value = this.getPercentage(d)
		const isFirst = field == 'term1' || (field == 'term2' && !row.term1)
		const pairValue = field == 'term1' ? this.getPercentage(row.term2) : this.getPercentage(row.term1)
		const width = value ? (value / 100) * barwidth : 0
		if (value) {
			const isObjective =
				this.state.dslabel == 'ProfileFull' && this.settings.component == 'Patients and Outcomes'
					? true
					: !subjectiveTerm && (pairValue || !hasSubjectiveData)
			const rect = g
				.append('rect')
				.attr('transform', `translate(${x + 10}, ${y})`)
				.attr('pointer-events', 'none')
				.attr('x', 0)
				.attr('y', 0)
				.attr('width', width)
				.attr('height', 20)
			if (isObjective) rect.attr('fill', termColor)
			else {
				const termid = this.id + d.score.term.id
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
		else if (!pairValue && field == 'term1') text.attr('transform', `translate(${x + 35}, ${y + 15})`)
		//else text.attr('transform', `translate(${x + 35}, ${y + 15})`)

		if (isFirst)
			g.append('text')
				.attr('transform', `translate(${field == 'term1' ? x : x - stepx}, ${y + 15})`)
				.attr('text-anchor', 'end')
				.text(row.name)
				.attr('pointer-events', 'none')
	}

	drawLegendRect(x, y, operator, color, lineG) {
		const rect = lineG
			.append('g')
			.attr('transform', `translate(${x}, ${y})`)
			.append('rect')
			.attr('x', 0)
			.attr('y', 0)
			.attr('width', 20)
			.attr('height', 20)
		if (operator == 'and') rect.attr('fill', 'gray')
		else rect.attr('fill', `url(#${this.id}_diagonalHatch)`)

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
		const defaults = getProfilePlotConfig(app, opts)
		defaults.settings = { profileBarchart: getDefaultProfilePlotSettings() }
		let config = structuredClone(defaults)
		config = copyMerge(config, opts)
		config.settings.controls = { isOpen: false }
		const twlst = []
		for (const component of config.plotByComponent) {
			component.hasSubjectiveData = false
			for (const group of component.groups)
				for (const row of group.rows) {
					if (row.term1) {
						row.term1.score.q = row.term1.maxScore.q = { mode: 'continuous' }
						twlst.push(row.term1.score)
						twlst.push(row.term1.maxScore)
					}
					if (row.term2) {
						row.term2.score.q = row.term2.maxScore.q = { mode: 'continuous' }
						twlst.push(row.term2.score)
						twlst.push(row.term2.maxScore)
					}
					if (row.term1 && row.term2) component.hasSubjectiveData = true
				}
		}
		await fillTwLst(twlst, app.vocabApi)
		await loadFilterTerms(config, app, opts)

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
