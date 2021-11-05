import { getCompInit, copyMerge } from '../common/rx.core'
import { controlsInit } from './controls'
import { fillTermWrapper } from '../common/termsetting'
import { select, event } from 'd3-selection'
import { scaleLinear as d3Linear } from 'd3-scale'
import { axisLeft, axisBottom } from 'd3-axis'
import { line, area, curveStepAfter } from 'd3-shape'
import { scaleOrdinal, schemeCategory10, schemeCategory20 } from 'd3-scale'
import { rgb } from 'd3-color'
import htmlLegend from '../html.legend'
import Partjson from 'partjson'
import { dofetch3, to_svg } from '../client'

class TdbCumInc {
	constructor(opts) {
		this.type = 'cuminc'
	}

	async init() {
		const opts = this.opts
		const controls = this.opts.controls ? null : opts.holder.append('div')
		const holder = opts.controls ? opts.holder : opts.holder.append('div')
		this.dom = {
			header: opts.header,
			controls,
			holder,
			chartsDiv: holder.append('div').style('margin', '10px'),
			legendDiv: holder.append('div').style('margin', '5px 5px 15px 5px')
		}
		if (this.dom.header) this.dom.header.html('Cumulative Incidence Plot')
		// hardcode for now, but may be set as option later
		this.settings = Object.assign({}, this.opts.settings)
		this.pj = getPj(this)
		this.lineFxn = line()
			.curve(curveStepAfter)
			.x(c => c.scaledX)
			.y(c => c.scaledY)
		setInteractivity(this)
		setRenderers(this)
		this.legendRenderer = htmlLegend(this.dom.legendDiv, {
			settings: {
				legendOrientation: 'vertical'
			},
			handlers: {
				legend: {
					click: this.legendClick
				}
			}
		})
		await this.setControls()
	}

	async setControls() {
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
					holder: this.dom.controls.attr('class', 'pp-termdb-plot-controls').style('display', 'inline-block')
				})
			}

			this.components.controls.on('downloadClick.boxplot', this.download)
		}
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			isVisible: config.settings.currViews.includes('cuminc'),
			genome: this.app.vocabApi.vocab.genome,
			dslabel: this.app.vocabApi.vocab.dslabel,
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			config: {
				term: JSON.parse(JSON.stringify(config.term)),
				term0: config.term0 ? JSON.parse(JSON.stringify(config.term0)) : null,
				term2: config.term2 ? JSON.parse(JSON.stringify(config.term2)) : null,
				settings: config.settings.cuminc
			}
		}
	}

	async main() {
		try {
			if (!this.state.isVisible) {
				this.dom.holder.style('display', 'none')
				return
			}
			if (this.dom.header)
				this.dom.header.html(
					this.state.config.term.term.name +
						' <span style="opacity:.6;font-size:.7em;margin-left:10px;">CUMULATIVE INCIDENCE</span>'
				)
			Object.assign(this.settings, this.state.config.settings)

			const reqOpts = this.getDataRequestOpts()
			const data = await this.app.vocabApi.getNestedChartSeriesData(reqOpts)
			this.app.vocabApi.syncTermData(this.state.config, data)
			this.currData = this.processData(data)
			this.refs = data.refs
			this.pj.refresh({ data: this.currData })
			this.setTerm2Color(this.pj.tree.charts)
			this.render()
			this.legendRenderer(this.legendData)
		} catch (e) {
			throw e
		}
	}

	// creates an opts object for the vocabApi.getNestedChartsData()
	getDataRequestOpts() {
		const c = this.state.config
		const opts = {
			chartType: 'cuminc',
			grade: this.settings.gradeCutoff,
			term: c.term,
			filter: this.state.termfilter.filter
		}
		if (c.term2) opts.term2 = c.term2
		if (c.term0) opts.term0 = c.term0
		if (this.state.ssid) opts.ssid = this.state.ssid
		return opts
	}

	processData(data) {
		this.uniqueSeriesIds = new Set()
		const rows = []
		const estKeys = ['cuminc', 'low', 'high']
		for (const d of data.case) {
			const obj = {}
			data.keys.forEach((k, i) => {
				obj[k] = estKeys.includes(k) ? 100 * d[i] : d[i]
			})
			rows.push(obj)
			this.uniqueSeriesIds.add(obj.seriesId)
		}
		return rows
	}

	setTerm2Color(charts) {
		if (!charts) return
		this.term2toColor = {}
		this.colorScale = this.uniqueSeriesIds.size < 11 ? scaleOrdinal(schemeCategory10) : scaleOrdinal(schemeCategory20)
		const legendItems = []
		for (const chart of charts) {
			for (const series of chart.serieses) {
				this.term2toColor[series.seriesId] = rgb(this.colorScale(series.seriesId))
				if (!legendItems.find(d => d.seriesId == series.seriesId)) {
					legendItems.push({
						seriesId: series.seriesId,
						text: series.seriesLabel,
						color: this.term2toColor[series.seriesId],
						isHidden: this.settings.hidden.includes(series.seriesId)
					})
				}
			}
		}
		if (this.state.config.term2 && legendItems.length) {
			this.legendData = [
				{
					name: this.state.config.term2.term.name,
					items: legendItems
				}
			]
		} else {
			this.legendData = []
		}
	}
}

