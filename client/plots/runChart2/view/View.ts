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

		for (const series of this.viewData.series || []) {
			new SeriesRender(series)
		}
	}

	renderScale(scale: any, isLeft = false) {
		const scaleG = this.chartDom[isLeft ? 'yAxis' : 'xAxis']
			.append('g')
			.attr('transform', `translate(${scale.x}, ${scale.y})`)
			.call(isLeft ? axisLeft(scale.scale) : axisBottom(scale.scale))

		axisstyle({
			axis: scaleG,
			color: 'black',
			showline: true
		})
	}
}
