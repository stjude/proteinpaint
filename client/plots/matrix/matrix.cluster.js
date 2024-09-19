import { select, selectAll } from 'd3-selection'

export class MatrixCluster {
	constructor(opts) {
		this.parent = opts.parent
		const svg = opts.svg
		this.patternId = `sjpp-matrix-grid-pattern-${this.parent.id}`
		this.patternIdSuffix = 0
		this.dom = {
			holder: opts.holder,
			//clusterrowline: opts.holder.insert('g', 'g').attr('class', 'sjpp-matrix-clusterrowline'),
			//clustercolline: opts.holder.insert('g', 'g').attr('class', 'sjpp-matrix-clustercolline'),
			clusterbg: opts.holder.insert('g', 'g').attr('class', 'sjpp-matrix-clusterbg').on('mouseover', this.mouseout),
			outlines: opts.holder.append('g').attr('class', 'sjpp-matrix-clusteroutlines')
		}
		setRenderers(this)
	}

	main(data) {
		this.currData = data
		this.settings = data.settings
		this.xGrps = data.xGrps
		this.xGrpKey = !this.settings.transpose ? 'samplegrp' : 'termgrp'
		this.yGrps = data.yGrps
		this.yGrpKey = !this.settings.transpose ? 'termgrp' : 'samplegrp'
		this.clusters = this.processData()
		this.render(this.clusters)
	}

	processData() {
		const s = this.settings
		const d = this.currData.dimensions
		const clusters = []
		// track total width for zooming, including pads
		this.totalWidth = s.zoomLevel == 1 ? -4 : 0 //4 * Math.max(1, s.colspace)

		for (const xg of this.xGrps) {
			const dx = d.dx //Math.min(d.dx, s.colwMax + s.colspace)
			const x = xg.prevGrpTotalIndex * dx + s.colgspace * xg.grpIndex + xg.totalHtAdjustments
			const width = dx * (xg.processedLst || xg.grp.lst).length + xg.grpTotals.htAdjustment - s.colspace
			this.totalWidth += width + 2 * Math.max(1, s.colspace)

			for (const yg of this.yGrps) {
				const y = yg.prevGrpTotalIndex * d.dy + yg.grpIndex * s.rowgspace + yg.totalHtAdjustments
				const height = d.dy * (yg.processedLst || yg.grp.lst).length + yg.grpTotals.htAdjustment - s.rowspace
				const offsetX = 1 //Math.max(1, s.colspace)
				const offsetY = 1 //Math.max(1, s.rowspace)
				clusters.push({
					xg,
					yg,
					// use colspace and rowspace as padding around the cluster outline
					x: x - offsetX,
					y: y - offsetY,
					width: width + 2 * offsetX,
					height: height + 2 * offsetY
				})
			}
		}

		return clusters
	}
}

