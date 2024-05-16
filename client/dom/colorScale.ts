import { scaleLinear } from 'd3-scale'
import { Elem, SvgG } from '../types/d3'
import { axisBottom, axisTop } from 'd3-axis'
import { axisstyle } from '#dom/axisstyle'
import { Selection } from 'd3-selection'

type ColorScaleOpts = {
	g: SvgG
	gradientStart: Selection<SVGStopElement, any, any, any>
	gradientMid: Selection<SVGStopElement, any, any, any>
	gradientEnd: Selection<SVGStopElement, any, any, any>
	/** Color shown on the left, start of the scale. Default is white */
	startColor: string
	/** Color shown in the center of the scale.*/
	midColor: string
	/** Color shown on the right, end of the scale. Default is red */
	endColor: string
	bar: Selection<SVGRectElement, any, any, any>
	scale: any
	scaleAxis: any
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
	data: number[]
	/** Required */
	holder: Elem
	position: string
	/** Optional. Attributes for the svg*/
	svg: {
		/** Optional. Default is 100 */
		width: number
		/** Optional. Default is 30.*/
		height: number
	}
	/** Optional. Placement of numbered ticks. Default is bottom */
	tickPosition: 'top' | 'bottom'
	/** Optional. Number of ticks to show. Cannot be zero. Default is 4. */
	ticks: number
	tickSize: number

	constructor(opts: any) {
		this.barheight = opts.barheight || 14
		this.barwidth = opts.barwidth || 100
		;(this.bar = {
			startColor: opts.startColor || 'white',
			midColor: opts.midColor || 'white',
			endColor: opts.endColor || 'red'
		}),
			(this.data = opts.data || [0, 1]),
			(this.holder = opts.holder)
		//TODO change this so it detects the holder size
		this.position = opts.position || '0,0'
		this.svg = {
			width: opts.width || 100,
			height: opts.height || 30
		}
		this.tickPosition = opts.tickPosition || 'bottom'
		this.ticks = opts.ticks || 5
		this.tickSize = opts.tickSize || 1
	}

	async render() {
		const scaleSvg = this.holder.append('svg').attr('width', this.svg.width).attr('height', this.svg.height)
		this.bar.g = scaleSvg.append('g').attr('transform', `translate(${this.position})`)

		const defs = this.bar.g.append('defs')
		const id = Math.random().toString()
		const gradient = defs.append('linearGradient').attr('id', id)

		this.bar.gradientStart = gradient
			.append('stop')
			.attr('offset', 0)
			.attr('stop-color', this.bar.startColor as string)
		this.bar.gradientMid = gradient
			.append('stop')
			.attr('offset', 0.5)
			.attr('stop-color', this.bar.midColor as string)
		this.bar.gradientEnd = gradient
			.append('stop')
			.attr('offset', 1)
			.attr('stop-color', this.bar.endColor as string)

		this.bar.bar = this.bar.g
			.append('rect')
			.attr('height', this.barheight)
			.attr('width', this.barwidth)
			.attr('fill', 'url(#' + id + ')')
		this.bar.scaleAxis = this.bar.g.append('g').attr('transform', `translate(0, ${this.barheight + 2})`)
		const start = Number(this.data[0].toFixed(2))
		const stop = Number(this.data[this.data.length - 1].toFixed(2))
		this.bar.scale = scaleLinear().domain([start, stop]).range([0, this.barwidth])

		const axis = this.getAxis()

		axisstyle({
			axis: this.bar.scaleAxis.call(axis),
			showline: true,
			fontsize: '3px'
		})
	}

	getAxis() {
		const axis = this.tickPosition === 'top' ? axisTop(this.bar.scale) : axisBottom(this.bar.scale)
		axis.ticks(this.ticks).tickSize(this.tickSize)
		return axis
	}

	updateColors() {
		this.bar.gradientStart!.attr('stop-color', this.bar.startColor as string)
		this.bar.gradientEnd!.attr('stop-color', this.bar.endColor as string)
	}

	updateAxis() {
		const start = Number(this.data[0].toFixed(2))
		const stop = Number(this.data[this.data.length - 1].toFixed(2))
		const tickValues = [start, stop]
		this.bar.scaleAxis.selectAll('*').remove()

		if (start < 0 && stop > 0) {
			tickValues.splice(1, 0, 0)
			this.bar.scale = scaleLinear()
				.domain(tickValues)
				.range([0, this.barwidth / 2, this.barwidth])
			this.bar.gradientStart!.attr('offset', '0%').attr('stop-color', this.bar.startColor as string)
			this.bar.gradientMid!.attr('offset', '50%').attr('stop-color', this.bar.midColor as string)
			this.bar.gradientEnd!.attr('offset', '100%').attr('stop-color', this.bar.endColor as string)
		} else {
			this.bar.scale = scaleLinear().domain(tickValues).range([0, this.barwidth])
			this.bar.gradientStart!.attr('offset', '0%').attr('stop-color', this.bar.startColor as string)
			this.bar
				.gradientMid!.attr('offset', start >= 0 ? '0%' : '100%')
				.attr('stop-color', start >= 0 ? (this.bar.startColor as string) : (this.bar.endColor as string))
			this.bar.gradientEnd!.attr('offset', '100%').attr('stop-color', this.bar.endColor as string)
		}

		this.bar.scaleAxis
			.transition()
			.duration(500)
			.call(axisBottom(this.bar.scale).tickValues(tickValues).tickSize(this.tickSize))
	}

	updateScale() {
		this.updateColors()
		this.updateAxis()
	}
}
