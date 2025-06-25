import { getMaxLabelWidth } from '#dom'
import { select } from 'd3-selection'
import { line } from 'd3'
import { ScatterLegend } from './scatterLegend.js'
import { ScatterTooltip } from './scatterTooltip.js'
import { getTitle } from './scatterLegend.js'
import { ScatterZoom } from './scatterZoom.js'
import type { Scatter } from '../scatter.js'

export class ScatterViewModelBase {
	scatter: Scatter
	view: any
	model: any
	interactivity: any
	legendvm: ScatterLegend
	scatterTooltip: ScatterTooltip
	scatterZoom: ScatterZoom
	canvas: any
	step: any
	legendHeight: any

	constructor(scatter: Scatter) {
		this.scatter = scatter
		this.view = scatter.view
		this.model = scatter.model
		this.interactivity = scatter.interactivity
		this.legendvm = new ScatterLegend(scatter)
		this.scatterTooltip = new ScatterTooltip(scatter)
		this.scatterZoom = new ScatterZoom(scatter)
	}

	render() {
		const chartDivs = this.view.dom.mainDiv.selectAll(':scope > div').data(this.model.charts, chart => chart?.id)
		chartDivs.exit().remove()
		chartDivs.each((chart, i, divs) => {
			const div = select(divs[i])
			this.renderChart(chart, div)
		})
		chartDivs
			.enter()
			.append('div')
			.style('vertical-align', 'top')
			.each((chart, i, divs) => {
				const div = select(divs[i])
				this.renderChart(chart, div)
			})
	}

	renderChart(chart, div, removePrevious = true) {
		const s = this.scatter.settings
		div.style('opacity', 0).style('display', 'inline-block')
		div.on('mouseover', event => {
			if (!this.scatterTooltip.onClick) this.scatterTooltip.showTooltip(event, chart)
		})
		div.on('click', event => this.scatterTooltip.showTooltip(event, chart))

		chart.svg = div.select('svg').empty() ? div.append('svg') : div.select('svg')
		this.renderSVG(chart, s, removePrevious)
		div.transition().duration(s.duration).style('opacity', 1)
		chart.chartDiv = div
	}

	async renderSVG(chart, s, removePrevious) {
		const svg = chart.svg
		let step = Math.min((20 * 40) / chart.colorLegend.size, 25)
		if (step < 18) step = 18
		this.step = step
		let colorLegendSize = chart.colorLegend.size * step
		if (chart.colorLegend.get('Ref')?.sampleCount > 0) colorLegendSize += 60
		const scaleHeight = this.scatter.config.scaleDotTW ? 200 : 100
		this.legendHeight = Math.max(colorLegendSize, chart.shapeLegend.size * 30) + scaleHeight //legend step and header

		const fontSize = this.legendvm.getFontSize(chart)

		/** Becomes the x offset for the shape legend.
		 * When in continuous mode, color scale renders with a
		 * default width of 150. */
		const labels: any = []
		if (this.scatter.config.colorTW) labels.push(this.scatter.config.colorTW.term.name)
		if (this.scatter.config.scaleDotTW) labels.push(this.scatter.config.scaleDotTW.term.name)
		if (labels.length > 0) {
			const labelsWidth = getMaxLabelWidth(svg, labels) + 40
			chart.colorLegendWidth =
				this.scatter.config?.colorTW?.q.mode == 'continuous'
					? Math.max(175, labelsWidth)
					: Math.max(this.legendvm.getLegendLabelWidth(chart, 'color', svg, fontSize), labelsWidth)
		} else chart.colorLegendWidth = 0

		const shapeWidth = this.legendvm.getLegendLabelWidth(chart, 'shape', svg, fontSize)
		const width = s.svgw + chart.colorLegendWidth + shapeWidth + 125
		svg

			.attr('width', width)
			.attr('height', Math.max(s.svgh + 200, this.legendHeight)) //leaving some space for axis/ref/ scale legend/padding
			.transition()
			.duration(s.duration)
		this.fillSvgSubElems(chart)

		await this.renderSerie(chart, removePrevious) //wait for legendG to be defined if on 2D large or 3D
		this.legendvm.renderLegend(chart, step)
	}

