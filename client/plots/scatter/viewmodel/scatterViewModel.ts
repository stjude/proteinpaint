import { icons as icon_functions, ColorScale, Menu, getMaxLabelWidth } from '#dom'
import { d3lasso } from '#common/lasso'
import { rgb } from 'd3-color'
import { scaleLinear as d3Linear } from 'd3-scale'
import { select } from 'd3-selection'
import { line, extent, contourDensity, geoPath, scaleSequential, max, interpolateGreys, scaleTime } from 'd3'
import { ScatterLegend } from './scatterLegend.js'
import { ScatterTooltip } from './scatterTooltip.js'
import { ScatterLasso } from './scatterLasso.js'
import { getTitle } from './scatterLegend.js'
import { ScatterZoom } from './scatterZoom.js'

export class ScatterViewModel {
	constructor(scatter) {
		this.scatter = scatter
		this.view = scatter.view
		this.model = scatter.model
		this.interactivity = scatter.interactivity
		this.legendvm = new ScatterLegend(scatter)
		this.scatterTooltip = new ScatterTooltip(scatter)
		this.scatterLasso = new ScatterLasso(scatter)
		this.scatterZoom = new ScatterZoom(scatter)
	}

	render() {
		const chartDivs = this.view.dom.mainDiv.selectAll(':scope > div').data(this.model.charts, chart => chart?.id)
		chartDivs.exit().remove()
		chartDivs.each((chart, i, divs) => this.renderChart(chart, divs[i]))
		chartDivs
			.enter()
			.append('div')
			.style('vertical-align', 'top')
			.each((chart, i, divs) => this.renderChart(chart, divs[i]))
	}

	renderChart(chart, div) {
		chart.chartDiv = select(div)
		const s = this.scatter.settings
		chart.chartDiv.style('opacity', 0).style('display', 'inline-block')
		chart.chartDiv.on('mouseover', event => {
			if (!this.scatterTooltip.onClick) this.scatterTooltip.showTooltip(event, chart)
		})
		chart.chartDiv.on('click', event => this.scatterTooltip.showTooltip(event, chart))

		chart.svg = chart.chartDiv.select('svg').empty() ? chart.chartDiv.append('svg') : chart.chartDiv.select('svg')
		this.renderSVG(chart, s)

		chart.chartDiv.transition().duration(s.duration).style('opacity', 1)
	}

	async renderSVG(chart, s) {
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
		const labels = []
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

		await this.renderSerie(chart) //wait for legendG to be defined if on 2D large or 3D
		this.legendvm.renderLegend(chart, step)
	}

