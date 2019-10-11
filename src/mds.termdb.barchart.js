import rendererSettings from './bars.settings'
import barsRenderer from './bars.renderer'
import htmlLegend from './html.legend'
import { select, event } from 'd3-selection'
import { scaleOrdinal, schemeCategory10, schemeCategory20 } from 'd3-scale'
import { rgb } from 'd3-color'
import { format } from 'd3-format'
import getHandlers from './mds.termdb.barchart.events'
import { get_event_bus, to_svg } from './client'

const colors = {
	c10: scaleOrdinal(schemeCategory10),
	c20: scaleOrdinal(schemeCategory20)
}

export class TermdbBarchart {
	constructor(opts = { settings: {} }) {
		this.opts = opts
		this.dom = {
			holder: opts.holder,
			barDiv: opts.holder.append('div').style('white-space', 'normal'),
			legendDiv: opts.holder.append('div').style('margin', '5px 5px 15px 5px')
		}
		this.defaults = Object.assign(JSON.parse(rendererSettings), {
			isVisible: false,
			term0: '',
			term1: 'sex',
			term2: ''
		})
		this.settings = Object.assign(this.defaults, opts.settings)
		this.hasInitExcludedCols = false
		this.renderers = {}
		this.handlers = getHandlers(this)
		this.legendRenderer = htmlLegend(this.dom.legendDiv, {
			settings: {
				legendOrientation: 'vertical'
			},
			handlers: this.handlers
		})
		this.terms = {
			term0: null,
			term1: this.opts.term1,
			term2: null
		}
		this.controls = {}
		this.term2toColor = {}
		this.processedExcludes = []
		this.pctFormat = format('.2p')
		this.bus = get_event_bus(
			['postClick'], // will supply term-values to postClick
			opts.obj.callbacks.bar
		)
	}

	main(plot = null, data = null) {
		if (!this.currServerData) this.dom.barDiv.style('max-width', window.innerWidth + 'px')
		if (data) this.currServerData = data
		if (plot) {
			this.plot = plot
			this.obj = plot.obj
		}
		if (!this.setVisibility()) return
		this.updateSettings(plot)
		this.processData(this.currServerData)
	}

	setVisibility() {
		const isVisible = this.plot.settings.currViews.includes('barchart')
		const display = isVisible ? 'block' : 'none'
		this.dom.barDiv.style('display', display)
		this.dom.legendDiv.style('display', display)
		return isVisible
	}

	updateSettings(plot) {
		if (!plot) return
		// translate relevant plot keys to barchart settings keys
		const obj = plot.obj
		const settings = {
			genome: obj.genome.name,
			dslabel: obj.dslabel ? obj.dslabel : obj.mds.label,
			term0: plot.term0 && plot.term0.term ? plot.term0.term.id : '', // convenient reference to the term id
			term1: plot.term.term.id, // convenient reference to the term2 id
			term2: plot.term2 && plot.term2.term ? plot.term2.term.id : '',
			unit: plot.settings.bar.unit,
			orientation: plot.settings.bar.orientation,
			// normalize bar thickness regardless of orientation
			colw: plot.settings.common.barwidth,
			rowh: plot.settings.common.barwidth,
			colspace: plot.settings.common.barspace,
			rowspace: plot.settings.common.barspace
		}

		this.initExclude()
		Object.assign(this.settings, settings, this.currServerData.refs ? this.currServerData.refs : {}, {
			exclude: this.settings.exclude
		})

		this.settings.numCharts = this.currServerData.charts ? this.currServerData.charts.length : 0
		if (this.settings.term2 == '' && this.settings.unit == 'pct') {
			this.settings.unit = 'abs'
		}
		if (this.settings.term2 == 'genotype') {
			this.terms.term2 = { name: this.settings.mname }
		} else if ('term2' in this.settings && plot.term2) {
			this.terms.term2 = plot.term2.term
		} else {
			this.terms.term2 = null
		}
		this.terms.term0 = settings.term0 && plot.term0 ? plot.term0.term : null
	}

	initExclude() {
		const refs = this.currServerData.refs
		if (this.processedExcludes.includes(refs)) return
		// do not filter out bar series or overlay data when it will result in no chart being displayed
		const unannotatedColLabels = refs.unannotatedLabels.term1
		const unannotatedRowLabels = refs.unannotatedLabels.term2
		const dataFilter = data => !unannotatedRowLabels.includes(data.dataId)
		const seriesFilter = series =>
			!unannotatedColLabels.includes(series.seriesId) && series.data.filter(dataFilter).length
		if (!this.currServerData.charts.filter(chart => chart.serieses.filter(seriesFilter).length).length) {
			// has to make at least series or overlay visible
			const chart = this.currServerData.charts[0]
			const i = this.settings.exclude.cols.indexOf(chart.serieses[0].seriesId)
			if (i != -1) this.settings.exclude.cols.splice(i, 1)
			const j = this.settings.exclude.rows.indexOf(chart.serieses[0].data[0].dataId)
			if (j != -1) this.settings.exclude.rows.splice(j, 1)
			return
		}

		this.processedExcludes.push(refs)
		if (unannotatedColLabels && !this.hasInitExcludedCols) {
			for (const label of unannotatedColLabels) {
				if (!this.settings.exclude.cols.includes(label)) {
					this.settings.exclude.cols.push(label)
				}
			}
			this.hasInitExcludedCols = true
		}
		if (unannotatedRowLabels) {
			for (const label of unannotatedRowLabels) {
				if (!this.settings.exclude.rows.includes(label)) {
					this.settings.exclude.rows.push(label)
				}
			}
		}
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
		const charts = this.dom.barDiv.selectAll('.pp-sbar-div').data(self.visibleCharts, chart => chart.chartId)

		charts.exit().each(function(chart) {
			delete self.renderers[chart.chartId]
			select(this).remove()
		})

		charts.each(function(chart) {
			chart.settings.cols.sort(self.barSorter)
			chart.maxAcrossCharts = chartsData.maxAcrossCharts
			chart.handlers = self.handlers
			chart.maxSeriesLogTotal = 0
			chart.visibleSerieses.forEach(series => self.sortStacking(series, chart, chartsData))
			self.renderers[chart.chartId](chart)
		})

		charts
			.enter()
			.append('div')
			.attr('class', 'pp-sbar-div')
			.style('display', 'inline-block')
			.style('padding', '20px')
			.style('vertical-align', 'top')
			.each(function(chart, i) {
				chart.settings.cols.sort(self.barSorter)
				chart.maxAcrossCharts = chartsData.maxAcrossCharts
				chart.handlers = self.handlers
				chart.maxSeriesLogTotal = 0
				self.renderers[chart.chartId] = barsRenderer(self, select(this))
				chart.visibleSerieses.forEach(series => self.sortStacking(series, chart, chartsData))
				self.renderers[chart.chartId](chart)
			})

		this.dom.holder.selectAll('.pp-chart-title').style('display', self.terms.term0 ? 'block' : 'none')

		this.legendRenderer(this.getLegendGrps())
	}

