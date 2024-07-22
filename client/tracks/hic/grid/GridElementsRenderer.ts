import { Grid } from './Grid'
import { GridElementRenderer } from './GridElementRenderer'
import { SvgG } from '../../../types/d3'

export class GridElementsRenderer {
	grid: Grid
	gridElementRenderer: GridElementRenderer

	constructor(grid: Grid, layerMap: SvgG, app: any) {
		this.grid = grid
		this.gridElementRenderer = new GridElementRenderer(layerMap, app)
	}

	render(holder: any) {
		//chrx = String value of chromosome on x axis
		//chry = map of chromosome on y axis with grid elements and data
		for (const [chrx, chryMap] of this.grid.chromosomeMatrix) {
			for (const [chry, gridElem] of chryMap) {
				this.gridElementRenderer.render(gridElem, chrx, chry, holder)
			}
		}
	}
}
