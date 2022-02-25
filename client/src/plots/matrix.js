import { getCompInit, copyMerge } from '../common/rx.core'
import { controlsInit } from './controls'
import { select } from 'd3-selection'
import { scaleOrdinal, schemeCategory10, schemeCategory20 } from 'd3-scale'
import { fillTermWrapper } from '../common/termsetting'
import { MatrixCluster } from './matrix.cluster'

class Matrix {
	constructor(opts) {
		this.type = 'matrix'
		setRenderers(this)
	}

	async init(appState) {
		const opts = this.opts
		const holder = opts.controls ? opts.holder : opts.holder.append('div')
		const controls = this.opts.controls ? null : holder.append('div')
		const svg = holder
			.append('svg')
			.style('margin', '20px 10px')
			.style('overflow', 'visible')
		const mainG = svg.append('g')
		this.dom = {
			header: opts.header,
			controls,
			holder,
			svg,
			mainG,
			cluster: mainG.append('g').attr('class', 'sjpp-matrix-cluster-g'),
			seriesesG: mainG.append('g').attr('class', 'sjpp-matrix-serieses-g'),
			termLabelG: mainG.append('g').attr('class', 'sjpp-matrix-term-label-g')
			//legendDiv: holder.append('div').style('margin', '5px 5px 15px 5px')
		}
		this.config = appState.plots.find(p => p.id === this.id)
		this.settings = Object.assign({}, this.config.settings.matrix)
		if (this.dom.header) this.dom.header.html('Sample Matrix')
		await this.setControls(appState)

		this.clusterRenderer = new MatrixCluster({ holder: this.dom.cluster, app: this.app })
	}

	async setControls(appState) {
		if (this.opts.controls) {
			this.opts.controls.on('downloadClick.boxplot', this.download)
		} else {
			this.dom.holder
				.attr('class', 'pp-termdb-plot-viz')
				.style('display', 'inline-block')
				.style('min-width', '300px')
				.style('margin-left', '50px')

			this.components = {
				controls: await controlsInit({
					app: this.app,
					id: this.id,
					holder: this.dom.controls.attr('class', 'pp-termdb-plot-controls').style('display', 'inline-block'),
					inputs: [
						{
							label: 'Group samples by',
							type: 'term',
							chartType: 'matrix',
							configKey: 'divideBy',
							vocabApi: this.app.vocabApi,
							state: {
								vocab: appState.vocab,
								activeCohort: appState.activeCohort
							}
						},
						{
							label: 'Transpose',
							boxLabel: '',
							type: 'checkbox',
							chartType: 'matrix',
							settingsKey: 'transpose'
						},
						{
							label: 'Column width',
							type: 'number',
							chartType: 'matrix',
							settingsKey: 'colw'
						},
						{
							label: 'Column gap',
							type: 'number',
							chartType: 'matrix',
							settingsKey: 'colspace'
						},
						{
							label: 'Column label offset',
							type: 'number',
							chartType: 'matrix',
							settingsKey: 'collabelgap'
						},
						{
							label: 'Row height',
							type: 'number',
							chartType: 'matrix',
							settingsKey: 'rowh'
						},
						{
							label: 'Row gap',
							type: 'number',
							chartType: 'matrix',
							settingsKey: 'rowspace'
						},
						{
							label: 'Row label offset',
							type: 'number',
							chartType: 'matrix',
							settingsKey: 'rowlabelgap'
						}
					]
				})
			}
		}
	}

