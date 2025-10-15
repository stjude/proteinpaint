import type { TermSetting } from '../TermSetting.ts'
import type { NumRegularBin, NumCustomBins, NumCont, NumSpline } from '#tw'
import type { NumericHandler } from './NumericHandler.ts'
import type { NumericBin } from '#types'
import { violinRenderer } from '#dom'
import { select, pointer, type BaseType } from 'd3-selection'
import { scaleLinear, drag as d3drag } from 'd3'
//import { get_bin_label, get_bin_range_equation } from '#shared/termdb.bins.js'

export type BoundaryValue = {
	x: number
	isDraggable: boolean
}

type LineData = {
	x: any
	index: number
	scaledX: number
	isDraggable?: boolean
	draggedX?: number
	start?: number
	end?: number
	value?: number
}

type BrushEntry = {
	//No documentation!
	orig: string
	range: {
		start: number
		stop: number
	}
	init: () => void
}

export class NumericDensity {
	handler: NumericHandler
	termsetting: TermSetting
	opts: any // TODO
	tw: NumRegularBin | NumCustomBins | NumCont | NumSpline

	dom: {
		[name: string]: any
	} = {}

	vr!: violinRenderer
	density_data!: any
	ranges: NumericBin[] = []
	no_density_data = false
	brushes: any[] = []
	xscale!: any
	plot_size: {
		width: number
		height: number
		xpad: number
		ypad: number
		radius: number
	} = {
		width: 500,
		height: 100,
		xpad: 10,
		ypad: 20,
		radius: 8
	}

	constructor(opts, handler) {
		this.handler = handler
		this.opts = opts
		this.termsetting = opts.termsetting
		this.tw = opts.termsetting.tw
	}

	async setData() {
		if (this.density_data) return this.density_data
		const self = this.termsetting
		this.density_data = await self.vocabApi.getViolinPlotData(
			{
				tw: { term: self.term, q: self.q },
				svgw: this.plot_size.width,
				radius: this.plot_size.radius,
				filter: self.filter
			},
			self.opts.getBodyParams?.()
		)
		return this.setData()
	}

	async showViolin(div, boundaries?) {
		div.style('padding', '5px').selectAll('*').remove()

		const loadingDiv = div
			.append('div')
			.style('padding', '10px')
			.style('text-align', 'center')
			.html('Getting distribution data ...<br/>')

		const densityDiv = div.append('div')
		await this.setData()
		loadingDiv.remove()

		this.vr = new violinRenderer({
			holder: densityDiv,
			rd: this.density_data,
			width: this.plot_size.width,
			height: this.plot_size.height,
			radius: this.plot_size.radius
		})

		this.dom.svg = this.vr.svg
		this.vr.render()
		if (boundaries) await this.setBinLines(boundaries)

		return this.density_data
	}

	async setBinLines(boundaries) {
		if (this.density_data.max == this.density_data.min) {
			this.handleNoDensity()
			this.brushes.forEach((brush: BrushEntry) => {
				if (brush.range.stop > this.density_data.min) brush.init()
			})
		} else {
			// svg for range plot
			// const div = self.q.mode == 'spline' ? self.dom.knots_div : self.dom.bins_div
			//this.vr.render()

			// add binsize_g for termsetting lines
			if (!this.dom.binsize_g)
				this.dom.binsize_g = this.dom.svg
					.append('g')
					.attr('transform', `translate(${this.plot_size.xpad}, ${this.plot_size.ypad})`)
					.attr('class', 'binsize_g')

			const maxvalue = this.density_data.max
			const minvalue = this.density_data.min

			this.xscale = scaleLinear()
				.domain([minvalue, maxvalue])
				.range([this.plot_size.xpad, this.plot_size.width + this.plot_size.xpad])

			this.ranges = []
			this.brushes = []
			this.renderBinLines(boundaries)
		}
	}

