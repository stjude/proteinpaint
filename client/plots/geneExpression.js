import { getCompInit, copyMerge } from '#rx'
import { dofetch3 } from '#common/dofetch'
import { interpolateRgb } from 'd3-interpolate'

const defaultConfig = {
	clusterMethod: 'average',
	distanceMethod: 'euclidean'
}

const clusterMethodLst = [
	'average',
	'complete',
	'mcquitty'
	//'single', very slow
	//'median', 'centroid', crashes R with "No connections found!"
	//'ward.D','ward.D2', crashes client
]

const distanceMethodLst = ['euclidean', 'maximum', 'manhattan', 'canberra']

class geneExpression {
	constructor() {
		this.type = 'geneExpression'
	}
	async init(opts) {
		const holder = this.opts.holder.append('div')
		this.dom = {
			holder,
			controlsDiv: holder.append('div'),
			canvas: holder.append('canvas'),
			colorScaleDiv: holder.append('div')
		}
		this.makeControls()
		this.components = {}
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found`
		}
		return {
			config
		}
	}

	async main() {
		const body = this.getParam()
		const data = await dofetch3('mds3', { body })
		plotHeatmap_R(data, this)
	}

	getParam() {
		console.log(this.state.config.genes)
		const body = {
			genome: this.app.opts.state.vocab.genome,
			dslabel: this.app.opts.state.vocab.dslabel,
			geneExpression: 1,
			genes: this.state.config.genes,
			clusterMethod: this.state.config.clusterMethod
		}
		return body
	}

	makeControls() {
		const s = this.dom.controlsDiv.append('select')
		for (const n of clusterMethodLst) s.append('option').text(n)
		this.dom.clusterMethodSelect = s
		s.on('change', () => {
			this.app.dispatch({
				type: 'plot_edit',
				id: this.id,
				config: { clusterMethod: clusterMethodLst[s.property('selectedIndex')] }
			})
		})
	}
}

export async function getPlotConfig(opts, app) {
	try {
		const config = structuredClone(defaultConfig)

		return copyMerge(config, opts)
	} catch (e) {
		throw `${e} [geneExpression getPlotConfig()]`
	}
}

export const geneExpressionInit = getCompInit(geneExpression)
// this alias will allow abstracted dynamic imports
export const componentInit = geneExpressionInit

export function makeChartBtnMenu(holder, chartsInstance) {
	/*
	holder: the holder in the tooltip
	chartsInstance: MassCharts instance
        termdbConfig is accessible at chartsInstance.state.termdbConfig{}
        mass option is accessible at chartsInstance.app.opts{}
	*/

	// to fill in menu, create options in holder
	/*
	holder.append('div')
		.attr('class','sja_menuoption sja_sharp_border')
		.text('Single gene expression')
		.on('click',()=>{
			chartsInstance.dom.tip.hide()
			
		})
		*/

	holder
		.append('div')
		.attr('class', 'sja_menuoption sja_sharp_border')
		.text('Clustering analysis')
		.on('click', () => {
			chartsInstance.dom.tip.hide()
			chartsInstance.prepPlot({
				config: {
					chartType: 'geneExpression'
				}
			})
		})
}

// connect with output from R
function plotHeatmap_R(data, self) {
	/* data={
		geneNameLst,sampleNameLst,matrix,
		row_dendro [ {id1, x1, y1, id2, x2, y2} ... ]
		row_children [ {id:0, children:[1]}, ...]
		row_names_index [3,1,2]
		col_dendro
		col_children
		col_names_index
	}
	*/
	self.dom.clusterMethodSelect.property('selectedIndex', clusterMethodLst.indexOf(self.state.config.clusterMethod))
	self.dom.distanceMethodSelect.property('selectedIndex', distanceMethodLst.indexOf(self.state.config.distanceMethod))
	const obj = data.clustering
	console.log(obj)
	obj.d = {
		minColor: '#0c306b',
		maxColor: '#ffcc00',
		xDendrogramHeight: 150,
		yDendrogramHeight: 150
	}
	obj.d.colorScale = interpolateRgb(obj.d.minColor, obj.d.maxColor)
	const ctx = self.dom.canvas.node().getContext('2d')

	obj.d.rowHeight = getRowHeight(obj)
	obj.d.colWidth = getColWidth(obj)

	getLabHeight(ctx, obj) // set obj.d.xLabHeight obj.d.yLabHeight

	self.dom.canvas
		.attr('width', obj.d.xDendrogramHeight + obj.d.xLabHeight + obj.d.colWidth * obj.matrix[0].length)
		.attr('height', obj.d.yDendrogramHeight + obj.d.yLabHeight + obj.d.rowHeight * obj.matrix.length)

	plotNames(obj, ctx)
	drawHeatmap(obj, ctx)
	plotDendrogram_R(ctx, obj)
	plotHmColorScale(self, obj)
}

/*
in both row_dendro[] and col_dendro[], elements are: {id1,x1,y1, id2,x2,y2}
is one line traversing between a parent and a child
id1/2 can either be parent or child, it's mixed
x1/2 is row/column node index, 1-based
y1/2 is depth
*/
function plotDendrogram_R(ctx, obj) {
	try {
		obj.row_dendro.map(validateRline)
	} catch (e) {
		throw 'row_dendro error: ' + e
	}
	try {
		obj.col_dendro.map(validateRline)
	} catch (e) {
		throw 'col_dendro error: ' + e
	}

	// hardcoding gene to be on rows, swap x/y for row dendrogram
	for (const r of obj.row_dendro) {
		let t = r.x1
		r.x1 = r.y1
		r.y1 = t
		t = r.x2
		r.x2 = r.y2
		r.y2 = t
	}

	// replace node x/y values with on-screen #pixel for plotting
	{
		let max = 0
		for (const r of obj.row_dendro) max = Math.max(max, r.x1, r.x2)
		const sf = obj.d.xDendrogramHeight / max
		for (const r of obj.row_dendro) {
			r.x1 = sf * (max - r.x1) // for row dendrogram, x is now depth
			r.x2 = sf * (max - r.x2)
			r.y1 *= obj.d.rowHeight // y is number of row items
			r.y2 *= obj.d.rowHeight
		}
	}
	{
		let max = 0
		for (const r of obj.col_dendro) max = Math.max(max, r.y1, r.y2)
		const sf = obj.d.yDendrogramHeight / max
		for (const r of obj.col_dendro) {
			r.y1 = sf * (max - r.y1) // for col dendrogram, y is depth
			r.y2 = sf * (max - r.y2)
			r.x1 *= obj.d.colWidth // x is number of column items
			r.x2 *= obj.d.colWidth
		}
	}

	ctx.strokeStyle = 'black'

	// plot row dendrogram

	let F = obj.d.yDendrogramHeight + obj.d.yLabHeight // yoffset applied to y coord when plotting x dendrogram

	for (const r of obj.row_dendro) {
		ctx.beginPath()

		// r is a line between two points. get extreme x/y
		const x1 = Math.min(r.x1, r.x2),
			x2 = Math.max(r.x1, r.x2),
			y1 = Math.min(r.y1, r.y2),
			y2 = Math.max(r.y1, r.y2)

		// always one way to plot vertical line
		ctx.moveTo(x1, y1 + F)
		ctx.lineTo(x1, y2 + F)

		// two ways to plot horizontal line
		if ((r.x1 > r.x2 && r.y1 > r.y2) || (r.x1 < r.x2 && r.y1 < r.y2)) {
			// one point is on lower right of another, the horizontal line is based on *max y*
			ctx.lineTo(x2, y2 + F)
		} else {
			// one point is on upper right of another, the horizontal line is based on *min y*
			ctx.moveTo(x1, y1 + F)
			ctx.lineTo(x2, y1 + F)
		}
		ctx.stroke()
		ctx.closePath()
	}

	// plot column dendrogram
	F = obj.d.xDendrogramHeight + obj.d.xLabHeight // xoffset applied to x coord when plotting y dendrogram
	for (const r of obj.col_dendro) {
		ctx.beginPath()
		const x1 = Math.min(r.x1, r.x2),
			x2 = Math.max(r.x1, r.x2),
			y1 = Math.min(r.y1, r.y2),
			y2 = Math.max(r.y1, r.y2)
		ctx.moveTo(F + x1, y1)
		ctx.lineTo(F + x2, y1) // hline
		if ((r.x1 > r.x2 && r.y1 > r.y2) || (r.x1 < r.x2 && r.y1 < r.y2)) {
			// vline at max x
			ctx.lineTo(F + x2, y2)
		} else {
			// vline at min x
			ctx.moveTo(F + x1, y1)
			ctx.lineTo(F + x1, y2)
		}
		ctx.stroke()
		ctx.closePath()
	}
}
function validateRline(r) {
	// a line between parent and child, {id1,x1,y1, id2,x2,y2}

	// r1/2 is node id, 0-based, currently not used
	if (r.r1 < 0) throw `r.r1<0 ${r.r1}`
	if (r.r2 < 0) throw `r.r2<0 ${r.r2}`

	// x1/2 is matrix row/column entity index, 1-based; parent node can get non-integer value
	if (r.x1 < 1) throw `r.x1<1 ${r.x1}`
	if (r.x2 < 1) throw `r.x2<1 ${r.x2}`
	r.x1 -= 0.5 // since the values are 1-based, subtract 0.5 to point to middle of row/column when rendering
	r.x2 -= 0.5

	// y1/2 is dendrogram node depth, non-negative
	if (r.y1 < 0) throw `r.y1<0 ${r.y1}`
	if (r.y2 < 0) throw `r.y2<0 ${r.y2}`
}

// connect with output from rust/src/cluster
function plotHeatmap(data, self) {
	self.dom.clusterMethodSelect.property('selectedIndex', clusterMethodLst.indexOf(self.state.config.clusterMethod))
	self.dom.distanceMethodSelect.property('selectedIndex', distanceMethodLst.indexOf(self.state.config.distanceMethod))
	// data={geneNameLst,sampleNameLst,matrix,rowIdxLst,sorted_sample_coordinates,sorted_gene_coordinates}
	const obj = data.clustering
	console.log(obj)
	obj.d = {
		minColor: '#0c306b',
		maxColor: '#ffcc00',
		xDendrogramHeight: 150,
		yDendrogramHeight: 150
	}
	obj.d.colorScale = interpolateRgb(obj.d.minColor, obj.d.maxColor)

	const ctx = self.dom.canvas.node().getContext('2d')

	obj.d.rowHeight = getRowHeight(obj)
	obj.d.colWidth = getColWidth(obj)

	//parseDendrogram(obj)

	{
		const r = parseDendrogram2(obj.rowSteps, obj.matrix.length)
		obj.rowIdxLst = r.idxLst
		obj.xId2coord = r.id2coord
		let max = 0
		for (const n of obj.xId2coord.values()) {
			max = Math.max(max, n.x)
		}
		for (const n of obj.xId2coord.values()) {
			n.x = max - n.x
			n.y *= obj.d.rowHeight
			n.y += obj.d.rowHeight / 2
		}
		const scale = obj.d.xDendrogramHeight / max
		for (const n of obj.xId2coord.values()) {
			n.x *= scale
		}
	}
	{
		const r = parseDendrogram2(obj.colSteps, obj.matrix[0].length)
		obj.colIdxLst = r.idxLst
		obj.yId2coord = r.id2coord
		let max = 0
		for (const n of obj.yId2coord.values()) {
			const t = n.x
			n.x = n.y
			n.y = t
			max = Math.max(max, n.y)
		}
		for (const n of obj.yId2coord.values()) {
			n.y = max - n.y
			n.x *= obj.d.colWidth
		}
		const scale = obj.d.yDendrogramHeight / max
		for (const n of obj.yId2coord.values()) {
			n.y *= scale
		}
	}

	getLabHeight(ctx, obj)
	// set obj.d.xLabHeight obj.d.yLabHeight

	self.dom.canvas
		.attr('width', obj.d.xDendrogramHeight + obj.d.xLabHeight + obj.d.colWidth * obj.colIdxLst.length)
		.attr('height', obj.d.yDendrogramHeight + obj.d.yLabHeight + obj.d.rowHeight * obj.rowIdxLst.length)

	plotNames(obj, ctx)
	drawHeatmap(obj, ctx)
	plotDendrogram(ctx, obj)
	plotHmColorScale(self, obj)
}
function plotNames(obj, ctx) {
	if (obj.d.xLabHeight) {
		// can plot gene name as row label, do first loop
		ctx.font = obj.d.rowHeight + 'px Arial'
		ctx.textAlign = 'end'
		ctx.fillStyle = 'black'
		for (const [rowIdx, geneIdx] of obj.row_names_index.entries()) {
			ctx.fillText(
				obj.geneNameLst[geneIdx - 1],
				obj.d.xDendrogramHeight + obj.d.xLabHeight,
				obj.d.yDendrogramHeight + obj.d.yLabHeight + obj.d.rowHeight * (rowIdx + 1)
			)
		}
	}
	// col names are not plotted yet
}
function drawHeatmap(obj, ctx) {
	for (let i = 0; i < obj.row_names_index.length; i++) {
		const sampleValues = obj.matrix[obj.row_names_index[i] - 1] // row of matrix, that are sample values for this gene
		// min/max of this gene, to convert to [0,1] for mapping to color
		const [min, max] = getMinMax(sampleValues)
		for (let j = 0; j < obj.col_names_index.length; j++) {
			const v = sampleValues[obj.col_names_index[j] - 1]
			ctx.fillStyle = obj.d.colorScale((v - min) / (max - min))
			ctx.fillRect(
				obj.d.xDendrogramHeight + obj.d.xLabHeight + obj.d.colWidth * j,
				obj.d.yDendrogramHeight + obj.d.yLabHeight + obj.d.rowHeight * i,
				obj.d.colWidth,
				obj.d.rowHeight
			)
		}
	}
}
function getRowHeight(obj) {
	const h = 500 / obj.matrix.length
	if (h > 20) return 20
	if (h < 10) return 10
	return Math.ceil(h)
}
function getColWidth(obj) {
	const w = 2000 / obj.matrix[0].length
	if (w > 10) return 10
	return Math.ceil(w)
}
function getLabHeight(ctx, obj) {
	if (obj.geneNameLst && obj.d.rowHeight >= 7) {
		ctx.font = obj.d.rowHeight + 'px Arial'
		let max = 0
		for (const n of obj.geneNameLst) {
			max = Math.max(max, ctx.measureText(n).width)
		}
		obj.d.xLabHeight = max
	} else {
		obj.d.xLabHeight = 0
	}

	if (obj.sampleNameLst && obj.d.colWidth >= 7) {
		ctx.font = obj.d.colWidth + 'px Arial'
		let max = 0
		for (const n of obj.sampleNameLst) {
			max = Math.max(max, ctx.measureText(n).width)
		}
		obj.d.yLabHeight = max
	} else {
		obj.d.yLabHeight = 0
	}
}
function getMinMax(row) {
	let min = null,
		max
	for (const v of row) {
		if (min == null) {
			min = v
			max = v
		} else {
			min = Math.min(min, v)
			max = Math.max(max, v)
		}
	}
	return [min, max]
}

// not in use
function parseDendrogram(obj) {
	// if isX=true, collect max y from all nodes; otherwise collect max x
	obj.xId2coord = new Map()
	let max = null
	for (const n of obj.sorted_gene_coordinates) {
		// convert to on-canvas position
		n.node_coordinates.x *= obj.d.dFactor
		n.node_coordinates.y *= obj.d.rowHeight
		n.node_coordinates.y += obj.d.rowHeight / 2

		obj.xId2coord.set(n.node_id, n.node_coordinates)
		const v = n.node_coordinates.x
		if (max == null) max = v
		else max = Math.max(max, v)
	}
	obj.d.xDendrogramHeight = max

	obj.yId2coord = new Map()
	max = null
	for (const n of obj.sorted_sample_coordinates) {
		// convert
		n.node_coordinates.x *= obj.d.colWidth
		n.node_coordinates.y *= obj.d.dFactor

		obj.yId2coord.set(n.node_id, n.node_coordinates)
		const v = n.node_coordinates.y
		if (max == null) max = v
		else max = Math.max(max, v)
	}
	obj.d.yDendrogramHeight = max
}

function parseDendrogram2(steps, leafCount) {
	const idxLst = [] // list of leaf idx, sorted by steps
	const id2coord = new Map() // k: node idx, v: {x,y,children[]}

	let currentRowIdx = 0 // cumulative row number, to derive y position of each node
	const parentHeap = [] // heap of parent nodes, last in, first out

	for (const [i, step] of steps.entries()) {
		// collect leaf id by the order of appearance in rowSteps[], into rowIdxLst
		if (step.size == 2) {
			// both leaf

			idxLst.push(step.cluster1)
			idxLst.push(step.cluster2)

			const y1 = currentRowIdx++,
				y2 = currentRowIdx++
			id2coord.set(step.cluster1, { x: 0, y: y1 })
			id2coord.set(step.cluster2, { x: 0, y: y2 })
			// a free parent node is generated with these two leaves, and is cached in the array (it has no id yet)
			parentHeap.push({
				x: step.dissimilarity,
				y: (y1 + y2) / 2,
				children: [step.cluster1, step.cluster2]
			})
			continue
		}

		// at least one node is parent; may have a leaf
		// for every parent node, consume one earlier parent from the heap

		let leafId = null,
			parentId
		if (step.cluster1 < leafCount) {
			leafId = step.cluster1
			if (step.cluster2 < leafCount) throw 'cluster2 also leaf'
			parentId = step.cluster2
		} else if (step.cluster2 < leafCount) {
			leafId = step.cluster2
			parentId = step.cluster1
		}

		if (leafId != null) {
			// this is a link between a parent and a leaf
			idxLst.push(leafId)
			const y1 = currentRowIdx++
			id2coord.set(leafId, { x: 0, y: y1 })
			if (parentHeap.length == 0) throw 'empty heap, expecting 1'
			const p = parentHeap.pop()
			id2coord.set(parentId, p)
			// generate a new parent
			parentHeap.push({
				x: step.dissimilarity,
				y: (y1 + p.y) / 2,
				children: [step.cluster1, step.cluster2]
			})
			continue
		}

		// both are parent
		if (parentHeap.length < 2) throw 'heap has less than 2'
		const p1 = parentHeap.pop(),
			p2 = parentHeap.pop()
		id2coord.set(step.cluster1, p1)
		id2coord.set(step.cluster2, p2)
		// generate new parent
		parentHeap.push({
			x: step.dissimilarity,
			y: (p1.y + p2.y) / 2,
			children: [step.cluster1, step.cluster2]
		})
	}

	if (parentHeap.length != 1) throw '1 last parent not in heap'
	id2coord.set(leafCount * 2, parentHeap[0])
	return { idxLst, id2coord }
}

function plotDendrogram(ctx, obj) {
	ctx.strokeStyle = 'black'

	let F = obj.d.yDendrogramHeight + obj.d.yLabHeight // yoffset applied to y coord when plotting x dendrogram

	for (const n of obj.xId2coord.values()) {
		if (!n.children) continue
		if (n.children.length != 2) throw 'gene child_nodes length!=2'
		const [c1, c2] = n.children
		const p1 = obj.xId2coord.get(c1),
			p2 = obj.xId2coord.get(c2)
		if (!p1 || !p2) throw 'coord not found for gene child nodes'

		/*
		|-------p1
		|
		n
		|
		|-------p2
		*/
		ctx.beginPath()
		// h line from n to p1
		ctx.moveTo(n.x, p1.y + F)
		ctx.lineTo(p1.x, p1.y + F)
		// h line from n to p2
		ctx.moveTo(n.x, p2.y + F)
		ctx.lineTo(p2.x, p2.y + F)
		// v line through n, from p1 to p2
		ctx.moveTo(n.x, p1.y + F)
		ctx.lineTo(n.x, p2.y + F)
		// end
		ctx.stroke()
		ctx.closePath()
	}

	F = obj.d.xDendrogramHeight + obj.d.xLabHeight // xoffset applied to x coord when plotting y dendrogram

	for (const n of obj.yId2coord.values()) {
		if (!n.children) continue
		if (n.children.length != 2) throw 'child_nodes length!=2'
		const [c1, c2] = n.children
		const p1 = obj.yId2coord.get(c1),
			p2 = obj.yId2coord.get(c2)
		if (!p1 || !p2) throw 'coord not found for sample child nodes'
		/*
		|-----n-----|
		|           |
		|           |
		p1          p2
		*/
		ctx.beginPath()
		// v line from n to p1
		ctx.moveTo(F + p1.x, n.y)
		ctx.lineTo(F + p1.x, p1.y)
		// v line from n to p2
		ctx.moveTo(F + p2.x, n.y)
		ctx.lineTo(F + p2.x, p2.y)
		// h line through n, from p1 to p2
		ctx.moveTo(F + p1.x, n.y)
		ctx.lineTo(F + p2.x, n.y)
		// end
		ctx.stroke()
		ctx.closePath()
	}
}

function plotHmColorScale(self, obj) {
	self.dom.colorScaleDiv.selectAll('*').remove()
	const width = 100,
		height = 20
	self.dom.colorScaleDiv.append('span').text('Min')
	const svg = self.dom.colorScaleDiv.append('svg')
	self.dom.colorScaleDiv.append('span').text('Max')
	const grad = svg.append('defs').append('linearGradient').attr('id', 'grad')
	grad.append('stop').attr('offset', '0%').attr('stop-color', obj.d.minColor)
	grad.append('stop').attr('offset', '100%').attr('stop-color', obj.d.maxColor)
	svg.append('rect').attr('width', width).attr('height', height).attr('fill', 'url(#grad)')
	svg.attr('width', width).attr('height', height)
}
