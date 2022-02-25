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
		if (this.dom.header) this.dom.header.html('Sample Matrix')
		// hardcode for now, but may be set as option later
		this.settings = Object.assign({ h: {}, handlers: {} }, this.opts.settings)
		await this.setControls(appState)

		this.clusterRenderer = new MatrixCluster({ holder: this.dom.cluster, app: this.app })
	}

	async setControls(appState) {
		const config = appState.plots.find(p => p.id === this.id)
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
							label: 'Sample label offset',
							type: 'number',
							chartType: 'matrix',
							settingsKey: 'sampleLabelOffset'
						},
						{
							label: 'Term label offset',
							type: 'number',
							chartType: 'matrix',
							settingsKey: 'termLabelOffset'
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
			Object.assign(this.settings, this.config.settings)
			const reqOpts = this.getDataRequestOpts()
			const data = await this.app.vocabApi.getMatrixData(reqOpts)
			this.currData = this.processData(data)
			this.dimensions = this.getDimensions(this.currData)
			this.render(this.currData)
			this.clusterRenderer.main(this.currData)
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

	processData(data) {
		const s = this.settings.matrix
		const sgtid = this.config.divideBy?.term?.id
		const notAnnotated = {
			id: undefined,
			name: 'Not annotated',
			lst: []
		}

		const sampleGroups = new Map()
		if (!this.config.divideBy) {
			notAnnotated.lst = data.lst
		} else {
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
					notAnnotated.lst.push(row)
				}
			}
		}

		if (notAnnotated.lst.length) {
			sampleGroups.set(undefined, notAnnotated)
		}

		const sampleGroupKeys = [...sampleGroups.keys()]
		const samples = data.lst
			.sort((a, b) => {
				const i = sampleGroupKeys.indexOf(a[sgtid]?.key)
				const j = sampleGroupKeys.indexOf(b[sgtid]?.key)
				if (i < j) return -1
				if (i > j) return 1
				const k = a[s.sortSamplesBy]
				const l = b[s.sortSamplesBy]
				if (k < l) return -1
				if (k > l) return 1
				return 0
			})
			.map(r => r.sample)

		const termOrder = []
		let total = 0
		for (const [grpIndex, grp] of this.config.termgroups.entries()) {
			for (const [tIndex, tw] of grp.lst.entries()) {
				if (!('id' in tw)) tw.id = tw.term.id
				termOrder.push({ grp, grpIndex, tw, tIndex, prevGrpCount: total })
			}
			total += grp.lst.length
		}

		//console.log(233, s, samples, termOrder)
		const serieses = []
		const dx = s.colw + s.colspace
		const dy = s.rowh + s.rowspace
		const keysByTermId = {}
		const rowTermsIds = this.rowTerms.map(tw => ('id' in tw ? tw.id : tw.term.id))

		for (const row of data.lst) {
			const sIndex = samples.indexOf(row.sample)
			const sGrpIndex = sampleGroupKeys.indexOf(row[sgtid]?.key) //; console.log(229, sIndex, sGrpIndex)
			const series = {
				row,
				cells: [],
				x: !s.transpose ? sIndex * dx + sGrpIndex * s.colgspace : 0,
				y: !s.transpose ? 0 : sIndex * dy + sGrpIndex * s.rowgspace
			}

			for (const t of termOrder) {
				if (!(t.tw.id in row)) continue
				const key = t.tw.id
				const tIndex = t.tIndex + t.prevGrpCount
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

			/*for (const key in row) {
				if (key == 'sample' || !rowTermsIds.includes(key)) continue
				
				const tGrpIndex = termGroupKeys.indexOf(key)
				series.cells.push({
					termid: key,
					key: row[key].key,
					label: row[key].label,
					x: !s.transpose ? 0 : tIndex * dx,
					y: !s.transpose ? tIndex * dy : 0
				})
			}*/

			serieses.push(series)
		}

		this.colorScaleByTermId = {}
		for (const termid in keysByTermId) {
			this.colorScaleByTermId[termid] =
				keysByTermId[termid].size < 11 ? scaleOrdinal(schemeCategory10) : scaleOrdinal(schemeCategory20)
		}

		return {
			termOrder,
			serieses,
			sampleGroupKeys,
			sampleGroups: [...sampleGroups.values()],
			termGroups: this.config.termgroups,
			config: this.config
		}
	}

	getDimensions(data) {
		const s = this.settings.matrix
		const dx = s.colw + s.colspace
		const Nx = data[!s.transpose ? 'serieses' : 'termOrder'].length
		const xOffset = (!s.transpose ? s.termLabelOffset : s.sampleLabelOffset) + s.margin.left
		const dy = s.rowh + s.rowspace
		const Ny = data[!s.transpose ? 'termOrder' : 'serieses'].length
		const yOffset = (!s.transpose ? s.sampleLabelOffset : s.termLabelOffset) + s.margin.top

		return {
			dx,
			dy,
			xOffset,
			yOffset,
			svgw: Nx * dx + xOffset + s.margin.right,
			svgh: Ny * dy + yOffset + s.margin.bottom + 100
		}
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
	self.render = function(data) {
		//console.log('currData', data, self.dom.svg.attr('width'))
		const s = self.settings.matrix
		const d = self.dimensions
		const duration = self.dom.svg.attr('width') ? s.duration : 0

		self.dom.svg
			.transition()
			.duration(duration)
			.attr('width', d.svgw)
			.attr('height', d.svgh)

		self.dom.seriesesG
			.transition()
			.duration(duration)
			.attr('transform', `translate(${d.xOffset},${d.yOffset})`)

		const sg = self.dom.seriesesG.selectAll('.sjpp-mass-series-g').data(data.serieses, d => d.row.sample)

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

		const termLabels = self.dom.termLabelG.selectAll('g').data(data.termOrder, t => t.grp.id + ';;' + t.tw.id)
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
		const g = select(this)
		const duration = g.attr('transform') ? s.duration : 0

		g.transition()
			.duration(duration)
			.attr('transform', !s.transpose ? `translate(${0.7 * s.colw},-5)` : `translate(-5,${s.rowh - 2})`)

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
		const x = !s.transpose ? -5 : t.grpIndex * s.colgspace + tIndex * d.dx + s.colw / 3
		const y = !s.transpose ? t.grpIndex * s.rowgspace + tIndex * d.dy + 0.8 * s.rowh : -2
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
				rowh: 18,
				rowspace: 1,
				rowgspace: 8,
				rowlabelpos: 'left', // | 'right'
				rowlabelvisible: true,
				rowglabelpos: true,
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
	await Promise.all(promises)
	return config
}
