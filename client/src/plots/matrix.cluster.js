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
		this.settings = this.currData.config.settings.matrix
		this.clusters = this.processData()
		//console.log(24, this.clusters)
		this.render(this.clusters)
	}

	processData() {
		const s = this.settings
		this.dimensions = this.getDimensions(s)
		const d = this.dimensions

		const clusters = []
		let xOffset = 0 //, yOffset = 0
		const xGrps = !s.transpose ? this.currData.sampleGroups : this.currData.termGroups
		const yGrps = !s.transpose ? this.currData.termGroups : this.currData.sampleGroups

		for (const [xIndex, xgrp] of xGrps.entries()) {
			const x = xOffset + s.colgspace * xIndex //- s.colspace
			const width = d.dx * xgrp.lst.length //+ s.colspace
			let yOffset = 0

			for (const [yIndex, ygrp] of yGrps.entries()) {
				const y = yOffset + (yIndex == 0 ? 0 : s.rowgspace) //* yIndex
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

	getDimensions(s) {
		return {
			dx: s.colw + s.colspace,
			dy: s.rowh + s.rowspace,
			xOffset: s.margin.left + (!s.transpose ? s.termLabelOffset : s.sampleLabelOffset),
			yOffset: s.margin.top + (!s.transpose ? s.sampleLabelOffset : s.termLabelOffset)
		}
	}
}

function setRenderers(self) {
	self.render = function(clusters) {
		const s = self.settings
		const d = self.dimensions
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
		const yGrps = !s.transpose ? self.currData.termGroups : self.currData.sampleGroups
		// find the reference row group for placement
		const yRef = yGrps[s.collabelpos == 'top' ? yGrps.length - 1 : 0].name
		const xGrps = !s.transpose ? self.currData.sampleGroups : self.currData.termGroups
		const clusterKey = !s.transpose ? 'termgrp' : 'samplegrp'
		const xClusters = clusters.filter(c => {
			return c[clusterKey].name === yRef
		})
		//console.log(123, yGrps, yRef, xGrps, clusterKey, xClusters, clusters)

		const gy = d.yOffset + xClusters[0].y + xClusters[0].height + 5

		self.dom.colgrplabels
			.transition()
			.duration(self.dom.colgrplabels.attr('transform') ? s.duration : 0)
			.attr('transform', `translate(${d.xOffset},${gy})`)

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
			.text(cluster[!s.transpose ? 'samplegrp' : 'termgrp'].name)
	}

	function renderRowGrpLabels(clusters, s, d) {
		const xGrps = s.transpose ? self.currData.termGroups : self.currData.sampleGroups
		// find the reference column group for placement
		const xRef = xGrps[s.collabelpos == 'left' ? 0 : xGrps.length - 1].name
		const yGrps = s.transpose ? self.currData.sampleGroups : self.currData.termGroups
		const clusterKey = s.transpose ? 'termgrp' : 'samplegrp'
		const yClusters = clusters.filter(c => {
			return c[clusterKey].name === xRef
		})
		//console.log(yGrps, yRef, xGrps, clusterKey, xClusters, clusters)

		const gx = d.xOffset + yClusters[0].x + yClusters[0].width + 5

		self.dom.rowgrplabels
			.transition()
			.duration(self.dom.rowgrplabels.attr('transform') ? s.duration : 0)
			.attr('transform', `translate(${gx},${d.yOffset})`)

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
			.text(cluster[s.transpose ? 'samplegrp' : 'termgrp'].name)
	}
}
