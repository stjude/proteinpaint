import * as rx from '../common/rx.core'
import rendererSettings from '../bars.settings'
import barsRenderer from '../bars.renderer'
import htmlLegend from '../html.legend'
import { select, event } from 'd3-selection'
import { scaleOrdinal, schemeCategory10, schemeCategory20 } from 'd3-scale'
import { rgb } from 'd3-color'
import getHandlers from './barchart.events'
/* to-do: switch to using rx.Bus */
import { to_svg } from '../client'

class TdbBarchart {
	constructor(app, opts) {
		this.app = app
		this.opts = opts
		this.type = 'barchart'
		this.id = opts.id
		this.api = rx.getComponentApi(this)
		this.dom = {
			holder: opts.holder,
			banner: opts.holder
				.append('div')
				.style('display', 'none')
				.style('text-align', 'center')
				.style('padding', '24px')
				.style('font-size', '16px')
				.style('color', '#aaa'),
			barDiv: opts.holder.append('div').style('white-space', 'normal'),
			legendDiv: opts.holder.append('div').style('margin', '5px 5px 15px 5px')
		}
		this.settings = JSON.parse(rendererSettings) //, this.config.settings.barchart)
		this.renderers = {}

		setRenderers(this)
		setInteractivity(this)
		this.api.download = this.download

		this.legendRenderer = htmlLegend(this.dom.legendDiv, {
			settings: {
				legendOrientation: 'vertical'
			},
			handlers: this.handlers
		})
		this.controls = {}
		this.term2toColor = {}
		this.eventTypes = ['postInit', 'postRender']
		opts.controls.on('downloadClick.barchart', this.download)

		if (this.opts.bar_click_override) {
			// will use this as callback to bar click
			// and will not set up bar click menu
		} else if (!this.opts.bar_click_opts) {
			this.opts.bar_click_opts = ['hide_bar']
			if (this.app.getState().nav.header_mode === 'with_tabs') this.opts.bar_click_opts.push('add_filter')
		}
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		const displayAsSurvival =
			config.term.term.type == 'survival' || (config.term2 && config.term2.term.type == 'survival')
		return {
			isVisible:
				!displayAsSurvival &&
				config.settings.currViews.includes('barchart') &&
				appState.tree.visiblePlotIds.includes(this.id),
			genome: appState.vocab.genome,
			dslabel: appState.vocab.dslabel,
			nav: appState.nav,
			termfilter: appState.termfilter,
			config: {
				term: JSON.parse(JSON.stringify(config.term)),
				term0: config.term0 ? JSON.parse(JSON.stringify(config.term0)) : null,
				term2: config.term2 ? JSON.parse(JSON.stringify(config.term2)) : null,
				settings: {
					common: config.settings.common,
					barchart: config.settings.barchart
				}
			},
			ssid: appState.ssid,
			bar_click_menu: appState.bar_click_menu || {},
			// optional
			activeCohort: appState.activeCohort,
			termdbConfig: appState.termdbConfig
		}
	}

	main(data) {
		if (!this.currServerData) this.dom.barDiv.style('max-width', window.innerWidth + 'px')
		if (data) this.currServerData = data
		this.config = this.state.config
		if (!this.setVisibility()) return
		if (this.currServerData && this.currServerData.refs && this.currServerData.refs.q) {
			for (const q of this.currServerData.refs.q) {
				if (q.error) throw q.error
			}
		}
		this.term2toColor = {} // forget any assigned overlay colors when refreshing a barchart
		delete this.colorScale
		this.updateSettings(this.config)
		this.chartsData = this.processData(this.currServerData)
		this.render()
	}

	setVisibility() {
		const isVisible = this.state.isVisible
		const display = isVisible ? 'block' : 'none'
		this.dom.barDiv.style('display', display)
		this.dom.legendDiv.style('display', display)
		return isVisible
	}

