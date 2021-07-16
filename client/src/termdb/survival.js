import * as rx from '../common/rx.core'
import { getNormalRoot } from '../common/filter'
import { select, event } from 'd3-selection'
import { scaleLinear as d3Linear } from 'd3-scale'
import { axisLeft, axisBottom } from 'd3-axis'
import { line, area, curveStepAfter } from 'd3-shape'
import { scaleOrdinal, schemeCategory10, schemeCategory20 } from 'd3-scale'
import { rgb } from 'd3-color'
import htmlLegend from '../html.legend'
import Partjson from 'partjson'
import { dofetch3, to_svg } from '../client'

class TdbSurvival {
	constructor(app, opts) {
		this.type = 'survival'
		this.id = opts.id
		this.app = app
		this.api = rx.getComponentApi(this)
		this.dom = {
			holder: opts.holder,
			chartsDiv: opts.holder.append('div').style('margin', '10px'),
			legendDiv: opts.holder.append('div').style('margin', '5px 5px 15px 5px')
		}
		// hardcode for now, but may be set as option later
		this.settings = Object.assign({}, opts.settings)
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
		this.eventTypes = ['postInit', 'postRender']
	}

	getState(appState) {
		const config = appState.tree.plots[this.id]
		return {
			isVisible: config.term.term.type == 'survival' || (config.term2 && config.term2.term.type == 'survival'),
			genome: this.app.vocabApi.vocab.genome,
			dslabel: this.app.vocabApi.vocab.dslabel,
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			config: {
				term: JSON.parse(JSON.stringify(config.term)),
				term0: config.term0 ? JSON.parse(JSON.stringify(config.term0)) : null,
				term2: config.term2 ? JSON.parse(JSON.stringify(config.term2)) : null,
				settings: config.settings.survival
			},
			termdbConfig: appState.termdbConfig
		}
	}

	main(data) {
		if (!this.state.isVisible) {
			this.dom.holder.style('display', 'none')
			return
		}
		Object.assign(this.settings, this.state.config.settings)
		if (data) {
			this.currData = this.getData(data)
			this.refs = data.refs
		}
		this.pj.refresh({ data: this.currData })
		this.setTerm2Color(this.pj.tree.charts)
		this.render()
		this.legendRenderer(this.legendData)
	}