	handleNoDensity() {
		this.no_density_data = true
		this.ranges = []
		// const self = this.termsetting
		// if ('type' in self.q) {
		// 	if (self.q.type == 'regular-bin') {
		// 		if (self.q.first_bin) {
		// 			this.ranges.push(self.q.first_bin)
		// 			//this.ranges[0].bin = 'first'
		// 		}
		// 		if (self.q.last_bin) {
		// 			this.ranges.push(self.q.last_bin)
		// 			//this.ranges[1].bin = 'last'
		// 		}
		// 	}
		// }
		this.brushes = []
		//const brushes = this.brushes

		// if (!this.custom_bins_q) {
		// 	/* when custom_bins_q is undefined, do not run below as a quick fix not to break
		// 	FIXME where is this created and purpose?
		// 	*/
		// 	return
		// }

		// for (const r of this.ranges.values()) {
		// 	const _b = brushes.find((b: BrushEntry) => b.orig === r)
		// 	let brush
		// 	if (!_b) {
		// 		brush = { orig: r, range: JSON.parse(JSON.stringify(r)) }
		// 		brushes.push(brush)
		// 	} else {
		// 		brush = _b
		// 	}

		// 	const custom_bins_q = this.custom_bins_q
		// 	const maxvalue = this.density_data!.max
		// 	const minvalue = this.density_data!.min

		// 	const custom_bins = custom_bins_q.lst || []

		// 	if (custom_bins.length == 0) {
		// 		const mean_value = (maxvalue + minvalue) / 2
		// 		const first_bin = {
		// 			startunbounded: true,
		// 			stop: mean_value,
		// 			stopinclusive: true,
		// 			name: 'First bin'
		// 		}
		// 		const last_bin = {
		// 			start: mean_value,
		// 			stopunbounded: true,
		// 			startinclusive: false,
		// 			name: 'Last bin'
		// 		}
		// 		custom_bins.push(first_bin)
		// 		custom_bins.push(last_bin)
		// 		this.custom_bins_q.lst = custom_bins
		// 	}
		// }
	}

