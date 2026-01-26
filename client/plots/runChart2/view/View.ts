import { SeriesRender } from './SeriesRender.ts'
import type { RunChart2Settings } from '../Settings'
import { axisstyle } from '#src/client'
import { axisBottom, axisLeft } from 'd3-axis'

export class RunChart2View {
	viewData: any
	settings: RunChart2Settings
	chartDom: any

	constructor(viewData: any, settings: RunChart2Settings, holder: any) {
		this.viewData = viewData
		this.settings = settings
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

		this.chartDom.svg.transition().attr('width', plotDims.svg.width).attr('height', plotDims.svg.height)

		this.renderScale(plotDims.xAxis)
		this.renderScale(plotDims.yAxis, true)

		// Create a group for series rendering
		const seriesGroup = this.chartDom.svg
			.append('g')
			.attr('data-testId', 'sjpp-runChart2-seriesGroup')
			.attr('transform', `translate(${plotDims.xAxis.x}, ${plotDims.yAxis.y})`)

		for (const series of this.viewData.series || []) {
			new SeriesRender(series, plotDims, this.settings, seriesGroup)
		}
	}

	renderScale(scale: any, isLeft = false) {
		const scaleG = this.chartDom[isLeft ? 'yAxis' : 'xAxis']
			.append('g')
			.attr('transform', `translate(${scale.x}, ${scale.y})`)

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

			// Get unique x values and their corresponding xName labels
			const xValueMap = new Map<number, string>()
			for (const point of allPoints) {
				if (!xValueMap.has(point.x)) {
					xValueMap.set(point.x, point.xName)
				}
			}

			const xTickValues = Array.from(xValueMap.keys()).sort((a, b) => a - b)

			// Limit number of ticks to prevent overlap (approximately 60px per label)
			const minLabelSpacing = 60
			const maxTicks = Math.floor(this.settings.svgw / minLabelSpacing)
			let finalTickValues = xTickValues

			if (xTickValues.length > maxTicks) {
				// Select evenly distributed subset
				const step = Math.ceil(xTickValues.length / maxTicks)
				finalTickValues = []
				for (let i = 0; i < xTickValues.length; i += step) {
					finalTickValues.push(xTickValues[i])
				}
				// Always include the last tick
				if (finalTickValues[finalTickValues.length - 1] !== xTickValues[xTickValues.length - 1]) {
					finalTickValues.push(xTickValues[xTickValues.length - 1])
				}
			}

			const xAxis = axisBottom(scale.scale)
				.tickValues(finalTickValues)
				.tickFormat(d => {
					const xName = xValueMap.get(Number(d))
					return xName || String(d)
				})

			scaleG.call(xAxis)

			// Rotate x-axis labels to prevent overlap
			scaleG
				.selectAll('text')
				.style('text-anchor', 'end')
				.style('font-size', '10px')
				.attr('dx', '-.8em')
				.attr('dy', '.15em')
				.attr('transform', 'rotate(-45)')
		}

		axisstyle({
			axis: scaleG,
			color: 'black',
			showline: true
		})
	}
}
