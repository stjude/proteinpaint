import { renderTable } from '#dom'
import { clusterMethodLst, distanceMethodLst } from '#shared/clustering.js'
import { select } from 'd3-selection'

// Given a clusterId, return all its children clusterIds
export function getAllChildrenClusterIds(clickedClusterId, left) {
	const mergedClusters = left
		? this.hierClusterData.clustering.row.mergedClusters
		: this.hierClusterData.clustering.col.mergedClusters
	const children = mergedClusters.get(clickedClusterId).childrenClusters || []
	let allChildren = [...children]
	for (const child of children) {
		allChildren = allChildren.concat(this.getAllChildrenClusterIds(child, left))
	}
	return allChildren
}

export function addSelectedSamplesOptions(clickedSampleNames, event) {
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
		.attr('data-testid', d => `hierCluster_dendro_menu_${d.label.split(' ')[0]}`)
		.on('click', event => {
			this.dom.dendroClickMenu.d.selectAll('*').remove()
			event.target.__data__.callback()
		})
	this.dom.dendroClickMenu.show(event.clientX, event.clientY)
}

export function addSelectedRowsOptions(clickedRowNames, event) {
	// TODO to support other hierCluster types
	const rowType =
		this.config.dataType == 'geneExpression'
			? 'genes'
			: this.config.dataType == 'metaboliteIntensity'
			? 'metabolites'
			: 'items'

	const optionArr = [
		{
			label: `List ${clickedRowNames.length} ${rowType}`,
			callback: () => this.showTable4selectedRows(clickedRowNames, rowType)
		}
	]

	const minGeneCutoff = this.app.opts.genome.termdbs.msigdb.geneORAparam.minCutoff // gene ORA cutoffs queried from genome file
	const maxGeneCutoff = this.app.opts.genome.termdbs.msigdb.geneORAparam.maxCutoff // gene ORA cutoffs queried from genome file
	if (this.app.opts.genome.termdbs) {
		// Check if genome build contains termdbs, only then enable gene ora
		optionArr.push({
			label: `Gene set overrepresentation analysis`,
			disabled: clickedRowNames.length < minGeneCutoff || clickedRowNames.length > maxGeneCutoff,
			callback: () => {
				if (clickedRowNames.length < minGeneCutoff || clickedRowNames.length > maxGeneCutoff) return
				this.dom.dendroClickMenu.d.selectAll('*').remove()
				const sample_genes = clickedRowNames
				const geneORAparams = {
					sample_genes: sample_genes.toString(),
					genome: this.app.vocabApi.opts.state.vocab.genome
				}
				const config = {
					chartType: 'geneORA',
					geneORAparams: geneORAparams
				}
				this.app.dispatch({
					type: 'plot_create',
					config
				})
			}
		})
	}

	this.mouseout()
	this.dom.tip.hide()
	this.dom.dendroClickMenu.d.selectAll('*').remove()
	this.dom.dendroClickMenu.d
		.selectAll('div')
		.data(optionArr)
		.enter()
		.append('div')
		.attr('class', d => (d.disabled ? 'sja_menuoption_not_interactive' : 'sja_menuoption'))
		.style('opacity', d => (d.disabled ? 0.5 : 1))
		.style('border-radius', '0px')
		.html(d =>
			d.disabled
				? `${d.label} <span style="font-size: 0.6em; display: block; margin-left: 2px; margin-top: 2px;">Only available when 15 - 500 genes selected</span>`
				: d.label
		)
		.attr('data-testid', d => `hierCluster_dendro_menu_${d.label.split(' ')[0]}`)
		.on('click', event => {
			if (event.target.__data__?.callback) event.target.__data__.callback()
		})
	this.dom.dendroClickMenu.show(event.clientX, event.clientY)
}

