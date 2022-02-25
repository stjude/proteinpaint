import { select, selectAll, mouse, event } from 'd3-selection'
//import {labelAdjuster} from '../dom/labeladjuster'

export class MatrixCluster {
	constructor(opts) {
		const svg = opts.svg
		this.dom = {
			holder: opts.holder,
			outlines: opts.holder.append('g').attr('class', 'sjpp-matrix-clusteroutlines'),
			rowgrplabels: opts.holder.insert('g', 'g').attr('class', 'sjpp-matrix-rowgrplabels'),
			colgrplabels: opts.holder.append('g', 'g').attr('class', 'sjpp-matrix-colgrplabels'),
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
		//console.log(24, this.clusters)
		this.render(this.clusters)
	}

	processData() {
		const s = this.settings
		const d = this.currData.dimensions

		const clusters = []
		let xOffset = 0

		for (const [xIndex, xgrp] of this.xGrps.entries()) {
			const x = xOffset + s.colgspace * xIndex //- s.colspace
			const width = d.dx * xgrp.lst.length //+ s.colspace
			let yOffset = 0

			for (const [yIndex, ygrp] of this.yGrps.entries()) {
				const y = yOffset + (yIndex === 0 ? 0 : s.rowgspace) //* yIndex
				const height = d.dy * ygrp.lst.length //+ s.rowspace

				clusters.push({
					samplegrp: !s.transpose ? xgrp : ygrp,
					termgrp: s.transpose ? xgrp : ygrp,
					// use colspace and rowspace as padding around the cluster outline
					x: x - s.colspace,
					y: y - s.rowspace,
					width: width + s.colspace,
					height: height + s.rowspace
				})

				yOffset = y + height
			}

			xOffset += width
		}

		return clusters
	}
}

function setRenderers(self) {
	self.render = function(clusters) {
		const s = self.settings
		const d = self.currData.dimensions
		renderOutlines(clusters, s, d)
		renderColGrpLabels(clusters, s, d)
		renderRowGrpLabels(clusters, s, d)
	}

	function renderOutlines(clusters, s, d) {
		self.dom.outlines
			.transition()
			.duration(self.dom.outlines.attr('transform') ? s.duration : 0)
			.attr('transform', `translate(${d.xOffset},${d.yOffset})`)

		const outlines = self.dom.outlines.selectAll('rect').data(clusters, c => c.samplegrp.id + ';;' + c.termgrp.name)
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
			.attr('fill', 'transparent')
			.attr('stroke', '#555')
			.attr('stroke-width', '1px')
	}

	function renderColGrpLabels(clusters, s, d) {
		// find the reference row group for placement
		const yRef = self.yGrps[s.collabelpos == 'top' ? self.yGrps.length - 1 : 0].name
		const xClusters = clusters.filter(c => {
			return c[self.yGrpKey].name === yRef
		})
		//console.log(110, yRef, xClusters, clusters, self.currData)
		const x = d.xOffset + d.xLabelGap.grp
		const y = d.yOffset + xClusters[0].y + xClusters[0].height + d.yLabelGap.grp

		self.dom.colgrplabels
			.transition()
			.duration(self.dom.colgrplabels.attr('transform') ? s.duration : 0)
			.attr('transform', `translate(${x},${y})`)

		const labels = self.dom.colgrplabels.selectAll('g').data(xClusters)
		labels.exit().remove()
		labels.each(render1ColGrpLabel)
		labels
			.enter()
			.append('g')
			.each(render1ColGrpLabel)
	}

	function render1ColGrpLabel(cluster) {
		const s = self.settings
		const duration = this.firstChild ? s.duration : 0
		const g = select(this)

		g.transition()
			.duration(duration)
			.attr('transform', `translate(${cluster.x + cluster.width / 2},0)`)

		if (!this.firstChild) g.append('text')
		g.select('text')
			.attr('text-anchor', 'end')
			.transition()
			.duration(duration)
			.attr('transform', 'rotate(-90)')
			.text(cluster[self.xGrpKey].name)
	}

	function renderRowGrpLabels(clusters, s, d) {
		// find the reference column group for placement
		const xRef = self.xGrps[s.collabelpos == 'left' ? 0 : self.xGrps.length - 1].name
		const yClusters = clusters.filter(c => {
			return c[self.xGrpKey].name === xRef
		})

		const x = d.xOffset + yClusters[0].x + yClusters[0].width + d.xLabelGap.grp
		const y = d.yOffset + d.yLabelGap.grp

		self.dom.rowgrplabels
			.transition()
			.duration(self.dom.rowgrplabels.attr('transform') ? s.duration : 0)
			.attr('transform', `translate(${x},${y})`)

		const labels = self.dom.rowgrplabels.selectAll('g').data(yClusters)
		labels.exit().remove()
		labels.each(render1RowGrpLabel)
		labels
			.enter()
			.append('g')
			.each(render1RowGrpLabel)
	}

	function render1RowGrpLabel(cluster) {
		const s = self.settings
		const duration = this.firstChild ? s.duration : 0
		const g = select(this)

		g.transition()
			.duration(duration)
			.attr('transform', `translate(0,${cluster.y + cluster.height / 2})`)

		if (!this.firstChild) g.append('text')
		g.select('text')
			.attr('text-anchor', 'start')
			.transition()
			.duration(duration)
			//.attr('transform', 'rotate(-90)')
			.text(cluster[self.yGrpKey].name)
	}
}
