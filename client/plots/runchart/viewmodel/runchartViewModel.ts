import { line } from 'd3'
import type { Runchart } from '../runchart.ts'
import { median as d3Median } from 'd3-array'
import { roundValueAuto } from '#shared/roundValue.js'
import { ScatterViewModelBase } from '../../scatter/viewmodel/scatterViewModelBase.ts'

export class RunchartViewModel extends ScatterViewModelBase {
	runchart: Runchart

	constructor(runchart: Runchart) {
		super(runchart)
		this.runchart = runchart
	}

	render() {
		if (!this.view.dom.svg) this.view.dom.svg = this.view.dom.mainDiv.append('svg')
		else this.view.dom.svg.selectAll('*').remove()
		const chartDivs = this.view.dom.mainDiv.selectAll(':scope > div').data(this.model.charts, chart => chart?.id)
		chartDivs.exit().remove()
		chartDivs.each(chart => this.renderChart(chart, this.view.dom.mainDiv, false))
		chartDivs
			.enter()
			.append('div')
			.style('vertical-align', 'top')
			.each(chart => this.renderChart(chart, this.view.dom.mainDiv, false))
	}

	renderSerie(chart, removePrevious) {
		super.renderSerie(chart, removePrevious)
		this.showRunChart(chart)
	}

	showRunChart(chart) {
		const g = chart.serie
		const color = this.runchart.config.term0 ? this.runchart.cat2Color(chart.id) : this.runchart.settings.defaultColor
		const coords = chart.cohortSamples.map(s => this.getCoordinates(chart, s)).sort((a, b) => a.x - b.x)

		const xtext = coords[coords.length - 1].x - 20
		const areaBuilder = line()
			.x((d: any) => d.x)
			.y((d: any) => d.y)
		g.append('path')
			.attr('stroke', color)
			.attr('fill', 'none')
			.attr('stroke-width', 1)
			.attr('stroke-linejoin', 'round')
			.attr('opacity', this.runchart.settings.opacity)
			.attr('d', areaBuilder(coords))
		const median = d3Median(chart.cohortSamples, (d: any) => d.y)
		const y = chart.yAxisScale(median)
		g.append('line')
			.attr('x1', coords[0].x)
			.attr('y1', y)
			.attr('x2', coords[coords.length - 1].x)
			.attr('y2', y)
			.attr('stroke', color)
			.attr('stroke-width', 1)
			.attr('opacity', 0.5)
		g.append('text')
			.attr('x', xtext)
			.attr('y', y - 5)
			.attr('text-anchor', 'start')
			.text('M=' + roundValueAuto(median, true, 1))
			.attr('opacity', 0.8)
			.attr('font-size', '0.8em')
			.attr('fill', color)
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

	getCoordinates(chart, c) {
		const x = chart.xAxisScale(c.x)
		const y = chart.yAxisScale(c.y)
		return { x, y }
	}
}
