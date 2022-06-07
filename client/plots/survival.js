import { getCompInit, copyMerge } from '../rx'
import { controlsInit } from './controls'
import { select, event } from 'd3-selection'
import { scaleLinear, scaleOrdinal, schemeCategory10, schemeCategory20 } from 'd3-scale'
import { axisLeft, axisBottom } from 'd3-axis'
import { timeYear } from 'd3-time'
import { line, area, curveStepAfter } from 'd3-shape'
import { rgb } from 'd3-color'
import htmlLegend from '../dom/html.legend'
import Partjson from 'partjson'
import { to_svg, rgb2hex } from '../src/client'
import { fillTermWrapper } from '../termsetting/termsetting'
import { Menu } from '../dom/menu'

class TdbSurvival {
	constructor(opts) {
		this.type = 'survival'
	}

	async init() {
		const opts = this.opts
		const controls = this.opts.controls ? null : opts.holder.append('div')
		const holder = opts.controls ? opts.holder : opts.holder.append('div')
		this.dom = {
			loadingDiv: holder
				.append('div')
				.style('position', 'absolute')
				.style('display', 'none')
				.style('padding', '20px')
				.html('Loading ...'),
			header: opts.header,
			controls,
			holder,
			chartsDiv: holder.append('div').style('margin', '10px'),
			legendDiv: holder.append('div').style('margin', '5px 5px 15px 5px'),
			hiddenDiv: holder.append('div').style('margin', '5px 5px 15px 5px'),
			tip: new Menu({ padding: '5px' })
		}
		this.dom.tip.onHide = () => {
			this.activeMenu = false
		}
		if (this.dom.header) this.dom.header.html('Survival Plot')
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
		this.hiddenRenderer = htmlLegend(this.dom.hiddenDiv, {
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
			this.opts.controls.on('downloadClick.survival', this.download)
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
							type: 'overlay',
							usecase: { target: 'survival', detail: 'term2' }
						},
						{
							type: 'divideBy',
							usecase: { target: 'survival', detail: 'term0' }
						},
						{
							label: '95% CI',
							boxLabel: 'Visible',
							type: 'checkbox',
							chartType: 'survival',
							settingsKey: 'ciVisible'
						},
						{
							label: 'Censored Symbol',
							type: 'radio',
							chartType: 'survival',
							settingsKey: 'symbol',
							options: [{ label: 'X', value: 'x' }, { label: 'Tick', value: 'vtick' }]
						},
						{
							label: 'Time Factor',
							type: 'math',
							chartType: 'survival',
							settingsKey: 'timeFactor',
							title: 'Rescale the time scale by multiplying this factor. Enter a number or an expression like 1/365.'
						},
						{
							label: 'Time Unit',
							type: 'text',
							chartType: 'survival',
							settingsKey: 'timeUnit',
							title: `The unit to display in the x-axis title, like 'years'`
						},
						{
							label: 'X-axis ticks',
							type: 'text',
							chartType: 'survival',
							settingsKey: 'xTickValues',
							title: `Option to customize the x-axis tick values, enter as comma-separated values. Will be ignored if empty`,
							processInput: value => value.split(',').map(Number)
						},
						{
							label: 'At-risk counts',
							boxLabel: 'Visible',
							type: 'checkbox',
							chartType: 'survival',
							settingsKey: 'atRiskVisible',
							title: 'Display the at-risk counts'
						}
						//{label: 'At-risk label offset', type: 'numeric', chartType: 'survival', settingsKey: 'atRiskLabelOffset'},
					]
				})
			}

			this.components.controls.on('downloadClick.survival', () => alert('TODO: data download?'))
		}
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
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

	async main() {
		try {
			if (!this.state.isVisible) {
				this.dom.holder.style('display', 'none')
				return
			}

			if (this.dom.header) this.dom.header.html(this.state.config.term.term.name + ` plot`)
			this.toggleLoadingDiv()

			Object.assign(this.settings, this.state.config.settings)
			const reqOpts = this.getDataRequestOpts()
			const data = await this.app.vocabApi.getNestedChartSeriesData(reqOpts)
			this.toggleLoadingDiv('none')
			this.serverData = data
			this.app.vocabApi.syncTermData(this.state.config, data)
			this.currData = this.processData(data)
			this.refs = data.refs
			this.pj.refresh({ data: this.currData })
			this.setTerm2Color(this.pj.tree.charts)
			this.symbol = this.getSymbol(7) // hardcode the symbol size for now
			this.render()
		} catch (e) {
			throw e
		}
	}

	// creates an opts object for the vocabApi.getNestedChartsData()
	getDataRequestOpts() {
		const c = this.state.config
		const opts = {
			chartType: 'survival',
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
		const estKeys = ['survival', 'lower', 'upper']
		for (const d of data.case) {
			const obj = {}
			data.keys.forEach((k, i) => {
				obj[k] = estKeys.includes(k) ? Number(d[i]) : d[i]
			})
			obj.time = obj.time * this.settings.timeFactor
			rows.push(obj)
			this.uniqueSeriesIds.add(obj.seriesId)
		}

		// hide tests of hidden series
		this.tests = data.tests
		if (this.tests) {
			for (const chart in this.tests) {
				// remove hidden series from this.tests
				this.tests[chart] = this.tests[chart].filter(
					test => !this.settings.hidden.includes(test.series1) && !this.settings.hidden.includes(test.series2)
				)
				if (this.tests[chart].length == 0) delete this.tests[chart]
			}
		}

		return rows
	}

	setTerm2Color(charts) {
		if (!charts) return
		const config = this.state.config
		const t2values = copyMerge({}, config.term2?.term?.values || {}, config.term2?.values || {})
		const values = this.refs.bins[2] || Object.values(t2values)
		this.term2toColor = {}
		this.colorScale = this.uniqueSeriesIds.size < 11 ? scaleOrdinal(schemeCategory10) : scaleOrdinal(schemeCategory20)
		const legendItems = []
		for (const chart of charts) {
			for (const series of chart.serieses) {
				const v = values.find(v => v.key === series.seriesId || v.name === series.seriesId)
				const c = {
					orig: v?.color || this.colorScale(series.seriesId)
				}
				c.rgb = rgb(c.orig)
				c.adjusted = c.rgb.toString()
				c.hex = rgb2hex(c.adjusted)
				this.term2toColor[series.seriesId] = c

				if (!legendItems.find(d => d.seriesId == series.seriesId)) {
					legendItems.push({
						key: series.seriesId,
						seriesId: series.seriesId,
						text: series.seriesLabel,
						color: this.term2toColor[series.seriesId].adjusted,
						isHidden: this.settings.hidden.includes(series.seriesId)
					})
				}
			}
		}
		if (this.refs.orderedKeys) {
			const s = this.refs.orderedKeys.series
			legendItems.sort((a, b) => s.indexOf(a.seriesId) - s.indexOf(b.seriesId))
		}
		this.legendValues = {}
		legendItems.forEach((item, i) => {
			this.legendValues[item.seriesId] = {
				seriesId: item.seriesId,
				order: 'order' in item ? item.order : i,
				color: this.term2toColor[item.seriesId].orig
			}
		})
		const v = this.state.config.term2?.values
		if (v) {
			legendItems.sort((a, b) => {
				const av = v[a.seriesId]
				const bv = v[b.seriesId]
				if (av && bv) {
					if ('order' in av && 'order' in bv) return av.order - bv.order
					if (av.order) return av.order
					if (bv.order) return bv.order
					return 0
				}
				if (av) return av.order || 0
				if (bv) return bv.order || 0
				// default order
				return a.order - b.order
			})

			legendItems.forEach((item, i) => {
				this.legendValues[item.seriesId].order = i
			})
		}

		if ((!config.term.term.type == 'survival' || config.term2) && legendItems.length) {
			const termNum = config.term.term.type == 'survival' ? 'term2' : 'term'
			this.legendData = [
				{
					name: config[termNum].term.name,
					items: legendItems.filter(s => !s.isHidden)
				}
			]

			this.hiddenData = [
				{
					name: `<span style='color:#aaa; font-weight:400'><span>Hidden categories</span><span style='font-size:0.8rem'> CLICK TO SHOW</span></span>`,
					items: legendItems.filter(s => s.isHidden).map(item => Object.assign({}, item, { isHidden: false }))
				}
			]
		} else {
			this.legendData = []
		}
	}

	// helper so that 'Loading...' does not flash when not needed
	toggleLoadingDiv(display = '') {
		if (display != 'none') {
			this.dom.loadingDiv
				.style('opacity', 0)
				.style('display', display)
				.transition()
				.duration('loadingWait' in this ? this.loadingWait : 0)
				.style('opacity', 1)
		} else {
			this.dom.loadingDiv.style('display', display)
		}
		// do not transition on initial chart load
		this.loadingWait = 1000
	}
}

