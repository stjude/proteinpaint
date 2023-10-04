import { getCompInit, copyMerge } from '#rx'
import { fillTermWrapper } from '#termsetting'
import { scaleLinear as d3Linear } from 'd3-scale'
import { axisTop } from 'd3-axis'
import { profilePlot } from './profilePlot.js'
import { getSampleFilter } from '#termsetting/handlers/samplelst'

class profileBarchart extends profilePlot {
	constructor() {
		super()
		this.type = 'profileBarchart'
	}

	async init(appState) {
		await super.init(appState)
		const config = appState.plots.find(p => p.id === this.id)
		this.components = config.plotByComponent.map(comp => comp.component.name)
		const div = this.dom.firstDiv
		div.insert('label').html('Component:').style('font-weight', 'bold')
		this.selectComp = div.insert('select').style('margin-left', '5px')
		this.selectComp
			.selectAll('option')
			.data(this.components)
			.enter()
			.append('option')
			.attr('value', (d, i) => i)
			.html((d, i) => d)
		this.selectComp.on('change', () => {
			this.config.componentIndex = this.selectComp.node().value
			this.app.dispatch({ type: 'plot_edit', id: this.id, config: this.config })
		})
		this.opts.header.text('Barchart Graph')
		this.dom.plotDiv.on('mousemove', event => this.onMouseOver(event))
		this.dom.plotDiv.on('mouseleave', event => this.onMouseOut(event))
		this.dom.plotDiv.on('mouseout', event => this.onMouseOut(event))
	}

	async main() {
		this.config = JSON.parse(JSON.stringify(this.state.config))
		const twLst = []
		this.component = this.config.plotByComponent[this.config.componentIndex || 0]
		this.component.hasSubjectiveData = false
		this.rowCount = 0
		for (const group of this.component.groups)
			for (const row of group.rows) {
				this.rowCount++
				for (const [i, tw] of row.twlst.entries()) {
					if (tw.id) {
						twLst.push(tw)
						if (i == 1) this.component.hasSubjectiveData = true
					}
				}
			}
		twLst.push(this.config.typeTW)

		const sampleName = this.config.region !== undefined ? this.config.region : this.config.income || 'Global'
		const filter = this.config.filter || getSampleFilter(this.sampleidmap[sampleName])
		this.data = await this.app.vocabApi.getAnnotatedSampleData({
			terms: twLst,
			filter
		})
		this.sampleData = this.data.lst[0]

		this.income = this.config.income || this.incomes[0]
		this.region = this.config.region !== undefined ? this.config.region : this.income == '' ? 'Global' : ''

		this.componentIndex = this.config.componentIndex || 0
		this.setFilter()

		this.filename = `barchart_plot_${this.components[this.componentIndex]}${this.region ? '_' + this.region : ''}${
			this.income ? '_' + this.income : ''
		}.svg`
			.split(' ')
			.join('_')
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

		const sampleData = this.sampleData
		if (!sampleData) return

		this.svg = this.dom.plotDiv
			.append('svg')
			.attr('width', 1400)
			.attr('height', this.rowCount * 30 + 400)

		const svg = this.svg

		const color = this.component.component.color
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
		let stepx = 500
		let step = 30
		const barwidth = 400
		const hasSubjectiveData = this.component.hasSubjectiveData
		for (const [i, c] of config.columnNames.entries()) {
			if (i == 1 && !hasSubjectiveData) break

			x = i % 2 == 0 ? 400 : 900
			x += 10
			y = 50
			svg
				.append('text')
				.attr('transform', `translate(${x}, ${y})`)
				.attr('text-anchor', 'start')
				.style('font-weight', 'bold')
				.text(`${c}%`)
			drawAxes(x, y + 40)

			x += stepx
		}
		y = 75
		for (const group of this.component.groups) {
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
				for (const [i, tw] of row.twlst.entries()) {
					drawRect(x, y, row, i, g)
					x += stepx
				}

				y += step
			}
		}

		drawLine(410, 120, 50, y, 'B')
		drawLine(410, 120, 75, y, 'A')

		if (!hasSubjectiveData) return
		drawLine(910, 120, 50, y, 'B')
		drawLine(910, 120, 75, y, 'A')
		y += 40
		x = 50
		this.drawLegendRect(x, y, 'and', color)
		x += 300
		this.drawLegendRect(x, y, 'or', color)

		function drawRect(x, y, row, i, g) {
			const tw = row.twlst[i]
			let subjectiveTerm = false
			if (row.subjective) subjectiveTerm = true
			const termColor = tw?.term?.color
			const value = sampleData[tw.$id]?.value
			const isFirst = i % 2 == 0
			const pairValue = isFirst ? sampleData[row.twlst[1]?.$id]?.value : sampleData[row.twlst[0]?.$id]?.value
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
					const id = tw.term.name.replace(/[^a-zA-Z0-9]/g, '')
					g.append('defs')
						.append('pattern')
						.attr('id', id)
						.attr('patternUnits', 'userSpaceOnUse')
						.attr('width', 4)
						.attr('height', 4)
						.append('path')
						.attr('d', 'M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2')
						.attr('stroke-width', 1)
						.attr('stroke', termColor)
					rect.attr('fill', `url(#${id})`)
				}
			}
			const text = g
				.append('text')
				.attr('pointer-events', 'none')

				.attr('text-anchor', 'end')
				.text(`${value || 0}%`)
			if (width > 0) text.attr('transform', `translate(${x + width + 55}, ${y + 15})`)
			else if (!pairValue && i == 0) text.attr('transform', `translate(${x + 35}, ${y + 15})`)
			//else text.attr('transform', `translate(${x + 35}, ${y + 15})`)

			if (isFirst)
				g.append('text')
					.attr('transform', `translate(${x}, ${y + 15})`)
					.attr('text-anchor', 'end')
					.text(row.name)
					.attr('pointer-events', 'none')
		}

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
		for (const component of config.plotByComponent)
			for (const group of component.groups)
				for (const row of group.rows) {
					for (const t of row.twlst) {
						if (t.id) await fillTermWrapper(t, app.vocabApi)
						// allow empty cells, not all cells have a corresponding term
					}
				}
		config.typeTW = await fillTermWrapper({ id: 'sampleType' }, app.vocabApi)

		return config
	} catch (e) {
		throw `${e} [profileBarchart getPlotConfig()]`
	}
}

export const profileBarchartInit = getCompInit(profileBarchart)
// this alias will allow abstracted dynamic imports
export const componentInit = profileBarchartInit