	renderBinLines(data: BoundaryValue[]) {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const o = this
		if (!this.density_data) throw `Missing .density_data [density.ts, renderBinLines()]`
		const scaledMinX = Math.round(this.xscale(o.density_data.min)) //as number
		const scaledMaxX = Math.round(this.xscale(o.density_data.max)) //as number
		const lines: any[] = []
		for (const [index, v] of data.entries()) {
			lines.push({ x: v.x, index, scaledX: Math.round(this.xscale(v.x)), isDraggable: v.isDraggable })
		}

		//const self = this.handler.tw
		console.log(222, this.dom.binsize_g.node().querySelectorAll('line'))
		this.dom.binsize_g.selectAll('line').remove()
		const lastVisibleLine =
			lines.length == 1
				? lines[0]
				: lines
						.slice()
						.reverse()
						.find((d: LineData) => d.scaledX < scaledMaxX)
		let lastScaledX = lastVisibleLine ? Math.min(scaledMaxX, lastVisibleLine.scaledX) : (scaledMaxX as number)
		this.dom.binsize_g
			.selectAll('line')
			.data(lines)
			.enter()
			.append('line')
			.style('stroke', (d: LineData) => (d.isDraggable ? '#cc0000' : '#555'))
			.style('stroke-width', 1)
			.attr('x1', (d: LineData) => d.scaledX)
			.attr('y1', 0)
			.attr('x2', (d: LineData) => d.scaledX)
			.attr('y2', o.plot_size.height)
			.style('cursor', (d: LineData) => (d.isDraggable ? 'ew-resize' : ''))
			.style('display', (d: LineData) => (!d.isDraggable && d.scaledX > lastScaledX ? 'none' : ''))
			.on('mouseover', function (this: BaseType, d: LineData) {
				if (o.tw.q.type != 'regular-bin' || d.isDraggable) select(this).style('stroke-width', 3)
			})
			.on('mouseout', function (this: BaseType) {
				select(this).style('stroke-width', 1)
			})
			.each(function (this: Element, d: LineData) {
				if (d.isDraggable) {
					const dragger = d3drag().on('drag', dragged).on('end', dragend)
					select(this).call(dragger)
				}
			})

		const middleLines = this.dom.binsize_g.selectAll('line').filter((d: LineData) => !d.isDraggable)

		function dragged(this: any, event: PointerEvent, b: any) {
			const self = o.handler.tw
			const draggedX: number = pointer(event, this)[0]
			if (draggedX <= scaledMinX || draggedX >= scaledMaxX) return
			const line =
				self.q.type == 'regular-bin'
					? select(this)
					: b.index > 0 && draggedX <= lines[b.index - 1].scaledX
					? select(this.previousSibling)
					: b.index < lines.length - 1 && draggedX >= lines[b.index + 1].scaledX
					? select(this.nextSibling)
					: select(this)

			const d = line.datum() as LineData

			d.draggedX = draggedX
			line.attr('x1', d.draggedX).attr('y1', 0).attr('x2', d.draggedX).attr('y2', o.plot_size.height)

			const inverted = +this.xscale.invert(d.draggedX)
			const value = self.term.type == 'integer' ? Math.round(inverted) : inverted.toFixed(3)

			if (self.q.mode == 'discrete' && self.q.type == 'regular-bin') {
				//d.scaledX = Math.round(o.xscale(value))
				if (d.index === 0) {
					o.handler.dom.first_stop_input.property('value', value)
					const maxX = self.q.last_bin ? lastScaledX : scaledMaxX
					const diff = d.draggedX - d.scaledX
					middleLines.each(function (this: Element, c: LineData) {
						c.draggedX = c.scaledX + diff
						select(this)
							.attr('x1', c.draggedX)
							.attr('y1', 0)
							.attr('x2', c.draggedX)
							.attr('y2', o.plot_size.height)
							.style('display', (c: any) => (c.draggedX >= maxX ? 'none' : ''))
					})
					self.q.first_bin!.stop = value as number
				} else {
					o.handler.dom.last_start_input.property('value', value)
					self.q.last_bin!.start = value as number
					middleLines.style('display', (c: any) => (d.draggedX && c.scaledX >= d.draggedX ? 'none' : ''))
				}
			} else if ((self.q.mode == 'discrete' && self.q.type == 'custom-bin') || self.q.mode == 'binary') {
				// self.q.lst![d.index + 1].start = value as number
				// self.q.lst![d.index + 1].label = get_bin_label(self.q.lst![d.index + 1], self.q)
				// self.q.lst![d.index + 1].range = get_bin_range_equation(self.q.lst![d.index + 1], self.q)
				// self.q.lst![d.index].stop = value as number
				// self.q.lst![d.index].label = get_bin_label(self.q.lst![d.index], self.q)
				// self.q.lst![d.index].range = get_bin_range_equation(self.q.lst![d.index], self.q)
				// if (o.handler.dom.customBinBoundaryInput) {
				// 	// this is created by binary.js when mode=binary
				// 	// quick fix: while dragging, revert from percentile to normal, as it's hard to update percentile values
				// 	self.q.modeBinaryCutoffType = 'normal'
				// 	if (o.handler.dom.customBinBoundaryPercentileCheckbox) {
				// 		o.handler.dom.customBinBoundaryPercentileCheckbox.property('checked', false)
				// 	}
				// 	o.handler.dom.customBinBoundaryInput.property(
				// 		'value',
				// 		self.q
				// 			.lst!.slice(1)
				// 			.map((d: any) => d.start)
				// 			.join('\n')
				// 	)
				// }
				// if (o.handler.dom.customBinLabelInput) {
				// 	o.handler.dom.customBinLabelInput.property('value', (c: any) => c.label)
				// }
				// if (o.handler.dom.customBinRanges) {
				// 	o.handler.dom.customBinRanges.html((c: any) => c.range)
				// }
			} else if (self.q.mode == 'spline') {
				//self.q.knots[d.index].value = value
				if (o.handler.dom.customKnotsInput) {
					o.handler.dom.customKnotsInput.property('value', self.q.knots.map((d: any) => d.value).join('\n'))
				}
			} else {
				throw 'Dragging not allowed for this term type'
			}
		}

		function dragend(this: any, event: DragEvent, b: any) {
			const self = o.tw
			const draggedX = pointer(event, this)[0]
			const line =
				self.q.type == 'regular-bin'
					? select(this)
					: b.index > 0 && draggedX <= lines[b.index - 1].scaledX
					? select(this.previousSibling)
					: b.index < lines.length - 1 && draggedX >= lines[b.index + 1].scaledX
					? select(this.nextSibling)
					: select(this)
			const d = line.datum() as LineData

			d.scaledX = d.draggedX as number
			d.x = +this.xscale.invert(d.draggedX).toFixed(self.term.type == 'integer' ? 0 : 3)
			if (self.q.mode == 'discrete' && self.q.type == 'regular-bin') {
				if (d.index === 0) {
					self.q.first_bin!.stop = d.x
					middleLines.each((d: LineData) => {
						d.scaledX = d.draggedX as number
						d.x = +this.xscale.invert(d.draggedX).toFixed(self.term.type == 'integer' ? 0 : 3)
					})
				} else {
					self.q.last_bin!.start = d.x
				}
				lastScaledX = lines
					.slice()
					.reverse()
					.find((d: LineData) => d.scaledX < scaledMaxX).scaledX
			} else if (self.q.mode == 'discrete' && self.q.type == 'custom-bin') {
				// self.q.lst![d.index + 1].start = d.x
				// self.q.lst![d.index].stop = d.x
			} else if (self.q.mode == 'spline') {
				self.q.knots[d.index].value = d.x
			}
		}
	}
}
