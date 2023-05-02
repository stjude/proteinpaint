import { getCompInit, copyMerge } from '#rx'
import { dofetch3 } from '#common/dofetch'
import { interpolateRgb } from 'd3-interpolate'

const defaultConfig = {
	clusterMethod: 'Average'
}

const clusterMethodLst = ['Single', 'Complete', 'Average', 'Weighted', 'Ward', 'Centroid', 'Median']

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
		plotHeatmap(data, this)
	}

	getParam() {
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

function plotHeatmap(data, self) {
	self.dom.clusterMethodSelect.property('selectedIndex', clusterMethodLst.indexOf(self.state.config.clusterMethod))

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

	// plot

	if (obj.d.xLabHeight) {
		// can plot gene name as row label, do first loop
		ctx.font = obj.d.rowHeight + 'px Arial'
		ctx.textAlign = 'end'
		ctx.fillStyle = 'black'
		for (const [rowIdx, geneIdx] of obj.rowIdxLst.entries()) {
			ctx.fillText(
				obj.geneNameLst[geneIdx],
				obj.d.xDendrogramHeight + obj.d.xLabHeight,
				obj.d.yDendrogramHeight + obj.d.yLabHeight + obj.d.rowHeight * (rowIdx + 1)
			)
		}
	}
	// col names are not plotted yet

	for (let i = 0; i < obj.rowIdxLst.length; i++) {
		const sampleValues = obj.matrix[obj.rowIdxLst[i]] // row of matrix, that are sample values for this gene
		// min/max of this gene, to convert to [0,1] for mapping to color
		const [min, max] = getMinMax(sampleValues)
		for (let j = 0; j < obj.colIdxLst.length; j++) {
			const v = sampleValues[obj.colIdxLst[j]]
			ctx.fillStyle = obj.d.colorScale((v - min) / (max - min))
			ctx.fillRect(
				obj.d.xDendrogramHeight + obj.d.xLabHeight + obj.d.colWidth * j,
				obj.d.yDendrogramHeight + obj.d.yLabHeight + obj.d.rowHeight * i,
				obj.d.colWidth,
				obj.d.rowHeight
			)
		}
	}

	plotDendrogram(ctx, obj)

	plotHmColorScale(self, obj)
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
	const grad = svg
		.append('defs')
		.append('linearGradient')
		.attr('id', 'grad')
	grad
		.append('stop')
		.attr('offset', '0%')
		.attr('stop-color', obj.d.minColor)
	grad
		.append('stop')
		.attr('offset', '100%')
		.attr('stop-color', obj.d.maxColor)
	svg
		.append('rect')
		.attr('width', width)
		.attr('height', height)
		.attr('fill', 'url(#grad)')
	svg.attr('width', width).attr('height', height)
}
