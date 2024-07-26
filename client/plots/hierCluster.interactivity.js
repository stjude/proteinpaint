import { renderTable } from '../dom/table'
import { clusterMethodLst, distanceMethodLst } from '#shared/clustering'

// Given a clusterId, return all its children clusterIds
export function getAllChildrenClusterIds(clickedClusterId) {
	const mergedClusters = this.hierClusterData.clustering.col.mergedClusters
	const children = mergedClusters.get(clickedClusterId).childrenClusters || []
	let allChildren = [...children]
	for (const child of children) {
		allChildren = allChildren.concat(this.getAllChildrenClusterIds(child))
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

export function setClusteringBtn(holder, callback) {
	const hc = this.settings.hierCluster
	holder
		.append('button')
		//.property('disabled', d => d.disabled)
		.datum({
			label: `Clustering`,
			rows: [
				{
					label: 'Cluster Samples',
					title: 'Option to enable sample clustering, instead of enable sample sorting.',
					type: 'checkbox',
					chartType: 'hierCluster',
					settingsKey: 'clusterSamples',
					boxLabel: 'Cluster samples (Disable samples sorting)',
					callback: checked => {
						if (!checked) {
							this.config.settings.hierCluster.yDendrogramHeight = 0
							this.config.settings.hierCluster.clusterSamples = false
						} else {
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
					settingsKey: 'xDendrogramHeight'
				},
				{
					label: `z-score Cap`,
					title: `Cap the z-score scale to not exceed this absolute value`,
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
			]
		})
		.html(d => d.label)
		.style('margin', '2px 0')
		.on('click', callback)
}
