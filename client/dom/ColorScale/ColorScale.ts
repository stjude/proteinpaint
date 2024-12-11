import type { SvgSvg, SvgG } from '../../types/d3'
import type { ColorScaleDom, ColorScaleOpts, GradientElem, ColorScaleMenuOpts } from '../types/colorScale'
import { scaleLinear } from 'd3-scale'
import { axisBottom, axisTop } from 'd3-axis'
import { font } from '../../src/client'
import { axisstyle, niceNumLabels } from '#dom'
import { ColorScaleMenu } from './ColorScaleMenu'
// import { format } from 'd3-format'
// import { interpolateRgb } from 'd3-interpolate'
// import { decimalPlacesUntilFirstNonZero } from '#shared/roundValue.js'

export class ColorScale {
	dom: ColorScaleDom
	barheight: number
	barwidth: number
	domain: undefined | number[]
	colors: string[]
	cutoffMode?: 'auto' | 'fixed'
	default?: { min: number; max: number }
	data: number[]
	fontSize: number
	markedValue?: number | null
	menu?: ColorScaleMenu
	/** Purely for testing. Not used in the class but can be
	 * called independently of user click, if needed */
	setColorsCallback?: (val: string, idx: number) => void
	/** Purely for testing. Not used in the class but can be
	 * called independently of user click, if needed */
	setMinMaxCallback?: (f?: { cutoffMode: 'auto' | 'fixed'; min: number; max: number }) => void
	ticks: number
	tickSize: number
	tickValues: number[]
	topTicks: boolean

	constructor(opts: ColorScaleOpts) {
		this.barheight = opts.barheight || 14
		this.barwidth = opts.barwidth || 100
		this.colors = opts?.colors?.length ? opts.colors : ['white', 'red']
		this.data = opts.data
		this.fontSize = opts.fontSize || 10
		this.markedValue = opts.markedValue && opts.markedValue > 0.001 ? opts.markedValue : null
		this.ticks = opts.ticks || 5
		this.tickSize = opts.tickSize || 1
		this.topTicks = opts.topTicks || false
		this.domain = opts.domain

		this.validateOpts(opts)

		this.tickValues = niceNumLabels(opts.data)

		let scaleSvg: SvgSvg //
		if (opts.width || opts.height) {
			scaleSvg = opts.holder
				.append('svg')
				.attr('width', opts.width || 100)
				.attr('height', opts.height || 30)
		} else scaleSvg = opts.holder
		scaleSvg.attr('data-testid', 'sjpp-color-scale')
		let barG
		const position = opts.position || '0,0'
		if (opts.labels) {
			barG = this.renderLabels(scaleSvg, opts.labels, position)
		} else barG = scaleSvg.append('g').attr('transform', `translate(${position})`)
		const id = opts.id || Math.random().toString()

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
		this.render()

		if (opts.setColorsCallback || opts.setMinMaxCallback) {
			// Menu appearing on color bar click if callbacks are provided
			this.menu = this.renderMenu(opts, scaleSvg, barG)
		}
	}

	validateOpts(opts: ColorScaleOpts) {
		if (!opts.holder) throw new Error('No holder provided for #dom/ColorScale.')
		if (!opts.data || !opts.data.length) throw new Error('No data provided for #dom/ColorScale.')
		if (opts.data.length != this.colors.length)
			throw new Error('Data and color arrays for #dom/ColorScale must be the same length')
		if (opts.labels && (!opts.labels.left || !opts.labels.right))
			throw new Error('Missing a label for #dom/ColorScale.')
	}

	renderLabels(scaleSvg: SvgSvg, labels: { left: string; right: string }, position: string) {
		const addLabel = (text: string, x: number, y: number) => {
			return scaleSvg
				.append('text')
				.text(text)
				.attr('font-size', '.8em')
				.attr('opacity', 0.6)
				.attr('text-anchor', 'end')
				.attr('transform', `translate(${x}, ${y})`)
		}

		const [posX, posY] = position.split(',').map(Number)

		const leftLabel = addLabel(labels.left, posX, posY + 10)
		const leftBBox = leftLabel.node()!.getBBox()

		const startXPos = posX + leftBBox.x + leftBBox.width + 20
		const barGPos = `${startXPos}, ${posY}`
		const rightLabelX = startXPos + this.barwidth + 40
		const rightLabelY = posY + 10
		const barG = scaleSvg.append('g').attr('transform', `translate(${barGPos})`)
		addLabel(labels.right, rightLabelX, rightLabelY)
		const totalWidth = scaleSvg.node()!.getBBox().width + leftBBox.width
		scaleSvg.attr('width', totalWidth)

		return barG
	}

