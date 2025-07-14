import { getCompInit, copyMerge } from '../rx'
import { controlsInit, term0_term2_defaultQ } from './controls'
import { select } from 'd3-selection'
import { scaleLinear, scaleOrdinal } from 'd3-scale'
import { schemeCategory10 } from 'd3-scale-chromatic'
import { schemeCategory20 } from '#common/legacy-d3-polyfill'
import { axisLeft, axisBottom } from 'd3-axis'
import { timeYear } from 'd3-time'
import { line, area, curveStepAfter } from 'd3-shape'
import { rgb } from 'd3-color'
import htmlLegend from '#dom/html.legend'
import Partjson from 'partjson'
import { to_svg, rgb2hex } from '#src/client'
import { fillTermWrapper } from '#termsetting'
import { Menu } from '#dom/menu'
import { getSeriesTip } from '#dom/svgSeriesTips'
import { renderAtRiskG } from '#dom/renderAtRisk'
import { renderPvalues } from '#dom/renderPvalueTable'
import { downloadChart } from '#common/svg.download'
import { getCombinedTermFilter } from '#filter'

class TdbSurvival {
	constructor(opts) {
		this.type = 'survival'
		if (opts?.parentId) this.parentId = opts.parentId
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
			tip: new Menu({ padding: '5px' }),
			legendTip: new Menu({ padding: '5px' })
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
					click: e => this.legendClick(e.target.__data__, e.clientX, e.clientY)
				}
			}
		})
		this.hiddenRenderer = htmlLegend(this.dom.hiddenDiv, {
			settings: {
				legendOrientation: 'vertical'
			},
			handlers: {
				legend: {
					click: e => this.legendClick(e.target.__data__, e.clientX, e.clientY)
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
							type: 'term',
							configKey: 'term2',
							chartType: 'survival',
							usecase: { target: 'survival', detail: 'term2' },
							title: 'Overlay data',
							label: 'Overlay',
							vocabApi: this.app.vocabApi,
							numericEditMenuVersion: ['discrete'],
							defaultQ4fillTW: term0_term2_defaultQ
						},
						{
							type: 'term',
							configKey: 'term0',
							chartType: 'survival',
							usecase: { target: 'survival', detail: 'term0' },
							title: 'Divide by data',
							label: 'Divide by',
							vocabApi: this.app.vocabApi,
							numericEditMenuVersion: ['discrete'],
							defaultQ4fillTW: term0_term2_defaultQ
						},
						{
							label: 'Chart width',
							type: 'number',
							chartType: 'survival',
							settingsKey: 'svgw',
							title: 'The internal width of the chart plot'
						},
						{
							label: 'Chart height',
							type: 'number',
							chartType: 'survival',
							settingsKey: 'svgh',
							title: 'The internal height of the chart plot'
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
							options: [
								{ label: 'X', value: 'x' },
								{ label: 'Tick', value: 'vtick' }
							]
						},
						{
							label: 'Survival Time Visualized',
							type: 'number',
							chartType: 'survival',
							settingsKey: 'maxTimeToEvent',
							title:
								'The maximum time-to-event to be displayed in the survival plot, affects only the visual representation and does not impact other analyses. All available data is still used to compute p-values. If this value is left empty or set to 0, no cutoff will be applied.'
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
							processInput: value => (value ? value.split(',').map(Number) : [])
						},
						{
							label: 'At-risk counts',
							boxLabel: 'Visible',
							type: 'checkbox',
							chartType: 'survival',
							settingsKey: 'atRiskVisible',
							title: 'Display the at-risk counts'
						},
						//{label: 'At-risk label offset', type: 'numeric', chartType: 'survival', settingsKey: 'atRiskLabelOffset'},
						{
							label: 'Default color',
							type: 'color',
							chartType: 'survival',
							settingsKey: 'defaultColor'
						}
					]
				})
			}
			this.components.controls.on('downloadClick.survival', this.download)
		}
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		const parentConfig = appState.plots.find(p => p.id === this.parentId)
		const termfilter = getCombinedTermFilter(appState, parentConfig?.filter)

		return {
			isVisible: config.term.term.type == 'survival' || (config.term2 && config.term2.term.type == 'survival'),
			genome: this.app.vocabApi.vocab.genome,
			dslabel: this.app.vocabApi.vocab.dslabel,
			activeCohort: appState.activeCohort,
			termfilter,

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
			this.settings.defaultHidden = this.getDefaultHidden()
			this.settings.hidden = this.settings.customHidden || this.settings.defaultHidden
			this.settings.xTitleLabel = this.getXtitleLabel()
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
			filter: this.state.termfilter.filter,
			filter0: this.state.termfilter.filter0
		}
		if (c.term2) opts.term2 = c.term2
		if (c.term0) opts.term0 = c.term0
		return opts
	}

	getDefaultHidden() {
		const hidden = []
		const term2 = this.state.config.term2
		if (!term2) return hidden
		const hiddenValues = term2.q.hiddenValues
		if (hiddenValues && Object.keys(hiddenValues).length) {
			// term2 has default hidden values
			for (const k in hiddenValues) {
				hidden.push(term2.term.values[k].label)
			}
		}
		return hidden
	}

	getXtitleLabel() {
		const termNum = this.state.config.term.term.type == 'survival' ? 'term' : 'term2'
		const xUnit = this.settings.timeUnit ? this.settings.timeUnit : this.state.config[termNum].term.unit
		const xTitleLabel = `Time to Event (${xUnit})`
		return xTitleLabel
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

		// process statistical tests
		this.tests = {}
		if (data.tests) {
			for (const chartId in data.tests) {
				const chartTests = data.tests[chartId]
				this.tests[chartId] = []
				for (const test of chartTests) {
					if (this.settings.hidden.includes(test.series1) || this.settings.hidden.includes(test.series2)) continue // hide tests that contain hidden series
					this.tests[chartId].push({
						pvalue: { id: 'pvalue', text: test.pvalue },
						series1: { id: test.series1 },
						series2: { id: test.series2 }
					})
				}
				if (!this.tests[chartId].length) delete this.tests[chartId]
			}
		}

		return rows
	}

	setTerm2Color(charts) {
		if (!charts) return
		const config = this.state.config
		const t2values = copyMerge({}, config.term2?.term?.values || {}, config.term2?.values || {})
		const values = (this.refs.bins[2] && [this.refs.bins[2]]) || Object.values(t2values)
		this.term2toColor = {}
		this.colorScale = this.uniqueSeriesIds.size < 11 ? scaleOrdinal(schemeCategory10) : scaleOrdinal(schemeCategory20)
		const legendItems = []
		for (const chart of charts) {
			for (const series of chart.serieses) {
				const v = values.find(
					v =>
						v.seriesId === series.seriesId ||
						v.key === series.seriesId ||
						v.name === series.seriesId ||
						v.label === series.seriesId
				)
				const c = {
					orig: v?.color || (series.seriesId == '' ? this.settings.defaultColor : this.colorScale(series.seriesId))
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
	self.render = function () {
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

	const updateHiddenPvalues = hiddenPvalues => {
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
	}

	const setActiveMenu = bool => (self.activeMenu = bool)

	self.addCharts = function (chart) {
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
			.style('width', 'fit-content')
			.datum(chart)
			.html(chart => chart.chartId)
			.style('cursor', 'pointer')
			.on('mouseover', () => titleDiv.style('text-decoration', 'underline'))
			.on('mouseout', () => titleDiv.style('text-decoration', ''))
			.on('click', self.showMenuForSelectedChart)

		if (chart.serieses) {
			const svg = div.append('svg').attr('class', 'pp-survival-svg')
			renderSVG(svg, chart, s, 0)

			div.transition().duration(s.duration).style('opacity', 1)

			// div for chart-specific legends
			div
				.append('div')
				.attr('class', 'pp-survival-chartLegends')
				.style('vertical-align', 'top')
				.style('margin', '10px 10px 10px 30px')
				.style('display', 'none')

			// p-values legend
			if (self.tests && chart.rawChartId in self.tests) {
				const holder = div.select('.pp-survival-chartLegends').style('display', 'inline-block').append('div')
				renderPvalues({
					title: 'Group comparisons (log-rank test)',
					holder,
					plot: 'survival',
					tests: self.tests[chart.rawChartId],
					s,
					bins: self.refs.bins,
					tip: self.app.tip,
					setActiveMenu,
					updateHiddenPvalues
				})
			}
		}
	}

	function setVisibleSerieses(chart, s) {
		chart.visibleSerieses = chart.serieses?.filter(series => !s.hidden.includes(series.seriesId)) || []
		const maxSeriesLabelLen = chart.visibleSerieses.reduce(
			(maxlen, a) => (a.seriesLabel && a.seriesLabel.length > maxlen ? a.seriesLabel.length : maxlen),
			0
		)
		chart.atRiskLabelWidth = s.atRiskVisible
			? maxSeriesLabelLen * (s.axisTitleFontSize - 2) * 0.4 + s.atRiskLabelOffset
			: 0
	}

	self.updateCharts = function (chart) {
		if (!chart.serieses) return
		const s = self.settings
		setVisibleSerieses(chart, s)

		const div = select(this)
		div.transition().duration(s.duration).style('width', 'fit-content')

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
		div.select('.pp-survival-chartLegends').selectAll('*').remove()

		// p-values legend
		if (self.tests && chart.rawChartId in self.tests) {
			const holder = div.select('.pp-survival-chartLegends').style('display', 'inline-block').append('div')
			renderPvalues({
				title: 'Group comparisons (log-rank test)',
				holder,
				plot: 'survival',
				tests: self.tests[chart.rawChartId],
				s,
				bins: self.refs.bins,
				tip: self.app.tip,
				setActiveMenu,
				updateHiddenPvalues
			})
		}
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
		const xOffset = chart.atRiskLabelWidth + s.svgPadding.left
		mainG.attr('transform', 'translate(' + xOffset + ',' + s.svgPadding.top + ')')

		const serieses = seriesesG
			.selectAll('.sjpp-survival-series')
			.data(chart.visibleSerieses, d => (d && d[0] ? d[0].seriesId : ''))

		serieses.exit().remove()
		serieses.each(function (series, i) {
			renderSeries(select(this), chart, series, i, s, s.duration)
		})
		serieses
			.enter()
			.append('g')
			.attr('class', 'sjpp-survival-series')
			.each(function (series, i) {
				renderSeries(select(this), chart, series, i, s, duration)
			})

		renderAxes(xAxis, xTitle, yAxis, yTitle, s, chart)
		renderAtRiskG({
			g: atRiskG,
			s,
			chart,
			term2values: self.state.config.term2?.values,
			term2toColor: self.term2toColor,
			onSerieClick: self.legendClick
		})

		plotRect
			.attr('x', 0) //s.svgPadding.left) //s.svgh - s.svgPadding.top - s.svgPadding.bottom + 5)
			.attr('width', s.svgw - s.svgPadding.left - s.svgPadding.right)
			.attr('y', 0) //s.svgPadding.top) // - s.svgPadding.bottom + 5)
			.attr('height', s.svgh - s.svgPadding.top - s.svgPadding.bottom + s.xAxisOffset)

		svg.seriesTip.update({
			xScale: chart.xScale,
			xTitleLabel: s.xTitleLabel,
			decimals: s.seriesTipDecimals,
			serieses: chart.visibleSerieses.map(s => {
				const seriesLabel = `${s.seriesLabel || 'Probability'}:`
				const color = self.term2toColor[s.seriesId].adjusted || '#000'
				return {
					data: s.data.map(d => {
						return {
							x: d.x,
							html:
								`<span style='color: ${color}'>` +
								`${seriesLabel} ${(100 * d.y).toFixed(2)}% (${(100 * d.lower).toFixed(2)} - ${(100 * d.upper).toFixed(
									2
								)})` +
								`</span>`
						}
					})
				}
			})
		})
	}

	function getSvgSubElems(svg, chart) {
		let mainG, seriesesG, axisG, xAxis, yAxis, xTitle, yTitle, atRiskG, plotRect, line
		if (!svg.select('.sjpp-survival-mainG').size()) {
			mainG = svg.append('g').attr('class', 'sjpp-survival-mainG')
			seriesesG = mainG.append('g').attr('class', 'sjpcb-survival-seriesesG')
			axisG = mainG.append('g').attr('class', 'sjpp-survival-axis')
			xAxis = axisG.append('g').attr('class', 'sjpp-survival-x-axis')
			yAxis = axisG.append('g').attr('class', 'sjpp-survival-y-axis')
			xTitle = axisG.append('g').attr('class', 'sjpp-survival-x-title')
			yTitle = axisG.append('g').attr('class', 'sjpp-survival-y-title')
			atRiskG = mainG.append('g').attr('class', 'sjpp-survival-atrisk')
			line = mainG
				.append('line')
				.attr('class', 'sjpcb-plot-tip-line')
				.attr('stroke', '#000')
				.attr('stroke-width', '1px')
			plotRect = mainG.append('rect').attr('class', 'sjpcb-plot-tip-rect').style('fill', 'transparent')
		} else {
			mainG = svg.select('.sjpp-survival-mainG')
			seriesesG = mainG.select('.sjpcb-survival-seriesesG')
			axisG = mainG.select('.sjpp-survival-axis')
			xAxis = axisG.select('.sjpp-survival-x-axis')
			yAxis = axisG.select('.sjpp-survival-y-axis')
			xTitle = axisG.select('.sjpp-survival-x-title')
			yTitle = axisG.select('.sjpp-survival-y-title')
			atRiskG = mainG.select('.sjpp-survival-atrisk')
			plotRect = mainG.select('.sjpcb-plot-tip-rect')
			line = mainG.select('.sjpcb-plot-tip-line')
		}

		if (!svg.seriesTip) {
			svg.seriesTip = getSeriesTip(line, plotRect, self.app?.tip)
		}

		return [mainG, seriesesG, axisG, xAxis, yAxis, xTitle, yTitle, atRiskG, plotRect]
	}

	function renderSeries(g, chart, series, i, s, duration) {
		// do not show samples with time to event larger than maxTimeToEvent
		let processedData = series.data
		if (s.maxTimeToEvent) {
			processedData = series.data.filter(d => d.x <= s.maxTimeToEvent)
		}
		// todo: allow update of exiting path instead of replacing
		g.selectAll('path').remove()
		g.append('path')
			.attr(
				'd',
				area()
					.curve(curveStepAfter)
					.x(c => c.scaledX)
					.y0(c => c.scaledY[1])
					.y1(c => c.scaledY[2])(processedData)
			)
			.style('display', s.ciVisible ? '' : 'none')
			.style('fill', self.term2toColor[series.seriesId].adjusted)
			.style('opacity', '0.15')
			.style('stroke', 'none')

		renderSubseries(
			s,
			g,
			processedData.map(d => {
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
			processedData.map(d => {
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
			processedData.map(d => {
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
		/*const circles = subg.selectAll('circle').data(lineData, b => b.x)
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
			.style('stroke', s.stroke)*/

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
			// xTicksValues should not be larger than maxTimeToEvent
			chart.xTickValues = s.xTickValues.filter(
				v => v === 0 || (v >= chart.xMin && v <= Math.min(s.maxTimeToEvent || chart.xMax, chart.xMax))
			)
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

		// without this pixel offset, the axes and data are slightly misaligned
		// this could be because the axes have a 0.5 offset in their path,
		// for example: <path class="domain" stroke="#000" d="M0.5,6V0.5H325.5V6"></path>
		const pixelOffset = -0.5

		xAxis
			.attr(
				'transform',
				`translate(${pixelOffset}, ${s.svgh - s.svgPadding.top - s.svgPadding.bottom + s.xAxisOffset + pixelOffset})`
			)
			.call(xTicks)

		yAxis
			.attr('transform', `translate(${s.yAxisOffset + pixelOffset}, ${pixelOffset})`)
			.call(axisLeft(scaleLinear().domain(chart.yScale.domain()).range(chart.yScale.range())).ticks(5))

		xTitle.select('text, title').remove()
		const xText = xTitle
			.attr(
				'transform',
				'translate(' +
					(s.svgw - s.svgPadding.left - s.svgPadding.right) / 2 +
					',' +
					(s.svgh - s.axisTitleFontSize - 4) +
					')'
			)
			.append('text')
			.style('text-anchor', 'middle')
			.style('font-size', s.axisTitleFontSize + 'px')
			.text(s.xTitleLabel)

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

	self.getSymbol = function (size) {
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
	self.download = function () {
		if (!self.state) return
		downloadChart(
			self.dom.chartsDiv.selectAll('.sjpp-survival-mainG'),
			'Survival_Plot',
			self.dom.chartsDiv.select('.pp-survival-chart').node()
		)
	}

	self.mouseover = function (event) {
		const d = event.target.__data__
		/*if (event.target.tagName == 'circle') {
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
		}*/
	}

	self.mouseout = function () {
		if (self.activeMenu) return
		self.app.tip.hide()
	}

	self.legendClick = function (d, x, y) {
		if (d === undefined) return
		const hidden = self.settings.hidden.slice()
		const i = hidden.indexOf(d.seriesId)
		if (i == -1) {
			hidden.push(d.seriesId)
			self.showLegendItemMenu(d, hidden, x, y)
		} else {
			hidden.splice(i, 1)
			self.app.dispatch({
				type: 'plot_edit',
				id: self.id,
				config: {
					settings: {
						survival: {
							customHidden: hidden
						}
					}
				}
			})
		}
	}

	self.showLegendItemMenu = function (d, hidden, x, y) {
		const term2 = self.state.config.term2?.term || null
		const seriesLabel = term2?.values?.[d.seriesId]?.label || d.seriesId

		const header = `<div style='padding-bottom:8px'><b>${seriesLabel}</b></div>`
		const data = d.seriesId || d.seriesId === 0 ? d : { seriesId: d.id, dataId: d.dataId }
		if (!data.seriesId && !data.dataId) {
			if (!term2) {
				const label = self.dom.legendTip.clear().d.append('div').html('Edit color: ')
				const input = label
					.append('input')
					.attr('type', 'color')
					.attr('value', self.settings.defaultColor)
					.on('change', () => self.adjustColor(input.property('value'), d))
				self.dom.legendTip.show(x, y)
			}
			return
		}

		const options = []
		options.push({
			label: 'Hide',
			callback: () => {
				menu.hide()
				self.app.dispatch({
					type: 'plot_edit',
					id: self.id,
					config: {
						settings: {
							survival: {
								customHidden: hidden
							}
						}
					}
				})
			}
		})

		if (self.legendData[0]?.items.length > 1) {
			options.push({
				label: 'Move&nbsp;',
				setInput: holder => {
					const legendIndex = self.legendValues[d.seriesId].order
					if (legendIndex != 0)
						holder
							.append('button')
							.html('up')
							.on('click', () => {
								menu.hide()
								self.adjustValueOrder(d, -1)
							})
					if (legendIndex < self.legendData[0]?.items.length - 1)
						holder
							.append('button')
							.html('down')
							.on('click', () => {
								menu.hide()
								self.adjustValueOrder(d, 1)
							})
				}
			})
		}

		options.push({
			//label: 'Color',
			//callback: d => {}
			setInput: holder => {
				const label = holder.append('div')
				label.html('Edit color: ')
				const input = label
					.append('input')
					.attr('type', 'color')
					.attr('value', self.term2toColor[d.seriesId].hex)
					.on('change', () => self.adjustColor(input.property('value'), d))
			}
		})

		if (!options.length) return
		const menu = self.dom.legendTip.clear()
		menu.d.append('div').html(header)
		menu.d
			.append('div')
			.selectAll('div')
			.data(options)
			.enter()
			.append('div')
			.attr('class', d => (d.label == 'Hide' ? 'sja_menuoption' : 'sja_menuoption_not_interactive'))
			.on('click', (event, c) => {
				if (c.setInput) return
				self.app.tip.hide()
				c.callback(d)
			})

			.each(function (d) {
				const div = select(this)
				if (d.label) div.append('div').style('display', 'inline-block').html(d.label)
				if (d.setInput)
					d.setInput(
						div.append('div').style('display', 'inline-block')
						//.style('margin-left', '10px')
					)
			})

		menu.show(event.clientX, event.clientY)
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

	self.adjustColor = (value, d) => {
		const color = rgb(value).formatHex()
		const t2 = self.state.config.term2
		if (!t2) {
			self.app.dispatch({
				type: 'plot_edit',
				id: self.id,
				config: { settings: { survival: { defaultColor: color } } }
			})
		} else {
			const values = structuredClone(t2?.term.values || self.legendValues)
			const term2 = structuredClone(t2)
			term2.term.values = values
			if (!values) term2.term.values = { [d.seriesId]: {} }
			term2.term.values[d.seriesId].color = color
			self.app.dispatch({
				type: 'plot_edit',
				id: self.id,
				config: {
					term2
				}
			})
		}

		self.app.tip.hide()
	}

	self.showMenuForSelectedChart = function () {
		self.dom.tip.clear()
		self.activeMenu = true
		self.dom.tip
			.showunder(this)
			.d.append('button')
			.html('Download SVG')
			.on('click', () => {
				if (!self.state) return
				const chartDiv = select(this.closest('.pp-survival-chart'))
				downloadChart(
					chartDiv.select('.sjpp-survival-mainG'),
					'Survival_Plot',
					chartDiv.node() // use to get computed styles
				)
			})
	}
}

export async function getPlotConfig(opts, app) {
	if (!opts.term) throw 'survival getPlotConfig: opts.term{} missing'
	try {
		await fillTermWrapper(opts.term, app.vocabApi)
		// supply term0_term2_defaultQ if opts.term0/2.bins/q is undefined
		// so that term0_term2_defaultQ does not override bins or q from user
		if (opts.term2)
			await fillTermWrapper(opts.term2, app.vocabApi, opts.term2.bins || opts.term2.q ? null : term0_term2_defaultQ)
		if (opts.term0)
			await fillTermWrapper(opts.term0, app.vocabApi, opts.term0.bins || opts.term0.q ? null : term0_term2_defaultQ)
	} catch (e) {
		throw `${e} [survival getPlotConfig()]`
	}

	const config = {
		id: opts.term.term.id,
		settings: {
			controls: {
				term2: null, // the previous overlay value may be displayed as a convenience for toggling
				term0: null
			},
			survival: {
				radius: 5,
				ciVisible: true,
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
				seriesTipDecimals: 1,
				svgPadding: {
					top: 20,
					left: 55,
					right: 20,
					bottom: 50
				},
				axisTitleFontSize: 16,
				xAxisOffset: 5,
				yAxisOffset: -5,
				hiddenPvalues: [],
				defaultColor: '#2077b4'
			}
		}
	}

	// default survival settings will be overwritten by the survival settings defined in dataset
	const overrides = app.vocabApi.termdbConfig.survival || {}
	copyMerge(config.settings.survival, overrides.settings)

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
					'@done()': '=sortSerieses()'
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
				if (t0.q?.type == 'predefined-groupset' || t0.q?.type == 'custom-groupset') return row.chartId
				const value = self.state.config.term0.term.values[row.chartId]
				return value && value.label ? value.label : row.chartId
			},
			seriesLabel(row, context) {
				const t2 = self.state.config.term2
				if (!t2) return
				const seriesId = context.self.seriesId
				if (t2?.q?.type == 'predefined-groupset' || t2?.q?.type == 'custom-groupset') return seriesId
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
						// force x to start at 0 because first data point will always
						// be at x=0 (see survival.R)
						.domain([0, Math.min(s.maxTimeToEvent || context.self.xMax, context.self.xMax)])
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
			sortSerieses(result) {
				for (const series of result.serieses) {
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
				result.charts.sort(
					(a, b) =>
						(c.indexOf(a.chartId) == -1 ? c.indexOf(a.rawChartId) : c.indexOf(a.chartId)) -
						(c.indexOf(b.chartId) == -1 ? c.indexOf(b.rawChartId) : c.indexOf(b.chartId))
				)
			}
		}
	})

	return pj
}
