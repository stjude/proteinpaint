import { Matrix } from './matrix'
import { getCompInit } from '../rx'
import { getPlotConfig as getMatrixPlotConfig } from './matrix.config'
import { dofetch3 } from '#common/dofetch'
import { fillTermWrapper } from '#termsetting'
import { extent } from 'd3-array'
import { interpolateRgb } from 'd3-interpolate'

class HierCluster extends Matrix {
	constructor(opts) {
		super(opts)
		this.type = 'hierCluster'
		this.chartType = 'hierCluster'
	}

	async init(appState) {
		await super.init(appState)
		this.hcClipId = this.seriesClipId + '-hc'
		this.dom.hcClipRect = this.dom.svg
			.select('defs')
			.append('clipPath')
			.attr('id', this.hcClipId)
			//.attr('clipPathUnits', 'objectBoundingBox')
			.attr('clipPathUnits', 'userSpaceOnUse')
			.append('rect')
			.attr('display', 'block')
		this.dom.topDendrogram = this.dom.svg
			.insert('g', 'g')
			.attr('clip-path', `url(#${this.hcClipId})`)
			.append('g')
			.attr('class', 'sjpp-matrix-dendrogram')
		this.dom.leftDendrogram = this.dom.svg.insert('g', 'g').attr('class', 'sjpp-matrix-dendrogram') //.attr('clip-path', `url(#${this.seriesClipId})`)
	}

	async setHierClusterData(_data = {}) {
		const twlst = this.config.termgroups[0].lst
		const genes = twlst.filter(tw => tw.term.type == 'geneVariant').map(tw => tw.term)
		if (!genes.length) return
		const body = {
			genome: this.app.opts.state.vocab.genome,
			dslabel: this.app.opts.state.vocab.dslabel,
			geneExpression: 1,
			genes,
			clusterMethod: this.state.config.settings.hierCluster.clusterMethod
		}
		this.hierClusterData = await dofetch3('mds3', { body })

		const c = this.hierClusterData.clustering
		this.setHierColorScale(c)
		const samples = {}
		for (const [i, sample] of c.sampleNameLst.entries()) {
			samples[sample] = { sample }
			for (const [j, name] of c.geneNameLst.entries()) {
				const tw = twlst.find(tw => tw.term.name === name)
				const value = c.matrix[j][i]
				const { min, range, scale } = this.hierClusterColor[j]
				samples[sample][tw.$id] = {
					key: tw.term.name,
					values: [
						{
							sample,
							dt: 3,
							class: 'geneexpression',
							// TODO: use the assigned label from common.js
							label: 'Gene Expression',
							gene: tw.term.name,
							chr: tw.term.chr,
							pos: `${tw.term.start}-${tw.term.stop}`,
							value,
							color: scale((value - min) / range)
						}
					]
				}
			}
		}

		c.sampleNameLst = c.col_names_index.map(i => c.sampleNameLst[i - 1])
		c.geneNameLst = c.row_names_index.map(i => c.geneNameLst[i - 1])
		const orderedTw = c.geneNameLst.map(name => twlst.find(tw => tw.term.name === name))
		this.config.termgroups[0].lst = orderedTw
		this.hierClusterSamples = {
			refs: { byTermId: {} },
			lst: c.sampleNameLst.map(sample => samples[sample]),
			samples
		}
	}

	setHierColorScale(c) {
		const hc = this.settings.hierCluster
		const minMaxes = []
		const scale = interpolateRgb(hc.minColor, hc.maxColor)
		for (const row of c.matrix) {
			const [min, max] = extent(row)
			minMaxes.push({
				min,
				max,
				range: max - min,
				scale
			})
		}
		this.hierClusterColor = minMaxes
		this.geneExpValues = { scale }
	}

	async renderDendrogram() {
		const obj = this.hierClusterData.clustering
		obj.d = {
			rowHeight: this.settings.matrix.rowh,
			colWidth: this.dimensions.colw,
			xDendrogramHeight: this.settings.hierCluster.xDendrogramHeight,
			yDendrogramHeight: this.settings.hierCluster.yDendrogramHeight,
			minColor: '#0c306b',
			maxColor: '#ffcc00'
		}
		try {
			obj.row_dendro.map(this.validateRline)
		} catch (e) {
			throw 'row_dendro error: ' + e
		}
		try {
			obj.col_dendro.map(this.validateRline)
		} catch (e) {
			throw 'col_dendro error: ' + e
		}

		this.plotDendrogram_R(obj)
		const g = this.dom.dendrogram
	}

