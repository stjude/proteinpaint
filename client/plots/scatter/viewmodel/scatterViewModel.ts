import { icons as icon_functions } from '#dom'
import { d3lasso } from '#common/lasso'
import { scaleLinear as d3Linear } from 'd3-scale'
import { line, extent, contourDensity, geoPath, scaleSequential, max, interpolateGreys } from 'd3'
import { ScatterLasso } from './scatterLasso.js'
import type { Scatter } from '../scatter.js'
import { ScatterViewModelBase } from './scatterViewModelBase.js'

export class ScatterViewModel extends ScatterViewModelBase {
	scatterLasso: ScatterLasso

	constructor(scatter: Scatter) {
		super(scatter)
		this.scatterLasso = new ScatterLasso(scatter)
	}

	fillSvgSubElems(chart) {
		super.fillSvgSubElems(chart)
		chart.axisG.style('opacity', this.scatter.settings.showAxes ? 1 : 0)
		chart.labelsG.style('opacity', this.scatter.settings.showAxes ? 1 : 0)
	}

	renderSerie(chart, removePrevious) {
		super.renderSerie(chart, removePrevious)
		if (this.scatter.settings.showContour) this.renderContours(chart)
	}

	renderContours(chart) {
		const contourG = chart.serie
		let zAxisScale
		if (this.scatter.config.colorTW?.q.mode == 'continuous') {
			const [zMin, zMax] = extent(chart.data.samples, (d: any) => d.category) as [any, any]
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

	async toggleLasso() {
		this.scatter.config.lassoOn = !this.scatter.config.lassoOn
		this.scatter.app.dispatch({ type: 'plot_edit', id: this.scatter.id, config: this.scatter.config })
	}

	async addGroup(group) {
		this.model.addGroup(group)
		this.view.dom.tip.hide()
	}

	setTools() {
		super.setTools()
		const toolsDiv = this.view.dom.toolsDiv
		const display = 'block'
		const searchDiv = toolsDiv.insert('div').style('display', display).style('margin', '15px 10px')
		this.view.dom.lassoDiv = toolsDiv.insert('div').style('display', display).style('margin', '15px 10px')
		icon_functions['search'](searchDiv, { handler: e => this.interactivity.searchSample(e), title: 'Search samples' })
		icon_functions['lasso'](this.view.dom.lassoDiv, {
			handler: () => this.toggleLasso(),
			enabled: this.scatter.config.lassoOn,
			title: 'Select a group of samples'
		})
		this.view.dom.groupDiv = toolsDiv.insert('div').style('display', display).style('margin', '15px 10px')

		for (const chart of this.model.charts) {
			if (!chart.lasso) chart.lasso = d3lasso()
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
			.attr('height', this.scatter.vm.legendHeight)
			.append('g')
			.attr('transform', 'translate(20, 20)')
	}
}

export function renderContours(contourG, data, width, height, colorContours, bandwidth, thresholds) {
	// Create the horizontal and vertical scales.

	const contours = contourDensity()
		.x((s: any) => s.x)
		.y((s: any) => s.y)
		.weight((s: any) => s.z)
		.size([width, height])
		.cellSize(2)

		.bandwidth(bandwidth)
		.thresholds(thresholds)(data)

	const colorScale = scaleSequential()
		.domain([0, max(contours, d => d.value) as any])
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
