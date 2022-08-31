import { getCompInit, copyMerge } from '../rx'
import { controlsInit } from './controls'
import { fillTermWrapper } from '#termsetting'
import { select, event } from 'd3-selection'
import { scaleLinear, scaleOrdinal, schemeCategory10, schemeCategory20 } from 'd3-scale'
import { axisLeft, axisBottom } from 'd3-axis'
import { line, area, curveStepAfter } from 'd3-shape'
import { rgb } from 'd3-color'
import htmlLegend from '#dom/html.legend'
import Partjson from 'partjson'
import { dofetch3, to_svg } from '#src/client'
import { sayerror } from '#dom/error'
import { getSeriesTip } from '#dom/svgSeriesTips'
import { renderAtRiskG } from '#dom/renderAtRisk'
import { renderPvalues } from '#dom/renderPvalueTable'

// Cuminc class is for cumulative incidence test for cox regression
// input data is cuminc data for a single chart for a low AF snp
export class Cuminc {
	constructor(opts) {
		this.pj = getPj(this)
		this.state = {
			config: copyMerge(
				{
					settings: JSON.parse(defaultSettings)
				},
				opts.config
			)
		}

		const holder = opts.holder
		this.dom = {
			holder,
			chartsDiv: holder.append('div').style('margin', '10px'),
			legendDiv: holder.append('div').style('margin', '5px')
		}

		this.lineFxn = line()
			.curve(curveStepAfter)
			.x(c => c.scaledX)
			.y(c => c.scaledY)

		this.hidePlotTitle = true

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
	}

	main(data) {
		this.settings = this.state.config.settings.cuminc
		this.settings.atRiskVisible = false
		this.hiddenOverlays = []
		this.processData(data)
		this.pj.refresh({ data: this.currData })
		this.setTerm2Color(this.pj.tree.charts)
		this.render()
		this.legendRenderer(this.legendData)
	}

	processData(data) {
		// data is for a single chart/snp
		if (new Set(data.case.map(d => d[0])).size != 1) throw 'should have one chart'

		// process case data
		data.keys = ['chartId', 'seriesId', 'time', 'cuminc', 'low', 'high']
		this.uniqueSeriesIds = new Set()
		this.currData = []
		const estKeys = ['cuminc', 'low', 'high']
		for (const d of data.case) {
			const obj = {}
			data.keys.forEach((k, i) => {
				obj[k] = estKeys.includes(k) ? 100 * d[i] : d[i]
			})
			this.currData.push(obj)
			this.uniqueSeriesIds.add(obj.seriesId)
		}

		this.refs = {} //data.refs

		// process statistical tests
		this.tests = {}
		const chartIds = Object.keys(data.tests)
		if (chartIds.length != 1) throw 'should have one chart'
		const chartId = chartIds[0]
		this.tests[chartId] = []
		const chartTests = data.tests[chartId]
		if (chartTests.length != 1) throw 'should have one test'
		const test = chartTests[0]
		if (!this.hiddenOverlays.includes(test.series1) && !this.hiddenOverlays.includes(test.series2)) {
			// if test does not contain any hidden series
			// then show test
			this.tests[chartId].push({
				pvalue: { id: 'pvalue', text: test.pvalue },
				series1: { id: test.series1 },
				series2: { id: test.series2 }
			})
		}
		if (!this.tests[chartId].length) delete this.tests[chartId]

		// NOTE: do not process skipped series or skipped charts, because no series or charts will be skipped for cox cuminc test

		// procress start times
		this.startTimes = data.startTimes
	}

