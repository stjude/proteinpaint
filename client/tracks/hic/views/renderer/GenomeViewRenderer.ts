import { GenomeViewModel } from '../viewmodel/GenomeViewModel.ts'
import { GridRenderer } from './GridRenderer.ts'
import { SvgSvg } from 'types/d3'

export class GenomeViewRenderer {
	private gridRenderer: GridRenderer

	constructor(svg: SvgSvg, layerMap: any, layerSv: any, viewModel: GenomeViewModel) {
		this.gridRenderer = new GridRenderer(svg, layerMap, layerSv, viewModel.grid)
	}

	render() {
		this.gridRenderer.render()
	}
}
