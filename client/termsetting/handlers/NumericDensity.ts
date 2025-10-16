import type { TermSetting } from '../TermSetting.ts'
import type { NumRegularBin, NumCustomBins, NumCont, NumSpline } from '#tw'
import type { NumericHandler } from './NumericHandler.ts'
import type { NumericBin } from '#types'
import { violinRenderer } from '#dom'
import { select, pointer, type BaseType } from 'd3-selection'
import { scaleLinear, drag as d3drag } from 'd3'
//import { get_bin_label, get_bin_range_equation } from '#shared/termdb.bins.js'

export type BoundaryOpts = {
	values: BoundaryValue[]
	callback: (d: DraggedLineData, value: number) => void
}

export type BoundaryValue = {
	x: number
	isDraggable: boolean
	movesWithLineIndex?: number
	isLastVisibleLine?: boolean
}

export type LineData = BoundaryValue & {
	scaledX: number
	index: number
}

export type DraggedLineData = LineData & {
	draggedX?: number
	start?: number
	end?: number
}

// type BrushEntry = {
// 	//No documentation!
// 	orig: string
// 	range: {
// 		start: number
// 		stop: number
// 	}
// 	init: () => void
// }

export class NumericDensity {
	handler: NumericHandler
	termsetting: TermSetting
	opts: any // TODO
	tw: NumRegularBin | NumCustomBins | NumCont | NumSpline

	dom: {
		[name: string]: any
	} = {}

	vrByDiv: WeakMap<HTMLElement, any> = new WeakMap()
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

	async showViolin(div, boundaryOpts?) {
		await this.setData()

		if (!this.vrByDiv.has(div)) {
			div.style('padding', '5px').selectAll('*').remove()
			const loadingDiv = div
				.append('div')
				.style('padding', '10px')
				.style('text-align', 'center')
				.html('Getting distribution data ...<br/>')

			const densityDiv = div.append('div')
			loadingDiv.remove()
			const vr = new violinRenderer({
				holder: densityDiv,
				rd: this.density_data,
				width: this.plot_size.width,
				height: this.plot_size.height,
				radius: this.plot_size.radius
			})
			this.vrByDiv.set(div, vr)
		}

		this.vr = this.vrByDiv.get(div)
		this.dom.svg = this.vr.svg
		this.vr.render()
		if (boundaryOpts) await this.setBinLines(boundaryOpts)

		return this.density_data
	}

	async setBinLines(boundaryOpts) {
		if (this.density_data.max == this.density_data.min) {
			this.handleNoDensity()
		} else {
			// svg for range plot
			// const div = self.q.mode == 'spline' ? self.dom.knots_div : self.dom.bins_div
			//this.vr.render()

			// add binsize_g for termsetting lines
			if (this.dom.binsize_g) this.dom.binsize_g.remove()
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
			this.renderBinLines(boundaryOpts)
		}
	}

	handleNoDensity() {
		this.no_density_data = true
		this.ranges = []
		this.brushes = []
	}