	/*reactsTo(action) {
		if (action.type == 'plot_edit') {
			// note: parent 'plot' component already checked against action.id == this.id
			// no need to react to edits to controls panel 
			return action.config && action.config.settings && actions.config.settings.matrix
		}
		return true
	}*/

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		return {
			isVisible: true,
			config,
			filter: appState.termfilter.filter
		}
	}

	async main() {
		try {
			this.config = this.state.config
			const prevTranspose = this.settings.transpose
			Object.assign(this.settings, this.config.settings)

			// get the data
			const reqOpts = this.getDataRequestOpts()
			const data = await this.app.vocabApi.getMatrixData(reqOpts)

			// process the data
			this.setSampleGroupsOrder(data)
			this.setTermOrder(data)
			this.dimensions = this.getDimensions()
			this.serieses = this.getSerieses()

			// render the data
			this.render()

			this.clusterRenderer.main({
				settings: this.settings.matrix,
				xGrps: this.layout.colgrps,
				yGrps: this.layout.rowgrps,
				dimensions: this.dimensions
			})

			await this.updateSvgDimensions(prevTranspose)
		} catch (e) {
			throw e
		}
	}

	// creates an opts object for the vocabApi.getNestedChartsData()
	getDataRequestOpts() {
		this.rowTerms = []
		for (const grp of this.config.termgroups) {
			this.rowTerms.push(...grp.lst)
		}
		const terms = []
		if (this.config.divideBy) terms.push(this.config.divideBy)
		terms.push(...this.rowTerms)
		return { terms, filter: this.state.filter }
	}

	setSampleGroupsOrder(data) {
		const s = this.settings.matrix
		const sgtid = this.config.divideBy?.term?.id
		const defaultSampleGrp = { id: undefined, lst: [] }

		const sampleGroups = new Map()
		if (!this.config.divideBy) {
			defaultSampleGrp.lst = data.lst
			defaultSampleGrp.name = ''
		} else {
			defaultSampleGrp.name = 'Not annotated'
			for (const row of data.lst) {
				if (sgtid in row) {
					const key = row[sgtid].key
					if (!sampleGroups.has(key)) {
						sampleGroups.set(key, {
							id: key,
							name: key, // TODO: may change to a label
							lst: []
						})
					}
					sampleGroups.get(key).lst.push(row)
				} else {
					defaultSampleGrp.lst.push(row)
				}
			}
		}

		if (defaultSampleGrp.lst.length) {
			sampleGroups.set(undefined, defaultSampleGrp)
		}

		// TODO: sort sample groups, maybe by sample count, value order, etc
		this.sampleGroups = [...sampleGroups.values()]
		//this.sampleGroupKeys = [...sampleGroups.keys()] -- not needed?
		this.sampleOrder = []
		const sampleSorter = (a, b) => {
			const k = a[s.sortSamplesBy] // TODO: support many types of sorting
			const l = b[s.sortSamplesBy]
			if (k < l) return -1
			if (k > l) return 1
			return 0
		}

		let total = 0
		for (const [grpIndex, grp] of this.sampleGroups.entries()) {
			grp.lst.sort(sampleSorter)
			for (const [sIndex, row] of grp.lst.entries()) {
				this.sampleOrder.push({ grp, grpIndex, row, sIndex, prevGrpCount: total, index: total + sIndex })
			}
			total += grp.lst.length
		}
	}

	setTermOrder(data) {
		this.termOrder = []
		let total = 0
		for (const [grpIndex, grp] of this.config.termgroups.entries()) {
			for (const [tIndex, tw] of grp.lst.entries()) {
				if (!('id' in tw)) tw.id = tw.term.id
				this.termOrder.push({ grp, grpIndex, tw, tIndex, prevGrpCount: total, index: total + tIndex })
			}
			total += grp.lst.length
		}
	}

	getDimensions() {
		const s = this.settings.matrix

		if (!s.transpose) {
			// sample as columns
			this.layout = {
				colgrps: this.sampleGroups,
				colorder: this.sampleOrder,
				colOffset: s.sampleLabelOffset,
				rowgrps: this.config.termgroups,
				roworder: this.termOrder,
				rowOffset: s.termLabelOffset
			}
		} else {
			// sample as rows
			this.layout = {
				colgrps: this.config.termgroups,
				colorder: this.termOrder,
				colOffset: s.termLabelOffset,
				rowgrps: this.sampleGroups,
				roworder: this.sampleOrder,
				rowOffset: s.sampleLabelOffset
			}
		}

		const dx = s.colw + s.colspace
		const nx = this.layout.colorder.length
		const xOffset = this.layout.rowOffset + s.margin.left
		const dy = s.rowh + s.rowspace
		const ny = this.layout.roworder.length
		const yOffset = this.layout.colOffset + s.margin.top

		return {
			dx,
			dy,
			xOffset,
			yOffset,
			mainw: nx * dx + this.layout.colgrps.length * s.colgspace,
			mainh: ny * dy + this.layout.rowgrps.length * s.rowgspace,
			xLabelGap:
				s.rowlabelpos == 'left'
					? { row: -s.rowlabelgap, grp: s.rowlabelgap }
					: { row: s.rowlabelgap, grp: -s.rowlabelgap },
			yLabelGap:
				s.collabelpos == 'top'
					? { col: -s.collabelgap, grp: s.collabelgap }
					: { col: s.collabelgap, grp: -s.collabelgap }
		}
	}

	getSerieses() {
		const s = this.settings.matrix
		//console.log(233, s, samples, termOrder)
		const serieses = []
		const dx = s.colw + s.colspace
		const dy = s.rowh + s.rowspace
		const keysByTermId = {}

		for (const { index, grpIndex, row } of this.sampleOrder) {
			const series = {
				row,
				cells: [],
				x: !s.transpose ? index * dx + grpIndex * s.colgspace : 0,
				y: !s.transpose ? 0 : index * dy + grpIndex * s.rowgspace
			}

			for (const t of this.termOrder) {
				if (!(t.tw.id in row)) continue
				const key = t.tw.id
				const tIndex = t.index
				series.cells.push({
					termid: key,
					key: row[key].key,
					label: row[key].label,
					x: !s.transpose ? 0 : tIndex * dx + t.grpIndex * s.colgspace,
					y: !s.transpose ? tIndex * dy + t.grpIndex * s.rowgspace : 0
				})

				if (!keysByTermId[key]) keysByTermId[key] = new Set()
				keysByTermId[key].add(row[key].key)
			}
			serieses.push(series)
		}

		this.colorScaleByTermId = {}
		for (const termid in keysByTermId) {
			this.colorScaleByTermId[termid] =
				keysByTermId[termid].size < 11 ? scaleOrdinal(schemeCategory10) : scaleOrdinal(schemeCategory20)
		}
		return serieses
	}

	setSorters() {
		this.sorters = {
			name: (a, b) => (a.sample < b.sample ? -1 : 1)
		}
	}
}

