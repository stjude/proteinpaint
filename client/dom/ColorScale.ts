import { ScaleLinear, scaleLinear } from 'd3-scale'
import { rgb } from 'd3-color'
import { axisBottom, axisTop } from 'd3-axis'
import { Selection } from 'd3-selection'
import { font } from '../src/client'
import { Menu, axisstyle } from '#dom'
import { Elem, SvgG } from '../types/d3'

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
	/** If present, creates a menu on click to change the colors */
	callback?: (val: string, idx: number) => void
	/** Optional but highly recommend. Default is a white to red scale.
	 * The length of the array must match the data array. */
	colors?: string[]
	/** Required . Specifies the values to show along a number line. The length
	 * of the array must match the colors array. */
	data: number[]
	/** Optional. Font size in px of the text labels. Default is 10. */
	fontSize?: number
	/** Required. Either a div or svg element.
	 * If not a svg, include either the .width: INT or .height:INT to create the svg.*/
	holder: Elem
	/** id for the linearGradiant elem */
	id?: string
	/** Optional. Shows a value in the color bar for the default, bottom axis
	 * This value cannot be zero at initialization.*/
	markedValue?: number
	/** Set the position within in the element. Default is 0,0 */
	position?: string
	/** If the holder is not an svg or g element, adding the width or height creates the svg. */
	/** Optional. Width of the svg. Default is 100. */
	width?: number
	/** Optional. Height fo the svg. Default is 30.*/
	height?: number
	/** Creates inputs for the user to set the min and max colors
	 * Use the callback to update the plot/track/app/etc.
	 */
	setMinMax?: (f?: { min: number; max: number }) => void
	/** Optional. Suggested number of ticks to show. Cannot be zero. Default is 5.
	 * NOTE: D3 considers this a ** suggested ** count. d3-axis will ultimateluy render the
	 * ticks based on the available space of each label.
	 * See d3 documentation for more info: https://d3js.org/d3-axis#axis_ticks.
	 */
	ticks?: number
	/** Optional. Size of the ticks in px. Default is 1. */
	tickSize?: number
	/** Optional. Placement of numbered ticks. Default is false (i.e. placement
	 * below the color bar). */
	topTicks?: boolean
}

export class ColorScale {
	dom: ColorScaleDom
	barheight: number
	barwidth: number
	/** Purely for testing. Not used in the class but can be
	 * called independently of user click, if needed */
	callback: ((val: string, idx: number) => void) | null
	colors: string[]
	data: number[]
	fontSize: number
	markedValue?: number | null
	/** Purely for testing. Not used in the class but can be
	 * called independently of user click, if needed */
	setMinMax: ((f?: { min: number; max: number }) => void) | null
	ticks: number
	tickSize: number
	tip: Menu
	topTicks: boolean

