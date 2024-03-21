import { GenomeViewModel } from '../viewmodel/GenomeViewModel.ts'
import { GridRenderer } from './GridRenderer.ts'

export class GenomeViewRenderer {
	private gridRenderer: GridRenderer

	constructor(layerMap: any, layerSv: any, viewModel: GenomeViewModel) {
		this.gridRenderer = new GridRenderer(layerMap, layerSv, viewModel.grid)
	}

	render() {
		this.gridRenderer.render()
	}
}