export const cumincInit = getCompInit(TdbCumInc)
// this alias will allow abstracted dynamic imports
export const componentInit = cumincInit

function setRenderers(self) {
	self.render = function() {
		const data = self.pj.tree.charts || [{ chartId: 'No cumulative incidence data' }]
		const chartDivs = self.dom.chartsDiv.selectAll('.pp-cuminc-chart').data(data, d => d.chartId)
		chartDivs.exit().remove()
		chartDivs.each(self.updateCharts)
		chartDivs.enter().each(self.addCharts)

		self.dom.holder.style('display', 'inline-block')
		self.dom.chartsDiv.on('mouseover', self.mouseover).on('mouseout', self.mouseout)
	}

	self.addCharts = function(d) {
		const s = self.settings
		const div = select(this)
			.append('div')
			.attr('class', 'pp-cuminc-chart')
			.style('opacity', d.serieses ? 0 : 1) // if the data can be plotted, slowly reveal plot
			//.style("position", "absolute")
			.style('width', s.svgw + 50 + 'px')
			.style('display', 'inline-block')
			.style('margin', s.chartMargin + 'px')
			.style('padding', '10px')
			.style('top', 0)
			.style('left', 0)
			.style('text-align', 'left')
			.style('border', '1px solid #eee')
			.style('box-shadow', '0px 0px 1px 0px #ccc')
			.style('background', 1 || s.orderChartsBy == 'organ-system' ? d.color : '')

		div
			.append('div')
			.attr('class', 'sjpcb-cuminc-title')
			.style('text-align', 'center')
			.style('width', s.svgw + 50 + 'px')
			.style('height', s.chartTitleDivHt + 'px')
			.style('font-weight', '600')
			.style('margin', '5px')
			.datum(d.chartId)
			.html(d.chartId)

		if (d.serieses) {
			const svg = div.append('svg').attr('class', 'pp-cuminc-svg')
			renderSVG(svg, d, s, 0)

			div
				.transition()
				.duration(s.duration)
				.style('opacity', 1)
		}
	}

	self.updateCharts = function(d) {
		if (!d.serieses) return
		const s = self.settings
		const div = select(this)

		div
			.transition()
			.duration(s.duration)
			.style('width', s.svgw + 50 + 'px')
			.style('background', 1 || s.orderChartsBy == 'organ-system' ? d.color : '')

		div
			.select('.sjpcb-cuminc-title')
			.style('width', s.svgw + 50)
			.style('height', s.chartTitleDivHt + 'px')
			.datum(d.chartId)
			.html(d.chartId)

		div.selectAll('.sjpcb-lock-icon').style('display', s.scale == 'byChart' ? 'block' : 'none')

		div.selectAll('.sjpcb-unlock-icon').style('display', s.scale == 'byChart' ? 'none' : 'block')

		renderSVG(div.select('svg'), d, s, s.duration)
	}

	function renderSVG(svg, chart, s, duration) {
		svg
			.transition()
			.duration(duration)
			.attr('width', s.svgw)
			.attr('height', s.svgh)
			.style('overflow', 'visible')
			.style('padding-left', '20px')

		/* eslint-disable */
		const [mainG, axisG, xAxis, yAxis, xTitle, yTitle] = getSvgSubElems(svg)
		/* eslint-enable */
		//if (d.xVals) computeScales(d, s);

		mainG.attr('transform', 'translate(' + s.svgPadding.left + ',' + s.svgPadding.top + ')')
		const visibleSerieses = chart.serieses.filter(s => !self.settings.hidden.includes(s.seriesId))
		const serieses = mainG
			.selectAll('.sjpcb-cuminc-series')
			.data(visibleSerieses, d => (d && d[0] ? d[0].seriesId : ''))

		serieses.exit().remove()
		serieses.each(function(series, i) {
			renderSeries(select(this), chart, series, i, s, s.duration)
		})
		serieses
			.enter()
			.append('g')
			.attr('class', 'sjpcb-cuminc-series')
			.each(function(series, i) {
				renderSeries(select(this), chart, series, i, s, duration)
			})

		renderAxes(xAxis, xTitle, yAxis, yTitle, s, chart)
	}

	function getSvgSubElems(svg) {
		let mainG, axisG, xAxis, yAxis, xTitle, yTitle
		if (!svg.select('.sjpcb-cuminc-mainG').size()) {
			mainG = svg.append('g').attr('class', 'sjpcb-cuminc-mainG')
			axisG = mainG.append('g').attr('class', 'sjpcb-cuminc-axis')
			xAxis = axisG.append('g').attr('class', 'sjpcb-cuminc-x-axis')
			yAxis = axisG.append('g').attr('class', 'sjpcb-cuminc-y-axis')
			xTitle = axisG.append('g').attr('class', 'sjpcb-cuminc-x-title')
			yTitle = axisG.append('g').attr('class', 'sjpcb-cuminc-y-title')
		} else {
			mainG = svg.select('.sjpcb-cuminc-mainG')
			axisG = mainG.select('.sjpcb-cuminc-axis')
			xAxis = axisG.select('.sjpcb-cuminc-x-axis')
			yAxis = axisG.select('.sjpcb-cuminc-y-axis')
			xTitle = axisG.select('.sjpcb-cuminc-x-title')
			yTitle = axisG.select('.sjpcb-cuminc-y-title')
		}
		return [mainG, axisG, xAxis, yAxis, xTitle, yTitle]
	}

	function renderSeries(g, chart, series, i, s, duration) {
		g.selectAll('path').remove()

		g.append('path')
			.attr(
				'd',
				area()
					.curve(curveStepAfter)
					.x(c => c.scaledX)
					.y0(c => c.scaledY[1])
					.y1(c => c.scaledY[2])(series.data)
			)
			.style('fill', self.term2toColor[series.seriesId].toString())
			.style('opacity', '0.15')
			.style('stroke', 'none')

		renderSubseries(
			s,
			g,
			series.data.map(d => {
				return {
					seriesId: d.seriesId,
					x: d.x,
					y: d.y,
					scaledX: d.scaledX,
					scaledY: d.scaledY[0],
					seriesName: 'cuminc',
					seriesLabel: series.seriesLabel
				}
			})
		)

		renderSubseries(
			s,
			g.append('g'),
			series.data.map(d => {
				return {
					seriesId: d.seriesId,
					x: d.x,
					y: d.low,
					scaledX: d.scaledX,
					scaledY: d.scaledY[1],
					seriesName: 'low',
					seriesLabel: series.seriesLabel
				}
			})
		)

		renderSubseries(
			s,
			g.append('g'),
			series.data.map(d => {
				return {
					seriesId: d.seriesId,
					x: d.x,
					y: d.high,
					scaledX: d.scaledX,
					scaledY: d.scaledY[2],
					seriesName: 'high',
					seriesLabel: series.seriesLabel
				}
			})
		)
	}

	function renderSubseries(s, g, data) {
		g.selectAll('g').remove()
		const subg = g.append('g')
		const circles = subg.selectAll('circle').data(data, b => b.x)
		circles.exit().remove()

		circles
			.attr('r', s.radius)
			.attr('cx', c => c.scaledX)
			.attr('cy', c => c.scaledY)
			.style('fill', s.fill)
			.style('fill-opacity', s.fillOpacity)
			.style('stroke', s.stroke)

		circles
			.enter()
			.append('circle')
			.attr('r', s.radius)
			.attr('cx', c => c.scaledX)
			.attr('cy', c => c.scaledY)
			.style('opacity', 0)
			.style('fill', s.fill)
			.style('fill-opacity', s.fillOpacity)
			.style('stroke', s.stroke)

		const seriesName = data[0].seriesName
		const color = self.term2toColor[data[0].seriesId]

		if (seriesName == 'cuminc') {
			g.append('path')
				.attr('d', self.lineFxn(data))
				.style('fill', 'none')
				.style('stroke', color.darker())
				.style('opacity', 1)
				.style('stroke-opacity', 1)
		}
	}

	function renderAxes(xAxis, xTitle, yAxis, yTitle, s, d) {
		xAxis
			.attr('transform', 'translate(0,' + (s.svgh - s.svgPadding.top - s.svgPadding.bottom) + ')')
			.call(axisBottom(d.xScale).ticks(5))

		yAxis.call(
			axisLeft(
				d3Linear()
					.domain(d.yScale.domain())
					.range([0, s.svgh - s.svgPadding.top - s.svgPadding.bottom])
			).ticks(5)
		)

		xTitle.select('text, title').remove()
		const xTitleLabel = 'Time to Event (years)'
		const xText = xTitle
			.attr(
				'transform',
				'translate(' +
					(s.svgw - s.svgPadding.left - s.svgPadding.right) / 2 +
					',' +
					(s.svgh - s.axisTitleFontSize) +
					')'
			)
			.append('text')
			.style('text-anchor', 'middle')
			.style('font-size', s.axisTitleFontSize + 'px')
			.text(xTitleLabel)

		const yTitleLabel = 'Cumulative Incidence (%)'
		yTitle.select('text, title').remove()
		const yText = yTitle
			.attr(
				'transform',
				'translate(' +
					(-s.svgPadding.left / 2 - s.axisTitleFontSize) +
					',' +
					(s.svgh - s.svgPadding.top - s.svgPadding.bottom) / 2 +
					')rotate(-90)'
			)
			.append('text')
			.style('text-anchor', 'middle')
			.style('font-size', s.axisTitleFontSize + 'px')
			.text(yTitleLabel)
	}
}