export const matrixInit = getCompInit(Matrix)
// this alias will allow abstracted dynamic imports
export const componentInit = matrixInit

function setRenderers(self) {
	self.render = function() {
		//console.log('currData', data, self.dom.svg.attr('width'))
		const s = self.settings.matrix
		const d = self.dimensions
		const duration = self.dom.svg.attr('width') ? s.duration : 0

		self.dom.seriesesG
			.transition()
			.duration(duration)
			.attr('transform', `translate(${d.xOffset},${d.yOffset})`)

		const sg = self.dom.seriesesG.selectAll('.sjpp-mass-series-g').data(this.serieses, d => d.row.sample)

		sg.exit().remove()
		sg.each(self.renderSeries)
		sg.enter()
			.append('g')
			.attr('class', 'sjpp-mass-series-g')
			.style('opacity', 0.001)
			.each(self.renderSeries)

		self.dom.termLabelG
			.transition()
			.duration(duration)
			.attr('transform', `translate(${d.xOffset},${d.yOffset})`)

		const termLabels = self.dom.termLabelG.selectAll('g').data(this.termOrder, t => t.grp.id + ';;' + t.tw.id)
		termLabels.exit().remove()
		termLabels.each(self.renderTermLabels)
		termLabels
			.enter()
			.append('g')
			.each(self.renderTermLabels)
	}

	self.renderSeries = function(series) {
		//console.log(157, 'series', series)
		const s = self.settings.matrix
		const g = select(this)
		const duration = g.attr('transform') ? s.duration : 0

		g.transition()
			.duration(duration)
			.attr('transform', `translate(${series.x},${series.y})`)
			.style('opacity', 1)

		const texts = g.selectAll('.sjpp-matrix-series-label-g').data([series], series => series.row.sample)
		texts.exit().remove()
		texts.each(self.renderSeriesLabel)
		texts
			.enter()
			.append('g')
			.attr('class', 'sjpp-matrix-series-label-g')
			.each(self.renderSeriesLabel)

		const rects = g.selectAll('rect').data(series.cells, cell => cell.termid)
		rects.exit().remove()
		rects.each(self.renderRect)
		rects
			.enter()
			.append('rect')
			.each(self.renderRect)
	}

	self.renderRect = function(cell) {
		const s = self.settings.matrix
		const rect = select(this)
			.transition()
			.duration('x' in this ? s.duration : 0)
			.attr('x', cell.x)
			.attr('y', cell.y)
			.attr('width', s.colw)
			.attr('height', s.rowh)
			.attr('stroke', '#eee')
			.attr('stroke-width', 1)
			.attr('fill', self.colorScaleByTermId[cell.termid](cell.key))
	}

	self.renderSeriesLabel = function(series) {
		const s = self.settings.matrix
		const d = self.dimensions
		const g = select(this)
		const duration = g.attr('transform') ? s.duration : 0

		g.transition()
			.duration(duration)
			.attr(
				'transform',
				!s.transpose ? `translate(${0.7 * s.colw},${d.yLabelGap.col})` : `translate(${d.xLabelGap.row},${s.rowh - 2})`
			)

		if (!g.select('text').size()) g.append('text')
		const text = g.select('text')
		const fontSize = !s.transpose ? s.colw + s.colspace - 4 : s.rowh + s.rowspace - 4
		text
			.attr('fill', '#000')
			.transition()
			.duration(duration)
			//.attr('opacity', fontsize < 6 ? 0 : )
			.attr('font-size', fontSize)
			.attr('text-anchor', !s.transpose ? 'start' : 'end')
			.attr('transform', !s.transpose ? `rotate(-90)` : '')
			.text(series.row.sample)
	}

	self.renderTermLabels = function(t) {
		const s = self.settings.matrix
		const d = self.dimensions
		const g = select(this)
		const duration = g.attr('transform') ? s.duration : 0
		const tIndex = t.tIndex + t.prevGrpCount
		const x = !s.transpose ? d.xLabelGap.row : t.grpIndex * s.colgspace + tIndex * d.dx + s.colw / 3
		const y = !s.transpose ? t.grpIndex * s.rowgspace + tIndex * d.dy + 0.8 * s.rowh : d.yLabelGap.col
		g.transition()
			.duration(duration)
			.attr('transform', `translate(${x},${y})`)

		const fontSize = s.transpose ? s.colw + s.colspace - 4 : s.rowh + s.rowspace - 4
		if (!g.select('text').size()) g.append('text')
		g.select('text')
			.attr('fill', '#000')
			.transition()
			.duration(duration)
			//.attr('opacity', fontsize < 6 ? 0 : )
			.attr('font-size', fontSize)
			.attr('text-anchor', !s.transpose ? 'end' : 'start')
			.attr('transform', !s.transpose ? '' : `rotate(-90)`)
			.text(t.tw.term.name)
	}

	self.updateSvgDimensions = async function(prevTranspose) {
		const s = self.settings.matrix
		const d = self.dimensions
		const duration = self.dom.svg.attr('width') ? s.duration : 0

		// wait for labels to render; when transposing, must wait for
		// the height and width to be measured after its done
		await sleep(prevTranspose == s.transpose ? duration : s.duration)

		const sLabelBox = { max: 0, key: !s.transpose ? 'height' : 'width' }
		self.dom.mainG.selectAll('.sjpp-matrix-series-label-g').each(function() {
			const bbox = this.getBBox()
			const measurement = bbox[sLabelBox.key]
			if (measurement > sLabelBox.max) sLabelBox.max = measurement
		})
		const termBox = self.dom.mainG
			.select('.sjpp-matrix-term-label-g')
			.node()
			.getBBox()

		const colGrpLabelBox = self.dom.mainG
			.select('.sjpp-matrix-colgrplabels')
			.node()
			.getBBox()
		const rowGrpLabelBox = self.dom.mainG
			.select('.sjpp-matrix-rowgrplabels')
			.node()
			.getBBox()

		const xw = !s.transpose ? termBox.width : sLabelBox.max
		d.extraWidth = rowGrpLabelBox.width + xw + s.margin.left + s.margin.right + s.rowlabelgap * 2

		const yh = !s.transpose ? sLabelBox.max : termBox.height
		d.extraHeight = colGrpLabelBox.height + yh + s.margin.top + s.margin.bottom + s.collabelgap * 2

		d.svgw = d.mainw + d.extraWidth // d.svgw + self.dom.row self.clusterRenderer  d.xOffset + nx * dx + this.layout.colgrps.length * s.colgspace + s.margin.right,
		d.svgh = d.mainh + d.extraHeight // d.yOffset + ny * dy + this.layout.rowgrps.length * s.rowgspace + s.margin.bottom + 100

		self.dom.svg
			.transition()
			.duration(duration)
			.attr('width', d.svgw)
			.attr('height', d.svgh)

		self.dom.mainG
			.transition()
			.duration(duration)
			.attr('transform', `translate(${xw - self.layout.rowOffset},${yh - self.layout.colOffset})`)
	}
}

