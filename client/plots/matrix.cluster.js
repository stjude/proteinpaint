import { select, selectAll } from 'd3-selection'

export class MatrixCluster {
	constructor(opts) {
		this.parent = opts.parent
		const svg = opts.svg
		this.dom = {
			holder: opts.holder.attr('clip-path', `url(#${this.parent.clusterClipId})`),
			outlines: opts.holder.append('g').attr('class', 'sjpp-matrix-clusteroutlines'),
			//clusterrowline: opts.holder.insert('g', 'g').attr('class', 'sjpp-matrix-clusterrowline'),
			//clustercolline: opts.holder.insert('g', 'g').attr('class', 'sjpp-matrix-clustercolline'),
			clusterbg: opts.holder.insert('g', 'g').attr('class', 'sjpp-matrix-clusterbg'),
			clipRect: opts.holder
				.append('clipPath')
				.attr('id', this.parent.clusterClipId)
				.attr('clipPathUnits', 'objectBoundingBox')
				//.attr('clipPathUnits', 'userSpaceOnUse')
				.append('rect')
				.attr('display', 'block')
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
			const width = dx * (xg.processedLst || xg.grp.lst).length + xg.grpHtAdjustments
			this.totalWidth += width + 2 * Math.max(1, s.colspace)

			for (const yg of this.yGrps) {
				const y = yg.prevGrpTotalIndex * d.dy + yg.grpIndex * s.rowgspace + yg.totalHtAdjustments
				const height = d.dy * (yg.processedLst || yg.grp.lst).length + yg.grpHtAdjustments
				const offsetX = Math.max(1, s.colspace)
				const offsetY = Math.max(1, s.rowspace)
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
	self.render = function(clusters) {
		const s = self.settings
		const d = self.currData.dimensions
		self.dom.clipRect
			.attr('x', s.zoomLevel <= 1 && d.mainw >= d.zoomedMainW ? 0 : Math.abs(d.seriesXoffset) / d.zoomedMainW)
			.attr('y', 0)
			.attr('width', Math.min(d.mainw, d.maxMainW) / this.totalWidth) // d.zoomedMainW)
			.attr('height', 1)

		renderOutlines(clusters, s, d)
	}

	function renderOutlines(clusters, s, d) {
		self.dom.outlines
			.transition()
			.duration(self.dom.outlines.attr('transform') ? s.duration : 0)
			.attr('transform', `translate(${d.xOffset + d.seriesXoffset},${d.yOffset})`)

		const outlines = self.dom.outlines.selectAll('rect').data(clusters, c => c.xg.grp.name + ';;' + c.yg.grp.name)
		outlines.exit().remove()
		outlines.each(render1Outline)
		outlines
			.enter()
			.append('rect')
			.each(render1Outline)
	}

	function render1Outline(cluster) {
		const rect = select(this)
			.transition()
			.duration('x' in this ? self.settings.duration : 0)
			.attr('x', cluster.x)
			.attr('y', cluster.y)
			.attr('width', cluster.width)
			.attr('height', cluster.height)
			.attr('shape-rendering', 'crispEdges')
			.attr('fill', self.settings.cellbg)
			.attr('stroke', '#ccc') //self.settings.cellbg)
			.attr('stroke-width', '1px')
	}
}