	fillSvgSubElems(chart) {
		const svg = chart.svg
		let axisG, labelsG
		if (svg.select('.sjpcb-scatter-mainG').size() == 0) {
			chart.mainG = svg.append('g').attr('class', 'sjpcb-scatter-mainG')
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
			chart.svg
				.append('defs')
				.append('clipPath')
				.attr('id', id)
				.append('rect')
				.attr('x', this.model.axisOffset.x)
				.attr('y', this.model.axisOffset.y)
				.attr('width', this.scatter.settings.svgw + 10)
				.attr('height', this.scatter.settings.svgh)
			chart.mainG.attr('clip-path', `url(#${id})`)

			chart.serie = chart.mainG.append('g').attr('class', 'sjpcb-scatter-series')
			chart.regressionG = chart.mainG.append('g').attr('class', 'sjpcb-scatter-lowess')
			chart.legendG = svg.append('g').attr('class', 'sjpcb-scatter-legend')
		} else {
			chart.mainG = svg.select('.sjpcb-scatter-mainG')
			chart.serie = chart.mainG.select('.sjpcb-scatter-series')
			chart.regressionG = chart.mainG.select('.sjpcb-scatter-lowess')
			axisG = svg.select('.sjpcb-scatter-axis')
			labelsG = svg.select('.sjpcb-scatter-labelsG')
			chart.xAxis = axisG.select('.sjpcb-scatter-x-axis')
			chart.yAxis = axisG.select('.sjpcb-scatter-y-axis')
			chart.legendG = svg.select('.sjpcb-scatter-legend')
		}
		chart.xAxis.attr('transform', `translate(0, ${this.scatter.settings.svgh + this.model.axisOffset.y})`)

		chart.legendG.attr('transform', `translate(${this.scatter.settings.svgw + this.model.axisOffset.x + 50}, 20)`)
		if (chart.axisBottom) {
			chart.xAxis.call(chart.axisBottom)
			chart.yAxis.call(chart.axisLeft)
		}
		if (this.scatter.settings.showAxes && !(this.model.is2DLarge || this.model.is3D)) {
			axisG.style('opacity', 1)
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
							this.showText(event, this.scatter.config.term.term.name)
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
				const term2Name = getTitle(this.scatter.config.term2.term.name, 60)
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
							this.showText(event, this.scatter.config.term2.term.name)
						})
						.on('mouseleave', () => this.view.dom.tooltip.hide())
				}
			}
		} else {
			axisG.style('opacity', 0)
		}
	}

	renderSerie(chart) {
		const step = this.step
		const duration = this.scatter.settings.duration
		if (this.canvas) this.canvas.remove()

		const g = chart.serie
		const data = chart.data
		chart.serie.selectAll('*').remove()

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
		if (this.scatter.settings.showContour) this.renderContours(chart)
	}

	renderContours(chart) {
		const contourG = chart.serie
		let zAxisScale
		if (this.scatter.config.colorTW?.q.mode == 'continuous') {
			const [zMin, zMax] = extent(chart.data.samples, d => d.category)
			zAxisScale = d3Linear().domain([zMin, zMax]).range([0, 1])
		}

		const data = chart.data.samples
			.filter(s => this.model.getOpacity(s) > 0)
			.map(s => {
				return { x: chart.xAxisScale(s.x), y: chart.yAxisScale(s.y), z: zAxisScale ? zAxisScale(s.category) : 1 }
			})
		renderContours(
			contourG,
			data,
			this.scatter.settings.svgw,
			this.scatter.settings.svgh,
			this.scatter.settings.colorContours,
			this.scatter.settings.contourBandwidth,
			this.scatter.settings.contourThresholds
		)
	}

	async mayRenderRegression() {
		for (const chart of this.model.charts) {
			chart.regressionG?.selectAll('*').remove()
			if (chart.regressionCurve) {
				console.log(chart)
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

	toggleLasso() {
		this.scatterLasso.lassoOn = !this.scatterLasso.lassoOn
		for (const chart of this.model.charts) {
			if (this.scatterLasso.lassoOn) {
				chart.mainG.on('.zoom', null)
				chart.mainG.call(chart.lasso)
			} else {
				chart.mainG.on('mousedown.drag', null)
				chart.lasso.items().classed('not_possible', false)
				chart.lasso.items().classed('possible', false)
				chart.lasso
					.items()
					.attr('r', this.scatter.settings.size)
					.style('fill-opacity', c => this.model.getOpacity(c))
				chart.mainG.call(this.vm.scatterZoom.zoomD3)
				this.selectedItems = null
			}
		}
		this.lassoDiv.select('*').remove()
		icon_functions['lasso'](this.lassoDiv, {
			handler: () => this.toggleLasso(),
			enabled: this.scatterLasso.lassoOn,
			title: 'Select a group of samples'
		})
	}

	async addGroup(group) {
		this.model.addGroup(group)
		this.view.dom.tip.hide()
	}

	setTools() {
		if (!this.model.charts[0]) return
		const toolsDiv = this.view.dom.toolsDiv.style('background-color', 'white')
		toolsDiv.selectAll('*').remove()
		const display = 'block'

		this.scatterZoom.initZoom(toolsDiv)
		const searchDiv = toolsDiv.insert('div').style('display', display).style('margin', '15px 10px')
		this.lassoDiv = toolsDiv.insert('div').style('display', display).style('margin', '15px 10px')
		if (!(this.model.is2DLarge || this.model.is3D)) {
			icon_functions['search'](searchDiv, { handler: e => this.interactivity.searchSample(e), title: 'Search samples' })
			icon_functions['lasso'](this.lassoDiv, {
				handler: () => this.toggleLasso(),
				enabled: this.scatterLasso.lassoOn,
				title: 'Select a group of samples'
			})
		}
		this.view.dom.groupDiv = toolsDiv.insert('div').style('display', display).style('margin', '15px 10px')

		for (const chart of this.model.charts) {
			chart.lasso = d3lasso()
			this.scatterLasso.lassoReset(chart)
		}
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

export function renderContours(contourG, data, width, height, colorContours, bandwidth, thresholds) {
	// Create the horizontal and vertical scales.
	const x = d3Linear()
		.domain(extent(data, s => s.x))
		.nice()
		.rangeRound([0, width])
	const y = d3Linear()
		.domain(extent(data, s => s.y))
		.nice()
		.rangeRound([height, 0])
	const contours = contourDensity()
		.x(s => s.x)
		.y(s => s.y)
		.weight(s => s.z)
		.size([width, height])
		.cellSize(2)

		.bandwidth(bandwidth)
		.thresholds(thresholds)(data)

	const colorScale = scaleSequential()
		.domain([0, max(contours, d => d.value)])
		.interpolator(interpolateGreys)

	// Compute the density contours.
	// Append the contours.
	contourG
		.attr('fill', 'none')
		.attr('stroke', 'gray') // gray to make the contours visible
		.attr('stroke-linejoin', 'round')
		.selectAll()
		.data(contours)
		.join('path')
		.attr('stroke-width', (d, i) => (i % 5 ? 0.25 : 1))
		.attr('d', geoPath())
		.attr('fill', colorContours ? d => colorScale(d.value) : 'none')
		.attr('fill-opacity', 0.05) //this is the opacity of the contour, reduce it to 0.05 to avoid hiding the points
}
