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
		const SeriesRenderClass = this.getSeriesRenderClass()
		for (let i = 0; i < seriesList.length; i++) {
			const series = seriesList[i]
			const seriesColor = cat2Color ? cat2Color(series.seriesId ?? String(i)) : undefined
			new SeriesRenderClass(series, plotDims, this.settings, seriesGroup, this.runChart2, seriesColor)
		}

		this.renderAxisLabels(plotDims)
	}

	/** Override in subclasses to use a custom series renderer (e.g. different tooltip). */
	getSeriesRenderClass() {
		return SeriesRender
	}

	/** Override in subclasses (e.g. FrequencyChart2View) to show a different Y-axis label. */
	getYAxisLabel(): string {
		return this.config?.ytw?.term?.name || 'Y Axis'
	}

	renderAxisLabels(plotDims: any) {
		const xName = this.config?.xtw?.term?.name || 'X Axis'
		const xLabel =
			this.viewData.totalSampleCount != null && this.config?.xtw?.q?.mode !== 'discrete'
				? `${xName}, n=${this.viewData.totalSampleCount.toLocaleString()}`
				: xName
		const yLabel = this.getYAxisLabel()

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
			const [domainMin, domainMax] = scale.scale.domain()
			const xScale = scale.scale
			const rangeMax = this.settings.svgw

			const firstYear = Math.floor(domainMin)
			const lastYear = Math.floor(domainMax)
			const firstEvenYear = firstYear % 2 === 0 ? firstYear : firstYear + 1
			const majorTickValues: number[] = []
			for (let y = firstEvenYear; y <= lastYear; y += 2) majorTickValues.push(y)

			const majorVisible = majorTickValues.filter(y => {
				const pos = xScale(y)
				return pos >= 0 && pos <= rangeMax
			})

			const xAxis = axisBottom(scale.scale).tickFormat(d => String(Math.floor(Number(d))))
			if (majorVisible.length > 0) xAxis.tickValues(majorVisible)
			else xAxis.ticks(6)

			scaleG.call(xAxis)
			const tickTexts = scaleG.selectAll('text').style('font-size', '12px')
			tickTexts.style('text-anchor', 'middle')
			const n = tickTexts.size()
			if (n > 0) tickTexts.filter((_: any, i: number) => i === 0).style('text-anchor', 'start')
			if (n > 1) tickTexts.filter((_: any, i: number) => i === n - 1).style('text-anchor', 'end')

			// Minor ticks: unlabeled tick at every year (single-year increments between major labels)
			const minorYears: number[] = []
			for (let y = firstYear; y <= lastYear; y++) if ((y - firstEvenYear) % 2 !== 0) minorYears.push(y)
			const minorVisible = minorYears.filter(y => {
				const pos = xScale(y)
				return pos >= 0 && pos <= rangeMax
			})
			if (minorVisible.length > 0) {
				const minorG = scaleG.append('g').attr('class', 'sjpp-runChart2-xAxis-minor')
				minorVisible.forEach(y => {
					const pos = xScale(y)
					minorG
						.append('line')
						.attr('x1', pos)
						.attr('x2', pos)
						.attr('y1', 0)
						.attr('y2', 4)
						.attr('stroke', 'currentColor')
						.attr('stroke-width', 1)
				})
			}
		}

		axisstyle({
			axis: scaleG,
			color: 'black',
			showline: true
		})
	}
}