	constructor(opts: ColorScaleOpts) {
		this.barheight = opts.barheight || 14
		this.barwidth = opts.barwidth || 100
		this.callback = opts.callback || null
		this.colors = opts.colors || ['white', 'red']
		this.data = opts.data
		this.fontSize = opts.fontSize || 10
		this.markedValue = opts.markedValue && opts.markedValue > 0.001 ? opts.markedValue : null
		this.setMinMax = opts.setMinMax || null
		this.ticks = opts.ticks || 5
		this.tickSize = opts.tickSize || 1
		this.tip = new Menu({ padding: '2px' })
		this.topTicks = opts.topTicks || false

		if (!opts.holder) throw new Error('No holder provided for #dom/ColorScale.')
		if (!opts.data) throw new Error('No data provided for #dom/ColorScale.')
		if (opts.data.length != this.colors.length)
			throw new Error('Data and color arrays for #dom/ColorScale must be the same length')

		this.formatData()

		let scaleSvg
		if (opts.width || opts.height) {
			scaleSvg = opts.holder
				.append('svg')
				.attr('width', opts.width || 100)
				.attr('height', opts.height || 30)
		} else scaleSvg = opts.holder
		scaleSvg.attr('data-testid', 'sjpp-color-scale')

		const barG = scaleSvg.append('g').attr('transform', `translate(${opts.position || '0,0'})`)
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

		if (opts.callback || opts.setMinMax) {
			const appendInputs = (text: string, cIdx: number, dIdx: number) => {
				const wrapper = this.tip.d.append('div').style('display', 'inline-block').style('text-align', 'center')

				wrapper
					.append('div')
					.style('display', 'inline-block')
					.style('vertical-align', 'text-bottom')
					.style('padding-bottom', '2px')
					.style('padding-left', text.includes('Max') ? '10px' : '3px')
					.text(text)

				const valueInput = wrapper.append('div').style('display', 'inline-block').style('vertical-align', 'bottom')
				const colorInput = wrapper.append('div').style('display', 'inline-block')

				if (opts.setMinMax) appendValueInput(valueInput, dIdx)
				if (opts.callback) appendColorInput(colorInput, cIdx)
			}

			const appendColorInput = (wrapper: any, idx: number) => {
				const colorInput = wrapper
					.append('input')
					.attr('type', 'color')
					.attr('value', rgb(this.colors[idx]).formatHex())
					.on('change', async () => {
						const color = colorInput.node()!.value
						this.colors[idx] = color
						await opts.callback!(color, idx)
						this.updateColors()
						this.tip.hide()
					})
			}

			const appendValueInput = (wrapper: any, idx: number) => {
				const divWrapper = wrapper.append('div').style('padding-bottom', '2px')
				const valueInput = divWrapper
					.append('input')
					.attr('type', 'number')
					.style('width', '50px')
					.attr('value', this.data[idx])
					.style('padding', '1px')
					.on('keyup', async (event: KeyboardEvent) => {
						if (event.code != 'Enter') return
						const value: number = parseFloat(valueInput.node().value)
						this.data[idx] = value
						if (opts.setMinMax) await opts.setMinMax({ min: this.data[0], max: this.data[this.data.length - 1] })
						this.updateAxis()
						this.tip.hide()
					})
			}

			let showTooltip = true
			scaleSvg
				.on('click', () => {
					this.tip.clear().showunder(barG.node())
					appendInputs('Min:', 0, 0)
					appendInputs('Max:', this.colors.length - 1, this.data.length - 1)
					showTooltip = false
				})
				.on('mouseenter', () => {
					//Prevent showing the tooltip after user interacts with the color picker
					if (showTooltip == false) return
					this.tip.clear().showunder(barG.node())
					const text = `Click to customize ${opts.callback ? 'colors' : ''} ${
						opts.setMinMax && opts.callback ? ' and ' : ''
					}${opts.setMinMax ? 'values' : ''}`
					this.tip.d.append('div').style('padding', '2px').text(text)
				})
				.on('mouseleave', () => {
					if (showTooltip) this.tip.hide()
				})
		}
		this.render()
	}

	formatData() {
		this.data = this.data.map(d => Number(d.toFixed(2)))
	}

	getRange() {
		return this.data.map((_, i) => {
			return this.barwidth * (i / (this.data.length - 1))
		})
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
		if (this.topTicks === false) scaleAxis.attr('transform', `translate(0, ${this.barheight})`)
		const scale = scaleLinear().domain(this.data).range(this.getRange()).clamp(true)

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

	updateColors() {
		this.dom.gradient.selectAll('stop').remove()
		this.makeColorBar()
	}

	updateAxis() {
		this.formatData()
		this.dom.scaleAxis.selectAll('*').remove()
		// const start = this.data[0]
		// const stop = this.data[this.data.length - 1]

		// if (start < 0 && stop > 0 && this.data.indexOf(0) == -1) {
		// 	this.data.splice(this.data.length / 2, 0, 0)
		// }

		this.dom.scale = scaleLinear().domain(this.data).range(this.getRange())

		this.dom.scaleAxis
			.transition()
			.duration(400)
			.call(this.getAxis())
			//Transition sometimes removes the font size
			.selectAll('text')
			.attr('font-size', `${this.fontSize}px`)
	}

	updateValueInColorBar() {
		if (!this.markedValue || this.topTicks == true) return
		if (!this.dom.line || !this.dom.label)
			throw new Error('Missing dom elements to update value in color bar in #dom/ColorScale.')

		const x = Math.min(this.barwidth, this.dom.scale(this.markedValue))

		this.dom.line.attr('x1', x).attr('x2', x)
		this.dom.label.attr('x', x).text(Math.floor(this.markedValue))
	}

	updateScale() {
		if (this.data.length != this.colors.length)
			throw new Error('Data and color arrays for #dom/ColorScale must be the same length')
		this.updateColors()
		this.updateAxis()
		this.updateValueInColorBar()

		//The stroke may inherit 'currentColor' from opts.holder
		//This is a workaround to prevent the black line from appearing
		const pathElem = this.dom.scaleAxis.select('path').node()
		if (pathElem instanceof SVGPathElement) pathElem.style.stroke = 'none'
	}
}
