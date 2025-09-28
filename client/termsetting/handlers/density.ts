import { select, pointer } from 'd3-selection'
import { scaleLinear, drag as d3drag } from 'd3'
import { get_bin_label, get_bin_range_equation } from '#shared/termdb.bins.js'
import type { BaseType } from 'd3-selection'
import type { NumericBin } from '#types'
/*
********************** EXPORTED
	setDensityPlot(self)
********************** INTERNAL
	handleNoDensity(self) // if maxvalue is same as minvalue
	renderBinLines() // render binlines on top of densityplot based on term mode

*/

// this is violin route return
export type DensityData = {
	max: number
	min: number
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

type NumberObj = {
	binsize_g?: any //dom element??
	brushes: BrushEntry[]
	custom_bins_q: any
	density_data: DensityData
	no_density_data: true
	plot_size: {
		width: number
		height: number
		xpad: number
		ypad: number
	}
	ranges?: NumericBin[]
	svg: any
	xscale: any
}

export async function setDensityPlot(self) {
	if (!self.num_obj) throw `Missing density data [density.ts setDensityPlot()]`
	const numObj = self.num_obj as NumberObj
	if (numObj.density_data.max == numObj.density_data.min) {
		handleNoDensity(self)
		numObj.brushes.forEach((brush: BrushEntry) => {
			if (brush.range.stop > numObj.density_data.min) brush.init()
		})
	} else {
		// svg for range plot
		// const div = self.q.mode == 'spline' ? self.dom.knots_div : self.dom.bins_div
		self.vr.render()

		// add binsize_g for termsetting lines
		self.num_obj.binsize_g = self.num_obj.svg
			.append('g')
			.attr('transform', `translate(${numObj.plot_size.xpad}, ${numObj.plot_size.ypad})`)
			.attr('class', 'binsize_g')

		const maxvalue = numObj.density_data.max
		const minvalue = numObj.density_data.min

		self.num_obj.xscale = scaleLinear()
			.domain([minvalue, maxvalue])
			.range([numObj.plot_size.xpad, numObj.plot_size.width + numObj.plot_size.xpad])

		self.num_obj.ranges = []
		if (self.q.first_bin) {
			self.num_obj.ranges.push(self.q.first_bin)
			self.num_obj.ranges[0].bin = 'first'
		}
		if (self.q.last_bin) {
			self.num_obj.ranges.push(self.q.last_bin)
			self.num_obj.ranges[1].bin = 'last'
		}
		self.num_obj.brushes = []
		renderBinLines(self, self.q)
	}

	self.renderBinLines = renderBinLines
}

function handleNoDensity(self) {
	self.num_obj.no_density_data = true
	self.num_obj.ranges = []
	if (self.q.first_bin) {
		self.num_obj.ranges.push(self.q.first_bin)
		self.num_obj.ranges[0].bin = 'first'
	}
	if (self.q.last_bin) {
		self.num_obj.ranges.push(self.q.last_bin)
		self.num_obj.ranges[1].bin = 'last'
	}
	self.num_obj.brushes = []
	const brushes = self.num_obj.brushes

	if (!self.num_obj.custom_bins_q) {
		/* when custom_bins_q is undefined, do not run below as a quick fix not to break
		FIXME where is this created and purpose?
		*/
		return
	}

	for (const r of self.num_obj.ranges.values()) {
		const _b = brushes.find((b: BrushEntry) => b.orig === r)
		let brush
		if (!_b) {
			brush = { orig: r, range: JSON.parse(JSON.stringify(r)) }
			brushes.push(brush)
		} else {
			brush = _b
		}

		const custom_bins_q = self.num_obj.custom_bins_q
		const maxvalue = self.num_obj.density_data!.max
		const minvalue = self.num_obj.density_data!.min

		const custom_bins = custom_bins_q.lst || []

		if (custom_bins.length == 0) {
			const mean_value = (maxvalue + minvalue) / 2
			const first_bin = {
				startunbounded: true,
				stop: mean_value,
				stopinclusive: true,
				name: 'First bin'
			}
			const last_bin = {
				start: mean_value,
				stopunbounded: true,
				startinclusive: false,
				name: 'Last bin'
			}
			custom_bins.push(first_bin)
			custom_bins.push(last_bin)
			self.num_obj.custom_bins_q.lst = custom_bins
		}
	}
}

function renderBinLines(self, data: any) {
	const o = self.num_obj as NumberObj
	if (!o.density_data) throw `Missing .density_data [density.ts, renderBinLines()]`
	const scaledMinX = Math.round(o.xscale(o.density_data.min)) as number
	const scaledMaxX = Math.round(o.xscale(o.density_data.max)) as number
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
	const lines: any = []

	if (data.mode == 'discrete' && data.type == 'regular-bin') {
		// assume that boundary lines will be hidden if x > last_bin.start
		// offset max value by first_bin.stop in case the first boundary is dragged
		// to the left, will reveal additional non-draggable boundaries from the right
		const binLinesStop = o.density_data.max + Math.abs(data.first_bin.stop) - Math.min(o.density_data.min, 0)
		let index = 0
		//
		for (let i = data.first_bin.stop; i <= binLinesStop; i = i + data.bin_size) {
			lines.push({ x: i, index, scaledX: Math.round(o.xscale(i)) })
			index++
		}
		const lastVisibleLine = lines
			.slice()
			.reverse()
			.find((d: LineData) => d.scaledX <= scaledMaxX)

		if (data.last_bin && data.last_bin.start && data.last_bin.start !== lastVisibleLine.x) {
			lines.push({ x: data.last_bin.start, index, scaledX: Math.round(o.xscale(data.last_bin.start)) })
		}
	} else if ((data.mode == 'discrete' && data.type == 'custom-bin') || data.mode == 'binary') {
		lines.push(
			...data.lst.slice(1).map((d: LineData, index: number) => {
				return { x: d.start, index, scaledX: Math.round(o.xscale(d.start)) }
			})
		)
	} else if (data.mode == 'spline') {
		lines.push(
			...data.knots.map((d: LineData, index: number) => {
				return { x: d.value, index, scaledX: Math.round(o.xscale(d.value)) }
			})
		)
	}

	lines.forEach((d: LineData, i: number) => {
		d.isDraggable =
			self.q.type == 'custom-bin' ||
			self.q.mode == 'spline' ||
			i === 0 ||
			(self.q.last_bin && self.q.last_bin.start === d.x && d.index == lines.length - 1)
	})

	self.num_obj.binsize_g.selectAll('line').remove()
	const lastVisibleLine =
		lines.length == 1
			? lines[0]
			: lines
					.slice()
					.reverse()
					.find((d: LineData) => d.scaledX < scaledMaxX)
	let lastScaledX = lastVisibleLine ? Math.min(scaledMaxX, lastVisibleLine.scaledX) : (scaledMaxX as number)
	self.num_obj.binsize_g
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
			if (self.q.type != 'regular-bin' || d.isDraggable) select(this).style('stroke-width', 3)
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

	const middleLines = self.num_obj.binsize_g.selectAll('line').filter((d: LineData) => !d.isDraggable)

	function dragged(this: any, event: PointerEvent, b: any) {
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

		const inverted = +o.xscale.invert(d.draggedX)
		const value = self.term.type == 'integer' ? Math.round(inverted) : inverted.toFixed(3)

		if (self.q.mode == 'discrete' && self.q.type == 'regular-bin') {
			//d.scaledX = Math.round(o.xscale(value))
			if (d.index === 0) {
				self.dom.first_stop_input.property('value', value)
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
				self.dom.last_start_input.property('value', value)
				self.q.last_bin!.start = value as number
				middleLines.style('display', (c: any) => (d.draggedX && c.scaledX >= d.draggedX ? 'none' : ''))
			}
		} else if ((self.q.mode == 'discrete' && self.q.type == 'custom-bin') || self.q.mode == 'binary') {
			self.q.lst![d.index + 1].start = value as number
			self.q.lst![d.index + 1].label = get_bin_label(self.q.lst![d.index + 1], self.q)
			self.q.lst![d.index + 1].range = get_bin_range_equation(self.q.lst![d.index + 1], self.q)
			self.q.lst![d.index].stop = value as number
			self.q.lst![d.index].label = get_bin_label(self.q.lst![d.index], self.q)
			self.q.lst![d.index].range = get_bin_range_equation(self.q.lst![d.index], self.q)
			if (self.dom.customBinBoundaryInput) {
				// this is created by binary.js when mode=binary
				// quick fix: while dragging, revert from percentile to normal, as it's hard to update percentile values
				self.q.modeBinaryCutoffType = 'normal'
				if (self.dom.customBinBoundaryPercentileCheckbox) {
					self.dom.customBinBoundaryPercentileCheckbox.property('checked', false)
				}
				self.dom.customBinBoundaryInput.property(
					'value',
					self.q
						.lst!.slice(1)
						.map((d: any) => d.start)
						.join('\n')
				)
			}

			if (self.dom.customBinLabelInput) {
				self.dom.customBinLabelInput.property('value', (c: any) => c.label)
			}
			if (self.dom.customBinRanges) {
				self.dom.customBinRanges.html((c: any) => c.range)
			}
		} else if (self.q.mode == 'spline') {
			self.q.knots[d.index].value = value
			if (self.dom.customKnotsInput) {
				self.dom.customKnotsInput.property('value', self.q.knots.map((d: any) => d.value).join('\n'))
			}
		} else {
			throw 'Dragging not allowed for this term type'
		}
	}

	function dragend(this: any, event: DragEvent, b: any) {
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
		d.x = +o.xscale.invert(d.draggedX).toFixed(self.term.type == 'integer' ? 0 : 3)
		if (self.q.mode == 'discrete' && self.q.type == 'regular-bin') {
			if (d.index === 0) {
				self.q.first_bin!.stop = d.x
				middleLines.each(function (d: LineData) {
					d.scaledX = d.draggedX as number
					d.x = +o.xscale.invert(d.draggedX).toFixed(self.term.type == 'integer' ? 0 : 3)
				})
			} else {
				self.q.last_bin!.start = d.x
			}
			lastScaledX = lines
				.slice()
				.reverse()
				.find((d: LineData) => d.scaledX < scaledMaxX).scaledX
		} else if (self.q.mode == 'discrete' && self.q.type == 'custom-bin') {
			self.q.lst![d.index + 1].start = d.x
			self.q.lst![d.index].stop = d.x
		} else if (self.q.mode == 'spline') {
			self.q.knots[d.index].value = d.x
		}
	}
}