	updateSettings(config) {
		if (!config) return
		// translate relevant config keys to barchart settings keys
		const obj = this.state
		const settings = {
			term0: config.term0 ? config.term0.term.id : '', // convenient reference to the term id
			term1: config.term.term.id, // convenient reference to the term2 id
			term2: config.term2 ? config.term2.term.id : '',
			unit: config.settings.barchart.unit,
			orientation: config.settings.barchart.orientation,
			// normalize bar thickness regardless of orientation
			colw: config.settings.common.barwidth,
			rowh: config.settings.common.barwidth,
			colspace: config.settings.common.barspace,
			rowspace: config.settings.common.barspace
		}

		this.mayResetHidden(this.config.term, this.config.term2, this.config.term0)
		this.setExclude(this.config.term, this.config.term2)
		Object.assign(this.settings, settings, this.currServerData.refs ? this.currServerData.refs : {}, {
			exclude: this.settings.exclude
		})

		this.settings.numCharts = this.currServerData.charts ? this.currServerData.charts.length : 0
		if (!config.term2 && this.settings.unit == 'pct') {
			this.settings.unit = 'abs'
		}
		if (this.state.ssid) {
			this.config.term2 = { term: { id: 'genotype', name: this.state.ssid.mutation_name, isgenotype: true }, q: {} }
		}
	}

	mayResetHidden(term, term2, term0) {
		const combinedTermIds = (term && term.id) + ';;' + (term2 && term2.id) + ';;' + (term0 && term0.id)
		if (combinedTermIds === this.currCombinedTermIds) return
		// only reset hidden if terms have changed
		for (const chart of this.currServerData.charts) {
			if (term.q && term.q.hiddenValues) {
				this.mayEditHiddenValues(term, chart.serieses.length, 'term')
			}
			if (term2 && term2.q && term2.q.hiddenValues) {
				for (const series of chart.serieses) {
					this.mayEditHiddenValues(term2, series.data.length, 'term2')
				}
			}
		}
		this.currCombinedTermIds = combinedTermIds
	}

	mayEditHiddenValues(term, numAvailable, termNum) {
		const numHidden = Object.keys(term.q.hiddenValues).filter(key => term.q.hiddenValues[key]).length
		if (numHidden < numAvailable) return
		/*
			if all the serieses are assigned to be hidden on first render,
			show the usually hidden values instead to avoid confusion
			with an empty plot
		*/
		for (const key in term.q.hiddenValues) {
			if (!term.q.hiddenValues[key]) return
			delete term.q.hiddenValues[key]
		}
		// since config.[term | term2 | term0] are copies of appState,
		// must save the changes to q.hiddenValues in the stored state
		// for consistent behavior in later app.dispatch or barchart updates
		this.app.save({
			type: 'plot_edit',
			id: this.id,
			config: {
				[termNum]: term
			}
		})
	}

	setExclude(term, term2) {
		// a non-numeric term.id is used directly as seriesId or dataId
		this.settings.exclude.cols = Object.keys(term.q && term.q.hiddenValues ? term.q.hiddenValues : {})
			.filter(id => term.q.hiddenValues[id])
			.map(id =>
				term.term.type == 'categorical'
					? id
					: this.settings.cols && this.settings.cols.includes(term.term.id)
					? id
					: term.term.values && id in term.term.values && 'label' in term.term.values[id]
					? term.term.values[id].label
					: id
			)

		this.settings.exclude.rows =
			!term2 || !term2.q || !term2.q.hiddenValues
				? []
				: Object.keys(term2.q.hiddenValues)
						.filter(id => term2.q.hiddenValues[id])
						.map(id =>
							term2.term.type == 'categorical'
								? id
								: this.settings.cols && this.settings.cols.includes(term2.term.id)
								? id
								: term2.term.values && id in term2.term.values && 'label' in term2.term.values[id]
								? term2.term.values[id].label
								: id
						)
	}