	getData(data) {
		this.uniqueSeriesIds = new Set()
		const rows = []
		const estKeys = ['survival'] //, 'low', 'high']
		for (const d of data.case) {
			const obj = {}
			data.keys.forEach((k, i) => {
				obj[k] = estKeys.includes(k) ? Number(d[i]) : d[i] //100 * d[i] : d[i]
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
		const config = this.state.config
		if ((!config.term.term.type == 'survival' || config.term2) && legendItems.length) {
			const termNum = config.term.term.type == 'survival' ? 'term2' : 'term'
			this.legendData = [
				{
					name: config[termNum].term.name,
					items: legendItems
				}
			]
		} else {
			this.legendData = []
		}
	}
}

export const survivalInit = rx.getInitFxn(TdbSurvival)

function setRenderers(self) {
	self.render = function() {
		const data = self.pj.tree.charts || [{ chartId: 'No survival data' }]
		const chartDivs = self.dom.chartsDiv.selectAll('.pp-survival-chart').data(data, d => d.chartId)
		chartDivs.exit().remove()
		chartDivs.each(self.updateCharts)
		chartDivs.enter().each(self.addCharts)

		self.dom.holder.style('display', 'block')
		self.dom.chartsDiv.on('mouseover', self.mouseover).on('mouseout', self.mouseout)
	}

	self.addCharts = function(d) {
		const s = self.settings
		const div = select(this)
			.append('div')
			.attr('class', 'pp-survival-chart')
			.style('opacity', d.serieses ? 0 : 1) // if the data can be plotted, slowly reveal plot
			//.style("position", "absolute")
			.style('width', s.svgw + 50 + 'px')
			.style('display', 'inline-block')
			.style('margin', s.chartMargin + 'px')
			.style('padding', '10px')
			.style('top', 0)
			.style('left', 0)
			.style('text-align', 'left')
		//.style('border', '1px solid #eee')
		//.style('box-shadow', '0px 0px 1px 0px #ccc')

		div
			.append('div')
			.attr('class', 'sjpp-survival-title')
			.style('text-align', 'center')
			.style('width', s.svgw + 50 + 'px')
			.style('height', s.chartTitleDivHt + 'px')
			.style('font-weight', '600')
			.style('margin', '5px')
			.datum(d.chartId)
			.html(d.chartId)

		if (d.serieses) {
			const svg = div.append('svg').attr('class', 'pp-survival-svg')
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
			.select('.sjpp-survival-title')
			.style('width', s.svgw + 50)
			.style('height', s.chartTitleDivHt + 'px')
			.datum(d.chartId)
			.html(d.chartId)

		div.selectAll('.sjpp-lock-icon').style('display', s.scale == 'byChart' ? 'block' : 'none')

		div.selectAll('.sjpp-unlock-icon').style('display', s.scale == 'byChart' ? 'none' : 'block')

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
			.selectAll('.sjpp-survival-series')
			.data(visibleSerieses, d => (d && d[0] ? d[0].seriesId : ''))

		serieses.exit().remove()
		serieses.each(function(series, i) {
			renderSeries(select(this), chart, series, i, s, s.duration)
		})
		serieses
			.enter()
			.append('g')
			.attr('class', 'sjpp-survival-series')
			.each(function(series, i) {
				renderSeries(select(this), chart, series, i, s, duration)
			})

		renderAxes(xAxis, xTitle, yAxis, yTitle, s, chart)
	}

	function getSvgSubElems(svg) {
		let mainG, axisG, xAxis, yAxis, xTitle, yTitle
		if (!svg.select('.sjpp-survival-mainG').size()) {
			mainG = svg.append('g').attr('class', 'sjpp-survival-mainG')
			axisG = mainG.append('g').attr('class', 'sjpp-survival-axis')
			xAxis = axisG.append('g').attr('class', 'sjpp-survival-x-axis')
			yAxis = axisG.append('g').attr('class', 'sjpp-survival-y-axis')
			xTitle = axisG.append('g').attr('class', 'sjpp-survival-x-title')
			yTitle = axisG.append('g').attr('class', 'sjpp-survival-y-title')
		} else {
			mainG = svg.select('.sjpp-survival-mainG')
			axisG = mainG.select('.sjpp-survival-axis')
			xAxis = axisG.select('.sjpp-survival-x-axis')
			yAxis = axisG.select('.sjpp-survival-y-axis')
			xTitle = axisG.select('.sjpp-survival-x-title')
			yTitle = axisG.select('.sjpp-survival-y-title')
		}
		return [mainG, axisG, xAxis, yAxis, xTitle, yTitle]
	}

	function renderSeries(g, chart, series, i, s, duration) {
		g.selectAll('path').remove()

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
					seriesName: 'survival',
					seriesLabel: series.seriesLabel,
					censored: d.censored
				}
			})
		)

		/*renderSubseries(
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
		)*/
	}

	function renderSubseries(s, g, data) {
		g.selectAll('g').remove()
		const lastDataIndex = data.length - 1
		const lineData = data.filter(s.method == 1 ? d => !d.censored : (d, i) => !d.censored || i == lastDataIndex) //; console.log(lineData)
		const censoredData = data.filter(d => d.censored) //; console.log(censoredData)
		const subg = g.append('g')
		const circles = subg.selectAll('circle').data(lineData, b => b.x)
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

		if (seriesName == 'survival') {
			g.append('path')
				.attr('d', self.lineFxn(lineData))
				.style('fill', 'none')
				.style('stroke', color.darker())
				.style('opacity', 1)
				.style('stroke-opacity', 1)
		}

		const subg1 = g.append('g').attr('class', 'sjpp-survival-censored')
		const censored = subg1.selectAll('circle').data(censoredData, d => d.x)
		censored.exit().remove()

		censored
			.attr('cx', c => c.scaledX)
			.attr('cy', c => c.scaledY)
			.style('fill', 'transparent') //data.fill ? data.fill : colors[i])
			.style('fill-opacity', s.fillOpacity)
			.style('stroke', data.fill ? data.fill : colors[i])
			.transition()
			.duration(1000)
			.style('opacity', 1)

		censored
			.enter()
			.append('circle')
			//.attr('class', 'pp-survival-circle-censored')
			.attr('r', s.radius)
			.attr('cx', c => c.scaledX)
			.attr('cy', c => c.scaledY)
			.style('fill', 'transparent') //data.fill ? data.fill : colors[i])
			//.style('fill-opacity', s.fillOpacity)
			.style('stroke', '#000') //data.fill ? data.fill : colors[i])
			.transition()
			.duration(1000)
			.style('opacity', 1)
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
		const termNum = self.state.config.term.term.type == 'survival' ? 'term' : 'term2'
		const xUnit = self.state.config[termNum].term.unit
		const xTitleLabel = `Time to Event (${xUnit})`
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

		const yTitleLabel = 'Probability of Survival'
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
		survival: 'Survival',
		low: 'Lower 95% CI',
		high: 'Upper 95% CI'
	}

