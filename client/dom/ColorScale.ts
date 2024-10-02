import { scaleLinear } from 'd3-scale'
import { Elem, SvgG } from '../types/d3'
import { axisBottom, axisTop } from 'd3-axis'
import { axisstyle } from './axisstyle'
import { Selection } from 'd3-selection'
import { ScaleLinear } from 'd3-scale'
import { font } from '../src/client'

type GradientElem = Selection<SVGLinearGradientElement, any, any, any>

type ColorScaleDom = {
	gradient: GradientElem
	scale: ScaleLinear<number, number, never>
	scaleAxis: SvgG
	/** Present when important value is indicated in opts */
	label?: Selection<SVGTextElement, any, any, any>
	line?: Selection<SVGLineElement, any, any, any>
}

type ColorScaleOpts = {
	/** Optional but recommended. The height of the color bar in px. Default is 14. */
	barheight?: number
	/** Optional but recommended. The width of the color bar in px. Default is 100. */
	barwidth?: number
	/** Optional but highly recommend. Default is a white to red scale. */
	colors?: string[]
	/** Required */
	data: number[]
	/** Optional. Font size in px of the text labels. */
	fontSize?: number
	/** Required */
	holder: Elem
	/** Optional. Shows a value in the color bar for the default, bottom axis
	 * This value cannot be zero at initialization.
	 */
	markedValue?: number
	position?: string
	/** Optional but recommendend. If the holder is not an svg or g element adding the width, height, or position creates the svg. */
	/** Optional. Width of the svg. Default is 100 */
	width?: number
	/** Optional. Heigh fo the svg. Default is 30.*/
	height?: number
	/** Optional. Number of ticks to show. Cannot be zero. Default is 4. */
	ticks?: number
	/** Optional. Size of the ticks in px. Default is 1. */
	tickSize?: number
	/** Optional. Placement of numbered ticks. Default is false (i.e. placement below the color bar). */
	topTicks?: boolean
	/** Optional. Specify the values to show along a number line. Otherwise the first and last numder in data are used.  */
	tickValues?: number[]
}

export class ColorScale {
	dom: ColorScaleDom
	barheight: number
	barwidth: number
	colors: string[]
	data: number[]
	fontSize: number
	markedValue?: number | null
	topTicks: boolean
	ticks: number
	tickSize: number
	tickValues: number[]

	constructor(opts: ColorScaleOpts) {
		this.barheight = opts.barheight || 14
		this.barwidth = opts.barwidth || 100
		this.colors = opts.colors || ['white', 'red']
		this.data = opts.data
		this.fontSize = opts.fontSize || 10
		this.markedValue = opts.markedValue && opts.markedValue > 0.001 ? opts.markedValue : null
		this.ticks = opts.ticks || 5
		this.tickSize = opts.tickSize || 1
		this.topTicks = opts.topTicks || false
		this.tickValues = opts.tickValues || []

		if (!opts.holder) throw new Error('No holder provided for color scale.')
		if (!opts.data) throw new Error('No data provided for color scale.')

		this.formatData()

		let scaleSvg
		if (opts.width || opts.height || opts.position) {
			scaleSvg = opts.holder
				.append('svg')
				.attr('data-testid', 'sjpp-color-scale')
				.attr('width', opts.width || 100)
				.attr('height', opts.height || 30)
		} else scaleSvg = opts.holder
		const barG = scaleSvg.append('g').attr('transform', `translate(${opts.position || '0,0'})`)
		const id = Math.random().toString()

		const defs = barG.append('defs')
		const gradient = defs.append('linearGradient').attr('data-testid', 'sjpp-color-scale-bar').attr('id', id)

		if (this.topTicks === true) {
			const { scale, scaleAxis } = this.makeAxis(barG, id)
			this.makeColorBar(gradient)
			this.dom = { gradient, scale, scaleAxis }
		} else {
			this.makeColorBar(gradient)
			const { scale, scaleAxis } = this.makeAxis(barG, id)
			this.dom = { gradient, scale, scaleAxis }
			if (this.markedValue !== null) this.markedValueInColorBar(barG)
		}
	}

	formatData() {
		this.data = this.data.map(d => Number(d.toFixed(2)))
	}

	makeColorBar(gradient?: GradientElem) {
		const gradElem = gradient || this.dom.gradient
		for (const c of this.colors) {
			const idx = this.colors.indexOf(c)
			const offset = (idx / (this.colors.length - 1)) * 100
			gradElem.append('stop').attr('offset', `${offset}%`).attr('stop-color', `${c}`)
		}
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

		return { scale, scaleAxis }
	}

	markedValueInColorBar(div: SvgG) {
		if (!this.markedValue || this.topTicks == true) return

		this.dom.line = div
			.append('line')
			.classed('sjpp-color-scale-marked', true)
			.attr('data-testid', 'sjpp-color-scale-marked-tick')
			.attr('y1', this.barheight - 2)
			.attr('y2', this.barheight + 1)
			.attr('stroke', 'black')

		this.dom.label = div
			.append('text')
			.classed('sjpp-color-scale-marked', true)
			.attr('data-testid', 'sjpp-color-scale-marked-label')
			.attr('text-anchor', 'middle')
			.attr('font-family', font)
			.attr('font-size', this.fontSize)
			.attr('y', this.barheight - 3)

		this.updateValueInColorBar()
	}

	render() {
		const axis = this.getAxis()

		axisstyle({
			axis: this.dom.scaleAxis.call(axis),
			showline: false,
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
		this.dom.gradient.selectAll('stop').remove()
		this.makeColorBar()
	}

	updateAxis() {
		this.formatData()
		const start = this.data[0]
		const stop = this.data[this.data.length - 1]
		if (!this.tickValues.length) this.tickValues = [start, stop]

		this.dom.scaleAxis.selectAll('*').remove()

		const getRange = () =>
			this.tickValues.map((v, i) => {
				return this.barwidth * (i / (this.tickValues.length - 1))
			})

		if (start < 0 && stop > 0 && this.tickValues.indexOf(0) == -1) {
			this.tickValues.splice(this.data.length / 2, 0, 0)
			this.dom.scale = scaleLinear().domain(this.tickValues).range(getRange())
		} else {
			this.dom.scale = scaleLinear().domain(this.tickValues).range(getRange())
		}

		this.dom.scaleAxis.transition().duration(500).call(this.setAxis(this.tickValues))
	}

	updateValueInColorBar() {
		if (!this.markedValue || this.topTicks == true) return
		if (!this.dom.line || !this.dom.label) throw new Error('Missing dom elements to update value in color bar.')

		const x = Math.min(this.barwidth, this.dom.scale(this.markedValue))

		this.dom.line.attr('x1', x).attr('x2', x)
		this.dom.label.attr('x', x).text(Math.floor(this.markedValue))
	}

	updateScale() {
		this.updateColors()
		this.updateAxis()
		this.updateValueInColorBar()
	}
}
