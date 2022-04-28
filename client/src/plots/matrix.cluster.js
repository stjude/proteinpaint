import { select, selectAll, mouse, event } from 'd3-selection'

export class MatrixCluster {
	constructor(opts) {
		this.parent = opts.parent
		const svg = opts.svg
		this.dom = {
			holder: opts.holder,
			outlines: opts.holder.append('g').attr('class', 'sjpp-matrix-clusteroutlines'),
			//clusterrowline: opts.holder.insert('g', 'g').attr('class', 'sjpp-matrix-clusterrowline'),
			//clustercolline: opts.holder.insert('g', 'g').attr('class', 'sjpp-matrix-clustercolline'),
			clusterbg: opts.holder.insert('g', 'g').attr('class', 'sjpp-matrix-clusterbg')
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

		for (const xg of this.xGrps) {
			const x = xg.prevGrpTotalIndex * d.dx + s.colgspace * xg.grpIndex + xg.totalHtAdjustments
			const width = d.dx * xg.grp.lst.length + xg.grpHtAdjustments

			for (const yg of this.yGrps) {
				const y = yg.prevGrpTotalIndex * d.dy + yg.grpIndex * s.rowgspace + yg.totalHtAdjustments
				const height = d.dy * yg.grp.lst.length + yg.grpHtAdjustments
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
		renderOutlines(clusters, s, d)
	}

	function renderOutlines(clusters, s, d) {
		self.dom.outlines
			.transition()
			.duration(self.dom.outlines.attr('transform') ? s.duration : 0)
			.attr('transform', `translate(${d.xOffset},${d.yOffset})`)

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
