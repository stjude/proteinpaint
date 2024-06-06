import { scaleLinear } from 'd3-scale'
import { Elem, SvgG } from '../types/d3'
import { axisBottom, axisTop } from 'd3-axis'
import { axisstyle } from './axisstyle'
import { Selection } from 'd3-selection'
import { ScaleLinear } from 'd3-scale'

type ColorScaleDom = {
	gradientStart: Selection<SVGStopElement, any, SVGLinearGradientElement, any>
	gradientMid: Selection<SVGStopElement, any, SVGLinearGradientElement, any>
	gradientEnd: Selection<SVGStopElement, any, SVGLinearGradientElement, any>
	scale: ScaleLinear<number, number, never>
	scaleAxis: Selection<SVGGElement, any, any, any>
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
	dom: ColorScaleDom
	/** The height of the color bar. */
	barheight: number
	/** The width of the color bar */
	barwidth: number
	/** Color shown on the left, start of the scale. Default is white */
	startColor: string
	/** Color shown in the center of the scale.*/
	midColor: string
	/** Color shown on the right, end of the scale. Default is red */
	endColor: string
	/** Required */
	data: number[]
	/** Optional but recommendend. Sets the position of the color scale in the holder. Default is 0,0*/
	position: string
	/** Optional but recommendend. Attributes for the svg*/
	svg: {
		/** Optional. Default is 100 */
		width: number
		/** Optional. Default is 30.*/
		height: number
	}
	/** Optional. Placement of numbered ticks. Default is false */
	topTicks: boolean
	/** Optional. Number of ticks to show. Cannot be zero. Default is 4. */
	ticks: number
	/** Optional. Size of the ticks in px. Default is 1 */
	tickSize: number
	/** Options. Font size of the text labels */
	fontSize: number

	constructor(opts: {
		/** Required */
		holder: Elem
		data: number[]
		/** Optional */
		barheight?: number
		barwidth?: number
		startColor?: string
		midColor?: string
		endColor?: string
		position?: string
		/** svg.width */
		width?: number
		/** svg.height */
		height?: number
		topTicks?: boolean
		ticks?: number
		tickSize?: number
		fontSize?: number
	}) {
		this.barheight = opts.barheight || 14
		this.barwidth = opts.barwidth || 100
		this.startColor = opts.startColor || 'white'
		this.midColor = opts.midColor || 'red'
		this.endColor = opts.endColor || 'red'
		this.data = opts.data
		//TODO change this so it detects the holder size
		this.position = opts.position || '0,0'
		this.svg = {
			width: opts.width || 100,
			height: opts.height || 30
		}
		this.topTicks = opts.topTicks || false
		this.ticks = opts.ticks || 5
		this.tickSize = opts.tickSize || 1
		this.fontSize = opts.fontSize || 10

		if (!opts.holder) throw new Error('No holder provided for color scale.')
		if (!opts.data) throw new Error('No data provided for color scale.')

		this.formatData()

		const scaleSvg = opts.holder
			.append('svg')
			.attr('data-testid', 'sjpp-color-scale')
			.attr('width', this.svg.width)
			.attr('height', this.svg.height)
		const barG = scaleSvg.append('g').attr('transform', `translate(${this.position})`)
		const id = Math.random().toString()

		if (this.topTicks === true) {
			const { scale, scaleAxis } = this.makeAxis(barG, id)
			const { gradientStart, gradientMid, gradientEnd } = this.makeColorBar(barG, id)
			this.dom = { scale, scaleAxis, gradientStart, gradientMid, gradientEnd }
		} else {
			const { gradientStart, gradientMid, gradientEnd } = this.makeColorBar(barG, id)
			const { scale, scaleAxis } = this.makeAxis(barG, id)
			this.dom = { scale, scaleAxis, gradientStart, gradientMid, gradientEnd }
		}
	}

	makeColorBar(div: SvgG, id: string) {
		const defs = div.append('defs')

		//Color bar
		const gradient = defs.append('linearGradient').attr('data-testid', 'sjpp-color-scale-bar').attr('id', id)

		const gradientStart = gradient.append('stop').attr('offset', '0%').attr('stop-color', this.startColor)
		const gradientMid = gradient.append('stop').attr('offset', '100%').attr('stop-color', this.midColor)
		const gradientEnd = gradient.append('stop').attr('offset', '100%').attr('stop-color', this.endColor)

		return { gradientStart, gradientMid, gradientEnd }
	}

	makeAxis(div: SvgG, id: string) {
		div
			.append('rect')
			.attr('height', this.barheight)
			.attr('width', this.barwidth)
			.attr('fill', 'url(#' + id + ')')

		const scaleAxis = div.append('g').attr('data-testid', 'sjpp-color-scale-axis')

		if (this.topTicks === false) scaleAxis.attr('transform', `translate(0, ${this.barheight + 2})`)

		const scale = scaleLinear().domain(this.data).range([0, this.barwidth])

		return { scaleAxis, scale }
	}

	formatData() {
		this.data = this.data.map(d => Number(d.toFixed(2)))
	}

	render() {
		const axis = this.getAxis()

		axisstyle({
			axis: this.dom.scaleAxis.call(axis),
			showline: true,
			fontsize: this.fontSize
		})
	}

	getAxis() {
		const axis = this.topTicks === true ? axisTop(this.dom.scale) : axisBottom(this.dom.scale)
		axis.ticks(this.ticks).tickSize(this.tickSize)
		return axis
	}

	setAxis(tickValues: number[]) {
		if (this.topTicks === true) {
			return axisTop(this.dom.scale).tickValues(tickValues).tickSize(this.tickSize)
		} else {
			return axisBottom(this.dom.scale).tickValues(tickValues).tickSize(this.tickSize)
		}
	}

	updateColors() {
		this.dom.gradientStart.attr('stop-color', this.startColor)
		this.dom.gradientMid.attr('stop-color', this.midColor)
		this.dom.gradientEnd.attr('stop-color', this.endColor)
	}

	updateAxis() {
		this.formatData()
		const start = this.data[0]
		const stop = this.data[this.data.length - 1]
		const tickValues = [start, stop]
		this.dom.scaleAxis.selectAll('*').remove()

		if (start < 0 && stop > 0) {
			tickValues.splice(this.data.length / 2, 0, 0)
			this.dom.scale = scaleLinear()
				.domain(tickValues)
				.range([0, this.barwidth / 2, this.barwidth])
			this.dom.gradientStart.attr('offset', '0%').attr('stop-color', this.startColor)
			this.dom.gradientMid.attr('offset', '50%').attr('stop-color', this.midColor)
			this.dom.gradientEnd.attr('offset', '100%').attr('stop-color', this.endColor)
		} else {
			this.dom.scale = scaleLinear().domain(tickValues).range([0, this.barwidth])
			this.dom.gradientStart.attr('offset', '0%').attr('stop-color', this.startColor)
			this.dom.gradientMid
				.attr('offset', start >= 0 ? '0%' : '100%')
				.attr('stop-color', start >= 0 ? this.startColor : this.endColor)
			this.dom.gradientEnd.attr('offset', '100%').attr('stop-color', this.endColor)
		}

		this.dom.scaleAxis.transition().duration(500).call(this.setAxis(tickValues))
	}

	updateScale() {
		this.updateColors()
		this.updateAxis()
	}
}
