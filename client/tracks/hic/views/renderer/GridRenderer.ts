import { Grid } from '../viewmodel/Grid.ts'

export class GridRenderer {
	private layerMap: any
	private layerSv: any
	private grid: Grid

	constructor(layerMap: any, layerSv: any, grid: Grid) {
		this.layerMap = layerMap
		this.layerSv = layerSv
		this.grid = grid
	}

	render() {
		this.renderAxisX(this.grid)
		this.renderAxisY(this.grid)
	}

	private renderAxisX(grid: Grid) {
		let xoff = 0
		// column labels

		grid.chromosomeList.forEach((chr, index) => {
			const chrw = chr.width

			if (index % 2 === 0) {
				this.layerMap
					.append('rect')
					.attr('x', xoff)
					.attr('width', chrw)
					.attr('height', Grid.fontSize)
					.attr('y', -Grid.fontSize)
					.attr('fill', Grid.checker_fill)
			}

			this.layerMap
				.append('text')
				.attr('font-family', 'Arial')
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
				// TODO fix this
				// .attr('stroke', spacecolor)
				.attr('shape-rendering', 'crispEdges')

			// TODO this.xoff += this.borderwidth

			xoff += 1
		})

		// for (const chr of this.hic.chrlst) {
		//     const chrw = this.chr2px[chr]
		//     if (checker_row) {
		//         this.layer_map
		//             .append('rect')
		//             .attr('x', this.xoff)
		//             .attr('width', chrw)
		//             .attr('height', this.fontsize)
		//             .attr('y', -this.fontsize)
		//             .attr('fill', checker_fill)
		//     }
		//     checker_row = !checker_row
		//     this.layer_map
		//         .append('text')
		//         .attr('font-family', client.font)
		//         .attr('text-anchor', 'middle')
		//         .attr('font-size', 12)
		//         .attr('x', this.xoff + chrw / 2)
		//         .text(chr)
		//
		//     this.xoff += chrw
		//     this.layer_sv
		//         .append('line')
		//         .attr('x1', this.xoff)
		//         .attr('x2', this.xoff)
		//         .attr('y2', totalpx)
		//         .attr('stroke', spacecolor)
		//         .attr('shape-rendering', 'crispEdges')
		//
		//     this.xoff += this.borderwidth
		// }
	}

	private renderAxisY(grid: Grid) {
		//     TODO implement
	}
}