	renderBinLines(boundaryOpts: BoundaryOpts) {
		//this.boundaryOpts = boundaryOpts
		const { density_data, plot_size, tw, xscale } = this
		if (!this.density_data) throw `Missing .density_data [density.ts, renderBinLines()]`
		const scaledMinX = Math.round(this.xscale(density_data.min))
		const scaledMaxX = Math.round(this.xscale(density_data.max))
		const lines: DraggedLineData[] = []
		for (const [index, v] of boundaryOpts.values.entries()) {
			lines.push({ ...v, index, scaledX: Math.round(this.xscale(v.x)) })
		}
		const lastVisibleLine = lines.find(l => l.isLastVisibleLine)
		const lastVisibleScaledX = lastVisibleLine ? this.xscale(lastVisibleLine.scaledX) : scaledMaxX

		this.dom.binsize_g.selectAll('line').remove()
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
			.attr('y2', plot_size.height)
			.style('cursor', (d: LineData) => (d.isDraggable ? 'ew-resize' : ''))
			.style('display', (d: LineData) => (!d.isDraggable && d.scaledX > lastVisibleScaledX ? 'none' : ''))
			.on('mouseover', function (this: BaseType, d: LineData) {
				if (tw.q.type != 'regular-bin' || d.isDraggable) select(this).style('stroke-width', 3)
			})
			.on('mouseout', function (this: BaseType) {
				select(this).style('stroke-width', 1)
			})
			.each(function (this: Element, d: LineData) {
				if (d.isDraggable) {
					const dragger = d3drag().on('drag', onDrag).on('end', onDrag)
					select(this).call(dragger)
				}
			})

		const lineElems = this.dom.binsize_g.node().querySelectorAll('line')

		function onDrag(this: any, event: PointerEvent, _d: any) {
			const draggedX: number = pointer(event, this)[0]
			if (draggedX <= scaledMinX || draggedX >= scaledMaxX) return

			const d = _d as DraggedLineData
			d.draggedX = draggedX
			select(this).attr('x1', d.draggedX).attr('y1', 0).attr('x2', d.draggedX).attr('y2', plot_size.height)

			const lastVisibleScaledX = lastVisibleLine?.draggedX || scaledMaxX

			const xOffset = d.draggedX - d.scaledX
			if (xOffset) {
				for (const elem of lineElems) {
					const c = elem.__data__
					if (c.movesWithLineIndex !== d.index) continue
					c.draggedX = c.scaledX + xOffset
					select(elem)
						.attr('x1', c.draggedX)
						.attr('x2', c.draggedX)
						.style('display', c.draggedX >= lastVisibleScaledX ? 'none' : '')
				}
				const inverted = xscale.invert(d.draggedX)
				const value = tw.term.type == 'integer' ? Math.round(inverted) : inverted.toFixed(3)
				boundaryOpts.callback(d, value)
			}

			// if (tw.q.mode == 'spline') {
			// 	//self.q.knots[d.index].value = value
			// 	if (handler.dom.customKnotsInput) {
			// 		handler.dom.customKnotsInput.property('value', tw.q.knots.map((d: any) => d.value).join('\n'))
			// 	}
			// }
			// else {
			// 	throw 'Dragging not allowed for this term type'
			// }
		}

		// function dragend(this: any, event: DragEvent, b: any) {
		// 	const draggedX = pointer(event, this)[0]
		// 	const line =
		// 		tw.q.type == 'regular-bin'
		// 			? select(this)
		// 			: b.index > 0 && draggedX <= lines[b.index - 1].scaledX
		// 			? select(this.previousSibling)
		// 			: b.index < lines.length - 1 && draggedX >= lines[b.index + 1].scaledX
		// 			? select(this.nextSibling)
		// 			: select(this)
		// 	const d = line.datum() as LineData

		// 	d.scaledX = d.draggedX as number
		// 	d.x = +this.xscale.invert(d.draggedX).toFixed(tw.term.type == 'integer' ? 0 : 3)
		// 	if (tw.q.mode == 'discrete' && tw.q.type == 'regular-bin') {
		// 		if (d.index === 0) {
		// 			tw.q.first_bin!.stop = d.x
		// 			middleLines.each((d: LineData) => {
		// 				d.scaledX = d.draggedX as number
		// 				d.x = +this.xscale.invert(d.draggedX).toFixed(tw.term.type == 'integer' ? 0 : 3)
		// 			})
		// 		} else {
		// 			tw.q.last_bin!.start = d.x
		// 		}
		// 		lastScaledX = lines
		// 			.slice()
		// 			.reverse()
		// 			.find((d: LineData) => d.scaledX < scaledMaxX).scaledX
		// 	} else if (tw.q.mode == 'discrete' && tw.q.type == 'custom-bin') {
		// 		// tw.q.lst![d.index + 1].start = d.x
		// 		// tw.q.lst![d.index].stop = d.x
		// 	} else if (tw.q.mode == 'spline') {
		// 		tw.q.knots[d.index].value = d.x
		// 	}
		// }
	}
}
