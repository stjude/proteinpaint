import { TermTypes } from '../shared/terms'

export function maySetSandboxHeader() {
	// run only once upon init, after state and dataType is given
	if (!this.dom.header) return // no header
	switch (this.config.settings.hierCluster.dataType) {
		case TermTypes.GENE_EXPRESSION:
			this.dom.header.text('Gene Expression Clustering')
			break
		case TermTypes.METABOLITE_INTENSITY:
			this.dom.header.text('Metabolite Intensity Clustering')
			break
		default:
			throw 'unknown hierCluster.dataType to set header'
	}
}

export function plotDendrogramHclust(plotColOnly) {
	/*
	based on hclust() output
	plotColOnly=true will only render column dendrograms
	if false will render both row and column
	*/
	const d = this.dimensions
	const s = this.config.settings.matrix
	const xOffset = d.seriesXoffset // could be negative when zoomed
	const pxr = window.devicePixelRatio <= 1 ? 1 : window.devicePixelRatio

	const obj = this.hierClusterData.clustering
	const row = obj.row
	const col = obj.col
	/* both row{} and col{} are hclust() output structure:
	.merge[]       {n1,n2}
	.height[]      {height}
	.order[]       {name}
	.inputOrder[]  [str]
	*/

	const rowHeight = this.dimensions.dy,
		xDendrogramHeight = this.settings.hierCluster.xDendrogramHeight,
		colWidth = this.dimensions.dx,
		yDendrogramHeight = this.settings.hierCluster.yDendrogramHeight

	// plot column dendrogram
	if (!this.settings.hierCluster.clusterSamples) {
		this.dom.topDendrogram.selectAll('*').remove()
	} else {
		const height2px = getHclustHeightScalefactor(col.height, yDendrogramHeight)

		const height = yDendrogramHeight + 0.0000001
		const width = colWidth * col.inputOrder.length
		const canvas = new OffscreenCanvas(width * pxr, height * pxr)
		const ctx = canvas.getContext('2d')
		ctx.scale(pxr, pxr)
		ctx.imageSmoothingEnabled = false
		ctx.imageSmoothingQuality = 'high'
		ctx.strokeStyle = 'black'

		const mergedClusters = new Map()
		/*
		as iterating through .merge[], collect merged clusters in here
		k: cluster id, positive integer, as in row.merge[]
		v: {
			x:
			y:
			children:[]
		}
		*/
		for (const [clusterid0, pair] of col.merge.entries()) {
			// pair is {n1,n2}, n1 and n2 form a new cluster; id of which is clusterid

			const clusterid = clusterid0 + 1 // id of this cluster formed by pair, as used in hclust$merge; positive integer
			const children = [] // collect all children leaves for this cluster
			const childrenClusters = [] // collect direct children cluster Ids for this cluster

			let x1, x2, y1, y2
			if (pair.n1 < 0) {
				// n1 is leaf
				const [name, columnNumber] = getLeafNumber(pair.n1, col.inputOrder, col.order)
				x1 = colWidth * (columnNumber + 0.5)
				y1 = yDendrogramHeight
				children.push({ name })
			} else {
				// n1 is cluster
				if (!mergedClusters.has(pair.n1)) throw 'pair.n1 is positive but not seen before'
				const c = mergedClusters.get(pair.n1)
				x1 = c.x
				y1 = c.y
				children.push(...c.children)
				childrenClusters.push(pair.n1)
			}
			if (pair.n2 < 0) {
				// n2 is leaf
				const [name, columnNumber] = getLeafNumber(pair.n2, col.inputOrder, col.order)
				x2 = colWidth * (columnNumber + 0.5)
				y2 = yDendrogramHeight
				children.push({ name })
			} else {
				if (!mergedClusters.has(pair.n2)) throw 'pair.n1 is positive but not seen before'
				const c = mergedClusters.get(pair.n2)
				x2 = c.x
				y2 = c.y
				children.push(...c.children)
				childrenClusters.push(pair.n2)
			}
			// cluster y position
			const clusterY = yDendrogramHeight - col.height[clusterid0].height * height2px

			const highlight = this.clickedClusterIds?.includes(clusterid)
			ctx.strokeStyle = highlight ? 'red' : 'black'

			ctx.beginPath()
			ctx.moveTo(x1, y1) // move to n1
			ctx.lineTo(x1, clusterY) // vertical line up to cluster
			ctx.lineTo(x2, clusterY) // h line to n2
			ctx.lineTo(x2, y2) // v line down to n2
			ctx.stroke()
			ctx.closePath()

			mergedClusters.set(clusterid, {
				x: (x1 + x2) / 2,
				y: clusterY,
				children,
				childrenClusters,
				clusterPosition: {
					x1,
					x2,
					y1,
					y2,
					clusterY
				}
			})
		}

		this.renderImage(this.dom.topDendrogram, canvas, width, height, xDendrogramHeight + 0.5 * colWidth, rowHeight)

		col.mergedClusters = mergedClusters
	}

	if (plotColOnly) return

	// plot row dendrogram
	const height2px = getHclustHeightScalefactor(row.height, xDendrogramHeight)

	const width = xDendrogramHeight + 0.0000001
	const height = rowHeight * row.inputOrder.length
	const canvas = new OffscreenCanvas(width * pxr, height * pxr)
	const ctx = canvas.getContext('2d')
	ctx.scale(pxr, pxr)
	ctx.imageSmoothingEnabled = false
	ctx.imageSmoothingQuality = 'high'
	ctx.strokeStyle = 'black'

	const mergedClusters = new Map()
	for (const [clusterid0, pair] of row.merge.entries()) {
		// pair is {n1,n2}, n1 and n2 form a new cluster; id of which is clusterid

		const clusterid = clusterid0 + 1 // id of this cluster formed by pair, as used in hclust$merge; positive integer
		const children = [] // collect all children leaves for this cluster

		let x1, x2, y1, y2
		if (pair.n1 < 0) {
			// n1 is leaf
			const [name, rowNumber] = getLeafNumber(pair.n1, row.inputOrder, row.order)
			y1 = rowHeight * (rowNumber + 0.5)
			x1 = xDendrogramHeight
			children.push({ name })
		} else {
			// n1 is cluster
			if (!mergedClusters.has(pair.n1)) throw 'pair.n1 is positive but not seen before'
			const c = mergedClusters.get(pair.n1)
			x1 = c.x
			y1 = c.y
			children.push(...c.children)
		}
		if (pair.n2 < 0) {
			// n2 is leaf
			const [name, rowNumber] = getLeafNumber(pair.n2, row.inputOrder, row.order)
			y2 = rowHeight * (rowNumber + 0.5)
			x2 = xDendrogramHeight
			children.push({ name })
		} else {
			if (!mergedClusters.has(pair.n2)) throw 'pair.n1 is positive but not seen before'
			const c = mergedClusters.get(pair.n2)
			x2 = c.x
			y2 = c.y
			children.push(...c.children)
		}
		// cluster x position
		const clusterX = xDendrogramHeight - row.height[clusterid0].height * height2px

		ctx.beginPath()
		ctx.moveTo(x1, y1) // move to n1
		ctx.lineTo(clusterX, y1) // h line right to cluster
		ctx.lineTo(clusterX, y2) // v line down to n2
		ctx.lineTo(x2, y2) // h line left to n2
		ctx.stroke()
		ctx.closePath()

		mergedClusters.set(clusterid, {
			x: clusterX,
			y: (y1 + y2) / 2,
			children
		})
	}

	const t = this.termOrder.find(t => t.grp.type == 'hierCluster' || t.grp.name == this.hcTermGroup.name)
	const ty =
		//t.labelOffset is commented out because it causes row dendrogram to be misrendered
		t.grpIndex * s.rowgspace + t.prevGrpTotalIndex * d.dy /* + (t.labelOffset || 0) */ + t.totalHtAdjustments
	this.renderImage(this.dom.leftDendrogram, canvas, width, height, 0, ty + yDendrogramHeight + 1.5 * rowHeight)

	row.mergedClusters = mergedClusters
}

