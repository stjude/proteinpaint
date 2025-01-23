import type { LegendCircleReferenceOpts } from './types/LegendCircleReference'
import type { SvgG } from '../types/d3'
import { shapesArray } from '#dom'

/** Creates a visual reference of the circle elements used
 * in a plot by rendering the smallest to largest circles
 * in scale.
 *
 * Also includes the option to set the min to max radius and
 * whether the scale is ascending or descending by clicking
 * on the holder.
 */

export class LegendCircleReference {
	g: SvgG
	isAscending: boolean
	readonly color = '#aaa'
	/** circle d attribute */
	readonly circle = shapesArray[0]
	/** default size of the d attribute */
	readonly defaultSize = 16
	readonly shift = 20
	readonly width = 70
	constructor(opts: LegendCircleReferenceOpts) {
		this.isAscending = opts.isAscending ?? true
		this.g = opts.g

		console.log(this)
		this.renderLegendComponent(opts)
	}

	renderLegendComponent(opts: LegendCircleReferenceOpts) {
		this.g.selectAll('*').remove()

		if (opts.title) this.g.append('g').append('text').style('font-weight', 'bold').text(opts.title)

		const minG = this.g.append('g').attr('transform', `translate(${opts.x},${opts.y})`)
		const maxG = this.g.append('g').attr('transform', `translate(${opts.x + this.width},${opts.y})`)

		//Starting text and circle element
		const startRadius = this.isAscending ? opts.minRadius : opts.maxRadius
		this.renderText(minG, -startRadius - this.shift, opts.minRadius)
		this.renderCircle(minG, startRadius)

		//Ending text and circle element
		const endRadius = this.isAscending ? opts.maxRadius : opts.minRadius
		this.renderCircle(maxG, endRadius)
		this.renderText(maxG, endRadius + this.shift, opts.maxRadius)
		this.renderLines(minG, opts.minRadius, opts.maxRadius)
	}

	renderCircle(g: SvgG, radius: number) {
		g.append('circle')
			.style('fill', this.color)
			.style('stroke', this.color)
			.attr('cx', 0)
			.attr('cy', 0)
			.attr('r', radius)
	}

	renderText(g: SvgG, x: number, text: number) {
		g.append('text').attr('x', x).attr('y', 5).style('font-size', '.8em').text(text)
	}

	renderLines(g: SvgG, minRadius: number, maxRadius: number) {
		g.append('line')
			.attr('x1', 0)
			.attr('y1', this.isAscending ? minRadius : maxRadius)
			.attr('x2', this.width)
			.attr('y2', this.isAscending ? maxRadius : minRadius)
			.style('stroke', this.color)
		g.append('line')
			.attr('x1', 0)
			.attr('y1', this.isAscending ? -minRadius : -maxRadius)
			.attr('x2', this.width)
			.attr('y2', this.isAscending ? -maxRadius : -minRadius)
			.style('stroke', this.color)
	}

	renderMenu() {}
}
