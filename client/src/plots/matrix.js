import { getCompInit, copyMerge } from '../common/rx.core'
import { controlsInit } from './controls'
import { select } from 'd3-selection'
import { scaleOrdinal, schemeCategory10, schemeCategory20 } from 'd3-scale'

class Matrix {
	constructor(opts) {
		this.type = 'matrix'
		setRenderers(this)
	}

	async init(appState) {
		const opts = this.opts
		const holder = opts.controls ? opts.holder : opts.holder.append('div')
		const controls = this.opts.controls ? null : holder.append('div')
		const svg = holder.append('svg').style('margin', '20px 10px')
		this.dom = {
			header: opts.header,
			controls,
			holder,
			svg,
			mainG: svg.append('g')
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
							label: 'Column width',
							type: 'number',
							chartType: 'matrix',
							settingsKey: 'colw'
						},
						{
							label: 'Row height',
							type: 'number',
							chartType: 'matrix',
							settingsKey: 'rowh'
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
			config
		}
	}

	async main() {
		try {
			this.config = this.state.config
			Object.assign(this.settings, this.config.settings)
			const reqOpts = this.getDataRequestOpts()
			const data = await this.app.vocabApi.getMatrixData(reqOpts)
			this.currData = this.processData(data)
			this.render(this.currData)
		} catch (e) {
			throw e
		}
	}

	// creates an opts object for the vocabApi.getNestedChartsData()
	getDataRequestOpts() {
		return {
			termgroups: this.state.config.termgroups
		}
	}

	processData(data) {
		const s = this.settings.matrix
		const samples = data.lst.map(r => r.sample).sort((a, b) => (a[s.sortSamplesBy] < b[s.sortSamplesBy] ? -1 : 1))
		const terms = []
		this.config.termgroups.forEach(g => terms.push(...g.lst.map(t => ('id' in t ? t.id : t.term.id))))
		console.log(71, s, samples, terms)

		const currData = { terms, serieses: [] }
		const keysByTermId = {}
		for (let i = 0; i < data.lst.length; i++) {
			const row = data.lst[i]
			const obj = { row, cells: [] }
			const x = samples.indexOf(row.sample) * (s.colw + s.colspace)
			for (const key in row) {
				if (key == 'sample') continue
				obj.cells.push({
					termid: key,
					key: row[key].key,
					label: row[key].label,
					x,
					y: terms.indexOf(key) * (s.rowh + s.rowspace)
				})
				if (!keysByTermId[key]) keysByTermId[key] = new Set()
				keysByTermId[key].add(row[key].key)
			}

			currData.serieses.push(obj)
		}

		this.colorScaleByTermId = {}
		for (const termid in keysByTermId) {
			this.colorScaleByTermId[termid] =
				keysByTermId[termid].size < 11 ? scaleOrdinal(schemeCategory10) : scaleOrdinal(schemeCategory20)
		}

		return currData
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
		console.log(111, data)
		const s = self.settings.matrix
		self.dom.svg
			.attr('width', data.serieses.length * (s.colw + s.colspace) + 20)
			.attr('height', data.terms.length * (s.rowh + s.rowspace) + 20)

		const g = self.dom.mainG.selectAll('g').data(data.serieses, d => d.row.sample)

		g.exit().remove()
		g.each(self.renderSeries)
		g.enter()
			.append('g')
			.each(self.renderSeries)
	}

	self.renderSeries = function(series) {
		console.log(157, series)
		const rects = select(this)
			.selectAll('rect')
			.data(series.cells, cell => cell.termid)
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
			.attr('x', cell.x)
			.attr('y', cell.y)
			.attr('width', s.colw)
			.attr('height', s.rowh)
			.attr('stroke', '#eee')
			.attr('stroke-width', 1)
			.attr('fill', self.colorScaleByTermId[cell.termid](cell.key))
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
				sortSamplesBy: 'sample',
				colw: 8,
				colspace: 2,
				rowh: 10,
				rowspace: 2
			}
		}
	}

	// may apply term-specific changes to the default object
	return copyMerge(config, opts)
}