	fillSvgSubElems(chart) {
		const svg = chart.svg
		let axisG, labelsG
		if (svg.select('.sjpcb-scatter-mainG').size() == 0) {
			chart.G = svg.append('g').attr('class', 'sjpcb-scatter-G')
			chart.mainG = chart.G.append('g').attr('class', 'sjpcb-scatter-mainG')
			axisG = svg.append('g').attr('class', 'sjpcb-scatter-axis')
			labelsG = svg.append('g').attr('class', 'sjpcb-scatter-labelsG')
			chart.xAxis = axisG.append('g').attr('class', 'sjpcb-scatter-x-axis')
			chart.yAxis = axisG
				.append('g')
				.attr('class', 'sjpcb-scatter-y-axis')
				.attr('transform', `translate(${this.model.axisOffset.x}, 0)`)
			chart.mainG
				.append('rect')
				.attr('class', 'zoom')
				.attr('x', this.model.axisOffset.x)
				.attr('y', this.model.axisOffset.y)
				.attr('width', this.scatter.settings.svgw)
				.attr('height', this.scatter.settings.svgh)
				.attr('fill', 'white')
			const id = 'clip' + this.scatter.id
			chart.clipRect = chart.svg
				.append('defs')
				.append('clipPath')
				.attr('id', id)
				.append('rect')
				.attr('x', this.model.axisOffset.x)
				.attr('y', this.model.axisOffset.y)
				.attr('width', this.scatter.settings.svgw + 10)
				.attr('height', this.scatter.settings.svgh)

			chart.serie = chart.mainG.append('g').attr('class', 'sjpcb-scatter-series')

			chart.regressionG = chart.mainG.append('g').attr('class', 'sjpcb-scatter-lowess')
			chart.legendG = svg.append('g').attr('class', 'sjpcb-scatter-legend')
			if (this.scatter.state.config.transform && chart.mainG.attr('transform') != this.scatter.state.config.transform) {
				chart.mainG.attr('transform', this.scatter.state.config.transform)
			}
			chart.G.attr('clip-path', `url(#${id})`)
		} else {
			chart.G = svg.select('.sjpcb-scatter-G')
			chart.mainG = svg.select('.sjpcb-scatter-mainG')
			chart.serie = chart.mainG.select('.sjpcb-scatter-series')
			chart.regressionG = chart.mainG.select('.sjpcb-scatter-lowess')
			axisG = svg.select('.sjpcb-scatter-axis')
			labelsG = svg.select('.sjpcb-scatter-labelsG')
			chart.xAxis = axisG.select('.sjpcb-scatter-x-axis')
			chart.yAxis = axisG.select('.sjpcb-scatter-y-axis')
			chart.legendG = svg.select('.sjpcb-scatter-legend')
			chart.clipRect = svg.select('defs').select('clipPath').select('rect')
		}

		chart.axisG = axisG
		chart.labelsG = labelsG
		chart.xAxis.attr('transform', `translate(0, ${this.scatter.settings.svgh + this.model.axisOffset.y})`)

		chart.legendG.attr('transform', `translate(${this.scatter.settings.svgw + this.model.axisOffset.x + 50}, 20)`)
		if (chart.axisBottom) {
			chart.xAxis.call(chart.axisBottom)
			chart.yAxis.call(chart.axisLeft)
		}
		if (this.scatter.config.term) {
			let termName = getTitle(this.scatter.config.term.term.name, 60)
			if (!this.scatter.config.colorTW && !this.scatter.config.shapeTW && !this.scatter.config.term0)
				termName = `${termName}, n=${chart.cohortSamples.length}`

			labelsG.selectAll('*').remove()
			let text = labelsG
				.append('text')
				.attr(
					'transform',
					`translate(${this.model.axisOffset.x + this.scatter.settings.svgw / 2}, ${
						this.scatter.settings.svgh + this.model.axisOffset.y + 40
					})`
				)
				.attr('text-anchor', 'middle')
				.text(termName)

			if (termName.length > 65) {
				text
					.on('mouseenter', event => {
						this.scatter.interactivity.showText(event, this.scatter.config.term.term.name)
					})
					.on('mouseleave', () => this.view.dom.tooltip.hide())
			}
			if (this.scatter.config.term0 && !this.scatter.config.colorTW && !this.scatter.config.shapeTW) {
				const term0Name = `${chart.id}, n=${chart.cohortSamples.length}`

				labelsG
					.append('text')
					.attr(
						'transform',
						`translate(${this.model.axisOffset.x + this.scatter.settings.svgw / 2}, ${
							this.scatter.settings.svgh + this.model.axisOffset.y + 65
						})`
					)
					.attr('text-anchor', 'middle')
					.text(term0Name)
			}
			const isEvents = this.scatter.config.term2 ? false : true
			const term2Name = isEvents ? 'Frequency' : getTitle(this.scatter.config.term2.term.name, 60)
			text = labelsG
				.append('text')
				.attr(
					'transform',
					`translate(${this.model.axisOffset.x - 50}, ${
						this.scatter.settings.svgh / 2 + this.model.axisOffset.y
					}) rotate(-90)`
				)
				.attr('text-anchor', 'middle')
				.text(term2Name)
			if (term2Name.length > 60) {
				text
					.on('mouseenter', event => {
						this.scatter.interactivity.showText(event, this.scatter.config.term2.term.name)
					})
					.on('mouseleave', () => this.view.dom.tooltip.hide())
			}
		}
	}

