import type IRenderer from '#plots/disco/IRenderer.ts'
import type MutationWaterfallPoint from './MutationWaterfallPoint.ts'
import MenuProvider from '#plots/disco/menu/MenuProvider.ts'
import { table2col } from '#dom/table2col'
import { bplen } from '#shared/common.js'
import { ticks } from 'd3-array'

export default class MutationWaterfallRenderer implements IRenderer {
	private dotRadius: number

	constructor(dotRadius = 1.5) {
		this.dotRadius = dotRadius
	}

	render(holder: any, elements: Array<MutationWaterfallPoint>) {
		if (!elements.length) return

		const ringGroup = holder.append('g').attr('data-testid', 'sjpp_mutation_waterfall_ring')
		const menu = MenuProvider.create()

		ringGroup
			.append('g')
			.selectAll('circle')
			.data(elements)
			.enter()
			.append('circle')
			.attr('cx', d => Math.cos(d.startAngle - Math.PI / 2) * d.innerRadius)
			.attr('cy', d => Math.sin(d.startAngle - Math.PI / 2) * d.innerRadius)
			.attr('r', this.dotRadius)
			.attr('fill', '#4d4d4d')
			.attr('opacity', 0.9)
			.on('mouseover', (event: MouseEvent, d: MutationWaterfallPoint) => {
				const distance = Math.round(Math.pow(10, d.logDistance))
				menu.clear()
				const table = table2col({ holder: menu.d })
				{
					const [td1, td2] = table.addRow()
					td1.text('Chromosome')
					td2.text(d.chr)
				}
				{
					const [td1, td2] = table.addRow()
					td1.text('Position')
					td2.text(`${d.chr}:${d.position}`)
				}
				{
					const [td1, td2] = table.addRow()
					td1.text('Intermutation distance')
					td2.text(`${bplen(distance)} (${d.logDistance.toFixed(2)})`)
				}
				menu.show(event.x, event.y)
			})
			.on('mouseout', () => {
				menu.clear()
				menu.hide()
			})

		this.renderAxis(ringGroup, elements[0])
	}

	private renderAxis(holder: any, referencePoint: MutationWaterfallPoint) {
		const { ringInnerRadius, ringWidth, rangeMin, rangeMax } = referencePoint
		const axisGroup = holder.append('g').attr('class', 'sjpp-waterfall-axis')
		const topRadius = ringInnerRadius + ringWidth

		axisGroup
			.append('line')
			.attr('x1', 0)
			.attr('y1', -topRadius)
			.attr('x2', 0)
			.attr('y2', -ringInnerRadius)
			.attr('stroke', '#6e6e6e')
			.attr('stroke-width', 1)

		const span = rangeMax - rangeMin || 1
		const tickValues = rangeMax === rangeMin ? [rangeMin] : ticks(rangeMin, rangeMax, 4)

		tickValues.forEach(value => {
			const ratio = (value - rangeMin) / span
			const radius = ringInnerRadius + ringWidth * ratio
			const y = -radius
			axisGroup.append('line').attr('x1', -4).attr('x2', 4).attr('y1', y).attr('y2', y).attr('stroke', '#6e6e6e')

			const exponent = Math.round(value * 10) / 10
			const formatted = Number.isInteger(exponent) ? `${exponent}` : exponent.toFixed(1)
			axisGroup
				.append('text')
				.attr('x', 6)
				.attr('y', y + 3)
				.style('font-size', '10px')
				.style('fill', '#4d4d4d')
				.text(`10^${formatted} bp`)
		})

		axisGroup
			.append('text')
			.attr('x', 0)
			.attr('y', -(topRadius + 10))
			.attr('text-anchor', 'middle')
			.style('font-size', '10px')
			.style('fill', '#4d4d4d')
			.text('Intermutation distance (log10 bp)')
	}
}
