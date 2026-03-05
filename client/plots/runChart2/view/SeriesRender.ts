import { line } from 'd3-shape'
import { rgb } from 'd3-color'
import { table2col } from '#dom'
import { roundValueAuto } from '#shared/roundValue.js'
import type { RunChart2Settings } from '../Settings.ts'
import { getFrequencyCountLabel } from '../Settings.ts'
import type { RunChart2 } from '../RunChart2.ts'

function getCoordinate(val: number, min: number | null, max: number | null): number {
	if (min != null && val < min) return min
	if (max != null && val > max) return max
	return val
}

function isFrequencyMode(config: any): boolean {
	return config?.ytw == null
}

function isCumulativeFrequencyMode(config: any): boolean {
	return isFrequencyMode(config) && config?.settings?.runChart2?.showCumulativeFrequency === true
}

function shouldDrawMedianLine(config: any, series: any): boolean {
	return !isCumulativeFrequencyMode(config) && series?.median != null && !isNaN(series.median)
}

export class SeriesRender {
	series: any
	plotDims: any
	settings: RunChart2Settings
	seriesGroup: any
	runChart2: RunChart2 | undefined
	seriesColor?: string

	constructor(
		series: any,
		plotDims: any,
		settings: RunChart2Settings,
		seriesGroup: any,
		runChart2?: RunChart2,
		seriesColor?: string
	) {
		this.series = series
		this.plotDims = plotDims
		this.settings = settings
		this.seriesGroup = seriesGroup
		this.runChart2 = runChart2
		this.seriesColor = seriesColor
		this.render()
	}

	getCoordinates(d: { x: number; y: number }): { x: number; y: number } {
		const cx = getCoordinate(d.x, this.settings.minXScale, this.settings.maxXScale)
		const cy = getCoordinate(d.y, this.settings.minYScale, this.settings.maxYScale)
		return {
			x: this.plotDims.xAxis.scale(cx),
			y: this.plotDims.yAxis.scale(cy)
		}
	}

	render() {
		if (!this.series.points || this.series.points.length === 0) return

		const cfg = this.runChart2?.state?.config
		const color = this.seriesColor ?? this.settings.color ?? '#1f77b4'
		const medianColor = rgb(color).darker(2)
		const sortedPoints = [...this.series.points].sort((a, b) => a.x - b.x)

		const lineBuilder = line<{ x: number; y: number }>()
			.x(d => this.getCoordinates(d).x)
			.y(d => this.getCoordinates(d).y)

		const opacity = this.settings.opacity ?? 0.6
		const seriesG = this.seriesGroup
			.append('g')
			.attr('data-testId', 'sjpp-runChart2-series')
			.attr('data-series-id', this.series.seriesId ?? '')

		// Median line and text FIRST (background layer)
		if (shouldDrawMedianLine(cfg, this.series)) {
			const yMedian = this.plotDims.yAxis.scale(
				getCoordinate(this.series.median, this.settings.minYScale, this.settings.maxYScale)
			)
			const xStart = this.getCoordinates(sortedPoints[0]).x
			const xEnd = this.getCoordinates(sortedPoints[sortedPoints.length - 1]).x

			// Create background group for median line and text
			const medianG = seriesG.append('g').attr('data-testId', 'sjpp-runChart2-median-bg')

			// Draw median horizontal line
			medianG
				.append('line')
				.attr('x1', xStart)
				.attr('y1', yMedian)
				.attr('x2', xEnd)
				.attr('y2', yMedian)
				.attr('stroke', medianColor.toString())
				.attr('stroke-width', 1)
				.attr('opacity', 0.5)

			// Add median label
			medianG
				.append('text')
				.attr('x', xEnd - 10)
				.attr('y', yMedian - 5)
				.attr('text-anchor', 'end')
				.attr('font-size', '12px')
				.attr('fill', medianColor.toString())
				.attr('pointer-events', 'none')
				.text(`M=${roundValueAuto(this.series.median, true, 1)}`)
		}

		// Curve and dots SECOND (foreground layer)
		seriesG
			.append('path')
			.datum(sortedPoints)
			.attr('fill', 'none')
			.attr('stroke', color)
			.attr('stroke-width', 1)
			.attr('stroke-linejoin', 'round')
			.attr('opacity', opacity)
			.attr('d', lineBuilder)

		seriesG
			.selectAll('circle')
			.data(sortedPoints)
			.enter()
			.append('circle')
			.attr('cx', d => this.getCoordinates(d).x)
			.attr('cy', d => this.getCoordinates(d).y)
			.attr('r', 2.5)
			.attr('fill', color)
			.attr('stroke', '#fff')
			.attr('stroke-width', 1)
			.style('cursor', 'pointer')
			.on('mouseover', (event: any, d: any) => this.showHoverTip(event, d))
			.on('mouseout', () => this.hideHoverTip())
	}

	showHoverTip(event: any, d: any) {
		const tip = this.runChart2?.dom?.hovertip
		if (!tip) return
		const cfg = this.runChart2?.state?.config
		tip.clear()
		const table = table2col({ holder: tip.d.append('div') })
		if (this.series.seriesId) table.addRow('Period', this.series.seriesId)
		const xTermName = cfg?.xtw?.term?.name ?? 'X'
		table.addRow(xTermName, d.xName ?? String(d.x))
		if (isFrequencyMode(cfg)) {
			// y = plotted value (count or cumulative count).
			table.addRow(getFrequencyCountLabel(cfg?.settings?.runChart2?.showCumulativeFrequency), String(d.y ?? ''))
			if (d.sampleCount != null && d.sampleCount !== d.y) {
				table.addRow('Sample Count', String(d.sampleCount))
			}
		} else {
			table.addRow(cfg?.ytw?.term?.name ?? 'Y', roundValueAuto(d.y, true, 2))
			table.addRow('Sample Count', String(d.sampleCount ?? ''))
		}
		tip.show(event.clientX, event.clientY)
	}

	hideHoverTip() {
		this.runChart2?.dom?.hovertip?.hide()
	}

	// Click menu disabled until menu options have real actions (currently only close the menu)
	// showPointMenu(event: any, point: any) {
	// 	if (!this.runChart2 || !this.runChart2.dom.clickMenu) return
	// 	this.hideHoverTip()
	// 	const cfg = this.runChart2.state?.config
	// 	const xTermName = cfg?.term?.term?.name ?? 'X'
	// 	const yTermName = cfg?.term2?.term?.name ?? 'Y'
	// 	const menu = this.runChart2.dom.clickMenu
	// 	menu.clear()
	// 	const menuDiv = menu.d.append('div').attr('class', 'sja_menu_div')
	// 	const options = [
	// 		{ label: `${xTermName}: ${point.xName ?? point.x}`, callback: () => menu.hide() },
	// 		{ label: `${yTermName}: ${roundValueAuto(point.y, true, 2)}`, callback: () => menu.hide() },
	// 		{ label: `Sample Count: ${point.sampleCount}`, callback: () => menu.hide() }
	// 	]
	// 	menuDiv
	// 		.selectAll('div')
	// 		.data(options)
	// 		.enter()
	// 		.append('div')
	// 		.attr('class', 'sja_menuoption sja_sharp_border')
	// 		.text(d => d.label)
	// 		.style('cursor', 'pointer')
	// 		.on('click', (event: any, d: any) => { d.callback() })
	// 	menu.show(event.clientX, event.clientY)
	// }
}