	renderSerie(chart, removePrevious) {
		const duration = this.scatter.settings.duration
		if (this.canvas) this.canvas.remove()

		const g = chart.serie

		const data = chart.data
		if (removePrevious) chart.serie.selectAll('*').remove()

		// remove all symbols as there is no data id for privacy
		//g.selectAll('path').remove()

		const symbols = g.selectAll('path[name="serie"]').data(data.samples)
		symbols
			.transition()
			.duration(duration)
			.attr('name', 'serie')
			.attr('transform', c => this.model.transform(chart, c))
			.attr('d', c => this.model.getShape(chart, c))
			.attr('fill', c => this.model.getColor(c, chart))
			.attr('stroke', c => this.model.getColor(c, chart))
			.attr('stroke-width', c => this.model.getStrokeWidth(c))
			.style('fill-opacity', c => this.model.getOpacity(c))
		symbols
			.enter()
			.append('path')
			.attr('name', 'serie')
			/*** you'd need to set the symbol position using translate, instead of previously with cx, cy for a circle ***/
			.attr('transform', c => this.model.transform(chart, c))
			.attr('d', c => this.model.getShape(chart, c))
			.attr('fill', c => this.model.getColor(c, chart))
			.attr('stroke', c => this.model.getColor(c, chart))
			.attr('stroke-width', c => this.model.getStrokeWidth(c))
			.style('fill-opacity', c => this.model.getOpacity(c))
			.transition()
			.duration(duration)
		this.mayRenderRegression()
	}

	async mayRenderRegression() {
		for (const chart of this.model.charts) {
			chart.regressionG?.selectAll('*').remove()
			if (chart.regressionCurve) {
				const l = line()
					.x(d => d[0])
					.y(d => d[1])
				const regressionPath = chart.regressionG.append('path')
				regressionPath
					.attr('d', l(chart.regressionCurve))
					.attr('stroke', 'blue')
					.attr('fill', 'none')
					.style('stroke-width', '2')
			}
		}
	}

	async addGroup(group) {
		this.model.addGroup(group)
		this.view.dom.tip.hide()
	}

	setTools() {
		if (!this.model.charts[0]) return
		const toolsDiv = this.view.dom.toolsDiv.style('background-color', 'white')
		toolsDiv.selectAll('*').remove()

		this.scatterZoom.initZoom(toolsDiv)
	}

	//2D large and 3D add an svg for the legend
	addLegendSVG(chart) {
		chart.chartDiv.style('margin', '20px 20px')
		chart.legendDiv = this.view.dom.mainDiv
			.insert('div')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
		chart.legendG = chart.legendDiv
			.append('svg')
			.attr('width', this.scatter.settings.svgw / 2)
			.attr('height', this.scatter.settings.svgh)
			.append('g')
			.attr('transform', 'translate(20, 20)')
	}
}
