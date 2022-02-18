import { getCompInit, copyMerge } from '../common/rx.core'
import { controlsInit } from './controls'
import { select } from 'd3-selection'
import { scaleOrdinal, schemeCategory10, schemeCategory20 } from 'd3-scale'
import { fillTermWrapper } from '../common/termsetting'

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
			seriesesG: mainG.append('g').attr('class', 'sjpp-mass-serieses-g'),
			termLabelG: mainG.append('g').attr('class', 'sjpp-mass-term-label-g')
			//legendDiv: holder.append('div').style('margin', '5px 5px 15px 5px')
		}
		if (this.dom.header) this.dom.header.html('Sample Matrix')
		// hardcode for now, but may be set as option later
		this.settings = Object.assign({}, this.opts.settings)
		await this.setControls(appState)
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
		} catch (e) {
			throw e
		}
	}

	// creates an opts object for the vocabApi.getNestedChartsData()
	getDataRequestOpts() {
		return {
			termgroups: this.state.config.termgroups,
			filter: this.state.filter
		}
	}

	processData(data) {
		const s = this.settings.matrix
		const samples = data.lst.map(r => r.sample).sort((a, b) => (a[s.sortSamplesBy] < b[s.sortSamplesBy] ? -1 : 1))
		const termWrappers = []
		const terms = []
		this.config.termgroups.forEach(g => {
			termWrappers.push(...g.lst)
			terms.push(...g.lst.map(t => ('id' in t ? t.id : t.term.id)))
		})
		//console.log(71, s, samples, terms)

		const currData = { terms, serieses: [], termWrappers }
		const dx = s.colw + s.colspace
		const dy = s.rowh + s.rowspace
		const keysByTermId = {}
		for (let i = 0; i < data.lst.length; i++) {
			const row = data.lst[i]
			const sIndex = samples.indexOf(row.sample)
			const series = {
				row,
				cells: [],
				x: !s.transpose ? sIndex * dx : 0,
				y: !s.transpose ? 0 : sIndex * dy
			}

			for (const key in row) {
				if (key == 'sample') continue
				const tIndex = terms.indexOf(key)
				series.cells.push({
					termid: key,
					key: row[key].key,
					label: row[key].label,
					x: !s.transpose ? 0 : tIndex * dx,
					y: !s.transpose ? tIndex * dy : 0
				})
				if (!keysByTermId[key]) keysByTermId[key] = new Set()
				keysByTermId[key].add(row[key].key)
			}

			currData.serieses.push(series)
		}

		this.colorScaleByTermId = {}
		for (const termid in keysByTermId) {
			this.colorScaleByTermId[termid] =
				keysByTermId[termid].size < 11 ? scaleOrdinal(schemeCategory10) : scaleOrdinal(schemeCategory20)
		}

		return currData
	}

	getDimensions(data) {
		const s = this.settings.matrix
		const dx = s.colw + s.colspace
		const Nx = data[!s.transpose ? 'serieses' : 'terms'].length
		const xOffset = (!s.transpose ? s.termLabelOffset : s.sampleLabelOffset) + s.margin.left
		const dy = s.rowh + s.rowspace
		const Ny = data[!s.transpose ? 'terms' : 'serieses'].length
		const yOffset = (!s.transpose ? s.sampleLabelOffset : s.termLabelOffset) + s.margin.top

		return {
			dx,
			dy,
			xOffset,
			yOffset,
			svgw: Nx * dx + xOffset + s.margin.right,
			svgh: Ny * dy + yOffset + s.margin.bottom
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
		//console.log(111, 'currData', data)
		const s = self.settings.matrix
		const d = self.dimensions

		self.dom.svg
			.transition()
			.duration(s.transitionDuration)
			.attr('width', d.svgw)
			.attr('height', d.svgh)

		self.dom.seriesesG
			.transition()
			.duration(s.transitionDuration)
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
			.duration(s.transitionDuration)
			.attr('transform', `translate(${d.xOffset},${d.yOffset})`)

		const termLabels = self.dom.termLabelG
			.selectAll('g')
			.data(data.termWrappers, tw => ('id' in tw ? tw.id : tw.term.id))
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
		//const x = (!s.transpose ? s.termLabelOffset + series.x : s.sampleLabelOffset + series.y)
		//const y = (!s.transpose ? s.sampleLabelOffset + series.y : s.termLabelOffset + series.x)

		const g = select(this)
		g.transition()
			.duration(s.transitionDuration)
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
			.duration(s.transitionDuration)
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
		g.transition()
			.duration(s.transitionDuration)
			.attr('transform', !s.transpose ? `translate(${s.colw / 3},-2)` : `translate(-5,${s.rowh - 2})`)

		if (!g.select('text').size()) g.append('text')
		const text = g.select('text')
		const fontSize = !s.transpose ? s.colw + s.colspace - 4 : s.rowh + s.rowspace - 4
		text
			.attr('fill', '#000')
			.attr('text-anchor', 'end')
			.transition()
			.duration(s.transitionDuration)
			//.attr('opacity', fontsize < 6 ? 0 : )
			.attr('font-size', fontSize)
			.attr('transform', !s.transpose ? `rotate(90)` : '')
			.text(series.row.sample)
	}

	self.renderTermLabels = function(tw) {
		const s = self.settings.matrix
		const d = self.dimensions
		const g = select(this)
		const tIndex = self.currData.termWrappers.findIndex(t => t.id === tw.id)
		g.transition()
			.duration(s.transitionDuration)
			.attr(
				'transform',
				s.transpose ? `translate(${tIndex * d.dx + s.colw / 3},-2)` : `translate(-5,${tIndex * d.dy + 0.8 * s.rowh})`
			)

		const fontSize = s.transpose ? s.colw + s.colspace - 4 : s.rowh + s.rowspace - 4
		if (!g.select('text').size()) g.append('text')
		g.select('text')
			.attr('fill', '#000')
			.attr('text-anchor', 'end')
			.transition()
			.duration(s.transitionDuration)
			//.attr('opacity', fontsize < 6 ? 0 : )
			.attr('font-size', fontSize)
			.attr('transform', s.transpose ? `rotate(90)` : '')
			.text(tw.term.name)
	}
}

export async function getPlotConfig(opts, app) {
	const config = {
		// data configuration
		termgroups: [],
		samplegroups: [],

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
				rowh: 14,
				rowspace: 1,
				transitionDuration: 0,
				transpose: false,
				sampleLabelOffset: 120,
				sampleLabelFontSize: 8,
				termLabelOffset: 80
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