	processData(chartsData) {
		const self = this
		const cols = chartsData.refs.cols

		if (!chartsData.charts.length) {
			self.seriesOrder = []
		} else if (chartsData.refs.useColOrder) {
			self.seriesOrder = chartsData.refs.cols
		} else {
			self.seriesOrder = chartsData.charts[0].serieses
				.sort((a, b) => (!isNaN(a.seriesId) && !isNaN(b.seriesId) ? +b.seriesId - +a.seriesId : b.total - a.total))
				.map(series => series.seriesId)
		}

		self.setMaxVisibleTotals(chartsData)
		const rows = chartsData.refs.rows

		self.barSorter = (a, b) => this.seriesOrder.indexOf(a) - this.seriesOrder.indexOf(b)
		self.overlaySorter = chartsData.refs.useRowOrder
			? (a, b) => rows.indexOf(a.dataId) - rows.indexOf(b.dataId)
			: (a, b) =>
					this.totalsByDataId[b.dataId] > this.totalsByDataId[a.dataId]
						? 1
						: this.totalsByDataId[b.dataId] < this.totalsByDataId[a.dataId]
						? -1
						: a.dataId < b.dataId
						? -1
						: 1

		self.visibleCharts = chartsData.charts.filter(chart => chart.visibleSerieses.length)
		return chartsData
	}

	setMaxVisibleTotals(chartsData) {
		// chartsData = this.currServerData
		this.totalsByDataId = {}
		const t1 = this.config.term
		const t2 = this.config.term2

		const addlSeriesIds = {} // to track series IDs that are not already in this.seriesOrder
		let maxVisibleAcrossCharts = 0
		for (const chart of chartsData.charts) {
			if (!chart.settings) chart.settings = JSON.parse(rendererSettings)
			Object.assign(chart.settings, this.settings)
			chart.visibleTotal = 0
			chart.visibleSerieses = chart.serieses.filter(series => {
				if (chart.settings.exclude.cols.includes(series.seriesId)) return false
				series.visibleData = series.data.filter(d => !chart.settings.exclude.rows.includes(d.dataId))
				series.visibleTotal = series.visibleData.reduce((sum, a) => sum + a.total, 0)
				if (!series.visibleTotal) return false
				chart.visibleTotal += series.visibleTotal
				if (!this.seriesOrder.includes(series.seriesId)) {
					if (!(series.seriesId in addlSeriesIds)) addlSeriesIds[series.seriesId] = 0
					addlSeriesIds[series.seriesId] += series.visibleTotal
				}
				for (const data of series.data) {
					if (!(data.dataId in this.totalsByDataId)) {
						this.totalsByDataId[data.dataId] = 0
					}
					this.totalsByDataId[data.dataId] += data.total
				}
				return true
			})
			chart.settings.colLabels = chart.visibleSerieses.map(series => {
				const id = series.seriesId
				const label = t1.term.values && id in t1.term.values ? t1.term.values[id].label : id
				const af = series && 'AF' in series ? ', AF=' + series.AF : ''
				const ntotal =
					t2 && t2.term.type == 'condition' && t2.q.value_by_computable_grade ? '' : `, n=${series.visibleTotal}`
				return {
					id,
					label: label + af + ntotal
				}
			})
			chart.maxVisibleSeriesTotal = chart.visibleSerieses.reduce((max, series) => {
				return series.visibleTotal > max ? series.visibleTotal : max
			}, 0)
			if (chart.maxVisibleSeriesTotal > maxVisibleAcrossCharts) {
				maxVisibleAcrossCharts = chart.maxVisibleSeriesTotal
			}
		}
		for (const chart of chartsData.charts) {
			chart.maxVisibleAcrossCharts = maxVisibleAcrossCharts
		}
		this.seriesOrder.push(...Object.keys(addlSeriesIds).sort((a, b) => addlSeriesIds[b] - addlSeriesIds[a]))
	}

	sortStacking(series, chart, chartsData) {
		series.visibleData.sort(this.overlaySorter)
		let seriesLogTotal = 0
		for (const result of series.visibleData) {
			result.colgrp = '-'
			result.rowgrp = '-'
			result.chartId = chart.chartId
			result.seriesId = series.seriesId
			result.seriesTotal = series.total
			result.chartTotal = chart.visibleTotal
			result.logTotal = Math.log10(result.total)
			seriesLogTotal += result.logTotal
			this.setTerm2Color(result)
			result.color = this.term2toColor[result.dataId]
		}
		if (seriesLogTotal > chart.maxSeriesLogTotal) {
			chart.maxSeriesLogTotal = seriesLogTotal
		}
		// assign color to hidden data
		// for use in legend
		for (const result of series.data) {
			this.setTerm2Color(result)
			result.color = this.term2toColor[result.dataId]
		}
	}

