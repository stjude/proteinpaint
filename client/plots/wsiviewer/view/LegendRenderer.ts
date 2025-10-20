import { ColorScale, getMaxLabelWidth, renderTable } from '#dom'
import type { ImageViewData } from '#plots/wsiviewer/viewModel/ImageViewData.ts'

export class LegendRenderer {
	render(holder: any, imageViewData: ImageViewData) {
		if (!imageViewData.classesTable) return

		const legendHolder = holder
			.append('div')
			.attr('id', 'legend-wrapper')
			.style('display', 'inline-block')
			.style('padding', '20px')
			.style('vertical-align', 'top')

		renderTable({
			columns: imageViewData.classesTable.columns,
			rows: imageViewData.classesTable.rows,
			div: legendHolder
				.append('div')
				.attr('id', 'annotations-legend')
				.style('display', 'inline-block')
				.style('vertical-align', 'top'),
			showLines: false
		})

		if (!imageViewData.uncertainty) return

		const svgHolder = legendHolder.append('div').attr('id', 'uncertainty-legend').style('margin-top', '20px')
		const width = 200
		const height = 50
		const svg = svgHolder
			.append('svg')
			.style('width', width * 1.5)
			.style('height', height)
		const title = 'Uncertainty'
		const titleLth = getMaxLabelWidth(svg as any, [title], 1)
		svg
			.append('text')
			.attr('x', (width - titleLth) / 2) //Center the title
			.attr('y', 15)
			.style('opacity', 0.8)
			.text(title)

		//Assumes the ranges are equal intervals.
		const upperBound = Math.log(imageViewData.uncertainty.length)
		const domain = imageViewData.uncertainty.map((_, i) => {
			return upperBound * (i / (imageViewData.uncertainty!.length - 1))
		})

		new ColorScale({
			holder: svg,
			domain,
			colors: imageViewData.uncertainty.map(u => u.color),
			position: '25, 25',
			ticks: 10,
			barwidth: width,
			labels: {
				left: imageViewData.uncertainty[0].label,
				right: imageViewData.uncertainty[imageViewData.uncertainty.length - 1].label
			}
		})
	}
}
