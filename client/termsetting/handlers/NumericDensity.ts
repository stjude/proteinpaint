import type { TermSetting } from '../TermSetting.ts'
import type { NumRegularBin, NumCustomBins, NumCont, NumSpline } from '#tw'
import type { NumericBin } from '#types'
import { violinRenderer } from '#dom'
import { select, pointer, type BaseType } from 'd3-selection'
import { scaleLinear, drag as d3drag } from 'd3'
import { getValueConversionFactor } from '#shared/helpers.js'
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

	/* the boundary values exchanged with the bin/knot editors, and the domain of this.xscale, are in
	the term's user-facing unit; density_data is in the unit the values are stored in. only the two
	getters below cross that line, to put the plot's endpoints in the same unit as those values.

	they multiply instead of calling toUserUnit(), which rounds: rounding is right for a number shown
	in an input, but a rounded domain endpoint distorts every scaled x by up to half of the last shown
	digit, and collapses the domain outright when the converted range is smaller than that (a stored
	range of under 2 days at scaleFactor=1/365.25). it would also disagree with violinRenderer, whose
	axis this plot's lines overlay and which scales its own domain unrounded */
	get scaleFactor() {
		return getValueConversionFactor(this.tw.term)
	}

	get displayMin() {
		return this.density_data.min * this.scaleFactor
	}

	get displayMax() {
		return this.density_data.max * this.scaleFactor
	}

	async setData() {
		//if (this.density_data) return this.density_data
		const self = this.termsetting
		const d = await self.vocabApi.getViolinBox(
			{
				plotType: 'violin',
				tw: { type: self.tw.type, term: self.term, q: self.q },
				svgw: this.plot_size.width,
				radius: this.plot_size.radius,
				filter: self.filter
			},
			self.opts.getBodyParams?.()
		)
		if (d.error) throw d
		this.density_data = d
		return this.density_data
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
				radius: this.plot_size.radius,
				// axis ticks are labeled in the term's user-facing unit, e.g. years and not days
				scaleFactor: this.scaleFactor
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
			this.dom.binsize_g = this.dom.svg
				.append('g')
				.attr('transform', `translate(${this.plot_size.xpad}, ${this.plot_size.ypad})`)
				.attr('class', 'binsize_g')

			// boundary values come from the editors in the user-facing unit, so the domain is too
			const maxvalue = this.displayMax
			const minvalue = this.displayMin

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
		const { plot_size, tw, xscale, scaleFactor } = this
		if (!this.density_data) throw `Missing .density_data [density.ts, renderBinLines()]`
		const scaledMinX = Math.round(this.xscale(this.displayMin))
		const scaledMaxX = Math.round(this.xscale(this.displayMax))
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

		/* the boundary value that a line at this x reports. a converted value is on a much smaller
		scale than what it was converted from (e.g. 70 years vs 25868 days), so rounding an integer
		term to a whole number would make the line jump by a year at a time. round to 2 decimals in
		that case instead */
		function toBoundaryValue(x: number): number {
			const inverted = xscale.invert(x)
			return Number(
				scaleFactor != 1 ? inverted.toFixed(2) : tw.term.type == 'integer' ? Math.round(inverted) : inverted.toFixed(3)
			)
		}

		// the boundary a line currently stands for, which is its dragged position once it has been moved
		function toLineValue(line: DraggedLineData): number {
			return line.draggedX === undefined ? line.x : toBoundaryValue(line.draggedX)
		}

		/* the nearest draggable line on either side, if there is one. a boundary may not be dragged
		onto or past one of them: an editor addresses a boundary by the index its line had when the
		lines were rendered, so two boundaries that swap order make the next drag event overwrite the
		wrong one, and two boundaries of the same value are merged into a single one, leaving the
		editor with fewer boundaries than the plot has lines */
		function getNeighbors(d: DraggedLineData): [DraggedLineData | undefined, DraggedLineData | undefined] {
			const x = d.draggedX ?? d.scaledX
			let lower, upper
			for (const line of lines) {
				if (line.index === d.index || !line.isDraggable) continue
				const lineX = line.draggedX ?? line.scaledX
				if (lineX <= x) {
					if (!lower || lineX > (lower.draggedX ?? lower.scaledX)) lower = line
				} else if (!upper || lineX < (upper.draggedX ?? upper.scaledX)) upper = line
			}
			return [lower, upper]
		}

		function onDrag(this: any, event: PointerEvent, _d: any) {
			const d = _d as DraggedLineData
			const [lower, upper] = getNeighbors(d)
			/* a line follows the pointer but stops at the edge of the plot and at its neighboring
			lines. clamping rather than ignoring an out of bounds drag keeps a line draggable when it
			starts outside those limits, as a boundary kept from a wider cohort does: its line is
			drawn past the edge of the plot, where every pointer position is out of bounds */
			const lowerX = Math.max(scaledMinX, lower ? lower.draggedX ?? lower.scaledX : scaledMinX)
			const upperX = Math.min(scaledMaxX, upper ? upper.draggedX ?? upper.scaledX : scaledMaxX)
			if (upperX - lowerX < 2) return // no room to drag between the limits
			const draggedX = Math.min(Math.max(pointer(event, this)[0], lowerX + 1), upperX - 1)
			const value = toBoundaryValue(draggedX)
			/* the rounded value may still land on a neighboring boundary a pixel or two away. the
			edges of the plot are not boundaries, so only a neighboring line is compared */
			if (lower && value === toLineValue(lower)) return
			if (upper && value === toLineValue(upper)) return

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
				boundaryOpts.callback(d, value)
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