	plotDendrogram_R(obj) {
		const d = this.dimensions
		const zoomLevel = this.config.settings.matrix.zoomLevel
		const { xMin, xMax } = d
		const xOffset = d.seriesXoffset // could be negative when zoomed
		const pxr = window.devicePixelRatio <= 1 ? 1 : window.devicePixelRatio
		{
			let max = 0
			for (const r of obj.row_dendro) {
				max = Math.max(max, r.y1, r.y2)
				// hardcoding gene to be on rows, swap x/y for row dendrogram
				const t = {
					x1: r.y1,
					x2: r.y2,
					y1: r.x1,
					y2: r.x2
				}
				r.transformed = t
			}
			const sf = obj.d.xDendrogramHeight / max
			for (const r of obj.row_dendro) {
				const t = r.transformed
				t.x1 = sf * (max - t.x1) // for row dendrogram, x is now depth
				t.x2 = sf * (max - t.x2)
				t.y1 *= obj.d.rowHeight // y is number of row items
				t.y2 *= obj.d.rowHeight
			}
			const width = obj.d.xDendrogramHeight + 0.0000001
			const height = d.mainh + 0.0000001
			const canvas = new OffscreenCanvas(width * pxr, height * pxr)
			const ctx = canvas.getContext('2d')
			ctx.scale(pxr, pxr)
			ctx.imageSmoothingEnabled = false
			ctx.imageSmoothingQuality = 'high'
			ctx.strokeStyle = 'black'
			// plot row dendrogram
			for (const r of obj.row_dendro) {
				ctx.beginPath()
				const t = r.transformed
				// r is a line between two points. get extreme x/y
				const x1 = Math.min(t.x1, t.x2),
					x2 = Math.max(t.x1, t.x2),
					y1 = Math.min(t.y1, t.y2),
					y2 = Math.max(t.y1, t.y2)

				// always one way to plot vertical line
				ctx.moveTo(x1, y1)
				ctx.lineTo(x1, y2)
				// two ways to plot horizontal line
				if ((t.x1 > t.x2 && t.y1 > t.y2) || (t.x1 < t.x2 && t.y1 < t.y2)) {
					// one point is on lower right of another, the horizontal line is based on *max y*
					ctx.lineTo(x2, y2)
				} else {
					// one point is on upper right of another, the horizontal line is based on *min y*
					ctx.moveTo(x1, y1)
					ctx.lineTo(x2, y1)
				}
				ctx.stroke()
				ctx.closePath()
			}
			this.renderImage(this.dom.leftDendrogram, canvas, width, height, 0, obj.d.yDendrogramHeight + obj.d.rowHeight)
		}

		{
			// replace node x/y values with on-screen #pixel for plotting
			let max = 0
			const visible = []
			for (const r of obj.col_dendro) {
				max = Math.max(max, r.y1, r.y2)
				const x1 = r.x1 * d.dx //+ xOffset
				const x2 = r.x2 * d.dx //+ xOffset
				if (x2 < x1) {
					if (x1 < xMin || x2 > xMax) continue
				} else if (x2 < xMin || x1 > xMax) continue
				r.scaled = { x1, x2 }
				visible.push(r)
			}
			const sf = obj.d.yDendrogramHeight / max
			for (const r of visible) {
				r.scaled.y1 = sf * (max - r.y1) // for col dendrogram, y is depth
				r.scaled.y2 = sf * (max - r.y2)
			}

			const width = d.imgW + 0.0000001
			const height = obj.d.yDendrogramHeight + 0.0000001
			const canvas = new OffscreenCanvas(width * pxr, height * pxr)
			const ctx = canvas.getContext('2d')
			ctx.scale(pxr, pxr)
			ctx.imageSmoothingEnabled = false
			ctx.imageSmoothingQuality = 'high'
			ctx.strokeStyle = 'black'
			// plot row dendrogram
			// plot column dendrogram
			for (const r of visible) {
				ctx.beginPath()
				const s = r.scaled
				const x1 = Math.min(s.x1, s.x2),
					x2 = Math.max(s.x1, s.x2),
					y1 = Math.min(s.y1, s.y2),
					y2 = Math.max(s.y1, s.y2)
				ctx.moveTo(x1, y1)
				ctx.lineTo(x2, y1) // hline
				if ((r.x1 > r.x2 && s.y1 > s.y2) || (r.x1 < r.x2 && s.y1 < s.y2)) {
					// vline at max x
					ctx.lineTo(x2, y2)
				} else {
					// vline at min x
					ctx.moveTo(x1, y1)
					ctx.lineTo(x1, y2)
				}
				ctx.stroke()
				ctx.closePath()
			}
			this.renderImage(this.dom.topDendrogram, canvas, width, height, obj.d.xDendrogramHeight, obj.d.rowHeight)
		}
	}

