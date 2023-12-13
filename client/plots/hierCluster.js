import { Matrix } from './matrix'
import { getCompInit, copyMerge } from '../rx'
import { getPlotConfig as getMatrixPlotConfig } from './matrix.config'
import { dofetch3 } from '#common/dofetch'
import { fillTermWrapper } from '#termsetting'
import { extent } from 'd3-array'
import { interpolateRgbBasis } from 'd3-interpolate'
import { interpolateRdBu } from 'd3-scale-chromatic'
import { renderTable } from '#dom/table'
import { Menu } from '../dom/menu'

/*
FIXME items

1. do not hardcode this.config.termgroups[0] to be the list of items for clustering analysis
	this prevents showing a non-clustering group of terms at the first position, right under the sample dendrogram, which is common
	need a way to designate which element of termgroups[] is to run clustering analysis

2. do not hardcode to force tw.type='geneVariant'
	caller should supply well-formed twlst[] that can include gene and non-gene terms
	to be able to run clustering analysis on everything

3. replace dofetch with vocabApi call with support for (2)
*/

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
			.on('click', event => {
				const clickedBranch = this.getImgBranch(event)
				if (clickedBranch) {
					const clickedBranchId = Math.min(clickedBranch.id1, clickedBranch.id2) // the smaller branchId has all the children
					this.clickedChildren = this.hierClusterData.clustering.col_children.find(
						c => c.id == clickedBranchId
					).children

					//get the sampleName of the children
					const clickedSampleNames = this.getClickedSampleNames(this.clickedChildren)

					this.addSelectedSamplesOptions(clickedSampleNames, event)
				} else {
					// if not clicking on a branch, change highlighted branch color from red back to black
					delete this.clickedChildren
				}

				// rerender the col Dendrogram
				this.plotDendrogram_R(this.hierClusterData.clustering, true)
			})
		this.dom.leftDendrogram = this.dom.svg.insert('g', 'g').attr('class', 'sjpp-matrix-dendrogram') //.attr('clip-path', `url(#${this.seriesClipId})`)
	}

	addSelectedSamplesOptions(clickedSampleNames, event) {
		const l = this.settings.matrix.controlLabels
		const ss = this.opts.allow2selectSamples
		const optionArr = [
			{
				label: 'Zoom in',
				callback: () => {
					this.triggerZoomBranch(this, clickedSampleNames)
				}
			},
			{
				label: `List ${clickedSampleNames.length} samples`,
				callback: () => {
					this.dom.tip.hide()
					this.showTable(this, clickedSampleNames, event.clientX, event.clientY)
				}
			}
		]

		if (this.app.vocabApi.vocab?.dslabel !== 'GDC') {
			const samples = clickedSampleNames.map(c => this.sampleOrder.find(s => s.row.sample == c).row)
			for (const s of samples) {
				if (!s.sampleId) s.sampleId = s.sample
			}
			optionArr.push({
				label: 'Add to a group',
				callback: async () => {
					const group = {
						name: 'Group',
						items: samples
					}
					this.addGroup(group)
				}
			})
		}

		// when allow2selectSamples presents
		if (ss)
			optionArr.push({
				label: ss.buttonText || `Select ${l.Samples}`,
				callback: async () => {
					ss.callback({
						samples: clickedSampleNames.map(c => {
							return { 'cases.case_id': c }
						}),
						source: ss.defaultSelectionLabel || `Selected ${l.samples} from gene expression`
					})
				}
			})

		this.mouseout()
		this.dom.tip.hide()
		this.app.tip.clear()
		this.app.tip.d
			.selectAll('div')
			.data(optionArr)
			.enter()
			.append('div')
			.attr('class', 'sja_menuoption')
			.html(d => d.label)
			.on('click', event => {
				this.app.tip.hide()
				event.target.__data__.callback()
			})
		this.app.tip.show(event.clientX, event.clientY)
	}

	// zoom in matrix to the selected dendrogram branch
	triggerZoomBranch(self, clickedSampleNames) {
		if (self.zoomArea) {
			self.zoomArea.remove()
			delete self.zoomArea
		}
		const c = {
			startCell: self.serieses[0].cells.find(d => d.sample == clickedSampleNames[0]),
			endCell: self.serieses[0].cells.find(d => d.sample == clickedSampleNames[clickedSampleNames.length - 1])
		}

		const s = self.settings.matrix
		const d = self.dimensions
		const start = c.startCell.totalIndex < c.endCell.totalIndex ? c.startCell : c.endCell
		const zoomIndex = Math.floor(start.totalIndex + Math.abs(c.endCell.totalIndex - c.startCell.totalIndex) / 2)
		const centerCell = self.sampleOrder[zoomIndex] // || self.getImgCell(event)
		const colw = self.computedSettings.colw || self.settings.matrix.colw
		const maxZoomLevel = s.colwMax / colw
		const minZoomLevel = s.colwMin / colw
		const tentativeZoomLevel = Math.max(
			1,
			((s.zoomLevel * d.mainw) / Math.max(c.endCell.x - c.startCell.x, 2 * d.colw)) * 0.7
		)
		const zoomLevel = Math.max(minZoomLevel, Math.min(tentativeZoomLevel, maxZoomLevel))
		//const zoomCenter = centerCell.totalIndex * d.dx + (centerCell.grpIndex - 1) * s.colgspace + d.seriesXoffset

		self.app.dispatch({
			type: 'plot_edit',
			id: self.id,
			config: {
				settings: {
					matrix: {
						zoomLevel,
						zoomCenterPct: 0.5,
						//zoomLevel < 1 && d.mainw >= d.zoomedMainW ? 0.5 : zoomCenter / d.mainw,
						zoomIndex,
						zoomGrpIndex: centerCell.grpIndex
					}
				}
			}
		})
		self.resetInteractions()
	}

	// return the sample names of the clicked samples as an array
	getClickedSampleNames(clickedChildren) {
		const obj = this.hierClusterData.clustering
		const childIndexArr = clickedChildren.map(c => obj.col_names_index.indexOf(c))
		const childSampleNameArr = childIndexArr.map(c => obj.sampleNameLst[c])
		return childSampleNameArr
	}

	// show the list of clicked samples as a table
	showTable(self, clickedSampleNames, x, y) {
		const templates = self.state.termdbConfig.urlTemplates
		const rows = templates?.sample
			? clickedSampleNames.map(c => [{ value: c, url: `${templates.sample.base}${c}` }])
			: clickedSampleNames.map(c => [{ value: c }])

		if (this.app.vocabApi.vocab?.dslabel == 'GDC') {
			for (const row of rows) {
				row[0].value = this.hierClusterData.sampleNameMap[row[0].value]
			}
		}

		const columns = [{ label: self.settings.matrix.controlLabels.Samples }]

		const menu = new Menu({ padding: '5px' })
		const div = menu.d.append('div')

		renderTable({
			rows,
			columns,
			div,
			showLines: true,
			maxWidth: columns.length * '15' + 'vw',
			maxHeight: '35vh',
			resize: true
		})
		menu.show(x, y, false, false)
	}

	// add the clicked samples into a group
	async addGroup(group) {
		group.plotId = this.id
		await this.app.vocabApi.addGroup(group)
		this.dom.tip.hide()
	}

	// upon clicking, find the corresponding clicked branch in this.hierClusterData.clustering.col_dendro
	getImgBranch(event) {
		if (event.target.tagName == 'image') this.imgBox = event.target.getBoundingClientRect()
		else return

		const y = event.clientY - this.imgBox.y - event.target.clientTop
		const xMin = this.dimensions.xMin
		const x = event.clientX - this.imgBox.x - event.target.clientLeft + xMin

		for (const branch of this.hierClusterData.clustering.col_dendro) {
			if (!branch.normalized) return
			const { x1, y1, x2, y2, verticalX } = branch.normalized

			if (
				(x1 <= x && x <= x2 && y1 - 5 < y && y < y1 + 5) ||
				(y1 <= y && y <= y2 && verticalX - 5 < x && x < verticalX + 5)
			) {
				return branch
			}
		}
	}

	setClusteringBtn(holder, callback) {
		const hc = this.settings.hierCluster
		holder
			.append('button')
			//.property('disabled', d => d.disabled)
			.datum({
				label: `Clustering`,
				rows: [
					{
						label: `Clustering Method`,
						title: `Sets which clustering method to use`,
						type: 'radio',
						chartType: 'hierCluster',
						settingsKey: 'clusterMethod',
						options: [
							{
								label: 'Average',
								value: 'average',
								title: `Cluster by average value`
							},
							{
								label: `Complete`,
								value: 'complete',
								title: `Use the complete clustering method`
							}
							/*{
								label: `Mcquity`,
								value: 'mcquity',
								title: `Use the Mcquity clustering method`
							}*/
						]
					},
					{
						label: `Column dendrogram height`,
						title: `The maximum height to render the column dendrogram`,
						type: 'number',
						chartType: 'hierCluster',
						settingsKey: 'yDendrogramHeight'
					},
					{
						label: `Row dendrogram width`,
						title: `The maximum width to render the row dendrogram`,
						type: 'number',
						chartType: 'hierCluster',
						settingsKey: 'xDendrogramHeight'
					},
					{
						label: `Z-score cap`,
						title: `Cap the z-score scale to not exceed this absolute value`,
						type: 'number',
						chartType: 'hierCluster',
						settingsKey: 'zScoreCap'
					}
				]
			})
			.html(d => d.label)
			.style('margin', '2px 0')
			.on('click', callback)
	}

	async setHierClusterData(_data = {}) {
		// TODO: do not rely on the hardcoded grp.name for finding the hier cluster term group
		const s = this.settings.hierCluster
		this.hcTermGroup =
			this.config.termgroups.find(grp => grp.name == s.termGroupName) ||
			this.termOrder?.find(t => t.grp.name == s.termGroupName)?.grp
		const twlst = this.hcTermGroup.lst

		const genes = twlst.filter(tw => tw.term.type == 'geneVariant').map(tw => tw.term)
		if (!genes.length) return
		const body = {
			genome: this.app.opts.state.vocab.genome,
			dslabel: this.app.opts.state.vocab.dslabel,
			geneExpression: 1,
			genes,
			clusterMethod: this.state.config.settings.hierCluster.clusterMethod,
			filter: this.state.filter,
			filter0: this.state.filter0
		}
		const d = await dofetch3('mds3', { body })
		if (d.error) throw d.error
		this.hierClusterData = d

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
							label: s.termGroupName,
							gene: tw.term.name,
							chr: tw.term.chr,
							pos: `${tw.term.start}-${tw.term.stop}`,
							value,
							color: scale(1 - (value - min) / range)
						}
					]
				}
			}
		}

		c.sampleNameLst = c.col_names_index.map(i => c.sampleNameLst[i - 1])
		c.geneNameLst = c.row_names_index.map(i => c.geneNameLst[i - 1])
		const orderedTw = c.geneNameLst.map(name => twlst.find(tw => tw.term.name === name))
		this.hcTermGroup.lst = orderedTw

		// from d.byTermId to byTermId: change byTermId keys from gene names to $ids
		const byTermId = {}
		for (const tw of twlst) {
			if (d.byTermId[tw.term.name]) byTermId[tw.$id] = d.byTermId[tw.term.name]
		}
		this.hierClusterSamples = {
			refs: { byTermId },
			lst: c.sampleNameLst.map(sample => samples[sample]),
			samples
		}
	}

	combineData() {
		if (!this.hierClusterSamples) return
		const d = this.data
		const samples = {}
		const lst = []
		// the gene expression samples will be used as a filter for the matrix samples
		for (const sampleId in this.hierClusterSamples.samples) {
			const s = this.hierClusterSamples.samples[sampleId]
			samples[sampleId] = s
			lst.push(s)
			if (!(sampleId in d.samples)) continue
			Object.assign(s, d.samples[sampleId])
		}

		// combine this.hierClusterSamples.refs.byTermId into this.data.refs.byTermId
		const t = this.hierClusterSamples.refs.byTermId
		for (const $id of Object.keys(t)) {
			d.refs.byTermId[$id] = Object.assign({}, d.refs.byTermId[$id] || {}, t[$id])
		}
		this.data = { samples, lst, refs: d.refs }
	}

	setHierColorScale(c) {
		const hc = this.settings.hierCluster
		const scale = hc.colors?.length ? interpolateRgbBasis(hc.colors) : interpolateRdBu
		const globalMinMaxes = []
		for (const row of c.matrix) {
			globalMinMaxes.push(...extent(row))
		}
		const absMax = Math.min(hc.zScoreCap, Math.max(...extent(globalMinMaxes).map(Math.abs)))
		const [min, max] = [-absMax, absMax]
		const minMaxes = []
		for (const row of c.matrix) {
			//const [min, max] = extent(row)
			minMaxes.push({
				min,
				max,
				range: max - min,
				scale
			})
		}
		this.hierClusterColor = minMaxes
		this.geneExpValues = { scale, min, max }
	}

	async renderDendrogram() {
		const obj = this.hierClusterData.clustering
		obj.d = {
			rowHeight: this.dimensions.dy,
			colWidth: this.dimensions.dx,
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
	}

	// if onlyCol is true, only render the column dendrogram
	plotDendrogram_R(obj, onlyCol) {
		const d = this.dimensions
		const s = this.config.settings.matrix
		const zoomLevel = s.zoomLevel
		const { xMin, xMax } = d
		const xOffset = d.seriesXoffset // could be negative when zoomed
		const pxr = window.devicePixelRatio <= 1 ? 1 : window.devicePixelRatio
		if (!onlyCol) {
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
			// find the first term in the gene expression group
			const t = this.termOrder.find(t => t.grp.name == this.hcTermGroup.name)
			const ty = t.grpIndex * s.rowgspace + t.prevGrpTotalIndex * d.dy + (t.labelOffset || 0) + t.totalHtAdjustments
			this.renderImage(
				this.dom.leftDendrogram,
				canvas,
				width,
				height,
				0,
				ty + obj.d.yDendrogramHeight + obj.d.rowHeight
			)
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

				r.normalized = { x1, x2, y1, y2 }
				const minId = Math.min(r.id1, r.id2)
				const childrenItem = this.hierClusterData.clustering.col_children.find(d => d.id == minId).children

				const highlight =
					this.clickedChildren &&
					this.clickedChildren.some(c => childrenItem.includes(c)) &&
					!(
						this.clickedChildren.every(c => childrenItem.includes(c)) &&
						childrenItem.length > this.clickedChildren.length
					)
				ctx.strokeStyle = highlight ? 'red' : 'black'

				ctx.moveTo(x1, y1)
				ctx.lineTo(x2, y1) // hline
				if ((r.x1 > r.x2 && s.y1 > s.y2) || (r.x1 < r.x2 && s.y1 < s.y2)) {
					// vline at max x
					ctx.lineTo(x2, y2)
					r.normalized.verticalX = x2
				} else {
					// vline at min x
					ctx.moveTo(x1, y1)
					ctx.lineTo(x1, y2)
					r.normalized.verticalX = x1
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
	config.settings.hierCluster = {
		// TODO: may adjust the default group name based on automatically detected term types
		// otherwise, should define it via opts or overrides
		termGroupName: 'Gene Expression',
		clusterMethod: 'average',
		zScoreCap: 5,
		xDendrogramHeight: 100,
		yDendrogramHeight: 200,
		colors: []
	}
	const overrides = app.vocabApi.termdbConfig.hierCluster || {}
	copyMerge(config.settings.hierCluster, overrides.settings)

	config.settings.matrix.collabelpos = 'top'

	const termGroupName = config.settings.hierCluster.termGroupName
	// TODO: should compose the term group in launchGdcHierCluster.js, since this handling is customized to only that dataset?
	// the opts{} object should be standard, should pre-process the opts outside of this getPlotConfig()
	if (!config.termgroups.find(g => g.name == termGroupName)) {
		if (!Array.isArray(opts.genes)) throw 'opts.genes[] not array (may show geneset edit ui)'

		const twlst = []
		for (const i of opts.genes) {
			let tw
			if (typeof i.term == 'object' && i.term.type == 'geneVariant') {
				// i is already well-formed tw object
				tw = i
			} else {
				// shape i into term{} and nest into tw{}
				i.type = 'geneVariant'
				if (i.name) {
				} else if (i.gene) {
					i.name = i.gene // TODO
				}
				tw = { term: i }
			}
			await fillTermWrapper(tw)
			twlst.push(tw)
		}

		config.termgroups.unshift({
			name: termGroupName,
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
	}

	config.settings.matrix.maxSample = 100000
	return config
}