// zoom in matrix to the selected dendrogram branch
export function triggerZoomBranch(self, clickedSampleNames) {
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
export function showTable4selectedSamples(clickedSampleNames) {
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

// show the list of clicked samples as a table
export function showTable4selectedRows(clickedRowNames, rowType) {
	const templates = this.state.termdbConfig.urlTemplates

	const rows =
		templates?.gene && this.config.dataType == 'geneExpression' && this.hierClusterData.byTermId
			? clickedRowNames.map(c =>
					this.hierClusterData.byTermId[c]?.gencodeId
						? [{ value: c, url: `${templates.gene.base}${this.hierClusterData.byTermId[c].gencodeId}` }]
						: [{ value: c }]
			  )
			: clickedRowNames.map(c => [{ value: c }])

	const columns = [{ label: rowType }]

	const div = this.dom.dendroClickMenu.clear().d.append('div').style('margin', '10px')

	// Create a button to copy names in the table
	const buttonDiv = div.append('div').style('padding', '5px')
	const copyButton = buttonDiv
		.append('button')
		.html(`Copy ${rowType}`)
		.attr('class', '.sja_menu_div button')
		.style('margin-top', '2px')
		.style('padding', '5px')
		.on('click', () => {
			const geneNames = rows.map(row => row[0].value).join('\n')
			navigator.clipboard.writeText(geneNames).then(() => {}, console.warn)
			copyButton.html(`Copy ${rowType}&nbsp;&check;`)
		})
	renderTable({
		rows,
		columns,
		div: div.append('div'),
		showLines: true,
		maxHeight: '35vh',
		resize: true
	})
}

// add the clicked samples into a group
export async function addGroup(group) {
	group.plotId = this.id
	await this.app.vocabApi.addGroup(group)
	this.dom.tip.hide()
}

// upon clicking, find the corresponding clicked clusterId from this.hierClusterData.clustering.col.mergedClusters
export function getClusterFromTopDendrogram(event) {
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

// upon clicking, find the corresponding clicked clusterId from this.hierClusterData.clustering.row.mergedClusters
export function getClusterFromLeftDendrogram(event) {
	// Need imgBox to find the position of event relative to dendrogram
	if (event.target.tagName == 'image') this.imgBox = event.target.getBoundingClientRect()
	else return

	const y = event.clientY - this.imgBox.y - event.target.clientTop
	const xMin = this.dimensions.xMin
	const x = event.clientX - this.imgBox.x - event.target.clientLeft + xMin

	for (const [clusterId, cluster] of this.hierClusterData.clustering.row.mergedClusters) {
		const { x1, y1, x2, y2, clusterX } = cluster.clusterPosition
		if (
			(y1 <= y && y <= y2 && clusterX - 5 < x && x < clusterX + 5) ||
			(clusterX <= x && x <= x1 && y1 - 5 < y && y < y1 + 5) ||
			(clusterX <= x && x <= x2 && y2 - 5 < y && y < y2 + 5)
		) {
			return clusterId
		}
	}
}

export function setClusteringBtn(holder, callback) {
	const cl = this.config.settings.matrix.controlLabels
	const dataType = this.config.dataType
	const clusterRowLabel =
		dataType == 'geneExpression'
			? 'Genes'
			: dataType == 'metaboliteIntensity'
			? 'Metabolites'
			: dataType == 'numericDictTerm'
			? 'Terms'
			: 'Rows'
	const cluteringButtonLabel =
		dataType == 'geneExpression'
			? 'Gene Expression Clustering'
			: dataType == 'metaboliteIntensity'
			? 'Metabolite Intensity Clustering'
			: dataType == 'numericDictTerm'
			? 'Term Value Clustering'
			: 'Clustering'
	holder
		.append('button')
		//.property('disabled', d => d.disabled)
		.datum({
			label: cluteringButtonLabel,
			rows: [
				{
					label: `Cluster ${cl.Samples}`,
					title: `Option to enable ${cl.samples} clustering, instead of enabling ${cl.samples} sorting.`,
					type: 'checkbox',
					chartType: 'hierCluster',
					settingsKey: 'clusterSamples',
					boxLabel: `Cluster ${cl.Samples} (Disable ${cl.Samples} Sorting)`,
					callback: checked => {
						if (!checked) {
							this.config.settings.hierCluster.yDendrogramHeight = 0
							this.config.settings.hierCluster.clusterSamples = false
						} else {
							this.config.divideBy = null
							this.config.settings.hierCluster.yDendrogramHeight = 200
							this.config.settings.hierCluster.clusterSamples = true
						}
						this.app.dispatch({
							type: 'plot_edit',
							id: this.id,
							config: this.config
						})
					}
				},
				{
					label: `Cluster ${clusterRowLabel}`,
					title: `Option to enable ${clusterRowLabel} clustering, instead of enabling ${clusterRowLabel} sorting.`,
					type: 'checkbox',
					chartType: 'hierCluster',
					settingsKey: 'clusterRows',
					boxLabel: `Cluster ${clusterRowLabel} (Disable ${clusterRowLabel} Sorting)`,
					callback: checked => {
						if (!checked) {
							this.config.settings.hierCluster.clusterRows = false
							this.config.settings.hierCluster.sortClusterRows = 'asListed'
						} else {
							this.config.settings.hierCluster.clusterRows = true
							this.config.settings.hierCluster.sortClusterRows = undefined
						}
						this.app.dispatch({
							type: 'plot_edit',
							id: this.id,
							config: this.config
						})
					}
				},
				{
					label: `Sort ${clusterRowLabel}`,
					title: `Set how to order the ${clusterRowLabel} as rows`,
					type: 'radio',
					chartType: 'hierCluster',
					settingsKey: 'sortClusterRows',
					options: [
						{ label: `By input ${clusterRowLabel} order`, value: 'asListed' },
						{ label: `By ${clusterRowLabel} name`, value: 'byName' }
					],
					styles: { padding: 0, 'padding-right': '10px', margin: 0, display: 'inline-block' },
					getDisplayStyle(plot) {
						return plot.settings.hierCluster.clusterRows ? 'none' : 'table-row'
					}
				},
				{
					label: 'Z-score Transformation',
					title: `Option to do Z-score transformation`,
					type: 'checkbox',
					chartType: 'hierCluster',
					settingsKey: 'zScoreTransformation',
					boxLabel: `Perform Z-score Transformation`,
					callback: checked => {
						if (!checked) {
							this.config.settings.hierCluster.zScoreTransformation = false
							this.config.settings.hierCluster.colorScale = 'whiteRed'
						} else {
							this.config.settings.hierCluster.zScoreTransformation = true
							this.config.settings.hierCluster.colorScale = 'blueWhiteRed'
						}
						this.app.dispatch({
							type: 'plot_edit',
							id: this.id,
							config: this.config
						})
					}
				},
				{
					label: `Clustering Method`,
					title: `Sets which clustering method to use`,
					type: 'radio',
					chartType: 'hierCluster',
					settingsKey: 'clusterMethod',
					options: clusterMethodLst
				},
				{
					label: `Distance Method`,
					title: `Sets which distance method to use for clustering`,
					type: 'radio',
					chartType: 'hierCluster',
					settingsKey: 'distanceMethod',
					options: distanceMethodLst
				},
				{
					label: `Column Dendrogram Height`,
					title: `The maximum height to render the column dendrogram`,
					type: 'number',
					chartType: 'hierCluster',
					settingsKey: 'yDendrogramHeight',
					getDisplayStyle(plot) {
						return plot.settings.hierCluster.clusterSamples ? 'table-row' : 'none'
					}
				},
				{
					label: `Row Dendrogram Width`,
					title: `The maximum width to render the row dendrogram`,
					type: 'number',
					chartType: 'hierCluster',
					settingsKey: 'xDendrogramHeight',
					getDisplayStyle(plot) {
						return plot.settings.hierCluster.clusterRows ? 'table-row' : 'none'
					}
				},
				{
					label: `Z-score Cap`,
					title: `Cap the Z-score scale to not exceed this absolute value`,
					type: 'number',
					chartType: 'hierCluster',
					settingsKey: 'zScoreCap'
				},
				{
					label: `Color Scheme`,
					title: `Sets which color scheme to use`,
					type: 'radio',
					chartType: 'hierCluster',
					settingsKey: 'colorScale',
					options: [
						{
							label: 'Blue-White-Red',
							value: 'blueWhiteRed',
							title: `color scheme Blue-White-Red`
						},
						{
							label: 'Green-Black-Red',
							value: 'greenBlackRed',
							title: `color scheme Green-Black-Red`
						},
						{
							label: 'Blue-Yellow-Red',
							value: 'blueYellowRed',
							title: `color scheme Blue-Yellow-Red`
						},
						{
							label: 'Green-White-Red',
							value: 'greenWhiteRed',
							title: `color scheme Green-White-Red`
						},
						{
							label: 'Blue-Black-Yellow',
							value: 'blueBlackYellow',
							title: `color scheme Blue-Black-Yellow`
						}
					]
				}
			],
			customInputs: updateClusteringControls
		})
		.html(d => d.label)
		.style('margin', '2px 0')
		.on('click', callback)
}

function updateClusteringControls(self, app, parent, table) {
	if (parent.chartType == 'hierCluster' && !parent.config.settings.hierCluster.zScoreTransformation) {
		const zScoreCapControl = select(
			table
				.selectAll('td')
				.filter(function () {
					return select(this).text() == 'Z-score Cap'
				})
				.node()
				.closest('tr')
		)
		zScoreCapControl.style('display', 'none')
		const colorSchemeControl = select(
			table
				.selectAll('td')
				.filter(function () {
					return select(this).text() == 'Color Scheme'
				})
				.node()
				.closest('tr')
		)
		colorSchemeControl.style('display', 'none')
	}
}