	setMaxVisibleTotals(chartsData) {
		// chartsData = this.currServerData
		this.totalsByDataId = {}
		const term1 = this.settings.term1

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
				const label = this.terms.term1.values && id in this.terms.term1.values ? this.terms.term1.values[id].label : id
				const af = series && 'AF' in series ? ', AF=' + series.AF : ''
				const t2q = (this.terms.term2 && this.terms.term2.q) || {}
				const totalIsVisible =
					this.terms.term2 && this.terms.term2.iscondition && (!t2q.bar_by_grade || !t2q.value_by_max_grade)
				const ntotal = totalIsVisible ? '' : `, n=${series.visibleTotal}`
				const pct = totalIsVisible ? '' : ` (${this.pctFormat(series.visibleTotal / chart.total)})`
				return {
					id,
					label: '<tspan>' + label + af + ntotal + '</tspan>' + '<tspan fill="#777">' + pct + '<tspan>'
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
			result.unannotatedSeries = series.unannotated
			result.unannotatedData = result.unannotated
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
		this.term2toColor[result.dataId] =
			this.settings.term2 === ''
				? 'rgb(144, 23, 57)'
				: rgb(
						this.settings.rows && this.settings.rows.length < 11 ? colors.c10(result.dataId) : colors.c20(result.dataId)
				  ).toString() //.replace('rgb(','rgba(').replace(')', ',0.7)')
	}

	getLegendGrps() {
		const legendGrps = []
		const s = this.settings
		if (s.exclude.cols.length) {
			const t = this.terms.term1
			const b = t.graph && t.graph.barchart ? t.graph.barchart : null
			const reducer = (sum, b) => sum + b.total
			const items = s.exclude.cols
				.filter(collabel => s.cols.includes(collabel))
				.map(collabel => {
					const filter = c => c.seriesId == collabel
					const total =
						this.terms.term2 && this.terms.term2.iscondition
							? 0
							: this.currServerData.charts.reduce((sum, chart) => {
									return sum + chart.serieses.filter(filter).reduce(reducer, 0)
							  }, 0)
					const label =
						this.terms.term1.values && collabel in this.terms.term1.values
							? this.terms.term1.values[collabel].label
							: collabel
					const ntotal = total ? ', n=' + total : ''

					return {
						id: collabel,
						text: label + ntotal,
						color: '#fff',
						textColor: '#000',
						border: '1px solid #333',
						//inset: total ? "n="+total : '',
						noIcon: true,
						type: 'col'
					}
				})
				.sort(this.barSorter)

			if (items.length) {
				legendGrps.push({
					name: 'Hidden ' + this.terms.term1.name + ' value',
					items
				})
			}
		}
		if (s.rows && s.rows.length > 1 && !s.hidelegend && this.terms.term2 && this.term2toColor) {
			const t = this.terms.term2
			const b = t.graph && t.graph.barchart ? t.graph.barchart : null
			const value_by_label =
				!t.iscondition || !t.q
					? ''
					: t.q.value_by_max_grade
					? 'max. grade'
					: t.q.value_by_most_recent
					? 'most recent'
					: ''
			legendGrps.push({
				name: (this.obj.modifier_ssid_barchart ? 'Genotype' : t.name) + (value_by_label ? ', ' + value_by_label : ''),
				items: s.rows
					.map(d => {
						const total = this.totalsByDataId[d]
						const ntotal = total ? ', n=' + total : ''
						const label = this.terms.term2.values && d in this.terms.term2.values ? this.terms.term2.values[d].label : d
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

	download() {
		if (!this.plot.settings.currViews.includes('barchart')) return
		// has to be able to handle multichart view
		const mainGs = []
		const translate = { x: undefined, y: undefined }
		const titles = []
		let maxw = 0,
			maxh = 0,
			tboxh = 0
		let prevY = 0,
			numChartsPerRow = 0

		this.dom.barDiv.selectAll('.sjpcb-bars-mainG').each(function() {
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
			.attr('height', Math.ceil(mainGs.length / numChartsPerRow) * maxh)

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

		const svg_name = this.plot.term.term.name + ' barchart'
		to_svg(svg, svg_name) //,{apply_dom_styles:true})
	}
}
