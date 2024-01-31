import { Matrix } from './matrix'
import { getCompInit, copyMerge } from '../rx'
import { getPlotConfig as getMatrixPlotConfig } from './matrix.config'
import { dofetch3 } from '#common/dofetch'
import { fillTermWrapper } from '#termsetting'
import { extent } from 'd3-array'
import { scaleLinear } from 'd3-scale'
import { renderTable } from '../dom/table'
import { Menu } from '../dom/menu'
import { dtgeneexpression } from '#shared/common.js'
import { filterJoin } from '#filter'

/*
FIXME items

- should not hardcode this.geneExpValues, incompatible for future expansion
*/

export class HierCluster extends Matrix {
	constructor(opts) {
		super(opts)
		this.type = 'hierCluster'
		this.chartType = 'hierCluster'
	}

	async init(appState) {
		await super.init(appState)

		maySetSandboxHeader(this)

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
				const clickedClusterId = this.getClusterFromTopDendrogram(event)
				if (clickedClusterId) {
					this.clickedClusterIds = this.getAllChildrenClusterIds(clickedClusterId)
					this.clickedClusterIds.push(clickedClusterId)

					const clickedCluster = this.hierClusterData.clustering.col.mergedClusters.get(clickedClusterId)
					const clickedClusterSampleNames = clickedCluster.children.map(c => c.name)
					this.addSelectedSamplesOptions(clickedClusterSampleNames, event)
				} else {
					// if not clicking on a cluster, change highlighted cluster color from red back to black
					delete this.clickedClusterIds
				}

				// rerender the col Dendrogram
				this.plotDendrogramHclust(true)
			})
		this.dom.leftDendrogram = this.dom.svg.insert('g', 'g').attr('class', 'sjpp-matrix-dendrogram') //.attr('clip-path', `url(#${this.seriesClipId})`)
	}

	// Given a clusterId, return all its children clusterIds
	getAllChildrenClusterIds(clickedClusterId) {
		const mergedClusters = this.hierClusterData.clustering.col.mergedClusters
		const children = mergedClusters.get(clickedClusterId).childrenClusters || []
		let allChildren = [...children]
		for (const child of children) {
			allChildren = allChildren.concat(this.getAllChildrenClusterIds(child))
		}
		return allChildren
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
				label: `List ${clickedSampleNames.length} ${l.samples}`,
				callback: () => this.showTable4selectedSamples(clickedSampleNames)
			}
		]

		// when allow2selectSamples presents
		if (ss) {
			optionArr.push({
				label: ss.buttonText || `Select ${l.samples}`,
				callback: async () => {
					ss.callback({
						samples: clickedSampleNames.map(c => {
							return { 'cases.case_id': c }
						}),
						source: ss.defaultSelectionLabel || `Selected ${l.samples} from gene expression`
					})
				}
			})
		} else {
			if (this.state.nav && this.state.nav.header_mode !== 'hidden') {
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
		}

		this.mouseout()
		this.dom.tip.hide()
		this.dom.dendroClickMenu.d.selectAll('*').remove()
		this.dom.dendroClickMenu.d
			.selectAll('div')
			.data(optionArr)
			.enter()
			.append('div')
			.attr('class', 'sja_menuoption')
			.style('border-radius', '0px')
			.html(d => d.label)
			.on('click', event => {
				this.dom.dendroClickMenu.d.selectAll('*').remove()
				event.target.__data__.callback()
			})
		this.dom.dendroClickMenu.show(event.clientX, event.clientY)
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

	// show the list of clicked samples as a table
	showTable4selectedSamples(clickedSampleNames) {
		const templates = this.state.termdbConfig.urlTemplates
		const rows = templates?.sample
			? clickedSampleNames.map(c => [
					{ value: this.hierClusterData.bySampleId[c].label, url: `${templates.sample.base}${c}` }
			  ])
			: clickedSampleNames.map(c => [{ value: this.hierClusterData.bySampleId[c].label }])

		const columns = [{ label: this.settings.matrix.controlLabels.Sample }]

		renderTable({
			rows,
			columns,
			div: this.dom.dendroClickMenu.clear().d.append('div').style('margin', '10px'),
			showLines: true,
			maxHeight: '35vh',
			resize: true
		})
	}

	// add the clicked samples into a group
	async addGroup(group) {
		group.plotId = this.id
		await this.app.vocabApi.addGroup(group)
		this.dom.tip.hide()
	}

	// upon clicking, find the corresponding clicked clusterId from this.hierClusterData.clustering.col.mergedClusters
	getClusterFromTopDendrogram(event) {
		// Need imgBox to find the position of event relative to dendrogram
		if (event.target.tagName == 'image') this.imgBox = event.target.getBoundingClientRect()
		else return

		const y = event.clientY - this.imgBox.y - event.target.clientTop
		const xMin = this.dimensions.xMin
		const x = event.clientX - this.imgBox.x - event.target.clientLeft + xMin

		for (const [clusterId, cluster] of this.hierClusterData.clustering.col.mergedClusters) {
			const { x1, y1, x2, y2, clusterY } = cluster.clusterPosition
			if (
				(x1 <= x && x <= x2 && clusterY - 5 < y && y < clusterY + 5) ||
				(clusterY <= y && y <= y1 && x1 - 5 < x && x < x1 + 5) ||
				(clusterY <= y && y <= y2 && x2 - 5 < x && x < x2 + 5)
			) {
				return clusterId
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
						label: `Column Dendrogram Height`,
						title: `The maximum height to render the column dendrogram`,
						type: 'number',
						chartType: 'hierCluster',
						settingsKey: 'yDendrogramHeight'
					},
					{
						label: `Row Dendrogram Width`,
						title: `The maximum width to render the row dendrogram`,
						type: 'number',
						chartType: 'hierCluster',
						settingsKey: 'xDendrogramHeight'
					},
					{
						label: `Z-Score Cap`,
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
		this.hcTermGroup =
			this.config.termgroups.find(grp => grp.type == 'hierCluster') ||
			this.termOrder?.find(t => t.grp.type == 'hierCluster')?.grp

		// track the actionSequenceId before the server request, which may be laggy
		const actionSequenceId = this.api.notes('actionSequenceId')
		const d = await this.requestData()
		if (this.api.notes('actionSequenceId') !== actionSequenceId) {
			// (an)other state change(s) has been dispatched between the start and completion of the server request
			console.warn('aborted state update, the server data corresponds to a stale action.sequenceId')
			return
		}
		if (d.error) throw d.error
		const s = this.settings.hierCluster
		const twlst = this.hcTermGroup.lst

		if (!d.clustering) {
			// stop-gap data validation, lacks essential data part
			if (d.gene) {
				// for now backend returns {gene:str, data:{}} if there's only 1 eligible gene
				throw `Cannot do clustering: data is only available for 1 gene (${d.gene}). Try again by adding more genes.`
			}
			throw 'Cannot do clustering: invalid server response (lacks .clustering{})'
		}
		this.hierClusterData = d

		const c = this.hierClusterData.clustering
		this.setHierColorScale(c)

		const zScoreCap = this.settings.hierCluster.zScoreCap // used in loops below

		const samples = {}

		/* see comments inside plotDendrogramHclust() on structure of d.clustering.row{} and col{}
		assumes c.col is samples and c.row is non-sample things (genes for now); later may flip to c.row be samples instead!!
		*/

		for (const [i, column] of c.col.order.entries()) {
			samples[column.name] = { sample: column.name }
			for (const [j, row] of c.row.order.entries()) {
				const tw = twlst.find(tw => tw.term.name === row.name)
				const value = c.matrix[j][i]
				samples[column.name][tw.$id] = {
					key: tw.term.name,
					values: [
						{
							sample: column.name,
							dt: this.settings.hierCluster.dataType,
							class: 'geneexpression', // FIXME since there's no class defined for dtgeneexpression in common.js, best not to require value.class
							label: s.termGroupName,
							gene: tw.term.name,
							chr: tw.term.chr,
							pos: `${tw.term.start}-${tw.term.stop}`,
							value
							// the color will be computed in matrix.cells, so that
							// it can get updated even when there are no nonsetting state diff
						}
					]
				}
			}
		}

		this.hcTermNameOrder = c.row.order.map(row => row.name)
		this.hcTermSorter = (a, b) => {
			const i = this.hcTermNameOrder.indexOf(a.tw.term.name)
			const j = this.hcTermNameOrder.indexOf(b.tw.term.name)
			if (i == -1 && j == -1) return 0
			if (i == -1) return 1
			if (j == -1) return -1
			return i - j
		}

		this.hcSampleNameOrder = c.col.order.map(col => col.name)
		this.hcSampleSorter = (a, b) => {
			const i = this.hcSampleNameOrder.indexOf(a.sample)
			const j = this.hcSampleNameOrder.indexOf(b.sample)
			if (i == -1 && j == -1) return 0
			if (i == -1) return 1
			if (j == -1) return -1
			return i - j
		}

		// from d.byTermId to byTermId: change byTermId keys from gene names to $ids
		const byTermId = {}
		for (const tw of twlst) {
			if (d.byTermId[tw.term.name]) byTermId[tw.$id] = d.byTermId[tw.term.name]
		}
		this.hierClusterSamples = {
			refs: { byTermId, bySampleId: d.bySampleId },
			lst: c.col.order.map(c => samples[c.name]),
			samples
		}
	}

	async requestData() {
		// temporary fix to get rid of hard/soft filter and only keep dictionary legend filter,
		// soft filter shouldn't be used to filter out any samples for hierCluster
		// TODO: add hard filter back to filter out samples
		const s = this.config.settings.hierCluster
		const dictionaryLegendFilter = {
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: this.state.config.legendValueFilter.lst.filter(f => !f.tvs.legendFilterType)
		}
		const genes = this.getClusterRowTermsAsParameter()
		if (!genes.length) throw 'no data'
		const body = {
			genome: this.state.vocab.genome,
			dslabel: this.state.vocab.dslabel,
			dataType: s.dataType,
			genes,
			clusterMethod: s.clusterMethod,
			filter: filterJoin([this.state.filter, dictionaryLegendFilter]),
			filter0: this.state.filter0
		}
		return await dofetch3('termdb/cluster', { body })
	}

	combineData() {
		if (!this.hierClusterSamples) return
		const d = this.data // matrix data
		const samples = {}
		const lst = []
		// the gene expression samples will be used as a filter for the matrix samples
		for (const sampleId in this.hierClusterSamples.samples) {
			const s = this.hierClusterSamples.samples[sampleId]
			samples[sampleId] = s
			lst.push(s)
			if (sampleId in d.samples) Object.assign(s, d.samples[sampleId])
			const _ref_ = this.hierClusterSamples.refs.bySampleId[sampleId] || {}
			if (!s._ref_) s._ref_ = _ref_
			// hierCluster refs.bySampleId will overwrite matrix reference properties with the same name
			else Object.assign(s._ref_, _ref_)
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
		const scale = scaleLinear(hc.colorScale.domain, hc.colorScale.range).clamp(true)
		const globalMinMaxes = []
		for (const row of c.matrix) {
			globalMinMaxes.push(...extent(row))
		}
		const absMax = Math.min(hc.zScoreCap, Math.max(...extent(globalMinMaxes).map(Math.abs)))
		const [min, max] = [-absMax, absMax]
		// what's purpose of assigning this.geneExpValues{}, to signal something to matrix code?
		this.geneExpValues = { scale, min, max }
	}

	getValueColor(value) {
		const zScoreCap = this.settings.hierCluster.zScoreCap
		return this.geneExpValues.scale((value - -zScoreCap) / (zScoreCap * 2))
	}

	plotDendrogramHclust(plotColOnly) {
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
		{
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

	/* returns list of gene terms as request parameter, e.g. {gene,chr,start,stop}
	request parameter only need term but not tw, as it will simply fetch continuous sample values on terms without transform

	use of this function is unfortunate because:
		the incomplete migration of {name} to {gene} for gene-based term
		geneset edit ui is hardcoded to return {name}
		existing plot states contain {name}

	!!! migration instruction !!!
	- term.name is for display only, if a term is gene-based, it has term.gene=str
	- a geneVariant term can be based on a genomic range (and not a gene), in that case it won't have term.gene and cannot be used where gene is expected, e.g. gene-based clustering analysis

	*/
	getClusterRowTermsAsParameter() {
		const lst = []
		if (this.config.settings.hierCluster.dataType == dtgeneexpression) {
			/* all items from .lst[] are expected to be {gene} */
			for (const tw of this.hcTermGroup.lst) {
				if (tw.term.type != 'geneVariant') throw 'not geneVariant term while dataType==dtgeneexpression'
				// FIXME when {name} is fully migrated to {gene}, delete following line and use continue to skip non-gene terms
				if (!tw.term.gene) {
					if (!tw.term.name) throw 'geneVariant term missing gene/name'
					// adding tw properties should be done in fillTermWrapper(),
					// otherwise it makes state-tracked tw comparison unreliable
					// tw.term.gene = tw.term.name
				}
				// see notes above, avoid modifying the state unnecessarily
				// select the properties to include, since GDC term.values (computed incrementally)
				// or cohort-dependent term.categories2samplecount can affect caching
				lst.push({ name: tw.term.name, type: tw.term.type, gene: tw.term.gene || tw.term.name })
			}
		} else {
			throw 'unknown dataType'
		}
		// this helps caching by having a more consistent URL string
		lst.sort((a, b) => (a.name < b.name ? -1 : 1))
		return lst
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
	// opts.genes will be processed as the hierCluster term group.lst
	delete config.genes

	config.settings.hierCluster = {
		/* type of data used for clustering
		exciting todo: (to introduce new dt values)
		- gene dependency
		- numeric dic term
		- non-gene genomic stuff that resolves into numeric quantities (cpg meth)
		- metabolite
		*/
		dataType: dtgeneexpression,
		// TODO: may adjust the default group name based on automatically detected term types
		// otherwise, should define it via opts or overrides
		termGroupName: 'Gene Expression (CGC Genes Only)',
		clusterMethod: 'average', // complete
		zScoreCap: 5,
		xDendrogramHeight: 100,
		yDendrogramHeight: 200,
		colorScale: { domain: [0, 0.5, 1], range: ['blue', 'white', 'red'] }
	}
	const overrides = app.vocabApi.termdbConfig.hierCluster || {}
	copyMerge(config.settings.hierCluster, overrides.settings, opts.settings?.hierCluster || {})

	// okay to validate state here?
	{
		const c = config.settings.hierCluster.colorScale
		if (!c) throw 'colorScale missing'
		if (!Array.isArray(c.domain) || c.domain.length == 0) throw 'colorScale.domain must be non-empty array'
		if (!Array.isArray(c.range) || c.range.length == 0) throw 'colorScale.range must be non-empty array'
		if (c.domain.length != c.range.length) throw 'colorScale domain[] and range[] of different length'
	}

	config.settings.matrix.collabelpos = 'top'

	const termGroupName = config.settings.hierCluster.termGroupName
	const hcTermGroup = config.termgroups.find(g => g.type == 'hierCluster' || g.name == termGroupName) || {
		name: termGroupName
	}
	// TODO: should compose the term group in launchGdcHierCluster.js, since this handling is customized to only that dataset?
	// the opts{} object should be standard, should pre-process the opts outside of this getPlotConfig()

	hcTermGroup.type = 'hierCluster' // ensure that the group.type is correct for recovered legacy sessions

	if (!hcTermGroup.lst?.length) {
		const genes = opts.genes || []
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

		hcTermGroup.lst = twlst
		if (config.termgroups.indexOf(hcTermGroup) == -1) config.termgroups.unshift(hcTermGroup)
	}

	config.settings.matrix.maxSample = 100000
	return config
}

function maySetSandboxHeader(self) {
	// run only once upon init, after state and dataType is given
	if (!self.dom.header) return // no header
	switch (self.config.settings.hierCluster.dataType) {
		case dtgeneexpression:
			self.dom.header.text('Gene Expression Clustering')
			break
		default:
			throw 'unknown hierCluster.dataType to set header'
	}
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