	self.mouseover = function() {
		const d = event.target.__data__
		if (event.target.tagName == 'circle') {
			const label = labels[d.seriesName]
			const x = d.x.toFixed(1)
			const y = d.y.toPrecision(2)
			const termNum = self.state.config.term.term.type == 'survival' ? 'term' : 'term2'
			const xUnit = self.state.config[termNum].term.unit
			const rows = [
				`<tr><td colspan=2 style='text-align: center'>${
					d.seriesLabel ? d.seriesLabel : self.state.config.term.term.name
				}</td></tr>`,
				`<tr><td style='padding:3px; color:#aaa'>Time to event:</td><td style='padding:3px; text-align:center'>${x} ${xUnit}</td></tr>`,
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
					survival: {
						hidden
					}
				}
			}
		})
	}
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
									y: '$survival',
									censored: '$censored',
									//low: '$low',
									//high: '$high',
									'_1:scaledX': '=scaledX()',
									'_1:scaledY': '=scaledY()'
								},
								'=timeCensored()'
							]
						},
						'$seriesId'
					],
					'@done()': '=padAndSortSerieses()'
				},
				'=chartTitle()'
			]
		},
		'=': {
			chartTitle(row) {
				const s = self.settings
				if (!row.chartId || row.chartId == '-') {
					const termNum = self.state.config.term.term.type == 'survival' ? 'term' : 'term2'
					return self.state.config[termNum].term.name
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
				const t1 = self.state.config.term
				if (!t1) return
				const seriesId = context.self.seriesId
				if (t1 && t1.q && t1.q.groupsetting && t1.q.groupsetting.inuse) return seriesId
				if (t1 && t1.term.values && seriesId in t1.term.values) return t1.term.values[seriesId].label
				return seriesId
			},
			timeCensored(row) {
				return row.time + '-' + row.censored
			},
			y(row, context) {
				const seriesId = context.context.parent.seriesId
				return seriesId == 'CI' ? [row.low, row.high] : row[seriesId]
			},
			yMin(row) {
				return row.survival
			},
			yMax(row) {
				return row.survival
			},
			xScale(row, context) {
				const s = self.settings
				const xMin = s.method == 2 ? 0 : context.self.xMin
				return d3Linear()
					.domain([xMin, context.self.xMax])
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
				const domain = [1.05, 0]
				return d3Linear()
					.domain(domain)
					.range([0, s.svgh - s.svgPadding.top - s.svgPadding.bottom])
			},
			padAndSortSerieses(result) {
				const s = self.settings
				if (s.method == 2 || s.method == 0) {
					for (const series of result.serieses) {
						// prepend a starting prob=1 data point that survfit() does not include
						const d0 = series.data[0]
						series.data.unshift({
							seriesId: d0.seriesId,
							x: 0,
							y: 1,
							censored: 0,
							//low: '$low',
							//high: '$high',
							scaledX: 0, //result.xScale(0),
							scaledY: [result.yScale(1), result.yScale(1), result.yScale(1)]
						})
					}
				}
				if (self.refs.bins) return
				const labelOrder = self.refs.bins.map(b => b.label)
				result.serieses.sort((a, b) => labelOrder.indexOf(a.seriesId) - labelOrder.indexOf(b.seriesId))
			}
		}
	})

	return pj
}
