import { getCompInit, copyMerge } from '#rx'
import { dofetch3 } from '#common/dofetch'
import { interpolateRgb } from 'd3-interpolate'

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
			genes: this.state.config.genes
		}
		return body
	}
}

export async function getPlotConfig(opts, app) {
	try {
		const config = {}

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
	// {geneNameLst,sampleNameLst,matrix,sorted_sample_elements,sorted_gene_elements,sorted_sample_coordinates,sorted_gene_coordinates}
	const obj = data.clustering
	obj.d = {
		minColor: '#0c306b',
		maxColor: '#ffcc00',
		dFactor: 100 // times this factor when plotting dendrogram
	}
	obj.d.colorScale = interpolateRgb(obj.d.minColor, obj.d.maxColor)

	const ctx = self.dom.canvas.node().getContext('2d')

	obj.d.rowHeight = getRowHeight(obj)
	obj.d.colWidth = getColWidth(obj)

	parseDendrogram(obj)
	/* set below
	obj.xId2coord
	obj.yId2coord
	obj.d.xDendrogramHeight
	obj.d.yDendrogramHeight
	*/

	getLabHeight(ctx, obj)
	// set obj.d.xLabHeight obj.d.yLabHeight

	self.dom.canvas
		.attr('width', obj.d.xDendrogramHeight + obj.d.xLabHeight + obj.d.colWidth * obj.sorted_sample_elements.length)
		.attr('height', obj.d.yDendrogramHeight + obj.d.yLabHeight + obj.d.rowHeight * obj.sorted_gene_elements.length)

	// plot

	if (obj.d.xLabHeight) {
		// can plot gene name as row label, do first loop
		ctx.font = obj.d.rowHeight + 'px Arial'
		ctx.textAlign = 'end'
		ctx.fillStyle = 'black'
		for (const [rowIdx, geneIdx] of obj.sorted_gene_elements.entries()) {
			ctx.fillText(
				obj.geneNameLst[geneIdx],
				obj.d.xDendrogramHeight + obj.d.xLabHeight,
				obj.d.yDendrogramHeight + obj.d.yLabHeight + obj.d.rowHeight * (rowIdx + 1)
			)
		}
	}
	// col names are not plotted yet

	for (const [rowIdx, geneIdx] of obj.sorted_gene_elements.entries()) {
		const sampleValues = obj.matrix[geneIdx] // row of matrix, that are sample values for this gene
		// min/max of this gene, to convert to [0,1] for mapping to color
		const [min, max] = getMinMax(sampleValues)
		for (const [colIdx, sampleIdx] of obj.sorted_sample_elements.entries()) {
			const v = sampleValues[sampleIdx]
			ctx.fillStyle = obj.d.colorScale((v - min) / (max - min))
			ctx.fillRect(
				obj.d.xDendrogramHeight + obj.d.xLabHeight + obj.d.colWidth * colIdx,
				obj.d.yDendrogramHeight + obj.d.yLabHeight + obj.d.rowHeight * rowIdx,
				obj.d.colWidth,
				obj.d.rowHeight
			)
		}
	}

	plotXdendrogram(ctx, obj)
	console.log(obj)
	{
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
}
function getRowHeight(obj) {
	const h = 500 / obj.sorted_gene_elements.length
	if (h > 20) return 20
	return Math.ceil(h)
}
function getColWidth(obj) {
	const w = 2000 / obj.sorted_sample_elements.length
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
function parseDendrogram(obj) {
	// if isX=true, collect max y from all nodes; otherwise collect max x
	obj.xId2coord = new Map()
	let max = null
	for (const n of obj.sorted_gene_coordinates) {
		// convert to on-canvas position
		n.node_coordinates.x *= obj.d.dFactor
		n.node_coordinates.y *= obj.d.rowHeight

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
function plotXdendrogram(ctx, obj) {
	ctx.strokeStyle = 'black'

	let F = obj.d.yDendrogramHeight + obj.d.yLabHeight // yoffset applied to y coord when plotting x dendrogram

	for (const n of obj.sorted_gene_coordinates) {
		if (!n.child_nodes) continue
		if (n.child_nodes.length != 2) throw 'gene child_nodes length!=2'
		const nx = n.node_coordinates.x,
			ny = n.node_coordinates.y
		const [c1, c2] = n.child_nodes
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
		ctx.moveTo(nx, p1.y + F)
		ctx.lineTo(p1.x, p1.y + F)
		// h line from n to p2
		ctx.moveTo(nx, p2.y + F)
		ctx.lineTo(p2.x, p2.y + F)
		// v line through n, from p1 to p2
		ctx.moveTo(nx, p1.y + F)
		ctx.lineTo(nx, p2.y + F)
		// end
		ctx.stroke()
		ctx.closePath()
	}

	F = obj.d.xDendrogramHeight + obj.d.xLabHeight // xoffset applied to x coord when plotting y dendrogram

	for (const n of obj.sorted_sample_coordinates) {
		if (!n.child_nodes) continue
		if (n.child_nodes.length != 2) throw 'child_nodes length!=2'
		const nx = n.node_coordinates.x,
			ny = n.node_coordinates.y
		const [c1, c2] = n.child_nodes
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
		ctx.moveTo(F + p1.x, ny)
		ctx.lineTo(F + p1.x, p1.y)
		// v line from n to p2
		ctx.moveTo(F + p2.x, ny)
		ctx.lineTo(F + p2.x, p2.y)
		// h line through n, from p1 to p2
		ctx.moveTo(F + p1.x, ny)
		ctx.lineTo(F + p2.x, ny)
		// end
		ctx.stroke()
		ctx.closePath()
	}
}
