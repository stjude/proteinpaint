import type { TermSetting } from '../TermSetting.ts'
import type { NumRegularBin, NumCustomBins, NumCont, NumSpline } from '#tw'
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

export class NumericDensity {
	termsetting: TermSetting
	opts: any // TODO
	tw: NumRegularBin | NumCustomBins | NumCont | NumSpline

	dom: {
		[name: string]: any
	} = {}
	// WeakMap allows deletion of value when the object/DOM key is deleted,
	// so better for avoiding memory leak
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

	constructor(opts) {
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
			if (this.dom.binsize_g) this.dom.binsize_g.selectAll('*').remove()
			if (!this.dom.svg) console.trace(124)
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
		const lastVisibleScaledX = lastVisibleLine ? lastVisibleLine.scaledX : scaledMaxX
		const dragger = d3drag().on('drag', onDrag).on('end', onDrag)

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
			.attr('display', (d: LineData) => (!d.isDraggable && d.scaledX > lastVisibleScaledX ? 'none' : ''))
			.on('mouseover', function (this: SVGLineElement, _, d: LineData) {
				if (d.isDraggable) select(this).style('stroke-width', 3)
			})
			.on('mouseout', function (this: BaseType) {
				select(this).style('stroke-width', 1)
			})
			.each(function (this: Element, d: LineData) {
				if (d.isDraggable) select(this).call(dragger)
			})

		const lineElems = this.dom.binsize_g.node().querySelectorAll('line')

		function onDrag(this: any, event: PointerEvent, _d: any) {
			const draggedX: number = pointer(event, this)[0]
			if (draggedX <= scaledMinX || draggedX >= scaledMaxX) return

			const d = _d as DraggedLineData
			d.draggedX = draggedX
			select(this).attr('x1', d.draggedX).attr('y1', 0).attr('x2', d.draggedX).attr('y2', plot_size.height)

			const lastVisibleScaledX = lastVisibleLine?.draggedX ?? lastVisibleLine?.scaledX ?? scaledMaxX

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
				boundaryOpts.callback(d, Number(value))
			}
		}
	}

	destroy() {
		for (const [k, v] of Object.entries(this.dom)) {
			delete this.dom[k]
			if (typeof v.remove == 'function') v.remove()
		}
	}
}