	setTerm2Color(result) {
		if (this.settings.groups && result.dataId in this.settings.groups) {
			this.term2toColor[result.dataId] = this.settings.groups[result.dataId].color
		}
		if (result.dataId in this.term2toColor) return
		if (!this.colorScale) {
			this.colorScale =
				this.settings.rows && this.settings.rows.length < 11
					? scaleOrdinal(schemeCategory10)
					: scaleOrdinal(schemeCategory20)
		}
		const group = this.state.ssid && this.state.ssid.groups && this.state.ssid.groups[result.dataId]
		this.term2toColor[result.dataId] = !this.config.term2
			? 'rgb(144, 23, 57)'
			: group && 'color' in group
			? group.color
			: rgb(this.colorScale(result.dataId)).toString() //.replace('rgb(','rgba(').replace(')', ',0.7)')
	}

	getLegendGrps() {
		const legendGrps = []
		const s = this.settings
		const t1 = this.config.term
		const t2 = this.config.term2
		const headingStyle = 'color: #aaa; font-weight: 400'
		if (s.cols && s.exclude.cols.length) {
			const reducer = (sum, b) => sum + b.total
			const items = s.exclude.cols
				.filter(collabel => s.cols.includes(collabel)) // && (!t1.term.values || collabel in t1.term.values))
				.map(collabel => {
					const filter = c => c.seriesId == collabel
					const total =
						t2 && t2.term.type == 'condition'
							? 0
							: this.currServerData.charts.reduce((sum, chart) => {
									return sum + chart.serieses.filter(filter).reduce(reducer, 0)
							  }, 0)
					const label = t1.term.values && collabel in t1.term.values ? t1.term.values[collabel].label : collabel
					const ntotal = total ? ', n=' + total : ''

					return {
						id: collabel,
						text: label + ntotal,
						color: '#fff',
						textColor: '#000',
						border: '1px solid #333',
						//inset: total ? "n="+total : '',
						noIcon: true,
						type: 'col',
						isHidden: true,
						hiddenOpacity: 1
					}
				})
				.sort(this.barSorter)

			if (items.length) {
				const name = t2 ? t1.term.name : 'Other categories'
				legendGrps.push({
					name: `<span style="${headingStyle}">${name}</span>`,
					items
				})
			}
		}
		if (s.rows /*&& s.rows.length > 1*/ && !s.hidelegend && t2 && this.term2toColor) {
			const value_by_label =
				t2.term.type != 'condition' || !t2.q
					? ''
					: t2.q.value_by_max_grade
					? 'max. grade'
					: t2.q.value_by_most_recent
					? 'most recent'
					: ''
			legendGrps.push({
				name:
					`<span style="${headingStyle}">` + t2.term.name + (value_by_label ? ', ' + value_by_label : '') + '</span>',
				items: s.rows
					.map(d => {
						const total = this.totalsByDataId[d]
						const ntotal = total ? ', n=' + total : ''
						const label = t2.term.values && d in t2.term.values ? t2.term.values[d].label : d
						return {
							dataId: d,
							text: label + ntotal,
							color: this.term2toColor[d],
							type: 'row',
							isHidden: s.exclude.rows.includes(d)
						}
					})
					.sort(this.overlaySorter)
			})
		}
		return legendGrps
	}
}

export const barInit = rx.getInitFxn(TdbBarchart)

