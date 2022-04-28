import { select } from 'd3-selection'

export function setRenderers(self) {
	self.render = function() {
		const s = self.settings.matrix
		const l = self.layout
		const d = self.dimensions
		const duration = self.dom.svg.attr('width') ? s.duration : 0
		self.renderSerieses(s, l, d, duration)
		self.renderLabels(s, l, d, duration)
	}

	self.renderSerieses = function(s, l, d, duration) {
		self.dom.seriesesG
			.transition()
			.duration(duration)
			.attr('transform', `translate(${d.xOffset},${d.yOffset})`)

		const sg = self.dom.seriesesG.selectAll('.sjpp-mass-series-g').data(this.serieses, series => series.row.sample)

		sg.exit().remove()
		sg.each(self.renderSeries)
		sg.enter()
			.append('g')
			.attr('class', 'sjpp-mass-series-g')
			.style('opacity', 0.001)
			.each(self.renderSeries)
	}

	self.renderSeries = function(series) {
		const s = self.settings.matrix
		const g = select(this)
		const duration = g.attr('transform') ? s.duration : 0

		g.transition()
			.duration(duration)
			.attr('transform', `translate(${series.x},${series.y})`)
			.style('opacity', 1)

		const rects = g.selectAll('rect').data(series.cells, (cell, i) => cell.sample + ';;' + cell.tw.$id)
		rects.exit().remove()
		rects.each(self.renderCell)
		rects
			.enter()
			.append('rect')
			.each(self.renderCell)
	}

	self.renderCell = function(cell) {
		if (!cell.fill)
			cell.fill = cell.$id in self.colorScaleByTermId ? self.colorScaleByTermId[cell.$id](cell.key) : getRectFill(cell)
		const s = self.settings.matrix
		const rect = select(this)
			.transition()
			.duration('x' in this ? s.duration : 0)
			.attr('x', cell.x)
			.attr('y', cell.y)
			.attr('width', cell.width ? cell.width : s.colw)
			.attr('height', 'height' in cell ? cell.height : s.rowh)
			.attr('shape-rendering', 'crispEdges')
			.attr('stroke', cell.fill)
			.attr('stroke-width', '1px')
			.attr('fill', cell.fill)
	}

	self.renderLabels = function(s, l, d, duration) {
		for (const direction of ['top', 'btm', 'left', 'right']) {
			const side = l[direction]
			side.box
				.transition()
				.duration(duration)
				.attr('transform', side.attr.boxTransform)

			const labels = side.box.selectAll('.sjpp-matrix-label').data(side.data, side.key)
			labels.exit().remove()
			labels.each(renderLabel)
			labels
				.enter()
				.append('g')
				.attr('class', 'sjpp-matrix-label')
				.each(renderLabel)

			function renderLabel(lab) {
				const g = select(this)
				const textduration = g.attr('transform') ? duration : 0
				g.transition()
					.duration(textduration)
					.attr('transform', side.attr.labelGTransform)

				if (!g.select(':scope>text').size()) g.append('text')
				g.select(':scope>text')
					.attr('fill', '#000')
					.transition()
					.duration(textduration)
					.attr('opacity', side.attr.fontSize < 6 ? 0 : 1)
					.attr('font-size', side.attr.fontSize)
					.attr('text-anchor', side.attr.labelAnchor)
					.attr('transform', side.attr.labelTransform)
					.attr('cursor', 'pointer')
					.attr(side.attr.textpos.coord, side.attr.textpos.factor * (lab.tw?.q?.mode == 'continuous' ? 30 : 0))
					.text(side.label)

				if (lab.tw?.q?.mode == 'continuous' && side.label(lab)) {
					// TODO: may extract this into a matrix method
					const p = select(g.node().parentNode)
					if (!p.select('.sjpp-matrix-cell-axis').size()) {
						p.append('g')
							.attr('class', 'sjpp-matrix-cell-axis')
							.attr('shape-rendering', 'crispEdges')
					}
					const axisg = p.select('.sjpp-matrix-cell-axis')
					axisg.selectAll('*').remove()
					const domain = [lab.counts.maxval, lab.counts.minval]
					if (s.transpose) domain.reverse()
					const x = 0
					const y = !s.transpose ? `${lab.tw.settings.gap - 1}` : 0
					axisg
						.attr('shape-rendering', 'crispEdges')
						.attr('transform', `translate(${x},${y})`)
						.call(side.attr.axisFxn(lab.scale.domain(domain)).tickValues(domain))
				}
			}
		}
	}

	self.colLabelGTransform = (lab, grpIndex) => {
		const s = self.settings.matrix
		const d = self.dimensions
		const x = lab.grpIndex * s.colgspace + lab.totalIndex * d.dx + 0.8 * s.colw + lab.totalHtAdjustments
		const y = 0 //lab.tw?.q?.mode == 'continuous' ? -30 : 0
		return `translate(${x},${y})`
	}

	self.colGrpLabelGTransform = (lab, grpIndex) => {
		const s = self.settings.matrix
		const d = self.dimensions
		const x =
			lab.grpIndex * s.colgspace +
			lab.prevGrpTotalIndex * d.dx +
			(lab.grp.lst.length * d.dx) / 2 +
			3 +
			lab.totalHtAdjustments
		return `translate(${x},0)`
	}

	self.rowLabelGTransform = (lab, grpIndex) => {
		const s = self.settings.matrix
		const d = self.dimensions
		const x = 0 // lab.tw?.q?.mode == 'continuous' ? -30 : 0
		const y = lab.grpIndex * s.rowgspace + lab.totalIndex * d.dy + 0.7 * s.rowh + lab.totalHtAdjustments
		return `translate(${x},${y})`
	}

	self.rowGrpLabelGTransform = (lab, grpIndex) => {
		const s = self.settings.matrix
		const d = self.dimensions
		const y =
			lab.grpIndex * s.rowgspace +
			lab.prevGrpTotalIndex * d.dy +
			(lab.grp.lst.length * d.dy) / 2 +
			3 +
			lab.totalHtAdjustments
		return `translate(0,${y})`
	}

	self.adjustSvgDimensions = async function(prevTranspose) {
		const s = self.settings.matrix
		const d = self.dimensions
		const duration = self.dom.svg.attr('width') ? s.duration : 10

		// wait for labels to render; when transposing, must wait for
		// the label rotation to end before measuring the label height and width
		await sleep(prevTranspose == s.transpose ? duration : s.duration)

		const topBox = self.layout.top.box.node().getBBox()
		const btmBox = self.layout.btm.box.node().getBBox()
		const leftBox = self.layout.left.box.node().getBBox()
		const rtBox = self.layout.right.box.node().getBBox()

		d.extraWidth = leftBox.width + rtBox.width + s.margin.left + s.margin.right + s.rowlabelgap * 2
		d.extraHeight = topBox.height + btmBox.height + s.margin.top + s.margin.bottom + s.collabelgap * 2
		d.svgw = d.mainw + d.extraWidth
		d.svgh = d.mainh + d.extraHeight
		self.dom.svg
			.transition()
			.duration(duration)
			.attr('width', d.svgw)
			.attr('height', d.svgh)

		const x = leftBox.width - self.layout.left.offset
		const y = topBox.height - self.layout.top.offset
		self.dom.mainG
			.transition()
			.duration(duration)
			.attr('transform', `translate(${x},${y})`)
	}
}

function getRectFill(d) {
	if (d.fill) return d.fill
	/*** TODO: class should be for every values entry, as applicable ***/
	const cls = d.class || (Array.isArray(d.values) && d.values[0].class)
	return cls ? mclass[cls].color : '#555'
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}