export const survivalInit = getCompInit(TdbSurvival)
// this alias will allow abstracted dynamic imports
export const componentInit = survivalInit

function setRenderers(self) {
	self.render = function() {
		const data = self.pj.tree.charts || [{ chartId: 'No survival data' }]
		const chartDivs = self.dom.chartsDiv.selectAll('.pp-survival-chart').data(data, d => d.chartId)
		chartDivs.exit().remove()
		chartDivs.each(self.updateCharts)
		chartDivs.enter().each(self.addCharts)

		self.dom.holder.style('display', 'inline-block')
		self.dom.chartsDiv.on('mouseover', self.mouseover).on('mouseout', self.mouseout)

		self.legendRenderer(self.settings.atRiskVisible ? [] : self.legendData)
		if (!self.hiddenData?.[0]?.items.length) self.dom.hiddenDiv.style('display', 'none')
		else {
			self.dom.hiddenDiv.style('display', '')
			self.hiddenRenderer(self.hiddenData)
		}
	}

	self.addCharts = function(chart) {
		const s = self.settings
		setVisibleSerieses(chart, s)

		const div = select(this)
			.append('div')
			.attr('class', 'pp-survival-chart')
			.style('opacity', chart.serieses ? 0 : 1) // if the data can be plotted, slowly reveal plot
			//.style("position", "absolute")
			.style('width', 'fit-content')
			.style('display', 'inline-block')
			.style('margin', s.chartMargin + 'px')
			.style('padding', '10px')
			.style('top', 0)
			.style('left', 0)
			.style('text-align', 'left')
			.style('vertical-align', 'top')
		//.style('border', '1px solid #eee')
		//.style('box-shadow', '0px 0px 1px 0px #ccc')

		const titleDiv = div
			.append('div')
			.style('width', s.svgw + 50 + 'px')
			.style('height', s.chartTitleDivHt + 'px')
			.style('text-align', 'center')
			.style('font-weight', '600')
			.style('margin', '5px')
			.append('div')
			.attr('class', 'sjpp-survival-title')
			.style('display', 'inline-block')
			.datum(chart)
			.html(chart => chart.chartId)
			.style('cursor', 'pointer')
			.on('mouseover', () => titleDiv.style('text-decoration', 'underline'))
			.on('mouseout', () => titleDiv.style('text-decoration', ''))
			.on('click', self.showMenuForSelectedChart)

		if (chart.serieses) {
			const svg = div.append('svg').attr('class', 'pp-survival-svg')
			renderSVG(svg, chart, s, 0)

			div
				.transition()
				.duration(s.duration)
				.style('opacity', 1)

			// div for chart-specific legends
			div
				.append('div')
				.attr('class', 'pp-survival-chartLegends')
				.style('vertical-align', 'top')
				.style('margin', '10px 10px 10px 30px')
				.style('display', 'none')

			// p-values legend
			if (self.tests && chart.rawChartId in self.tests) {
				const pvaldiv = div
					.select('.pp-survival-chartLegends')
					.style('display', 'inline-block')
					.append('div')
				renderPvalues(pvaldiv, chart, self.tests[chart.rawChartId], s)
			}
		}
	}

	function setVisibleSerieses(chart, s) {
		chart.visibleSerieses = chart.serieses.filter(series => !s.hidden.includes(series.seriesId))
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
			.style('width', 'fit-content')

		div
			.select('.sjpp-survival-title')
			.style('width', s.svgw + 50)
			.style('height', s.chartTitleDivHt + 'px')
			.datum(chart.chartId)
			.html(chart.chartId)

		div.selectAll('.sjpp-lock-icon').style('display', s.scale == 'byChart' ? 'block' : 'none')

		div.selectAll('.sjpp-unlock-icon').style('display', s.scale == 'byChart' ? 'none' : 'block')

		renderSVG(div.select('svg'), chart, s, s.duration)

		// div for chart-specific legends
		div
			.select('.pp-survival-chartLegends')
			.selectAll('*')
			.remove()

		// p-values legend
		if (self.tests && chart.rawChartId in self.tests) {
			const pvaldiv = div
				.select('.pp-survival-chartLegends')
				.style('display', 'inline-block')
				.append('div')
			renderPvalues(pvaldiv, chart, self.tests[chart.rawChartId], s)
		}
	}

	function renderSVG(svg, chart, s, duration) {
		const extraHeight = s.atRiskVisible ? 20 + chart.visibleSerieses.length * 20 : 0

		svg
			.transition()
			.duration(duration)
			.attr('width', s.svgw + chart.atRiskLabelWidth)
			.attr('height', s.svgh + extraHeight)
			.style('overflow', 'visible')
			.style('padding-left', '20px')

		/* eslint-disable */
		const [mainG, axisG, xAxis, yAxis, xTitle, yTitle, atRiskG] = getSvgSubElems(svg)
		/* eslint-enable */
		const xOffset = chart.atRiskLabelWidth + s.svgPadding.left
		mainG.attr('transform', 'translate(' + xOffset + ',' + s.svgPadding.top + ')')

		const serieses = mainG
			.selectAll('.sjpp-survival-series')
			.data(chart.visibleSerieses, d => (d && d[0] ? d[0].seriesId : ''))

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
		renderAtRiskG(atRiskG, s, chart)
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
			.text('Group comparisons (log-rank test)')

		// table div
		// need separate divs for title and table
		// to support table scrolling
		const tablediv = pvaldiv.append('div').style('border', '1px solid #ccc')
		if (tests.length > maxPvalsToShow) {
			tablediv.style('overflow', 'auto').style('height', '220px')
		}

		const visibleTests = tests.filter(
			t => !s.hiddenPvalues.find(p => p.series1 === t.series1 && p.series2 === t.series2)
		)

		if (visibleTests.length) {
			visibleTests.sort((a, b) => a.pvalue - b.pvalue)

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
				.style('padding', '1px 8px 1px 2px')
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
				.data(visibleTests)
				.enter()
				.append('tr')
				.attr('class', 'pp-survival-chartLegends-pvalue')
				.on('click', t => {
					const hiddenPvalues = s.hiddenPvalues.slice()
					hiddenPvalues.push(t)
					self.app.dispatch({
						type: 'plot_edit',
						id: self.id,
						config: {
							settings: {
								survival: {
									hiddenPvalues
								}
							}
						}
					})
				})

			// table cells
			tr.selectAll('td')
				.data(d => [
					{
						d,
						text: chart.serieses.find(series => series.seriesId == d.series1).seriesLabel,
						color: self.term2toColor[d.series1].adjusted
					},
					{
						d,
						text: chart.serieses.find(series => series.seriesId == d.series2).seriesLabel,
						color: self.term2toColor[d.series2].adjusted
					},
					{ d, text: d.pvalue, color: '#000' }
				])
				.enter()
				.append('td')
				.attr('title', 'Click to hide a p-value')
				.style('color', d => d.color)
				.style('padding', '1px 8px 1px 2px')
				.style('font-size', fontSize + 'px')
				.style('cursor', 'pointer')
				.text(d => d.text)
		}

		const hiddenTests = tests.filter(t => s.hiddenPvalues.find(p => p.series1 === t.series1 && p.series2 === t.series2))
		if (hiddenTests.length) {
			pvaldiv
				.append('div')
				.style('color', '#aaa')
				.html(`<span style='color:#aaa; font-weight:400'><span>Hidden tests (${hiddenTests.length})</span>`)
				.on('click', () => {
					self.app.tip.clear()
					const divs = self.app.tip.d
						.append('div')
						.selectAll('div')
						.data(hiddenTests)
						.enter()
						.append('div')
						.each(function(d) {
							self.activeMenu = true
							const div = select(this)
							div
								.append('input')
								.attr('type', 'checkbox')
								.style('margin-right', '5px')
							div.append('span').html(`${d.series1} vs ${d.series2}`)
						})

					self.app.tip.d
						.append('button')
						.html('Show checked test(s)')
						.on('click', () => {
							const hiddenPvalues = []
							divs
								.filter(function() {
									return !select(this.firstChild).property('checked')
								})
								.each(d => hiddenPvalues.push(d))
							self.app.dispatch({
								type: 'plot_edit',
								id: self.id,
								config: {
									settings: {
										survival: {
											hiddenPvalues
										}
									}
								}
							})
							self.app.tip.hide()
						})

					self.app.tip.show(event.clientX, event.clientY)
				})
		}
	}

	function getSvgSubElems(svg) {
		let mainG, axisG, xAxis, yAxis, xTitle, yTitle, atRiskG
		if (!svg.select('.sjpp-survival-mainG').size()) {
			mainG = svg.append('g').attr('class', 'sjpp-survival-mainG')
			axisG = mainG.append('g').attr('class', 'sjpp-survival-axis')
			xAxis = axisG.append('g').attr('class', 'sjpp-survival-x-axis')
			yAxis = axisG.append('g').attr('class', 'sjpp-survival-y-axis')
			xTitle = axisG.append('g').attr('class', 'sjpp-survival-x-title')
			yTitle = axisG.append('g').attr('class', 'sjpp-survival-y-title')
			atRiskG = mainG
				.append('g')
				.attr('class', 'sjpp-survival-atrisk')
				.on('click', self.legendClick)
		} else {
			mainG = svg.select('.sjpp-survival-mainG')
			axisG = mainG.select('.sjpp-survival-axis')
			xAxis = axisG.select('.sjpp-survival-x-axis')
			yAxis = axisG.select('.sjpp-survival-y-axis')
			xTitle = axisG.select('.sjpp-survival-x-title')
			yTitle = axisG.select('.sjpp-survival-y-title')
			atRiskG = mainG.select('.sjpp-survival-atrisk').on('click', self.legendClick)
		}
		return [mainG, axisG, xAxis, yAxis, xTitle, yTitle, atRiskG]
	}

	function renderSeries(g, chart, series, i, s, duration) {
		// todo: allow update of exiting path instead of replacing
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
			.style('display', s.ciVisible ? '' : 'none')
			.style('fill', self.term2toColor[series.seriesId].adjusted)
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
					seriesName: 'survival',
					seriesLabel: series.seriesLabel,
					nevent: d.nevent,
					ncensor: d.ncensor,
					nrisk: d.nrisk
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
					y: d.lower,
					scaledX: d.scaledX,
					scaledY: d.scaledY[1],
					seriesName: 'lower',
					seriesLabel: series.seriesLabel,
					nevent: d.nevent,
					ncensor: 0, // no censor marks for lower CI
					nrisk: d.nrisk
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
					y: d.upper,
					scaledX: d.scaledX,
					scaledY: d.scaledY[2],
					seriesName: 'upper', // no censor marks for upper CI
					seriesLabel: series.seriesLabel,
					nevent: d.nevent,
					ncensor: 0,
					nrisk: d.nrisk
				}
			})
		)
	}

	function renderSubseries(s, g, data) {
		// todo: allow update of exiting g's instead of replacing
		g.selectAll('g').remove()

		const lineData = data.filter((d, i) => i === 0 || d.nevent || i === data.length - 1)
		const censoredData = data.filter(d => d.ncensor)
		const subg = g.append('g')
		const circles = subg.selectAll('circle').data(lineData, b => b.x)
		circles.exit().remove()

		// for mouseover only
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
		const color = self.term2toColor[data[0].seriesId].adjusted
		if (seriesName == 'survival') {
			g.append('path')
				.attr('d', self.lineFxn(lineData))
				.style('fill', 'none')
				.style('stroke', color)
				.style('opacity', 1)
				.style('stroke-opacity', 1)
		}

		const subg1 = g.append('g').attr('class', 'sjpp-survival-censored')
		const censored = subg1.selectAll('.sjpp-survival-censored-x').data(censoredData, d => d.x)

		censored.exit().remove()

		censored
			.attr('transform', c => `translate(${c.scaledX},${c.scaledY})`)
			.style('stroke', color)
			.style('display', '')

		censored
			.enter()
			.append('path')
			.attr('class', 'sjpp-survival-censored-x')
			.attr('transform', c => `translate(${c.scaledX},${c.scaledY})`)
			.attr('d', self.symbol)
			.style('fill', 'transparent')
			.style('fill-opacity', s.fillOpacity)
			.style('stroke', color)
			.style('display', '')
	}

	function renderAxes(xAxis, xTitle, yAxis, yTitle, s, chart) {
		let xTicks
		if (s.xTickValues?.length) {
			chart.xTickValues = s.xTickValues.filter(v => v === 0 || (v >= chart.xMin && v <= chart.xMax))
			xTicks = axisBottom(chart.xScale).tickValues(chart.xTickValues)
		} else {
			chart.xTickValues = []
			xTicks = axisBottom(chart.xScale)
				.ticks(4)
				.tickFormat(t => {
					chart.xTickValues.push(t)
					return t
				})
		}

		xAxis.attr('transform', 'translate(0,' + (s.svgh - s.svgPadding.top - s.svgPadding.bottom + 5) + ')').call(xTicks)

		yAxis.attr('transform', 'translate(-5,0)').call(
			axisLeft(
				scaleLinear()
					.domain(chart.yScale.domain())
					.range(chart.yScale.range())
			).ticks(5)
		)

		xTitle.select('text, title').remove()
		const termNum = self.state.config.term.term.type == 'survival' ? 'term' : 'term2'
		const xUnit = s.timeUnit ? s.timeUnit : self.state.config[termNum].term.unit
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

	function renderAtRiskG(g, s, chart) {
		const bySeries = {}
		for (const series of chart.visibleSerieses) {
			const counts = []
			let i = 0,
				d = series.data[0],
				prev = d, // prev = "previous" data point,
				nCensored = 0

			// for each x-axis timepoint, find and use the data that applies
			for (const time of chart.xTickValues) {
				while (d && d.x < time) {
					nCensored += d.ncensor
					prev = d
					i++
					d = series.data[i]
				}
				// NOTE:
				// must use the previous data point to compute the starting nrisk at the next timepoint,
				// since there may not be events/censored exits between or corresponding to all timepoints,
				// and a final curve drop to zero that happens before the max x-axis timepoint will not be
				// followed by another data with nrisk counts;
				// however, must also adjust the prev.nrisk for use in the next timepoint,
				// since it is a starting count and does not include the exits in that timepoint
				counts.push([time, prev.nrisk - prev.nevent - prev.ncensor, nCensored])
			}
			bySeries[series.seriesId] = counts
		}

		const y = s.svgh - s.svgPadding.top - s.svgPadding.bottom + 60 // make y-offset option???
		// fully rerender, later may reuse previously rendered elements
		// g.selectAll('*').remove()

		const seriesOrder = chart.serieses.map(s => s.seriesId)
		const v = self.state.config.term2?.values
		if (v) {
			seriesOrder.sort((aId, bId) => {
				const av = v[aId]
				const bv = v[bId]
				if (av && bv) {
					if ('order' in av && 'order' in bv) return av.order - bv.order
					if (av.order) return av.order
					if (bv.order) return bv.order
					return 0
				}
				if (av) return av.order || 0
				if (bv) return bv.order || 0
				return 0
			})
		}

		const data = !s.atRiskVisible
			? []
			: Object.keys(bySeries).sort((a, b) => seriesOrder.indexOf(a) - seriesOrder.indexOf(b))

		const sg = g
			.attr('transform', `translate(0,${y})`)
			.selectAll(':scope > g')
			.data(data, seriesId => seriesId)

		sg.exit().remove()

		sg.each(function(seriesId, i) {
			const g = select(this)
				.attr('transform', `translate(0,${(i + 1) * 20})`)
				.attr('fill', s.hidden.includes(seriesId) ? '#aaa' : self.term2toColor[seriesId].adjusted)

			renderAtRiskTick(g.select(':scope>g'), chart, s, seriesId, bySeries[seriesId])
		})

		sg.enter()
			.append('g')
			.each(function(seriesId, i) {
				const y = (i + 1) * 20
				const g = select(this)
					.attr('transform', `translate(0,${y})`)
					.attr('fill', s.hidden.includes(seriesId) ? '#aaa' : self.term2toColor[seriesId].adjusted)

				const sObj = chart.serieses.find(s => s.seriesId === seriesId)
				g.append('text')
					.attr('transform', `translate(${s.atRiskLabelOffset}, 0)`)
					.attr('text-anchor', 'end')
					.attr('font-size', `${s.axisTitleFontSize - 4}px`)
					.attr('cursor', 'pointer')
					.datum({ seriesId })
					.text(seriesId && seriesId != '*' ? sObj.seriesLabel || seriesId : 'At-risk')

				renderAtRiskTick(g.append('g'), chart, s, seriesId, bySeries[seriesId])
			})
	}

	function renderAtRiskTick(g, chart, s, seriesId, series) {
		const reversed = series.slice().reverse()
		const data = chart.xTickValues.map(tickVal => {
			if (tickVal === 0) return { seriesId, tickVal, atRisk: series[0][1], nCensored: series[0][2] }
			const d = reversed.find(d => d[0] <= tickVal)
			return { seriesId, tickVal, atRisk: d[1], nCensored: d[2] }
		})

		const text = g.selectAll('text').data(data)
		text.exit().remove()
		text.each(function(d) {
			select(this)
				.attr('transform', d => `translate(${chart.xScale(d.tickVal)},0)`)
				.attr('font-size', `${s.axisTitleFontSize - 4}px`)
				.text(d => `${d.atRisk}(${d.nCensored})`)
		})
		text
			.enter()
			.append('text')
			.attr('transform', d => `translate(${chart.xScale(d.tickVal)},0)`)
			.attr('text-anchor', 'middle')
			.attr('font-size', `${s.axisTitleFontSize - 4}px`)
			.attr('cursor', 'pointer')
			.text(d => `${d.atRisk}(${d.nCensored})`)
	}

	self.getSymbol = function(size) {
		const s = size,
			h = s / 2

		switch (self.settings.symbol) {
			case 'x':
				return `M -${h},-${h} l ${s},${s} M ${h},-${h} l -${s},${s}`

			case 'vtick':
				return `M 0,-${h} L 0,${h}`

			default:
				throw `Unrecognized survival plot symbol='${self.settings.symbol}'`
		}
	}
}