function setRenderers(self) {
	self.render = function() {
		const charts = self.dom.barDiv.selectAll('.pp-sbar-div').data(self.visibleCharts, chart => chart.chartId)

		charts.exit().each(self.exitChart)
		charts.each(self.updateChart)
		charts
			.enter()
			.append('div')
			.each(self.addChart)

		self.dom.holder.selectAll('.pp-chart-title').style('display', self.visibleCharts.length < 2 ? 'none' : 'block')
		self.legendRenderer(self.getLegendGrps())

		if (!self.visibleCharts.length) {
			const clickLegendMessage =
				self.settings.exclude.cols.length || self.settings.exclude.rows.length
					? `<br/><span>click on a legend label below to display the barchart</span>`
					: ''
			self.dom.banner
				.html(`<span>No visible barchart data to render</span>${clickLegendMessage}`)
				.style('display', 'block')
		} else {
			self.dom.banner.text('').style('display', 'none')
		}
	}

	self.exitChart = function(chart) {
		delete self.renderers[chart.chartId]
		select(this).remove()
	}

	self.updateChart = function(chart) {
		chart.settings.cols.sort(self.barSorter)
		chart.maxAcrossCharts = self.chartsData.maxAcrossCharts
		chart.handlers = self.handlers
		chart.maxSeriesLogTotal = 0
		chart.visibleSerieses.forEach(series => self.sortStacking(series, chart, self.chartsData))
		self.renderers[chart.chartId](chart)
	}

	self.addChart = function(chart, i) {
		const div = select(this)
			.attr('class', 'pp-sbar-div')
			.style('display', 'inline-block')
			.style('padding', '20px')
			.style('vertical-align', 'top')

		self.renderers[chart.chartId] = barsRenderer(self, select(this))
		self.updateChart(chart)
	}
}

function setInteractivity(self) {
	self.handlers = getHandlers(self)

	self.download = function() {
		if (!self.state || !self.state.isVisible) return
		// has to be able to handle multichart view
		const mainGs = []
		const translate = { x: undefined, y: undefined }
		const titles = []
		let maxw = 0,
			maxh = 0,
			tboxh = 0
		let prevY = 0,
			numChartsPerRow = 0

		self.dom.barDiv.selectAll('.sjpcb-bars-mainG').each(function() {
			mainGs.push(this)
			const bbox = this.getBBox()
			if (bbox.width > maxw) maxw = bbox.width
			if (bbox.height > maxh) maxh = bbox.height
			const divY = Math.round(this.parentNode.parentNode.getBoundingClientRect().y)
			if (!numChartsPerRow) {
				prevY = divY
				numChartsPerRow++
			} else if (Math.abs(divY - prevY) < 5) {
				numChartsPerRow++
			}
			const xy = select(this)
				.attr('transform')
				.split('translate(')[1]
				.split(')')[0]
				.split(',')
				.map(d => +d.trim())
			if (translate.x === undefined || xy[0] > translate.x) translate.x = +xy[0]
			if (translate.y === undefined || xy[1] > translate.y) translate.y = +xy[1]

			const title = this.parentNode.parentNode.firstChild
			const tbox = title.getBoundingClientRect()
			if (tbox.width > maxw) maxw = tbox.width
			if (tbox.height > tboxh) tboxh = tbox.height
			titles.push({ text: title.innerText, styles: window.getComputedStyle(title) })
		})

		// add padding between charts
		maxw += 30
		maxh += 30

		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')

		select(svg)
			.style('display', 'block')
			.style('opacity', 1)
			.attr('width', numChartsPerRow * maxw)
			.attr('height', Math.floor(mainGs.length / numChartsPerRow) * maxh)

		const svgStyles = window.getComputedStyle(document.querySelector('.pp-bars-svg'))
		const svgSel = select(svg)
		for (const prop of svgStyles) {
			if (prop.startsWith('font')) svgSel.style(prop, svgStyles.getPropertyValue(prop))
		}

		mainGs.forEach((g, i) => {
			const mainG = g.cloneNode(true)
			const colNum = i % numChartsPerRow
			const rowNum = Math.floor(i / numChartsPerRow)
			const corner = { x: colNum * maxw + translate.x, y: rowNum * maxh + translate.y }
			const title = select(svg)
				.append('text')
				.attr('transform', 'translate(' + corner.x + ',' + corner.y + ')')
				.text(titles[i].text)
			for (const prop of titles[i].styles) {
				if (prop.startsWith('font')) title.style(prop, titles[i].styles.getPropertyValue(prop))
			}

			select(mainG).attr('transform', 'translate(' + corner.x + ',' + (corner.y + tboxh) + ')')
			svg.appendChild(mainG)
		})

		const svg_name = self.config.term.term.name + ' barchart'
		to_svg(svg, svg_name) //,{apply_dom_styles:true})
	}
}
