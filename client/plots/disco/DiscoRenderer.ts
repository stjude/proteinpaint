import IRenderer from './IRenderer.ts'
import ViewModel from './viewmodel/ViewModel.ts'
import LegendRenderer from './legend/LegendRenderer.ts'
import { RingType } from './ring/RingType.ts'
import FusionRenderer from './fusion/FusionRenderer.ts'
import DownloadButtonRenderer from './download/DownloadButtonRenderer.ts'
import PrioritizeGenesCheckboxRenderer from '#plots/disco/prioritizegenes/PrioritizeGenesCheckboxRenderer.ts'

export class DiscoRenderer {
	private renders: Map<RingType, IRenderer>
	private legendRenderer: LegendRenderer
	private fusionRenderer: FusionRenderer
	private downloadButtonRenderer: DownloadButtonRenderer
	private prioritizeGenesCheckboxRenderer: PrioritizeGenesCheckboxRenderer

	constructor(
		renders: Map<RingType, IRenderer>,
		legendRenderer: LegendRenderer,
		downloadClickListener: (d: any) => void,
		prioritizedGenesCheckboxListener: (checked: boolean) => void
	) {
		this.renders = renders
		this.legendRenderer = legendRenderer
		this.fusionRenderer = new FusionRenderer()
		this.downloadButtonRenderer = new DownloadButtonRenderer(downloadClickListener)
		this.prioritizeGenesCheckboxRenderer = new PrioritizeGenesCheckboxRenderer(prioritizedGenesCheckboxListener)
	}

	render(holder: any, viewModel: ViewModel) {
		const rootDiv = holder.append('div')
		const headerDiv = rootDiv.append('div')
		const svgDiv = rootDiv.append('div').style('display', 'inline-block').style('font-family', 'Arial')
		const controlsDiv = svgDiv.append('div')

		this.downloadButtonRenderer.render(controlsDiv, svgDiv)
		this.prioritizeGenesCheckboxRenderer.render(
			controlsDiv,
			viewModel.settings.label.prioritizeGeneLabelsByGeneSets,
			viewModel.settings.label.showPrioritizeGeneLabelsByGeneSets
		)

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