function setInteractivity(self) {
	const labels = {
		cuminc: 'Cumulative incidence',
		low: 'Lower 95% CI',
		high: 'Upper 95% CI'
	}

	self.mouseover = function() {
		const d = event.target.__data__
		if (event.target.tagName == 'circle') {
			const label = labels[d.seriesName]
			const x = d.x.toFixed(1)
			const y = d.y.toPrecision(2)
			const rows = [
				`<tr><td colspan=2 style='text-align: center'>${
					d.seriesLabel ? d.seriesLabel : self.state.config.term.term.name
				}</td></tr>`,
				`<tr><td style='padding:3px; color:#aaa'>Time to event:</td><td style='padding:3px; text-align:center'>${x} years</td></tr>`,
				`<tr><td style='padding:3px; color:#aaa'>${label}:</td><td style='padding:3px; text-align:center'>${y}%</td></tr>`
			]
			// may also indicate the confidence interval (low%-high%) in a new row
			self.app.tip
				.show(event.clientX, event.clientY)
				.d.html(`<table class='sja_simpletable'>${rows.join('\n')}</table>`)
		} else if (event.target.tagName == 'path' && d && d.seriesId) {
			self.app.tip.show(event.clientX, event.clientY).d.html(d.seriesLabel ? d.seriesLabel : d.seriesId)
		} else {
			self.app.tip.hide()
		}
	}

	self.mouseout = function() {
		self.app.tip.hide()
	}

	self.legendClick = function() {
		event.stopPropagation()
		const d = event.target.__data__
		if (d === undefined) return
		const hidden = self.settings.hidden.slice()
		const i = hidden.indexOf(d.seriesId)
		if (i == -1) hidden.push(d.seriesId)
		else hidden.splice(i, 1)
		self.app.dispatch({
			type: 'plot_edit',
			id: self.id,
			config: {
				settings: {
					cuminc: {
						hidden
					}
				}
			}
		})
	}
}

