import { Grid } from './Grid.ts'
import { SvgSvg, SvgG } from '../../../types/d3'

export class GridRenderer {
	private svg: SvgSvg
	private layerMap: SvgG
	private layerSv: SvgG
	private grid: Grid

	constructor(svg: SvgSvg, layerMap: SvgG, layerSv: SvgG, grid: Grid) {
		this.svg = svg
		//Renders the entire grid
		this.layerMap = layerMap.attr('transform', `translate(${Grid.defaultChrLabWidth}, ${Grid.fontSize})`)
		//Renders the lines between the chromosomes
		this.layerSv = layerSv.attr('transform', `translate(${Grid.defaultChrLabWidth}, ${Grid.fontSize})`)
		this.grid = grid
	}

	render() {
		this.renderAxisX(this.grid)
		this.renderAxisY(this.grid)
		this.svg.attr('width', Grid.defaultChrLabWidth + this.grid.xoff).attr('height', Grid.fontSize + this.grid.yoff)
	}

	private renderAxisX(grid: Grid) {
		let xoff = 0

		// column labels
		this.grid.chromosomeList.forEach((chr, index) => {
			const chrw = chr.width

			if (index % 2 === 0) {
				this.layerMap
					.append('rect')
					.attr('x', xoff)
					.attr('width', chrw)
					.attr('height', Grid.fontSize)
					.attr('y', -Grid.fontSize)
					.attr('fill', Grid.checkerFill)
			}

			this.layerMap
				.append('text')
				.attr('font-family', Grid.font)
				.attr('text-anchor', 'middle')
				.attr('font-size', 12)
				.attr('x', xoff + chrw / 2)
				.text(chr.label)

			xoff += chrw
			this.layerSv
				.append('line')
				.attr('x1', xoff)
				.attr('x2', xoff)
				.attr('y2', grid.totalpx)
				.attr('stroke', Grid.spaceColor)
				.attr('shape-rendering', 'crispEdges')

			xoff += Grid.borderWidth
		})
	}

	private renderAxisY(grid: Grid) {
		let yoff = 0

		// row labels
		this.grid.chromosomeList.forEach((chr, index) => {
			const chrh = chr.width
			if (index % 2 === 0) {
				this.layerMap
					.append('rect')
					.attr('x', -Grid.defaultChrLabWidth)
					.attr('width', Grid.defaultChrLabWidth)
					.attr('height', chrh)
					.attr('y', yoff)
					.attr('fill', Grid.checkerFill)
			}

			this.layerMap
				.append('text')
				.attr('font-family', Grid.font)
				.attr('text-anchor', 'end')
				.attr('dominant-baseline', 'central')
				.attr('font-size', 12)
				.attr('y', yoff + chrh / 2)
				.text(chr.label)

			yoff += chrh

			this.layerSv
				.append('line')
				.attr('x2', grid.totalpx)
				.attr('y1', yoff)
				.attr('y2', yoff)
				.attr('stroke', Grid.spaceColor)
				.attr('shape-rendering', 'crispEdges')

			yoff += Grid.borderWidth
		})
	}
}