function setRenderers(self) {
	self.render = function (clusters) {
		const s = self.settings
		const d = self.currData.dimensions
		const duration = self.dom.outlines.attr('transform') ? s.duration : 0
		self.translateElems(0, s, d, duration)

		if (s.prevShowGrid != s.showGrid) {
			self.dom.outlines.selectAll('*').remove()
		}

		if (s.showGrid != 'pattern') {
			// see function for how s.showGrid = '' | 'rect' is handled
			renderOutlines(clusters, s, d)
		} else {
			const g = self.dom.outlines.selectAll('g').data(clusters, c => c.xg.grp.name + ';;' + c.yg.grp.name)
			g.exit().remove()
			g.each(renderCluster)
			g.enter().append('g').each(addCluster)
		}

		s.prevShowGrid = s.showGrid
		// need to reset imgBox and beam highlighters after rendering to avoid misaligned beam highlighters
		self.parent.delayedMouseoutHandler()
	}

	self.translateElems = function (dx, s, d, duration = 0) {
		const o = !duration ? self.dom.outlines : self.dom.outlines.transition().duration(duration)
		o.attr('transform', `translate(${d.xOffset + d.seriesXoffset + dx},${d.yOffset})`)
	}

	function renderOutlines(clusters, s, d) {
		const outlines = self.dom.outlines.selectAll('rect').data(clusters, c => c.xg.grp.name + ';;' + c.yg.grp.name)
		outlines.exit().remove()
		outlines.each(render1Outline)
		outlines.enter().append('rect').each(render1Outline)
	}

	function render1Outline(cluster) {
		const s = self.settings
		const rect = select(this)
			.transition()
			.duration('x' in this ? s.duration : 0)
			.attr('x', cluster.x)
			.attr('y', cluster.y)
			.attr('width', cluster.width)
			.attr('height', cluster.height)
			.attr('shape-rendering', 'crispEdges')
			//
			// s.showGrid == ''
			// - means empty cells are not rendered
			// - the cluster rect fill is set to s.cellbg
			//
			// s.showGrid != ''
			// - equivalent to 'rect' here since 'pattern' is handled in a different function
			// - sets cluster rect fill=s.gridStroke under cell rects, where the gaps between rects are perceived as lines
			//
			.attr('fill', !s.showGrid ? s.cellbg : s.gridStroke)
			.attr('stroke', s.outlineStroke)
			.attr('stroke-width', 1)
	}

	/* 
		render the grid using a repeating pattern as background fill
		
		NOTES:
		- needs debugging for when s.rowh or d.colw does not apply to all rows (inconsistent pattern)
		- canvas does not save memory using patterns, but svg does
		- can delete this option once canvas is fully debugged
	*/
	function addCluster(cluster) {
		const g = select(this)
		const pattern = g
			.append('pattern')
			.attr('id', `${self.patternId}-${self.patternIdSuffix++}`)
			.attr('patternUnits', 'userSpaceOnUse')
			.attr('patternUnits', 'userSpaceOnUse')
		pattern.append('line')
		pattern.append('line')
		g.append('rect') //.attr('class', 'sjpp-matrix-clusterbg-rect') // background rect
		g.append('rect') //.attr('class', 'sjpp-matrix-clusterbg-outline') // outline, grid
		renderCluster.call(this, cluster)
	}

	function renderCluster(cluster) {
		const s = self.settings
		const d = self.parent.dimensions
		const c = cluster
		const g = select(this)

		const patternId = definePattern(g, s, d, cluster)
		const rects = g.node().querySelectorAll('rect')
		render1Rect.call(rects[0], cluster, Object.assign({}, s, { fill: s.cellbg }))
		const fill = s.showGrid ? `url(#${patternId})` : 'none'
		render1Rect.call(rects[1], cluster, Object.assign({}, s, { fill, stroke: s.gridStroke }))
	}

	function definePattern(g, s, d, cluster) {
		//console.log(cluster)
		const pattern = g
			.select('pattern')
			.attr('x', 0) //-halfStroke)
			.attr('y', 0) //-halfStroke)
			.attr('width', d.colw + s.colspace)
			.attr('height', s.rowh + s.rowspace)

		// because the grid spacing may be different
		const halfStrokeH = 0.5 * s.rowspace
		const y = s.rowh + halfStrokeH

		const [patternLineH, patternLineV] = pattern.node().querySelectorAll('line')
		select(patternLineH)
			.attr('x1', 0)
			.attr('y1', y)
			.attr('x2', d.colw + s.colspace)
			.attr('y2', y)
			.attr('stroke', s.gridStroke)
			.attr('stroke-width', s.rowspace)

		const halfStrokeV = 0.5 * s.colspace
		const x = d.colw + halfStrokeV
		select(patternLineV)
			.attr('x1', x)
			.attr('y1', 0)
			.attr('x2', x)
			.attr('y2', s.rowh)
			.attr('stroke', s.gridStroke)
			.attr('stroke-width', s.colspace)

		return pattern.attr('id')
	}

	function renderRects(clusters, g, s, d, overrides) {
		g.transition()
			.duration(g.attr('transform') ? s.duration : 0)
			.attr('transform', `translate(${d.xOffset + d.seriesXoffset},${d.yOffset})`)

		function renderRect(cluster) {
			render1Rect.call(this, cluster, Object.assign({}, s, overrides))
		}

		const rects = g.selectAll('rect').data(clusters, c => c.xg.grp.name + ';;' + c.yg.grp.name)
		rects.exit().remove()
		rects.each(renderRect)
		rects.enter().append('rect').each(renderRect)
	}

	function render1Rect(cluster, s) {
		const rect = select(this)
		rect
			.transition()
			.duration(rect.attr('x') ? s.duration : 0)
			.attr('x', cluster.x)
			.attr('y', cluster.y)
			.attr('width', cluster.width)
			.attr('height', cluster.height)
			.attr('shape-rendering', 'crispEdges')
			.attr('fill', s.fill || 'none')
			.attr('stroke', s.stroke || 'none')
		//.attr('stroke-width', ) // s.colspace)
	}
	/* end of grid as pattern */
}
