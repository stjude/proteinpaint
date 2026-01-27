import { SeriesRender } from './SeriesRender.ts'
import type { RunChart2Settings } from '../Settings'
import { axisstyle } from '#src/client'
import { axisBottom, axisLeft } from 'd3-axis'

export class RunChart2View {
	viewData: any
	settings: RunChart2Settings
	chartDom: any
	config: any
	runChart2: any

	constructor(viewData: any, settings: RunChart2Settings, holder: any, config?: any, runChart2?: any) {
		this.viewData = viewData
		this.settings = settings
		this.config = config
		this.runChart2 = runChart2
		const svg = holder.append('svg').attr('data-testId', 'sjpp-runChart2-svg')
		this.chartDom = {
			svg,
			xAxis: svg.append('g').attr('data-testId', 'sjpp-runChart2-xAxis'),
			yAxis: svg.append('g').attr('data-testId', 'sjpp-runChart2-yAxis')
		}

		this.render()
	}

	render() {
		const plotDims = this.viewData.plotDims

		this.chartDom.svg.selectAll('*').remove()

		this.chartDom.xAxis = this.chartDom.svg.append('g').attr('data-testId', 'sjpp-runChart2-xAxis')
		this.chartDom.yAxis = this.chartDom.svg.append('g').attr('data-testId', 'sjpp-runChart2-yAxis')

		this.chartDom.svg.transition().attr('width', plotDims.svg.width).attr('height', plotDims.svg.height)

		this.renderScale(plotDims.xAxis)
		this.renderScale(plotDims.yAxis, true)

		// Create a group for series rendering
		const seriesGroup = this.chartDom.svg
			.append('g')
			.attr('data-testId', 'sjpp-runChart2-seriesGroup')
			.attr('transform', `translate(${plotDims.xAxis.x}, ${plotDims.yAxis.y})`)

		for (const series of this.viewData.series || []) {
			new SeriesRender(series, plotDims, this.settings, seriesGroup, this.runChart2)
		}

		// Add axis labels
		this.renderAxisLabels(plotDims)
	}

	renderAxisLabels(plotDims: any) {
		const xLabel = this.config?.term?.term?.name || 'X Axis'
		const yLabel = this.config?.term2?.term?.name || 'Y Axis'

		const xAxisLabelY = plotDims.xAxis.y + 35
		this.chartDom.svg
			.append('text')
			.attr('data-testId', 'sjpp-runChart2-xAxisLabel')
			.attr('transform', `translate(${plotDims.xAxis.x + this.settings.svgw / 2}, ${xAxisLabelY})`)
			.style('text-anchor', 'middle')
			.style('font-size', '14px')
			.style('font-weight', '500')
			.style('fill', 'black')
			.text(xLabel)

		this.chartDom.svg
			.append('text')
			.attr('data-testId', 'sjpp-runChart2-yAxisLabel')
			.attr('transform', `translate(25, ${plotDims.yAxis.y + this.settings.svgh / 2}) rotate(-90)`)
			.style('text-anchor', 'middle')
			.style('font-size', '14px')
			.style('font-weight', '500')
			.style('fill', 'black')
			.text(yLabel)
	}

	renderScale(scale: any, isLeft = false) {
		const axisGroup = this.chartDom[isLeft ? 'yAxis' : 'xAxis']
		const scaleG = axisGroup.append('g').attr('transform', `translate(${scale.x}, ${scale.y})`)

		if (isLeft) {
			// Y-axis: standard formatting
			scaleG.call(axisLeft(scale.scale))
		} else {
			// X-axis: use custom tick values and format with month names
			const allPoints: Array<{ x: number; xName: string }> = []
			for (const series of this.viewData.series || []) {
				if (series.points) {
					allPoints.push(...series.points)
				}
			}

			const yearMap = new Map<number, number>() // year -> first month x value (e.g., 2024 -> 2024.01)
			for (const point of allPoints) {
				const year = Math.floor(point.x)
				if (!yearMap.has(year)) {
					// Store the first occurrence of this year (which should be the first month)
					yearMap.set(year, point.x)
				} else {
					// Keep the smallest x value for this year (first month)
					const currentX = yearMap.get(year)!
					if (point.x < currentX) {
						yearMap.set(year, point.x)
					}
				}
			}

			// Get sorted years and their corresponding x values
			const years = Array.from(yearMap.keys()).sort((a, b) => a - b)
			const yearTickValues = years.map(year => yearMap.get(year)!).sort((a, b) => a - b)

			const xAxis = axisBottom(scale.scale)
				.tickValues(yearTickValues)
				.tickFormat(d => {
					const year = Math.floor(Number(d))
					return String(year)
				})

			scaleG.call(xAxis)

			// Style x-axis labels
			scaleG.selectAll('text').style('text-anchor', 'middle').style('font-size', '12px')
		}

		axisstyle({
			axis: scaleG,
			color: 'black',
			showline: true
		})
	}
}
