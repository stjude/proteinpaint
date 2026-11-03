import type { DotSizeScaleOpts } from './types/DotSizeScale'
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

export class DotSizeScale {
	g: SvgG
	inputMax: number
	inputMin: number
	isAscending: boolean
	maxLabel: number
	maxRadius: number
	minLabel: number
	minRadius: number
	menu?: {
		minMaxLabel?: string
		showOrder?: boolean
		callback: (obj: { min: number; max: number; isAscending: boolean }) => void
	}
	title?: string
	readonly color = '#aaa'
	readonly shift = 20
	/** The least distance between the centers of the two circles, and the room between the circles at the least */
	readonly minWidth = 70
	readonly circleGap = 10
	/** The room that a label needs */
	readonly labelWidth = 30
	readonly bottomPad = 15
	readonly tip = new Menu({ padding: '5px' })
	/** When set by the caller, the position of the center of the first circle. Otherwise it follows the radii. */
	readonly optsX?: number
	readonly optsY?: number

	constructor(opts: DotSizeScaleOpts) {
		this.validateOpts(opts)
		this.g = opts.g
		this.inputMax = opts.inputMax
		this.inputMin = opts.inputMin
		this.isAscending = opts.isAscending ?? true
		this.maxLabel = opts.maxLabel ?? opts.maxRadius
		this.maxRadius = opts.maxRadius
		this.minLabel = opts.minLabel ?? opts.minRadius
		this.minRadius = opts.minRadius
		this.optsX = opts.x
		this.optsY = opts.y

		if (opts.menu) this.menu = opts.menu
		if (opts.title) this.title = opts.title

		this.renderLegendComponent()
	}

	/** Where things are, for the radii as they are now. The circles follow the radii, as they can be
	 * set by the user: the second circle is far enough from the first not to cover it, and both are
	 * far enough from the top and left for the title, labels and circles to stay inside the svg. */
	getLayout() {
		const first = this.isAscending ? this.minRadius : this.maxRadius
		const last = this.isAscending ? this.maxRadius : this.minRadius
		const width = Math.max(this.minWidth, first + last + this.circleGap)
		const x = this.optsX ?? Math.max(40, first + this.shift)
		const y = this.optsY ?? Math.max(40, Math.max(this.minRadius, this.maxRadius) + 10)
		return { x, y, width, first, last }
	}

	/** The size of the svg that holds the whole reference: the circles and the labels at the left and right.
	 * The bottom is the lower edge of the largest circle. The title is above the group, at its origin. */
	getDimensions() {
		const { x, y, width, last } = this.getLayout()
		return {
			width: x + width + last + this.shift + this.labelWidth,
			height: y + Math.max(this.minRadius, this.maxRadius) + this.bottomPad
		}
	}

	validateOpts(opts: DotSizeScaleOpts) {
		if (!opts.g) throw `Missing g in LegendCircleReference`
		if (opts.maxRadius > opts.inputMax) throw `Max radius must be less than inputMax`
		if (opts.minRadius < opts.inputMin) throw `Min radius must be greater than inputMin`
	}

	renderLegendComponent() {
		this.g.selectAll('*').remove()

		if (this.title) this.g.append('text').style('font-weight', 'bold').style('font-size', '0.8em').text(this.title)

		const { x, y, width } = this.getLayout()
		const minG = this.g.append('g').attr('transform', `translate(${x},${y})`)
		const maxG = this.g.append('g').attr('transform', `translate(${x + width},${y})`)

		//Starting text and circle element
		const startRadius = this.isAscending ? this.minRadius : this.maxRadius
		this.renderLabel(minG, -startRadius - this.shift, this.isAscending ? this.minLabel : this.maxLabel)
		this.renderReferenceCircle(minG, startRadius)

		//Ending text and circle element
		const endRadius = this.isAscending ? this.maxRadius : this.minRadius
		this.renderReferenceCircle(maxG, endRadius)
		this.renderLabel(maxG, endRadius + this.shift, this.isAscending ? this.maxLabel : this.minLabel)

		//Lines connecting the top and bottom of the circles
		this.renderScalingLine(minG, this.minRadius, this.maxRadius, width)
		this.renderScalingLine(minG, -this.minRadius, -this.maxRadius, width)

		const minBBox = minG.node()!.getBBox()
		const maxBBox = maxG.node()!.getBBox()

		if (this.menu) {
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

	renderScalingLine(g: SvgG, minRadius: number, maxRadius: number, width: number) {
		g.append('line')
			.attr('x1', 0)
			.attr('y1', this.isAscending ? minRadius : maxRadius)
			.attr('x2', width)
			.attr('y2', this.isAscending ? maxRadius : minRadius)
			.style('stroke', this.color)
	}

	renderMenu() {
		if (!this.menu) return
		this.tip.clear().showunder(this.g.node())
		const div = this.tip.d.append('div')
		const minMaxRow = div.append('div')
		if (this.menu?.minMaxLabel)
			minMaxRow
				.append('span')
				.style('padding-right', '10px')
				.style('opacity', 0.7)
				.style('font-size', '.8em')
				.text(`${this.menu.minMaxLabel.toUpperCase()}`)

		this.addInput(minMaxRow, 'Min', this.minRadius)
		this.addInput(minMaxRow, 'Max', this.maxRadius)

		if (this.menu.showOrder) {
			const orderRow = div.append('div')
			make_radios({
				holder: orderRow,
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
					if (!this.menu) return //so TS doesn't complain
					this.isAscending = value
					this.menu.callback({ min: this.minRadius, max: this.maxRadius, isAscending: this.isAscending })
					this.renderLegendComponent()
					this.tip.hide()
				}
			})
		}
	}

	addInput(div: Div, label: string, value: number) {
		div.append('label').text(label)
		const input = div
			.append('input')
			.style('width', '50px')
			.attr('type', 'number')
			.attr('min', this.inputMin)
			.attr('max', this.inputMax)
			.attr('value', value)
			.on('change', () => {
				if (!this.menu) return //so TS doesn't complain
				const value = input.property('value')
				this[`${label.toLowerCase()}Radius`] = Number(value)
				this.menu.callback({ min: this.minRadius, max: this.maxRadius, isAscending: this.isAscending })
				this.renderLegendComponent()
				this.tip.hide()
			})
	}
}
