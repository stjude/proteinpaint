import { getCompInit, copyMerge } from '../rx'
import { controlsInit } from './controls'
import { fillTermWrapper } from '../termsetting/termsetting'
import { select, event } from 'd3-selection'
import { scaleLinear as d3Linear } from 'd3-scale'
import { axisLeft, axisBottom } from 'd3-axis'
import { line, area, curveStepAfter } from 'd3-shape'
import { scaleOrdinal, schemeCategory10, schemeCategory20 } from 'd3-scale'
import { rgb } from 'd3-color'
import htmlLegend from '../dom/html.legend'
import Partjson from 'partjson'
import { dofetch3, to_svg } from '../src/client'
import { sayerror } from '../dom/error'

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
			legendDiv: holder.append('div').style('margin', '5px'),
			skippedChartsDiv: holder.append('div').style('margin', '25px 5px 15px 5px')
		}

		this.lineFxn = line()
			.curve(curveStepAfter)
			.x(c => c.scaledX)
			.y(c => c.scaledY)

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
		this.hiddenOverlays = []
		this.processData(data)
		this.pj.refresh({ data: this.currData })
		this.setTerm2Color(this.pj.tree.charts)
		this.render()
		this.legendRenderer(this.legendData)
		this.renderSkippedCharts(this.dom.skippedChartsDiv, this.skippedCharts)
	}

	processData(data) {
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
		this.skippedCharts = data.skippedCharts

		// assume only one chart for now
		this.tests = {
			[this.currData[0].chartId]: data.tests //[0]
		}

		// hide skipped series of hidden series
		this.skippedSeries = data.skippedSeries
		if (this.skippedSeries) {
			for (const chart in this.skippedSeries) {
				// remove hidden series from this.skippedTests
				this.skippedSeries[chart] = this.skippedSeries[chart].filter(series => !this.hiddenOverlays.includes(series))
				if (this.skippedSeries[chart].length == 0) delete this.skippedSeries[chart]
			}
		}
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
						isHidden: false // this.hiddenOverlays.includes(series.seriesId)
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
			this.legendRenderer(this.legendData)
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
		const labelOrder = this.refs.bins && this.refs.bins.length > 0 ? this.refs.bins.map(b => b.label) : null

		// process statistical tests
		if (data.tests) {
			this.tests = {}
			for (const chart in data.tests) {
				// hide tests of hidden series
				this.tests[chart] = data.tests[chart].filter(
					test => !this.hiddenOverlays.includes(test.series1) && !this.hiddenOverlays.includes(test.series2)
				)
				if (this.tests[chart].length == 0) {
					delete this.tests[chart]
					continue
				}

				// sort tests
				if (labelOrder) {
					// series 1 should have smaller bin value
					for (const test of this.tests[chart]) {
						const orderedSeries = [test.series1, test.series2].sort(
							(a, b) => labelOrder.indexOf(a) - labelOrder.indexOf(b)
						)
						test.series1 = orderedSeries[0]
						test.series2 = orderedSeries[1]
					}
					// sort first by series1 then by series2
					this.tests[chart].sort(
						(a, b) =>
							labelOrder.indexOf(a.series1) - labelOrder.indexOf(b.series1) ||
							labelOrder.indexOf(a.series2) - labelOrder.indexOf(b.series2)
					)
				}
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
				const pvaldiv = div
					.select('.pp-cuminc-chartLegends')
					.style('display', 'inline-block')
					.append('div')
				renderPvalues(pvaldiv, chart, self.tests[chart.chartId], s)
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

	self.updateCharts = function(chart) {
		if (!chart.serieses) return
		const s = self.settings
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
			const pvaldiv = div
				.select('.pp-cuminc-chartLegends')
				.style('display', 'inline-block')
				.append('div')
			renderPvalues(pvaldiv, chart, self.tests[chart.chartId], s)
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
		const visibleSerieses = chart.serieses.filter(s => !self.hiddenOverlays.includes(s.seriesId))
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

	function renderPvalues(pvaldiv, chart, tests, s) {
		const fontSize = s.axisTitleFontSize - 2
		const maxPvalsToShow = 10

		pvaldiv.selectAll('*').remove()

		// title div
		pvaldiv
			.append('div')
			.style('padding-bottom', '5px')
			.style('font-size', fontSize + 'px')
			.style('font-weight', 'bold')
			.text("Group comparisons (Gray's test)")

		// table div
		// need separate divs for title and table
		// to support table scrolling
		const tablediv = pvaldiv.append('div').style('border', '1px solid #ccc')
		if (tests.length > maxPvalsToShow) {
			tablediv.style('overflow', 'auto').style('height', '220px')
		}

		// table
		const table = tablediv.append('table').style('width', '100%')

		// table header
		table
			.append('thead')
			.append('tr')
			.selectAll('td')
			.data(['Group 1', 'Group 2', 'P-value'])
			.enter()
			.append('td')
			.style('padding', '1px 20px 1px 3px')
			.style('color', '#858585')
			.style('position', 'sticky')
			.style('top', '0px')
			.style('background', 'white')
			.style('font-size', fontSize + 'px')
			.text(column => column)

		// table rows
		const tbody = table.append('tbody')
		const tr = tbody
			.selectAll('tr')
			.data(tests)
			.enter()
			.append('tr')
			.attr('class', 'pp-cuminc-chartLegends-pvalue')

		// table cells
		tr.selectAll('td')
			.data(d => [
				chart.serieses.find(series => series.seriesId == d.series1).seriesLabel,
				chart.serieses.find(series => series.seriesId == d.series2).seriesLabel,
				d.permutation ? d.pvalue + '*' : d.pvalue
			])
			.enter()
			.append('td')
			.style('padding', '1px 20px 1px 3px')
			.style('font-size', fontSize + 'px')
			.text(d => d)

		// footnote div
		if (tests.find(test => test.permutation)) {
			pvaldiv
				.append('div')
				.style('margin-top', '10px')
				.style('font-size', fontSize - 2 + 'px')
				.text("*computed by permutation of Gray's test statistic")
		}
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
			.attr('transform', 'translate(0,' + (s.svgh - s.svgPadding.top - s.svgPadding.bottom + 5) + ')')
			.call(axisBottom(d.xScale).ticks(5))

		yAxis.attr('transform', 'translate(-5,0)').call(
			axisLeft(
				d3Linear()
					.domain(d.yScale.domain())
					.range([0, s.svgh - s.svgPadding.top - s.svgPadding.bottom])
			).ticks(5)
		)

		xTitle.select('text, title').remove()
		const xTitleLabel = 'Years since diagnosis'
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
		axisTitleFontSize: 16
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
					d3Linear()
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