	validateRline(r) {
		return
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

	async renderImage(g, canvas, width, height, x, y) {
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
}

export const hierClusterInit = getCompInit(HierCluster)
export const componentInit = hierClusterInit

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
		.on('click', async () => {
			chartsInstance.dom.tip.hide()
			chartsInstance.prepPlot({
				config: await getPlotConfig({}, chartsInstance.app)
			})
		})
}

export async function getPlotConfig(opts = {}, app) {
	opts.chartType = 'hierCluster'
	const config = await getMatrixPlotConfig(opts, app)
	config.settings.matrix.collabelpos = 'top'

	// hardcode for testing only
	// TODO: replace with controls/menu, etc
	const genes = [
		{
			gene: 'BCR',
			chr: 'chr22',
			start: 23180509,
			stop: 23318037
		},
		{
			gene: 'ABL1',
			chr: 'chr9',
			start: 130835254,
			stop: 130887675
		},
		{
			gene: 'HOXA1',
			chr: 'chr7',
			start: 27092993,
			stop: 27096000
		}
	]

	//const genes = [{"gene":"JAG1","chr":"chr20","start":10637683,"stop":10673999},{"gene":"NOTCH3","chr":"chr19","start":15159037,"stop":15200995},{"gene":"NOTCH2","chr":"chr1","start":119911552,"stop":120069662},{"gene":"APH1A","chr":"chr1","start":150265403,"stop":150269016},{"gene":"HES1","chr":"chr3","start":194136147,"stop":194138732},{"gene":"CCND1","chr":"chr11","start":69641155,"stop":69654474},{"gene":"FZD1","chr":"chr7","start":91264432,"stop":91271326},{"gene":"PSEN2","chr":"chr1","start":226870615,"stop":226896098},{"gene":"FZD7","chr":"chr2","start":202033854,"stop":202038441},{"gene":"DTX1","chr":"chr12","start":113056729,"stop":113098025},{"gene":"DLL1","chr":"chr6","start":170282205,"stop":170291078},{"gene":"FZD5","chr":"chr2","start":207762597,"stop":207769906},{"gene":"MAML2","chr":"chr11","start":95976597,"stop":96343195},{"gene":"NOTCH1","chr":"chr9","start":136494432,"stop":136546048},{"gene":"PSENEN","chr":"chr19","start":35745650,"stop":35747519},{"gene":"WNT5A","chr":"chr3","start":55465714,"stop":55481398},{"gene":"CUL1","chr":"chr7","start":148697755,"stop":148801110},{"gene":"WNT2","chr":"chr7","start":117275450,"stop":117323058},{"gene":"DTX4","chr":"chr11","start":59171429,"stop":59208588},{"gene":"SAP30","chr":"chr4","start":173370953,"stop":173377532},{"gene":"PPARD","chr":"chr6","start":35342557,"stop":35425400},{"gene":"KAT2A","chr":"chr17","start":42113110,"stop":42121367},{"gene":"HEYL","chr":"chr1","start":39623434,"stop":39639643},{"gene":"SKP1","chr":"chr5","start":134148934,"stop":134176950},{"gene":"RBX1","chr":"chr22","start":40951377,"stop":40973309},{"gene":"TCF7L2","chr":"chr10","start":112950246,"stop":113167678},{"gene":"ARRB1","chr":"chr11","start":75260121,"stop":75351661},{"gene":"LFNG","chr":"chr7","start":2512528,"stop":2528429},{"gene":"PRKCA","chr":"chr17","start":66302612,"stop":66810743},{"gene":"DTX2","chr":"chr7","start":76461708,"stop":76505991},{"gene":"ST3GAL6","chr":"chr3","start":98732261,"stop":98795852},{"gene":"FBXW11","chr":"chr5","start":171861548,"stop":172006638}]

	const twlst = genes.map(term => {
		term.type = 'geneVariant'
		term.name = term.gene
		const tw = { term }
		fillTermWrapper(tw)
		return tw
	})

	config.termgroups.unshift({
		name: 'Gene Expression',
		// TODO: are duplicate term entries, with different q{} objects, allowed?
		// if yes, should use tw.$id to disambiguate
		lst: twlst,
		valueFilter: {
			type: 'tvs',
			tvs: {
				values: [{ dt: 3 }]
			}
		}
	})

	config.settings.matrix.maxSample = 100000
	config.settings.hierCluster = {
		clusterMethod: 'average',
		xDendrogramHeight: 100,
		yDendrogramHeight: 200,
		minColor: '#0000ff',
		maxColor: '#ff0000'
	}

	return config
}