export async function getPlotConfig(opts, app) {
	if (!opts.term) throw 'cuminc: opts.term{} missing'
	try {
		await fillTermWrapper(opts.term, app.vocabApi)
		if (opts.term2) await fillTermWrapper(opts.term2, app.vocabApi)
		if (opts.term0) await fillTermWrapper(opts.term0, app.vocabApi)
	} catch (e) {
		throw `${e} [cuminc getPlotConfig()]`
	}

	const config = {
		id: opts.term.term.id,
		settings: {
			currViews: ['cuminc'],
			controls: {
				isOpen: false, // control panel is hidden by default
				term2: null, // the previous overlay value may be displayed as a convenience for toggling
				term0: null
			},
			common: {
				use_logscale: false, // flag for y-axis scale type, 0=linear, 1=log
				use_percentage: false,
				barheight: 300, // maximum bar length
				barwidth: 20, // bar thickness
				barspace: 2 // space between two bars
			},
			cuminc: {
				gradeCutoff: 3,
				radius: 5,
				fill: '#fff',
				stroke: '#000',
				fillOpacity: 0,
				chartMargin: 10,
				svgw: 400,
				svgh: 300,
				svgPadding: {
					top: 20,
					left: 55,
					right: 20,
					bottom: 50
				},
				axisTitleFontSize: 16,
				hidden: []
			},

			/* LEGACY SUPPORT 
				 DELETE once all chart code is removed from the termdb app
			*/
			barchart: {},
			survival: {}
		}
	}

	// may apply term-specific changes to the default object
	return copyMerge(config, opts)
}