	setTerm2Color(charts) {
		if (!charts) return
		if (charts.length != 1) throw 'should be a single chart'
		const chart = charts[0]
		this.term2toColor = {}
		this.colorScale = this.uniqueSeriesIds.size < 11 ? scaleOrdinal(schemeCategory10) : scaleOrdinal(schemeCategory20)
		const legendItems = []
		for (const series of chart.serieses) {
			const c = { orig: this.colorScale(series.seriesId) }
			c.rgb = rgb(c.orig)
			c.adjusted = c.rgb.toString()
			this.term2toColor[series.seriesId] = c

			if (!legendItems.find(d => d.seriesId == series.seriesId)) {
				legendItems.push({
					seriesId: series.seriesId,
					text: series.seriesLabel,
					color: this.term2toColor[series.seriesId].adjusted,
					isHidden: this.hiddenOverlays.includes(series.seriesId)
				})
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
		const chartTests = this.tests[chart.chartId]
		if (chartTests.length != 1) throw 'should have one test'
		const test = chartTests[0]
		for (const key in test) {
			if (key == 'pvalue') {
				// p-value of test
				test[key].color = '#000'
			} else {
				// series of test
				const item = legendItems.find(item => item.seriesId == test[key].id)
				test[key].color = item.color
				test[key].text = item.text
			}
		}
	}
}

// MassCumInc class is for general cumulative incidence analysis
// input data is cuminc data for one or more charts
class MassCumInc {
	constructor(opts) {
		this.type = 'cuminc'
	}

	async init(appState) {
		const opts = this.opts
		const controls = this.opts.controls ? null : opts.holder.append('div')
		const holder = opts.controls ? opts.holder : opts.holder.append('div')
		this.dom = {
			header: opts.header,
			controls,
			holder,
			errDiv: holder
				.append('div')
				.style('display', 'none')
				.style('margin', '10px'),
			chartsDiv: holder.append('div').style('margin', '10px'),
			legendDiv: holder.append('div').style('margin', '5px'),
			skippedChartsDiv: holder.append('div').style('margin', '25px 5px 15px 5px')
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

			const options = []
			for (const grade in config.term.term.values) {
				//Fix for dropdown not displaying options
				const v = config.term.term.values[grade]
				if (v.uncomputable) continue
				options.push({
					label: v.label,
					value: grade
				})
			}

			this.components = {
				controls: await controlsInit({
					app: this.app,
					id: this.id,
					holder: this.dom.controls.attr('class', 'pp-termdb-plot-controls').style('display', 'inline-block'),
					inputs: [
						'term1',
						'overlay',
						'divideBy',
						{
							label: 'Minimum number of samples in series',
							type: 'number',
							chartType: 'cuminc',
							settingsKey: 'minSampleSize'
						},
						{
							label: 'At-risk counts',
							boxLabel: 'Visible',
							type: 'checkbox',
							chartType: 'cuminc',
							settingsKey: 'atRiskVisible',
							title: 'Display the at-risk counts'
						}
					]
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
			if (this.dom.header)
				this.dom.header.html(
					this.state.config.term.term.name +
						' <span style="opacity:.6;font-size:.7em;margin-left:10px;">CUMULATIVE INCIDENCE</span>'
				)
			Object.assign(this.settings, this.state.config.settings)

			const reqOpts = this.getDataRequestOpts()
			const data = await this.app.vocabApi.getNestedChartSeriesData(reqOpts)
			if (data.case.length === 0) {
				// the case data is empty here if every data series in
				// every chart was skipped due to absence of events
				throw 'no events found in the dataset'
			}
			this.app.vocabApi.syncTermData(this.state.config, data)
			this.hiddenOverlays = this.getHiddenOverlays()
			this.processData(data)
			this.pj.refresh({ data: this.currData })
			this.setTerm2Color(this.pj.tree.charts)
			this.render()
			this.legendRenderer(this.settings.atRiskVisible ? [] : this.legendData)
			this.renderSkippedCharts(this.dom.skippedChartsDiv, this.skippedCharts)
		} catch (e) {
			this.dom.chartsDiv.style('display', 'none')
			this.dom.legendDiv.style('display', 'none')
			this.dom.errDiv.style('display', 'inline-block')
			sayerror(this.dom.errDiv, 'Error: ' + e)
			console.error(e)
		}
	}

	// creates an opts object for the vocabApi.getNestedChartsData()
	getDataRequestOpts() {
		const c = this.state.config
		const opts = {
			chartType: 'cuminc',
			term: c.term,
			filter: this.state.termfilter.filter,
			minSampleSize: c.settings.minSampleSize
		}
		if (c.term2) opts.term2 = c.term2
		if (c.term0) opts.term0 = c.term0
		if (this.state.ssid) opts.ssid = this.state.ssid
		return opts
	}

	getHiddenOverlays() {
		const tw = this.state.config.term2
		if (!tw) return []
		const h = tw.q.hiddenValues
		return Object.keys(h)
			.filter(k => h[k])
			.map(k => tw.term.values[k].label)
	}

	processData(data) {
		// process case data
		this.uniqueSeriesIds = new Set()
		this.currData = []
		const estKeys = ['cuminc', 'low', 'high']
		for (const d of data.case) {
			const obj = {}
			data.keys.forEach((k, i) => {
				obj[k] = estKeys.includes(k) ? 100 * d[i] : d[i]
			})
			this.currData.push(obj)
			this.uniqueSeriesIds.add(obj.seriesId)
		}

		this.refs = data.refs

		// process statistical tests
		this.tests = {}
		if (data.tests) {
			for (const chartId in data.tests) {
				const chartTests = data.tests[chartId]
				this.tests[chartId] = []
				for (const test of chartTests) {
					if (this.hiddenOverlays.includes(test.series1) || this.hiddenOverlays.includes(test.series2)) continue // hide tests that contain hidden series
					this.tests[chartId].push({
						pvalue: { id: 'pvalue', text: test.pvalue },
						series1: { id: test.series1 },
						series2: { id: test.series2 }
					})
				}
				if (!this.tests[chartId].length) delete this.tests[chartId]
			}
		}

		// process skipped series
		this.skippedSeries = data.skippedSeries
		if (this.skippedSeries) {
			// hide skipped series of hidden series
			for (const chart in this.skippedSeries) {
				// remove hidden series from this.skippedTests
				this.skippedSeries[chart] = this.skippedSeries[chart].filter(series => !this.hiddenOverlays.includes(series))
				if (this.skippedSeries[chart].length == 0) delete this.skippedSeries[chart]
			}
		}

		// process skipped charts
		this.skippedCharts = data.skippedCharts

		// procress start times
		this.startTimes = data.startTimes
	}

	setTerm2Color(charts) {
		if (!charts) return
		this.term2toColor = {}
		this.colorScale = this.uniqueSeriesIds.size < 11 ? scaleOrdinal(schemeCategory10) : scaleOrdinal(schemeCategory20)
		const legendItems = []
		for (const chart of charts) {
			for (const series of chart.serieses) {
				const c = { orig: this.colorScale(series.seriesId) }
				c.rgb = rgb(c.orig)
				c.adjusted = c.rgb.toString()
				this.term2toColor[series.seriesId] = c

				if (!legendItems.find(d => d.seriesId == series.seriesId)) {
					legendItems.push({
						seriesId: series.seriesId,
						text: series.seriesLabel,
						color: this.term2toColor[series.seriesId].adjusted,
						isHidden: this.hiddenOverlays.includes(series.seriesId)
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
		for (const chartId in this.tests) {
			const chartTests = this.tests[chartId]
			for (const test of chartTests) {
				for (const key in test) {
					if (key == 'pvalue') {
						// p-value of test
						test[key].color = '#000'
					} else {
						// series of test
						const item = legendItems.find(item => item.seriesId == test[key].id)
						test[key].color = item.color
						test[key].text = item.text
					}
				}
			}
		}
	}
}

export const cumincInit = getCompInit(MassCumInc)
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

	self.addCharts = function(chart) {
		const s = self.settings
		setVisibleSerieses(chart, s)

		const div = select(this)
			.append('div')
			.attr('class', 'pp-cuminc-chart')
			.style('opacity', chart.serieses ? 0 : 1) // if the data can be plotted, slowly reveal plot
			//.style("position", "absolute")
			//.style('width', s.svgw + 50 + 'px')
			.style('display', 'inline-block')
			.style('margin', s.chartMargin + 'px')
			.style('padding', '10px')
			.style('top', 0)
			.style('left', 0)
			.style('text-align', 'left')
			//.style('border', '1px solid #eee')
			//.style('box-shadow', '0px 0px 1px 0px #ccc')
			.style('background', 1 || s.orderChartsBy == 'organ-system' ? chart.color : '')

		div
			.append('div')
			.attr('class', 'sjpcb-cuminc-title')
			.style('text-align', 'center')
			.style('width', s.svgw + 50 + 'px')
			.style('height', s.chartTitleDivHt + 'px')
			.style('font-weight', '600')
			.style('margin', '5px')
			.datum(chart.chartId)
			.html(chart.chartTitle)

		if (self.hidePlotTitle) div.select('.sjpcb-cuminc-title').style('display', 'none')

		if (chart.serieses) {
			const svg = div.append('svg').attr('class', 'pp-cuminc-svg')
			renderSVG(svg, chart, s, 0)

			div
				.transition()
				.duration(s.duration)
				.style('opacity', 1)

			// div for chart-specific legends
			div
				.append('div')
				.attr('class', 'pp-cuminc-chartLegends')
				.style('vertical-align', 'top')
				.style('margin', '10px 10px 10px 30px')
				.style('display', 'none')

			// p-values legend
			if (self.tests && chart.chartId in self.tests) {
				const holder = div
					.select('.pp-cuminc-chartLegends')
					.style('display', 'inline-block')
					.append('div')
				renderPvalues({
					holder,
					plot: 'cuminc',
					tests: self.tests[chart.chartId],
					s,
					bins: self.refs.bins,
					tip: null,
					setActiveMenu: null,
					showHiddenTests: null
				})
			}

			// skipped series legend
			if (self.skippedSeries && chart.chartId in self.skippedSeries) {
				const skipdiv = div
					.select('.pp-cuminc-chartLegends')
					.style('display', 'inline-block')
					.append('div')
					.style('margin', '30px 0px')
				renderSkippedSeries(skipdiv, self.skippedSeries[chart.chartId], s)
			}
		}
	}

	function setVisibleSerieses(chart, s) {
		chart.visibleSerieses = chart.serieses.filter(series => !self.hiddenOverlays.includes(series.seriesId))
		const maxSeriesLabelLen = chart.visibleSerieses.reduce(
			(maxlen, a) => (a.seriesLabel && a.seriesLabel.length > maxlen ? a.seriesLabel.length : maxlen),
			0
		)
		chart.atRiskLabelWidth = s.atRiskVisible
			? maxSeriesLabelLen * (s.axisTitleFontSize - 2) * 0.4 + s.atRiskLabelOffset
			: 0
	}

	self.updateCharts = function(chart) {
		if (!chart.serieses) return
		const s = self.settings
		setVisibleSerieses(chart, s)

		const div = select(this)

		div
			.transition()
			.duration(s.duration)
			//.style('width', s.svgw + 50 + 'px')
			.style('background', 1 || s.orderChartsBy == 'organ-system' ? chart.color : '')

		div
			.select('.sjpcb-cuminc-title')
			.style('width', s.svgw + 50)
			.style('height', s.chartTitleDivHt + 'px')
			.datum(chart.chartId)
			.html(chart.chartTitle)

		if (self.hidePlotTitle) div.select('.sjpcb-cuminc-title').style('display', 'none')

		div.selectAll('.sjpcb-lock-icon').style('display', s.scale == 'byChart' ? 'block' : 'none')

		div.selectAll('.sjpcb-unlock-icon').style('display', s.scale == 'byChart' ? 'none' : 'block')

		renderSVG(div.select('svg'), chart, s, s.duration)

		// div for chart-specific legends
		div
			.select('.pp-cuminc-chartLegends')
			.selectAll('*')
			.remove()

		// p-values legend
		if (self.tests && chart.chartId in self.tests) {
			const holder = div
				.select('.pp-cuminc-chartLegends')
				.style('display', 'inline-block')
				.append('div')
			renderPvalues({
				holder,
				plot: 'cuminc',
				tests: self.tests[chart.chartId],
				s,
				bins: self.refs.bins,
				tip: null,
				setActiveMenu: null,
				showHiddenTests: null
			})
		}

		// skipped series legend
		if (self.skippedSeries && chart.chartId in self.skippedSeries) {
			const skipdiv = div
				.select('.pp-cuminc-chartLegends')
				.style('display', 'inline-block')
				.append('div')
				.style('margin', '30px 0px')
			renderSkippedSeries(skipdiv, self.skippedSeries[chart.chartId], s)
		}
	}

	self.renderSkippedCharts = function(div, skippedCharts) {
		if (!skippedCharts || skippedCharts.length === 0) {
			div.style('display', 'none')
			return
		}

		div.selectAll('*').remove()

		// title div
		div
			.append('div')
			.style('font-weight', 'bold')
			.style('margin-left', '15px')
			.style('padding-bottom', '2px')
			.text('Skipped charts (no events)')

		// charts div
		const chartsDiv = div.append('div').style('margin-left', '15px')

		chartsDiv
			.selectAll('div')
			.data(skippedCharts)
			.enter()
			.append('div')
			.text(d => d)
	}

	function renderSVG(svg, chart, s, duration) {
		const extraHeight = s.atRiskVisible
			? s.axisTitleFontSize + 4 + chart.visibleSerieses.length * 2 * (s.axisTitleFontSize + 4)
			: 0

		svg
			.transition()
			.duration(duration)
			.attr('width', s.svgw + chart.atRiskLabelWidth)
			.attr('height', s.svgh + extraHeight)
			.style('overflow', 'visible')
			.style('padding-left', '20px')

		/* eslint-disable */
		const [mainG, seriesesG, axisG, xAxis, yAxis, xTitle, yTitle, atRiskG, plotRect] = getSvgSubElems(svg, chart)
		/* eslint-enable */
		//if (d.xVals) computeScales(d, s);
		const xOffset = chart.atRiskLabelWidth + s.svgPadding.left
		mainG.attr('transform', 'translate(' + xOffset + ',' + s.svgPadding.top + ')')
		chart.visibleSerieses = chart.serieses.filter(s => !self.hiddenOverlays.includes(s.seriesId))
		const serieses = seriesesG
			.selectAll('.sjpcb-cuminc-series')
			.data(chart.visibleSerieses, d => (d && d[0] ? d[0].seriesId : ''))

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
		renderAtRiskG({
			g: atRiskG,
			s,
			chart,
			hidden: self.hiddenOverlays,
			term2values: self.state.config.term2?.values,
			term2toColor: self.term2toColor
		})

		plotRect
			.attr('x', 0) //s.svgPadding.left) //s.svgh - s.svgPadding.top - s.svgPadding.bottom + 5)
			.attr('width', s.svgw - s.svgPadding.left - s.svgPadding.right)
			.attr('y', 0) //s.svgPadding.top) // - s.svgPadding.bottom + 5)
			.attr('height', s.svgh - s.svgPadding.top - s.svgPadding.bottom + s.xAxisOffset)

		svg.seriesTip.update({
			xScale: chart.xScale,
			serieses: chart.visibleSerieses.map(s => {
				const seriesLabel = s.seriesLabel ? `${s.seriesLabel}:` : 'Cumulative Incidence:'
				const color = self.term2toColor[s.seriesId].adjusted
				return {
					data: s.data.map(d => {
						return {
							x: d.x,
							html:
								`<span style='color: ${color}'>` +
								`${seriesLabel} ${d.y.toFixed(2)} (${d.low.toFixed(2)} -${d.high.toFixed(2)})` +
								`</span>`
						}
					})
				}
			})
		})
	}

	function renderSkippedSeries(skipdiv, skippedSeries, s) {
		const fontSize = s.axisTitleFontSize - 2

		skipdiv.selectAll('*').remove()

		// title div
		skipdiv
			.append('div')
			.style('padding-bottom', '5px')
			.style('font-size', fontSize + 'px')
			.style('font-weight', 'bold')
			.text('Skipped series (too few samples/events)')

		// serieses div
		const seriesesDiv = skipdiv
			.append('div')
			.style('padding-bottom', '5px')
			.style('font-size', fontSize + 'px')

		seriesesDiv
			.selectAll('div')
			.data(skippedSeries)
			.enter()
			.append('div')
			.attr('class', 'pp-cuminc-chartLegends-skipped')
			.text(d => d)
	}

	function getSvgSubElems(svg, chart) {
		let mainG, seriesesG, axisG, xAxis, yAxis, xTitle, yTitle, atRiskG, plotRect, line
		if (!svg.select('.sjpcb-cuminc-mainG').size()) {
			mainG = svg.append('g').attr('class', 'sjpcb-cuminc-mainG')
			seriesesG = mainG.append('g').attr('class', 'sjpcb-cuminc-seriesesG')
			axisG = mainG.append('g').attr('class', 'sjpcb-cuminc-axis')
			xAxis = axisG.append('g').attr('class', 'sjpcb-cuminc-x-axis')
			yAxis = axisG.append('g').attr('class', 'sjpcb-cuminc-y-axis')
			xTitle = axisG.append('g').attr('class', 'sjpcb-cuminc-x-title')
			yTitle = axisG.append('g').attr('class', 'sjpcb-cuminc-y-title')
			atRiskG = mainG
				.append('g')
				.attr('class', 'sjpp-cuminc-atrisk')
				.on('click', self.legendClick)

			line = mainG
				.append('line')
				.attr('class', 'sjpcb-plot-tip-line')
				.attr('stroke', '#000')
				.attr('stroke-width', '1px')
			plotRect = mainG
				.append('rect')
				.attr('class', 'sjpcb-plot-tip-rect')
				.style('fill', 'transparent')
		} else {
			mainG = svg.select('.sjpcb-cuminc-mainG')
			seriesesG = mainG.select('.sjpcb-cuminc-seriesesG')
			axisG = mainG.select('.sjpcb-cuminc-axis')
			xAxis = axisG.select('.sjpcb-cuminc-x-axis')
			yAxis = axisG.select('.sjpcb-cuminc-y-axis')
			xTitle = axisG.select('.sjpcb-cuminc-x-title')
			yTitle = axisG.select('.sjpcb-cuminc-y-title')
			atRiskG = mainG.select('.sjpp-cuminc-atrisk').on('click', self.legendClick)
			plotRect = mainG.select('.sjpcb-plot-tip-rect')
			line = mainG.select('.sjpcb-plot-tip-line')
		}

		if (!svg.seriesTip) {
			svg.seriesTip = getSeriesTip(line, plotRect, self.app?.tip)
		}

		return [mainG, seriesesG, axisG, xAxis, yAxis, xTitle, yTitle, atRiskG, plotRect]
	}

	function renderSeries(g, chart, series, i, s, duration) {
		const data = series.startTime.adj ? series.data.filter(d => d.x >= series.startTime.adj) : series.data

		g.selectAll('path').remove()

		g.append('path')
			.attr(
				'd',
				area()
					.curve(curveStepAfter)
					.x(c => c.scaledX)
					.y0(c => c.scaledY[1])
					.y1(c => c.scaledY[2])(data)
			)
			.style('fill', self.term2toColor[series.seriesId].adjusted)
			.style('opacity', '0.15')
			.style('stroke', 'none')

		renderSubseries(
			s,
			g,
			data.map(d => {
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
			data.map(d => {
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
			data.map(d => {
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

		const seriesName = data[0].seriesName
		const color = self.term2toColor[data[0].seriesId].adjusted

		if (seriesName == 'cuminc') {
			g.append('path')
				.attr('d', self.lineFxn(data))
				.style('fill', 'none')
				.style('stroke', color)
				.style('opacity', 1)
				.style('stroke-opacity', 1)
		}
	}

	function renderAxes(xAxis, xTitle, yAxis, yTitle, s, d) {
		d.xTickValues = []

		const xTicks = axisBottom(d.xScale)
			.ticks(5)
			.tickFormat(t => {
				d.xTickValues.push(t)
				return t
			})

		xAxis
			.attr('transform', 'translate(0,' + (s.svgh - s.svgPadding.top - s.svgPadding.bottom + s.xAxisOffset) + ')')
			.call(xTicks)

		yAxis.attr('transform', `translate(${s.yAxisOffset},0)`).call(
			axisLeft(
				scaleLinear()
					.domain(d.yScale.domain())
					.range([0, s.svgh - s.svgPadding.top - s.svgPadding.bottom])
			).ticks(5)
		)

		xTitle.select('text, title').remove()
		const xTitleLabel = self.state.config.xlabel || 'Years since diagnosis'
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
		/*if (event.target.tagName == 'circle') {
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
		}*/
	}

	self.mouseout = function() {
		self.app.tip.hide()
	}

	self.legendClick = function() {
		event.stopPropagation()
		const d = event.target.__data__
		if (d === undefined) return
		const hidden = self.hiddenOverlays.slice()
		const i = hidden.indexOf(d.seriesId)
		if (i == -1) hidden.push(d.seriesId)
		else hidden.splice(i, 1)

		const hiddenValues = {}
		const term2 = JSON.parse(JSON.stringify(self.state.config.term2))
		for (const v of hidden) {
			for (const k in term2.term.values) {
				const value = term2.term.values[k]
				if (hidden.includes(value.label)) hiddenValues[k] = 1
			}
		}
		term2.q.hiddenValues = hiddenValues

		self.app.dispatch({
			type: 'plot_edit',
			id: self.id,
			config: { term2 }
		})
	}
}

const defaultSettings = JSON.stringify({
	controls: {
		isOpen: false, // control panel is hidden by default
		term2: null, // the previous overlay value may be displayed as a convenience for toggling
		term0: null
	},
	cuminc: {
		minSampleSize: 5,
		atRiskVisible: true,
		atRiskLabelOffset: -20,
		radius: 5,
		fill: '#fff',
		stroke: '#000',
		fillOpacity: 0,
		chartMargin: 10,
		svgw: 400,
		svgh: 300,
		coxXlabel: 'Years since diagnosis',
		svgPadding: {
			top: 20,
			left: 55,
			right: 20,
			bottom: 50
		},
		axisTitleFontSize: 16,
		xAxisOffset: 5,
		yAxisOffset: -5
	}
})

export async function getPlotConfig(opts, app) {
	if (!opts.term) throw 'cuminc: opts.term{} missing'
	try {
		await fillTermWrapper(opts.term, app.vocabApi, {
			condition: { mode: 'cuminc', breaks: [2] }
		})
		if (opts.term2) await fillTermWrapper(opts.term2, app.vocabApi)
		if (opts.term0) await fillTermWrapper(opts.term0, app.vocabApi)
	} catch (e) {
		throw `${e} [cuminc getPlotConfig()]`
	}
	const h = opts.term2?.q.hiddenValues || {}
	const config = {
		id: opts.term.term.id,
		settings: JSON.parse(defaultSettings)
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
					chartTitle: '=chartTitle()',
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
							'__:startTime': '=startTime()',
							data: [
								{
									'__:seriesId': '@parent.@parent.seriesId',
									//color: "$color",
									x: '$time',
									y: '$cuminc',
									low: '$low',
									high: '$high',
									'_1:scaledX': '=scaledX()',
									'_1:scaledY': '=scaledY()',
									nrisk: '$nrisk',
									nevent: '$nevent',
									ncensor: '$ncensor'
								},
								'$time'
							]
						},
						'$seriesId'
					],
					'@done()': '=sortSerieses()'
				},
				'$chartId'
			]
		},
		'=': {
			chartTitle(row) {
				if (!self.state?.config?.term) return row.chartId
				const s = self.settings
				const cutoff = self.state.config.term.q.breaks[0]
				if (!row.chartId || row.chartId == '-') {
					return cutoff == 5 ? 'CTCAE grade 5' : `CTCAE grade ${cutoff}-5`
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
				const t2 = self.state.config?.term2
				if (!t2) return context.self.seriesId
				const seriesId = context.self.seriesId
				if (t2 && t2.q && t2.q.groupsetting && t2.q.groupsetting.inuse) return seriesId
				if (t2 && t2.term.values && seriesId in t2.term.values) return t2.term.values[seriesId].label
				return seriesId
			},
			startTime(row, context) {
				const seriesId = context.self.seriesId
				const chartId = context.self.chartId
				return self.startTimes[chartId][seriesId]
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
				return (
					scaleLinear()
						// force min x=0, instead of using min time in server data
						// add 2 years to x max value to ensure a horizontally flat ending
						// and avoid the potential for a vertical line ending
						.domain([0, context.self.xMax + 2])
						.range([0, s.svgw - s.svgPadding.left - s.svgPadding.right])
				)
			},
			scaledX(row, context) {
				return context.context.context.context.parent.xScale(context.self.x)
			},
			scaledY(row, context) {
				const yScale = context.context.context.context.parent.yScale.clamp(true)
				const s = context.self
				return [yScale(s.y), yScale(s.low), yScale(s.high)]
			},
			yScale(row, context) {
				const s = self.settings
				const yMax = s.scale == 'byChart' ? context.self.yMax : context.root.yMax
				const domain = [Math.min(100, 1.1 * yMax), 0]
				return scaleLinear()
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
