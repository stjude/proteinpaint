import { scaleLinear } from 'd3-scale'
import { Div, Elem } from '../types/d3'

type ColorScaleOpts = {
	g: any
	gradientLeft: any
	gradientRight: any
	/** Color shown on the left, start of the scale */
	leftColor: string
	/** Color shown on the right, end of the scale */
	rightColor: string
	bar: any //dom
	scale: any //dom
	tick_mincutoff: any
	axisg: any
	label_mincutoff: any
}

/**
 * Intended to be a reusable color scale throughout platform. Work in progress.
 */
export class ColorScale {
	barheight: number
	barwidth: number
	colorScale: Partial<ColorScaleOpts>
	holder: Elem | Div
	space: number
	tickPosition: 'top' | 'bottom'

	constructor(opts: any) {
		this.barheight = opts.barheight || 14
		this.barwidth = opts.barwidth
		this.colorScale = {
			leftColor: opts.leftColor || 'white',
			rightColor: opts.rightColor || 'red'
		}
		this.holder = opts.holder
		this.space = 1
		this.tickPosition = opts.tickPosition
	}

	render() {
		const scaleSvg = this.holder.append('svg').attr('width', 100).attr('height', 20)
		this.colorScale.g = scaleSvg.append('g').attr('transform', 'translate(0, 0)')

		const defs = this.colorScale.g.append('defs')
		const id = Math.random().toString()
		const gradient = defs.append('linearGradient').attr('id', id)
		//Anticipating implementing a color picker in the future
		this.colorScale.gradientLeft = gradient
			.append('stop')
			.attr('offset', 0)
			.attr('stop-color', this.colorScale.leftColor)
		this.colorScale.gradientRight = gradient
			.append('stop')
			.attr('offset', 1)
			.attr('stop-color', this.colorScale.rightColor)

		this.colorScale.bar = this.colorScale.g
			.append('rect')
			.attr('height', this.barheight)
			.attr('width', this.barwidth)
			.attr('fill', 'url(#' + id + ')')
		this.colorScale.axisg = this.colorScale.g
			.append('g')
			.attr('transform', `translate(0, ${this.barheight + this.space})`)
		this.colorScale.scale = scaleLinear().range([0, this.barwidth])

		// min cutoff indicator
		this.colorScale.tick_mincutoff = this.colorScale.g
			.append('line')
			.attr('y1', this.barheight + this.space - 3)
			.attr('y2', this.barheight + this.space)
		this.colorScale.label_mincutoff = this.colorScale.g
			.append('text')
			.attr('text-anchor', 'middle')
			.attr('font-size', '1em')
			.attr('y', this.barheight + this.space - 4)
	}

	updateColors() {
		//TODO: implement
	}

	updateTicks() {
		//TODO: implement
	}

	updateScale() {
		this.updateColors()
		this.updateTicks()
	}
}
