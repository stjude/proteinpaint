import IRenderer from './IRenderer.ts'
import ViewModel from './viewmodel/ViewModel.ts'
import LegendRenderer from './legend/LegendRenderer.ts'
import { RingType } from './ring/RingType.ts'
import FusionRenderer from './fusion/FusionRenderer.ts'

export class DiscoRenderer {
	private renders: Map<RingType, IRenderer>
	private legendRenderer: LegendRenderer
	private fusionRenderer: FusionRenderer

	constructor(renders: Map<RingType, IRenderer>, legendRenderer: LegendRenderer) {
		this.renders = renders
		this.legendRenderer = legendRenderer
		this.fusionRenderer = new FusionRenderer()
	}

	render(holder: any, viewModel: ViewModel) {
		const svgDiv = holder.append('div').style('display', 'inline-block').style('font-family', 'Arial')

		const svg = svgDiv
			.append('svg')
			.attr('id', 'sjpp_disco_plot')
			.attr('data-testid', 'sjpp_disco_plot')
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