function getPj(self) {
	const pj = new Partjson({
		template: {
			yMin: '>=yMin()',
			yMax: '<=yMax()',
			charts: [
				{
					chartId: '@key',
					xMin: '>$time',
					xMax: '<$time',
					'__:xScale': '=xScale()',
					'__:yScale': '=yScale()',
					yMin: '>=yMin()',
					yMax: '<=yMax()',
					serieses: [
						{
							chartId: '@parent.@parent.@key',
							seriesId: '@key',
							'__:seriesLabel': '=seriesLabel()',
							data: [
								{
									'__:seriesId': '@parent.@parent.seriesId',
									//color: "$color",
									x: '$time',
									y: '$cuminc',
									low: '$low',
									high: '$high',
									'_1:scaledX': '=scaledX()',
									'_1:scaledY': '=scaledY()'
								},
								'$time'
							]
						},
						'$seriesId'
					],
					'@done()': '=sortSerieses()'
				},
				'=chartTitle()'
			]
		},
		'=': {
			chartTitle(row) {
				const s = self.settings
				if (!row.chartId || row.chartId == '-') {
					return s.gradeCutoff == 5 ? 'CTCAE grade 5' : `CTCAE grade ${s.gradeCutoff}-5`
				}
				const t0 = self.state.config.term0
				if (!t0 || !t0.term.values) return row.chartId
				if (t0.q && t0.q.groupsetting && t0.q.groupsetting.inuse) {
					return row.chartId
				}
				const value = self.state.config.term0.term.values[row.chartId]
				return value && value.label ? value.label : row.chartId
			},
			seriesLabel(row, context) {
				const t2 = self.state.config.term2
				if (!t2) return
				const seriesId = context.self.seriesId
				if (t2 && t2.q && t2.q.groupsetting && t2.q.groupsetting.inuse) return seriesId
				if (t2 && t2.term.values && seriesId in t2.term.values) return t2.term.values[seriesId].label
				return seriesId
			},
			y(row, context) {
				const seriesId = context.context.parent.seriesId
				return seriesId == 'CI' ? [row.low, row.high] : row[seriesId]
			},
			yMin(row) {
				return row.low
			},
			yMax(row) {
				return row.high
			},
			xScale(row, context) {
				const s = self.settings
				return d3Linear()
					.domain([context.self.xMin, context.self.xMax])
					.range([0, s.svgw - s.svgPadding.left - s.svgPadding.right])
			},
			scaledX(row, context) {
				return context.context.context.context.parent.xScale(context.self.x)
			},
			scaledY(row, context) {
				const yScale = context.context.context.context.parent.yScale
				const s = context.self
				return [yScale(s.y), yScale(s.low), yScale(s.high)]
			},
			yScale(row, context) {
				const s = self.settings
				const yMax = s.scale == 'byChart' ? context.self.yMax : context.root.yMax
				const domain = [Math.min(100, 1.1 * yMax), 0]
				return d3Linear()
					.domain(domain)
					.range([0, s.svgh - s.svgPadding.top - s.svgPadding.bottom])
			},
			sortSerieses(result) {
				if (!self.refs.bins) return
				const labelOrder = self.refs.bins.map(b => b.label)
				result.serieses.sort((a, b) => labelOrder.indexOf(a.seriesId) - labelOrder.indexOf(b.seriesId))
			}
		}
	})

	return pj
}