export async function getPlotConfig(opts, app) {
	const config = {
		// data configuration
		termgroups: [],
		samplegroups: [],
		divideBy: null,

		// rendering options
		settings: {
			controls: {
				isOpen: false // control panel is hidden by default
			},
			matrix: {
				margin: {
					top: 5,
					right: 5,
					bottom: 5,
					left: 5
				},
				sortSamplesBy: 'sample',
				colw: 14,
				colspace: 1,
				colgspace: 8,
				collabelpos: 'top', // | 'bottom'
				collabelvisible: true,
				colglabelpos: true,
				collabelgap: 5,
				rowh: 18,
				rowspace: 1,
				rowgspace: 8,
				rowlabelpos: 'left', // | 'right'
				rowlabelgap: 5,
				rowlabelvisible: true,
				rowglabelpos: true,
				rowlabelgap: 5,
				transpose: false,
				sampleLabelOffset: 120,
				termLabelOffset: 80,
				duration: 250
			}
		}
	}

	// may apply term-specific changes to the default object
	copyMerge(config, opts)
	const promises = []
	for (const grp of config.termgroups) {
		for (const tw of grp.lst) promises.push(fillTermWrapper(tw, app.vocabApi))
	}
	if (config.divideBy) promises.push(fillTermWrapper(config.divideBy, app.vocabApi))
	await Promise.all(promises)
	return config
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}
