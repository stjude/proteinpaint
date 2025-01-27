import type { LegendCircleReferenceOpts } from './types/LegendCircleReference'
import type { Div, SvgG } from '../types/d3'
import { Menu, make_radios } from '#dom'

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
	inputMax: number
	inputMin: number
	isAscending: boolean
	maxRadius: number
	minRadius: number
	prompt?: string
	title?: string
	dotScaleCallback?: (isAscending: boolean) => void
	minMaxCallback?: (min: number, max: number) => void
	readonly color = '#aaa'
	readonly shift = 20
	readonly width = 70
	readonly tip = new Menu({ padding: '5px' })
	readonly x = 40
	readonly y = 40
	constructor(opts: LegendCircleReferenceOpts) {
		this.validateOpts(opts)
		this.g = opts.g
		this.inputMax = opts.inputMax
		this.inputMin = opts.inputMin
		this.isAscending = opts.isAscending ?? true
		this.maxRadius = opts.maxRadius
		this.minRadius = opts.minRadius

		if (opts.prompt) this.prompt = opts.prompt
		if (opts.title) this.title = opts.title
		if (opts.dotScaleCallback) this.dotScaleCallback = opts.dotScaleCallback
		if (opts.minMaxCallback) this.minMaxCallback = opts.minMaxCallback

		this.renderLegendComponent()
	}

	validateOpts(opts: LegendCircleReferenceOpts) {
		if (!opts.g) throw `Missing g in LegendCircleReference`
		if (opts.maxRadius > opts.inputMax) throw `Max radius must be less than inputMax`
		if (opts.minRadius < opts.inputMin) throw `Min radius must be greater than inputMin`
	}

	renderLegendComponent() {
		this.g.selectAll('*').remove()

		if (this.title)
			this.g
				.append('text')
				.style('font-weight', 'bold')
				.attr('transform', `translate(${this.x},${this.y - this.maxRadius - 15})`)
				.text(this.title)

		const minG = this.g.append('g').attr('transform', `translate(${this.x},${this.y})`)
		const maxG = this.g.append('g').attr('transform', `translate(${this.x + this.width},${this.y})`)

		//Starting text and circle element
		const startRadius = this.isAscending ? this.minRadius : this.maxRadius
		this.renderLabel(minG, -startRadius - this.shift, this.minRadius)
		this.renderReferenceCircle(minG, startRadius)

		//Ending text and circle element
		const endRadius = this.isAscending ? this.maxRadius : this.minRadius
		this.renderReferenceCircle(maxG, endRadius)
		this.renderLabel(maxG, endRadius + this.shift, this.maxRadius)

		//Lines connecting the top and bottom of the circles
		this.renderScalingLine(minG, this.minRadius, this.maxRadius)
		this.renderScalingLine(minG, -this.minRadius, -this.maxRadius)

		const minBBox = minG.node()!.getBBox()
		const maxBBox = maxG.node()!.getBBox()

		if (this.dotScaleCallback || this.minMaxCallback) {
			this.g
				.append('rect')
				.attr('width', minBBox.width + maxBBox.width)
				.attr('height', (this.isAscending ? maxBBox.height : minBBox.height) + 20)
				.attr('fill', 'transparent')
				.on('click', () => {
					this.renderMenu()
				})
		}
	}

	renderReferenceCircle(g: SvgG, radius: number) {
		g.append('circle')
			.style('fill', this.color)
			.style('stroke', this.color)
			.attr('cx', 0)
			.attr('cy', 0)
			.attr('r', radius)
	}

	renderLabel(g: SvgG, x: number, text: number) {
		g.append('text').attr('x', x).attr('y', 5).style('font-size', '.8em').text(text)
	}

	renderScalingLine(g: SvgG, minRadius: number, maxRadius: number) {
		g.append('line')
			.attr('x1', 0)
			.attr('y1', this.isAscending ? minRadius : maxRadius)
			.attr('x2', this.width)
			.attr('y2', this.isAscending ? maxRadius : minRadius)
			.style('stroke', this.color)
	}

	renderMenu() {
		this.tip.clear().showunder(this.g.node())
		const div = this.tip.d.append('div')
		if (this.minMaxCallback) {
			const minMaxRow = div.append('div')
			if (this.prompt) minMaxRow.append('span').text(`${this.prompt}: `).style('padding-right', '3px')

			this.addInput(minMaxRow, 'Min', this.minRadius, this.minMaxCallback)
			this.addInput(minMaxRow, 'Max', this.maxRadius, this.minMaxCallback)
		}
		if (this.dotScaleCallback) {
			const dotScaleRow = div.append('div')
			make_radios({
				holder: dotScaleRow,
				options: [
					{
						checked: this.isAscending,
						label: 'Ascending',
						title: 'Show in ascending order',
						value: true
					},
					{
						checked: !this.isAscending,
						label: 'Descending',
						title: 'Show in descending order',
						value: false
					}
				],
				callback: value => {
					this.isAscending = value
					this.dotScaleCallback!(this.isAscending)
					this.renderLegendComponent()
					this.tip.hide()
				}
			})
		}
	}

	addInput(div: Div, label: string, value: number, callback) {
		div.append('label').text(label)
		const input = div
			.append('input')
			.style('width', '50px')
			.attr('type', 'number')
			.attr('min', this.inputMin)
			.attr('max', this.inputMax)
			.attr('value', value)
			.on('change', () => {
				const value = input.property('value')
				this[`${label.toLowerCase()}Radius`] = Number(value)
				callback(this.minRadius, this.maxRadius)
				this.renderLegendComponent()
				this.tip.hide()
			})
	}
}