export async function renderImage(g, canvas, width, height, x, y) {
	const reader = new FileReader()
	reader.addEventListener(
		'load',
		() => {
			// remove a previously rendered image, if applicable, right before replacing it
			// so that there will be no flicker on update
			g.selectAll('*').remove()

			g.append('image') //.attr('transform', `translate(${x},${y})`)
				.attr('x', x + 0.033)
				.attr('y', y + 0.033)
				.attr('xlink:href', reader.result)
				.attr('width', width)
				.attr('height', height)
		},
		false
	)
	const blob = await canvas.convertToBlob({ quality: 1 })
	reader.readAsDataURL(blob)
	// g.selectAll('*').remove()
	// const foCanvas = g.append('foreignObject').append('canvas').attr('width', width).attr('height', height).node()
	// const bitmap = canvas.transferToImageBitmap();
	// foCanvas.getContext("bitmaprenderer").transferFromImageBitmap(bitmap);
}

function getHclustHeightScalefactor(lst, ph) {
	// scale hclust$height to on-screen max height (h) in number of pixels
	let max = lst[0].height
	for (const h of lst) max = Math.max(max, h.height)
	return ph / max
}

function getLeafNumber(minus, inputOrder, order) {
	const name = inputOrder[-minus - 1]
	if (!name) throw 'minus not in inputOrder'
	const i = order.findIndex(j => j.name == name)
	if (i == -1) throw 'name not found in hc$order'
	return [name, i]
}