function setInteractivity(self) {
	const labels = {
		survival: 'Survival',
		lower: 'Lower 95% CI',
		upper: 'Upper 95% CI'
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
				`<tr><td style='padding:3px; color:#aaa'>${label}:</td><td style='padding:3px; text-align:center'>${100 *
					y}%</td></tr>`,
				`<tr><td style='padding:3px; color:#aaa'>At-risk:</td><td style='padding:3px; text-align:center'>${d.nrisk}</td></tr>`
			]
			// may also indicate the confidence interval (lower%-upper%) in a new row
			self.app.tip
				.show(event.clientX, event.clientY)
				.d.html(`<table class='sja_simpletable'>${rows.join('\n')}</table>`)
		} else if (event.target.tagName == 'path' && d && d.seriesId) {
			self.app.tip.show(event.clientX, event.clientY).d.html(d.seriesLabel ? d.seriesLabel : d.seriesId)
		} else if (!self.activeMenu) {
			self.app.tip.hide()
		}
	}

	self.mouseout = function() {
		if (self.activeMenu) return
		self.app.tip.hide()
	}

	self.legendClick = function() {
		event.stopPropagation()
		const d = event.target.__data__
		if (d === undefined) return
		const hidden = self.settings.hidden.slice()
		const i = hidden.indexOf(d.seriesId)
		if (i == -1) {
			self.showLegendItemMenu(d)
		} else {
			hidden.splice(i, 1)
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

	self.showLegendItemMenu = function(d) {
		const term1 = self.state.config.term.term
		const term2 = self.state.config.term2?.term || null
		const uncomp_term1 = term1.values ? Object.values(term1.values).map(v => v.label) : []
		const uncomp_term2 = term2 && term2.values ? Object.values(term2.values).map(v => v.label) : []
		const term1unit = term1.unit && !uncomp_term1.includes(d.seriesId || d.id) ? ' ' + term1.unit : ''
		const term2unit = term2 && term2.unit && !uncomp_term2.includes(d.dataId || d.id) ? ' ' + term2.unit : ''
		const seriesLabel =
			(term1.values && d.seriesId in term1.values ? term1.values[d.seriesId].label : d.seriesId ? d.seriesId : d.id) +
			term1unit
		const dataLabel =
			(term2 && term2.values && d.dataId in term2.values ? term2.values[d.dataId].label : d.dataId ? d.dataId : d.id) +
			term2unit
		const icon = !term2
			? ''
			: "<div style='display:inline-block; width:14px; height:14px; margin: 2px 3px; vertical-align:top; background:" +
			  d.color +
			  "'>&nbsp;</div>"
		const header =
			`<div style='padding:2px'><b>${term1.name}</b>: ${seriesLabel}</div>` +
			(d.seriesId && term2 ? `<div style='padding:2px'><b>${term2.name}</b>: ${dataLabel} ${icon}</div>` : '')

		const data = d.seriesId || d.seriesId === 0 ? d : { seriesId: d.id, dataId: d.dataId }

		const options = []
		options.push({
			label: 'Hide "' + seriesLabel,
			callback: () => {
				const hidden = self.settings.hidden.slice()
				hidden.push(d.seriesId)
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
		})

		if (self.legendData[0]?.items.length > 1) {
			options.push({
				label: 'Move',
				setInput: holder => {
					const legendIndex = self.legendValues[d.seriesId].order
					if (legendIndex != 0)
						holder
							.append('button')
							.html('up')
							.on('click', () => self.adjustValueOrder(d, -1))
					if (legendIndex < self.legendData[0]?.items.length - 1)
						holder
							.append('button')
							.html('down')
							.on('click', () => self.adjustValueOrder(d, 1))
				}
			})
		}

		options.push({
			//label: 'Color',
			//callback: d => {}
			setInput: holder => {
				const label = holder.append('label')
				label
					.append('span')
					.style('vertical-align', 'middle')
					.style('line-height', '25px')
					.html('Edit color ')
				const input = label
					.append('input')
					.attr('type', 'color')
					.attr('value', self.term2toColor[d.seriesId].hex)
					.style('vertical-align', 'top')
					.on('change', () => self.adjustColor(input.property('value'), d))

				holder
					.append('span')
					.style('vertical-align', 'middle')
					.style('line-height', '25px')
					.html(' OR ')

				holder
					.append('button')
					.style('margin-left', '5px')
					.style('background-color', self.term2toColor[d.seriesId].rgb.darker())
					.style('vertical-align', 'top')
					.html('darken')
					.on('click', () => self.adjustColor(input.property('value'), d, 'darker'))

				holder
					.append('button')
					.style('margin-left', '5px')
					.style('background-color', self.term2toColor[d.seriesId].rgb.brighter())
					.style('vertical-align', 'top')
					.html('brighten')
					.on('click', () => self.adjustColor(input.property('value'), d, 'brighter'))
			}
		})

		if (!options.length) return
		self.activeMenu = true
		self.app.tip.clear()
		self.app.tip.d.append('div').html(header)
		self.app.tip.d
			.append('div')
			.selectAll('div')
			.data(options)
			.enter()
			.append('div')
			.attr('class', 'sja_menuoption')
			.on('click', c => {
				if (c.setInput) return
				self.app.tip.hide()
				c.callback(d)
			})
			.each(function(d) {
				const div = select(this)
				if (d.label)
					div
						.append('div')
						.style('display', 'inline-block')
						.html(d.label)
				if (d.setInput)
					d.setInput(
						div
							.append('div')
							.style('display', 'inline-block')
							.style('margin-left', '10px')
					)
			})

		self.app.tip.show(event.clientX, event.clientY)
	}

	self.adjustValueOrder = (d, increment) => {
		const values = JSON.parse(JSON.stringify(self.state.config.term2?.values || self.legendValues))
		if (!values[d.seriesId]) {
			values[d.seriesId] = Object.assign({}, self.state.config.term2?.term?.values || {})
		}

		for (const id in values) {
			if (!('order' in values[id])) values[id].order = self.legendValues[id].order
		}

		const v = values[d.seriesId]
		v.order += increment
		for (const id in values) {
			if (id == d.seriesId) continue
			if ('order' in values[id] && values[id].order === v.order) {
				values[id].order += -1 * increment
				break
			}
		}

		const term2 = JSON.parse(JSON.stringify(self.state.config.term2))
		term2.values = values

		self.app.dispatch({
			type: 'plot_edit',
			id: self.id,
			config: {
				term2
			}
		})

		self.app.tip.hide()
	}

	self.adjustColor = (value, d, adjust = '') => {
		if (adjust && adjust != 'darker' && adjust != 'brighter') throw 'invalid color adjustment option'
		const t2 = self.state.config.term2
		const values = JSON.parse(JSON.stringify(t2?.values || self.legendValues))
		const term2 = JSON.parse(JSON.stringify(self.state.config.term2))
		term2.values = values
		const color = rgb(value)
		const adjustedColor = !adjust ? color : adjust == 'darker' ? color.darker() : color.brighter()
		values[d.seriesId].color = adjustedColor.toString()
		self.app.dispatch({
			type: 'plot_edit',
			id: self.id,
			config: {
				term2
			}
		})

		self.app.tip.hide()
	}

	self.showMenuForSelectedChart = function(d) {
		self.dom.tip.clear()
		self.activeMenu = true
		self.dom.tip
			.showunder(this)
			.d.append('button')
			.html('Download SVG')
			.on('click', () =>
				to_svg(this.parentNode.parentNode.querySelector('svg'), 'survival', { apply_dom_styles: true })
			)
	}
}

export async function getPlotConfig(opts, app) {
	if (!opts.term) throw 'survival getPlotConfig: opts.term{} missing'
	try {
		await fillTermWrapper(opts.term, app.vocabApi)
		if (opts.term2) await fillTermWrapper(opts.term2, app.vocabApi)
		if (opts.term0) await fillTermWrapper(opts.term0, app.vocabApi)
	} catch (e) {
		throw `${e} [survival getPlotConfig()]`
	}

	const config = {
		id: opts.term.term.id,
		settings: {
			controls: {
				isOpen: false, // control panel is hidden by default
				term2: null, // the previous overlay value may be displayed as a convenience for toggling
				term0: null
			},
			survival: {
				radius: 5,
				ciVisible: false,
				fill: '#fff',
				stroke: '#000',
				symbol: 'vtick', // 'x', 'vtick'
				fillOpacity: 0,
				chartMargin: 10,
				svgw: 400,
				svgh: 300,
				timeFactor: 1,
				timeUnit: '',
				atRiskVisible: true,
				atRiskLabelOffset: -20,
				xTickValues: [], // if undefined or empty, will be ignored
				svgPadding: {
					top: 20,
					left: 55,
					right: 20,
					bottom: 50
				},
				axisTitleFontSize: 16,
				hidden: [],
				hiddenPvalues: []
			}
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
					rawChartId: '$chartId',
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
									lower: '$lower',
									upper: '$upper',
									'_1:scaledX': '=scaledX()',
									'_1:scaledY': '=scaledY()',
									nevent: '$nevent',
									ncensor: '$ncensor',
									nrisk: '$nrisk'
								},
								'=timeCensored()'
							]
						},
						'$seriesId'
					],
					'@done()': '=padAndSortSerieses()'
				},
				'=chartTitle()'
			],
			'@done()': '=sortCharts()'
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
				const t2 = self.state.config.term2
				if (!t2) return
				const seriesId = context.self.seriesId
				if (t2 && t2.q && t2.q.groupsetting && t2.q.groupsetting.inuse) return seriesId
				if (t2 && t2.term.values && seriesId in t2.term.values) return t2.term.values[seriesId].label
				return seriesId
			},
			timeCensored(row) {
				return row.time + '-' + row.ncensor
			},
			y(row, context) {
				const seriesId = context.context.parent.seriesId
				return seriesId == 'CI' ? [row.lower, row.upper] : row[seriesId]
			},
			yMin(row) {
				return row.lower
			},
			yMax(row) {
				return row.upper
			},
			xScale(row, context) {
				const s = self.settings
				const xMin = s.method == 2 ? 0 : context.self.xMin
				return (
					scaleLinear()
						// force x to start at 0, padAndSortSerieses() prepends this data point
						.domain([0, context.self.xMax])
						.range([0, s.svgw - s.svgPadding.left - s.svgPadding.right])
				)
			},
			scaledX(row, context) {
				return context.context.context.context.parent.xScale(context.self.x)
			},
			scaledY(row, context) {
				const yScale = context.context.context.context.parent.yScale
				const s = context.self
				return [yScale(s.y), yScale(s.lower), yScale(s.upper)]
			},
			yScale(row, context) {
				const s = self.settings
				const yMax = s.scale == 'byChart' ? context.self.yMax : context.root.yMax
				const domain = [1.05, 0]
				return scaleLinear()
					.domain(domain)
					.range([0, s.svgh - s.svgPadding.top - s.svgPadding.bottom])
			},
			padAndSortSerieses(result) {
				const s = self.settings
				for (const series of result.serieses) {
					// prepend a starting prob=1 data point that survfit() does not include
					const d0 = series.data[0]
					series.data.unshift({
						seriesId: d0.seriesId,
						x: 0,
						y: 1,
						nevent: 0,
						ncensor: 0,
						nrisk: series.data[0].nrisk,
						lower: 1,
						upper: 1,
						scaledX: 0, //result.xScale(0),
						scaledY: [result.yScale(1), result.yScale(1), result.yScale(1)]
					})

					series.data.sort((a, b) => (a.x < b.x ? -1 : 1))
				}
				if (self.refs.orderedKeys) {
					const s = self.refs.orderedKeys.series
					result.serieses.sort((a, b) => s.indexOf(a.seriesId) - s.indexOf(b.seriesId))
				}
				if (self.refs.bins) {
					const labelOrder = self.refs.bins.map(b => b.label)
					result.serieses.sort((a, b) => labelOrder.indexOf(a.seriesId) - labelOrder.indexOf(b.seriesId))
				}
			},
			sortCharts(result) {
				if (!self.refs.orderedKeys) return
				const c = self.refs.orderedKeys.chart
				result.charts.sort((a, b) => c.indexOf(a.chartId) - c.indexOf(b.chartId))
			}
		}
	})

	return pj
}