	getRange() {
		return this.tickValues.map((_, i) => {
			return this.barwidth * (i / (this.tickValues.length - 1))
		})
	}

	makeColorBar(gradient?: GradientElem) {
		const gradElem = gradient || this.dom.gradient
		for (const [idx, c] of this.colors.entries()) {
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
		if (this.topTicks === false) scaleAxis.attr('transform', `translate(0, ${this.barheight})`)
		const scale = scaleLinear().domain(this.tickValues).range(this.getRange())

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
			.attr('font-size', `${this.fontSize + 2}px`)
			.attr('y', this.barheight - 3)
			// Text easier to see on dark backgrounds
			.attr('fill', 'white')
			.attr('stroke', 'black')
			.attr('stroke-width', 0.3)

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

	renderMenu(opts: ColorScaleOpts, scaleSvg: SvgSvg, barG: SvgG) {
		const _opts: ColorScaleMenuOpts = {
			scaleSvg,
			barG,
			data: this.data,
			colors: this.colors,
			cutoffMode: opts.cutoffMode || 'auto'
		}
		if (opts.setColorsCallback)
			_opts.setColorsCallback = async (val, idx) => {
				if (!val || !isFinite(idx)) return
				await opts.setColorsCallback!(val, idx)
				this.updateColors()
			}
		if (opts.setMinMaxCallback)
			_opts.setMinMaxCallback = async obj => {
				if (!obj) return
				await opts.setMinMaxCallback!({
					cutoffMode: obj.cutoffMode,
					min: obj.min,
					max: obj.max
				})
				this.updateAxis()
			}
		const menu = new ColorScaleMenu(_opts)
		return menu
	}

	getAxis() {
		const axis = this.topTicks === true ? axisTop(this.dom.scale) : axisBottom(this.dom.scale)
		axis.ticks(this.ticks).tickSize(this.tickSize)
		return axis
	}

	updateColors() {
		this.dom.gradient.selectAll('stop').remove()
		this.makeColorBar()
	}

	updateAxis() {
		this.dom.scaleAxis.selectAll('*').remove()

		this.tickValues = niceNumLabels(this.data)
		this.dom.scale = scaleLinear().domain(this.tickValues).range(this.getRange())

		this.dom.scaleAxis
			.transition()
			.duration(400)
			.call(this.getAxis())
			//Transition sometimes removes the font size
			.selectAll('text')
			.attr('font-size', `${this.fontSize}px`)

		//The stroke may inherit 'currentColor' from opts.holder
		//This is a workaround to prevent the black line from appearing
		const pathElem = this.dom.scaleAxis.select('path').node()
		if (pathElem instanceof SVGPathElement) pathElem.style.stroke = 'none'
	}

	updateValueInColorBar() {
		if (!this.markedValue || this.topTicks == true) return
		if (!this.dom.line || !this.dom.label)
			throw new Error('Missing dom elements to update value in color bar in #dom/ColorScale.')

		const x = Math.min(this.barwidth, this.dom.scale(this.markedValue))
		this.dom.line.attr('x1', x).attr('x2', x)
		this.dom.label.attr('x', x).text(Math.floor(this.markedValue))

		// /**Determine if the text should be white or black based on the
		//  * background color.
		//  *
		//  * Code below passes npm run tsc, but fails on commit. Linters
		//  * contradict each other on how to resolve. */
		// //eslint-disable-next-line @typescript-eslint/no-explicit-any
		// const colorInt = interpolateRgb.apply(null, this.colors)
		// const color = colorInt(x)
		// if (color) {
		// 	const colorMap = color.match(/\d+/g)?.map(Number)
		// 	const [r, g, b] = colorMap.map(v => v / 255)
		// 	const contrast = 0.2126 * r + 0.7152 * g + 0.0722 * b
		// 	if (contrast < 0.5) this.dom.label.attr('fill', 'white').attr('stroke', 'black').attr('stroke-width', 0.3)
		// 	else this.dom.label.attr('fill', 'black').attr('stroke', 'none')
		// }
	}

	updateMenu() {
		if (!this.menu) return
		this.menu.colors = this.colors
		this.menu.data = this.data
	}

	updateScale() {
		if (this.data.length != this.colors.length)
			throw new Error('Data and color arrays for #dom/ColorScale must be the same length')
		this.updateColors()
		this.updateAxis()
		this.updateValueInColorBar()
		this.updateMenu()
	}
}
