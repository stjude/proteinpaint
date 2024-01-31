import { scaleLinear } from 'd3-scale'
import { Div, Elem } from '../types/d3'
import { axisBottom, axisTop } from 'd3-axis'
import { axisstyle } from '#dom/axisstyle'

type ColorScaleOpts = {
	g: any
	gradientStart: any
	gradientEnd: any
	/** Color shown on the left, start of the scale. Default is white */
	startColor: string
	/** Color shown on the right, end of the scale. Default is red */
	endColor: string
	bar: any //dom
	scale: any //dom
	axisg: any
}

/** Work in Progress! Update as needed.
 * Intended to be a reusable color scale throughout the platform. Also intended to be
 * highly customizable.
 *
 * TODO:
 *  - May conside moving the number line to a separate class. Allow the scale to be
 * implemented independent of the entire color scale.
 *  - Likewise may create a super class to handle the number line and color scale.
 * This will allow only the color bar to be implemented without additional code (e.g. ld track)
 */
export class ColorScale {
	/** The height of the color bar. */
	barheight: number
	/** The width of the color bar */
	barwidth: number
	bar: Partial<ColorScaleOpts>
	/** Required */
	data: any
	/** Required */
	holder: Elem | Div
	/** Optional. Attributes for the svg*/
	svg: {
		/** Optional. Default is 100 */
		width: number
		/** Optional. Default is 30.*/
		height: number
	}
	// /** Optional. Placement of numbered ticks. Default is bottom */
	// tickPosition: 'top' | 'bottom'
	// /** Optional. Number of ticks to show. Cannot be zero. Default is 4. */
	// ticks: number

	constructor(opts: any) {
		this.barheight = opts.barheight || 14
		this.barwidth = opts.barwidth || 100
		this.bar = {
			startColor: opts.startColor || 'white',
			endColor: opts.endColor || 'red'
		}
		;(this.data = opts.data || [0, 1]), (this.holder = opts.holder)
		this.svg = {
			width: opts.width || 100,
			height: opts.height || 30
		}
		// this.tickPosition = opts.tickPosition || 'bottom'
		// this.ticks = opts.ticks || 4
	}

	render() {
		const scaleSvg = this.holder.append('svg').attr('width', this.svg.width).attr('height', this.svg.height)
		this.bar.g = scaleSvg.append('g').attr('transform', 'translate(0, 0)')

		const defs = this.bar.g.append('defs')
		const id = Math.random().toString()
		const gradient = defs.append('linearGradient').attr('id', id)

		this.bar.gradientStart = gradient.append('stop').attr('offset', 0).attr('stop-color', this.bar.startColor)
		this.bar.gradientEnd = gradient.append('stop').attr('offset', 1).attr('stop-color', this.bar.endColor)

		this.bar.bar = this.bar.g
			.append('rect')
			.attr('height', this.barheight)
			.attr('width', this.barwidth)
			.attr('fill', 'url(#' + id + ')')
		this.bar.axisg = this.bar.g.append('g').attr('transform', `translate(0, ${this.barheight})`)
		const start = this.data[0]
		const stop = this.data[this.data.length - 1]
		this.bar.scale = scaleLinear([start, stop]).range([0, this.barwidth])

		// const axis = this.tickPosition === 'top' ?
		//     axisTop(this.bar.scale).ticks(this.ticks) :
		//     // @ts-ignore
		//     axisBottom().scale(this.bar.scale).ticks(this.ticks).tickSize(1)

		// axisstyle({
		//     axis: this.bar.axisg.call(axis),
		//     showline: true
		// })
	}

	updateColors() {
		this.bar.gradientStart.attr('stop-color', this.bar.startColor)
		this.bar.gradientEnd.attr('stop-color', this.bar.endColor)
	}

	updateTicks() {
		console.log(this.data)
	}

	updateScale() {
		this.updateColors()
		this.updateTicks()
	}
}
