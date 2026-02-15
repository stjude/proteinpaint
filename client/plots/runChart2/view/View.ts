import { SeriesRender } from './SeriesRender.ts'
import type { RunChart2Settings } from '../Settings'
import { axisstyle } from '#src/client'
import { axisBottom, axisLeft } from 'd3-axis'
import { getColors } from '#shared/common.js'

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

		const seriesGroup = this.chartDom.svg
			.append('g')
			.attr('data-testId', 'sjpp-runChart2-seriesGroup')
			.attr('transform', `translate(${plotDims.xAxis.x}, ${plotDims.yAxis.y})`)

		const seriesList = this.viewData.series || []
		const cat2Color = seriesList.length > 1 ? getColors(seriesList.length) : null
		for (let i = 0; i < seriesList.length; i++) {
			const series = seriesList[i]
			const seriesColor = cat2Color ? cat2Color(series.seriesId ?? String(i)) : undefined
			new SeriesRender(series, plotDims, this.settings, seriesGroup, this.runChart2, seriesColor)
		}

		this.renderAxisLabels(plotDims)
	}

	renderAxisLabels(plotDims: any) {
		const xName = this.config?.xtw?.term?.name || 'X Axis'
		const xLabel =
			this.viewData.totalSampleCount != null && this.config?.xtw?.q?.mode !== 'discrete'
				? `${xName}, n=${this.viewData.totalSampleCount.toLocaleString()}`
				: xName
		const isFrequency = this.config?.ytw == null
		const yLabel =
			this.config?.ytw?.term?.name ??
			(isFrequency && this.settings?.showCumulativeFrequency ? 'Cumulative count' : 'Count')

		const xAxisLabelY = plotDims.xAxis.y + (plotDims.xAxis.labelOffset ?? 50)
		this.chartDom.svg
			.append('text')
			.attr('data-testId', 'sjpp-runChart2-xAxisLabel')
			.attr('transform', `translate(${plotDims.xAxis.x + this.settings.svgw / 2}, ${xAxisLabelY})`)
			.attr('text-anchor', 'middle')
			.style('font-size', '0.9em')
			.text(xLabel)

		const seriesList = this.viewData.series || []
		if (seriesList.length > 0 && this.config?.xtw?.q?.mode === 'discrete') {
			const firstSeries = seriesList[0]
			const firstSeriesId = firstSeries?.seriesId
			if (firstSeriesId != null) {
				const periodN = firstSeries?.points?.reduce((sum: number, p: any) => sum + (Number(p.sampleCount) || 0), 0) ?? 0
				const labelText =
					periodN > 0 ? `${String(firstSeriesId)}, n=${periodN.toLocaleString()}` : String(firstSeriesId)
				this.chartDom.svg
					.append('text')
					.attr('data-testId', 'sjpp-runChart2-xAxisSeriesIds')
					.attr('transform', `translate(${plotDims.xAxis.x + this.settings.svgw / 2}, ${xAxisLabelY + 20})`)
					.attr('text-anchor', 'middle')
					.style('font-size', '0.9em')
					.style('opacity', 1)
					.text(labelText)
			}
		}
		const yAxisLabelX = plotDims.yAxis.labelX ?? 55
		this.chartDom.svg
			.append('text')
			.attr('data-testId', 'sjpp-runChart2-yAxisLabel')
			.attr('transform', `translate(${yAxisLabelX}, ${plotDims.yAxis.y + this.settings.svgh / 2}) rotate(-90)`)
			.attr('text-anchor', 'middle')
			.style('font-size', '0.9em')
			.text(yLabel)
	}

	renderScale(scale: any, isLeft = false) {
		const axisGroup = this.chartDom[isLeft ? 'yAxis' : 'xAxis']
		const scaleG = axisGroup.append('g').attr('transform', `translate(${scale.x}, ${scale.y})`)

		if (isLeft) {
			scaleG.call(axisLeft(scale.scale))
		} else {
			const allPoints: Array<{ x: number; xName: string }> = []
			for (const series of this.viewData.series || []) {
				if (series.points) allPoints.push(...series.points)
			}

			// One tick per year: use integer years so ticks are evenly spaced (month in x caused clustering)
			const yearTickValues = [...new Set(allPoints.map(p => Math.floor(p.x)))].sort((a, b) => a - b)
			const xAxis = axisBottom(scale.scale).tickFormat(d => String(Math.floor(Number(d))))
			if (yearTickValues.length > 0) xAxis.tickValues(yearTickValues)
			else xAxis.ticks(6)

			scaleG.call(xAxis)
			scaleG.selectAll('text').style('text-anchor', 'middle').style('font-size', '12px')
		}

		axisstyle({
			axis: scaleG,
			color: 'black',
			showline: true
		})
	}
}
