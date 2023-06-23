import IRenderer from './IRenderer'
import ViewModel from '#plots/disco/viewmodel/ViewModel'
import LegendRenderer from './LegendRenderer'
import { RingType } from '#plots/disco/viewmodel/RingType'
import FusionRenderer from './FusionRenderer'
import DownloadButtonRenderer from '#plots/disco/renderer/DownloadButtonRenderer'

export class DiscoRenderer {
	private renders: Map<RingType, IRenderer>
	private legendRenderer: LegendRenderer
	private fusionRenderer: FusionRenderer
	private downloadButtonRenderer: DownloadButtonRenderer

	constructor(
		renders: Map<RingType, IRenderer>,
		legendRenderer: LegendRenderer,
		downloadClickListener: (d: any) => void
	) {
		this.renders = renders
		this.legendRenderer = legendRenderer
		this.fusionRenderer = new FusionRenderer()
		this.downloadButtonRenderer = new DownloadButtonRenderer(downloadClickListener)
	}

	render(holder: any, viewModel: ViewModel) {
		const rootDiv = holder.append('div')

		const svgDiv = rootDiv.append('div').style('display', 'inline-block').style('font-family', 'Arial')

		this.downloadButtonRenderer.render(svgDiv)

		const svg = svgDiv
			.append('svg')
			.attr('width', viewModel.width)
			.attr('height', viewModel.height + viewModel.legendHeight)

		const mainG = svg
			.append('g')
			.attr('class', 'mainG')
			.attr(
				'transform',
				`translate(${
					viewModel.settings.rings.labelLinesInnerRadius + viewModel.settings.rings.labelsToLinesDistance + 100
				},${viewModel.height / 2})`
			)

		for (const [ringType, renderer] of this.renders) {
			const elements = viewModel.getElements(ringType)
			const collisions = viewModel.getCollisions(ringType)

			renderer.render(mainG, elements, collisions)
		}

		this.fusionRenderer.render(mainG, viewModel.fusions)

		this.legendRenderer.render(
			mainG,
			viewModel.legend,
			-1 * (viewModel.settings.rings.labelLinesInnerRadius + viewModel.settings.rings.labelsToLinesDistance + 50),
			viewModel.width,
			viewModel.height / 2
		)
	}
}
