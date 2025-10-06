import { getCompInit, copyMerge } from '../rx'
import { controlsInit, term0_term2_defaultQ, renderTerm1Label } from './controls'
import { fillTermWrapper } from '#termsetting'
import { select } from 'd3-selection'
import { scaleLinear, scaleOrdinal } from 'd3-scale'
import { schemeCategory10 } from 'd3-scale-chromatic'
import { schemeCategory20 } from '#common/legacy-d3-polyfill'
import { axisLeft, axisBottom } from 'd3-axis'
import { line, area, curveStepAfter } from 'd3-shape'
import { rgb } from 'd3-color'
import htmlLegend from '#dom/html.legend'
import Partjson from 'partjson'
import { getSeriesTip } from '#dom/svgSeriesTips'
import { renderAtRiskG } from '#dom/renderAtRisk'
import { renderPvalues } from '#dom/renderPvalueTable'
import { Menu } from '#dom/menu'
import { getCombinedTermFilter } from '#filter'
import { PlotBase } from '#plots/PlotBase.js'

const t0_t2_defaultQ = structuredClone(term0_term2_defaultQ)
Object.assign(t0_t2_defaultQ, {
	numeric: {
		mode: 'discrete',
		type: 'custom-bin',
		preferredBins: 'median'
	}
})

/*
class Cuminc
- for cox regression cumulative incidence test
- simpler workflow relative to class MassCumInc:
	- input data is for a single chart
	- no hidden series
	- no skipped series
	- no skipped charts
*/
export class Cuminc extends PlotBase {
	constructor(opts) {
		this.type = 'cuminc'
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
			hiddenDiv: holder.append('div').style('margin', '5px 5px 15px 5px')
		}
		this.tip = new Menu({ padding: '5px' })
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
					click: e => this.legendClick(e.target.__data__, e.clientX, e.clientY)
				}
			}
		})
	}

	main(results) {
		this.config = structuredClone(this.state.config)
		if (this.config.term.term.type != 'condition') throw 'cuminc term is not a condition term'
		this.settings = this.config.settings.cuminc
		this.settings.xTitleLabel = 'Years since entry into the cohort' // TODO: do not harcode time unit (see survival.js)
		this.settings.atRiskVisible = false
		this.processResults(results)
		this.pj.refresh({ data: this.currData })
		this.setTerm2Color(this.pj.tree.charts)
		this.render()
	}

	processResults(results) {
		const chartIds = Object.keys(results)
		if (chartIds.length != 1) throw 'must be a single chart'
		const chartId = chartIds[0]
		const chart = results[chartId]
		this.currData = []
		this.uniqueSeriesIds = new Set()
		// process cumulative incidence estimates
		for (const seriesId in chart.estimates) {
			const series = chart.estimates[seriesId]
			for (const timepoint of series) {
				const { time, est, low, up, nrisk, nevent, ncensor } = timepoint
				const d = {
					chartId,
					seriesId,
					time,
					cuminc: est * 100, // convert to percentage
					low: low * 100,
					high: up * 100,
					nrisk,
					nevent,
					ncensor
				}
				this.currData.push(d)
				this.uniqueSeriesIds.add(d.seriesId)
			}
		}
		// process results of Grey's tests
		this.tests = {}
		if (chart.tests?.length != 1) throw 'must have a single test'
		const test = chart.tests[0]
		this.tests[chartId] = [
			{
				pvalue: { id: 'pvalue', text: test.permutation ? test.pvalue + '*' : test.pvalue },
				series1: { id: test.series1 },
				series2: { id: test.series2 },
				permutation: test.permutation
			}
		]

		this.refs = {}
	}

	setTerm2Color(charts) {
		if (!charts) return
		if (charts.length != 1) throw 'should be a single chart'
		const chart = charts[0]
		this.term2toColor = {}
		this.colorScale = this.uniqueSeriesIds.size < 11 ? scaleOrdinal(schemeCategory10) : scaleOrdinal(schemeCategory20)
		const legendItems = []
		for (const series of chart.serieses) {
			const color = this.config.term2?.term.values?.[series.seriesId]?.color
			const c = {
				orig: color || (series.seriesId == '' ? this.settings.defaultColor : this.colorScale(series.seriesId))
			}
			c.rgb = rgb(c.orig)
			c.adjusted = c.rgb.toString()
			this.term2toColor[series.seriesId] = c

			if (!legendItems.find(d => d.seriesId == series.seriesId)) {
				legendItems.push({
					seriesId: series.seriesId,
					text: series.seriesLabel,
					color: this.term2toColor[series.seriesId].adjusted
				})
			}
		}
		if (this.config.term2 && legendItems.length) {
			this.legendData = [
				{
					name: this.config.term2.term.name,
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
			} else if (key.startsWith('series')) {
				// series of test
				const item = legendItems.find(item => item.seriesId == test[key].id)
				test[key].color = item.color
				test[key].text = item.text
			} else {
				// permutation flag
				continue
			}
		}
	}
}

/*
class MassCumInc
- for general cumulative incidence analysis
- input data is for one or more charts
*/
class MassCumInc {
	constructor(opts) {
		this.type = 'cuminc'
		this.chartIncrement = 0
	}

	async init(appState) {
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
			legendDiv: holder.append('div').style('margin', '5px'),
			hiddenDiv: holder.append('div').style('margin', '5px 5px 15px 5px')
		}
		this.tip = new Menu({ padding: '5px' })

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
					click: e => this.hideLegendItem(e.target.__data__)
				}
			}
		})
		await this.setControls(appState)
	}

	async setControls(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (this.opts.controls) {
			this.opts.controls.on('downloadClick.cuminc', this.download)
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
						{
							type: 'term',
							configKey: 'term',
							chartType: 'cuminc',
							usecase: { target: 'cuminc', detail: 'term' },
							label: renderTerm1Label,
							vocabApi: this.app.vocabApi,
							menuOptions: 'edit'
						},
						{
							type: 'term',
							configKey: 'term2',
							chartType: 'cuminc',
							usecase: { target: 'cuminc', detail: 'term2' },
							title: 'Overlay data',
							label: 'Overlay',
							vocabApi: this.app.vocabApi,
							numericEditMenuVersion: ['discrete'],
							defaultQ4fillTW: t0_t2_defaultQ
						},
						{
							type: 'term',
							configKey: 'term0',
							chartType: 'cuminc',
							usecase: { target: 'cuminc', detail: 'term0' },
							title: 'Divide by data',
							label: 'Divide by',
							vocabApi: this.app.vocabApi,
							numericEditMenuVersion: ['discrete'],
							defaultQ4fillTW: t0_t2_defaultQ
						},
						{
							label: 'Minimum sample size of series',
							type: 'number',
							chartType: 'cuminc',
							settingsKey: 'minSampleSize'
						},
						{
							label: 'Minimum at-risk count of event',
							type: 'number',
							chartType: 'cuminc',
							settingsKey: 'minAtRisk'
						},
						{
							label: 'Chart width',
							type: 'number',
							chartType: 'cuminc',
							settingsKey: 'svgw',
							title: 'The internal width of the chart plot'
						},
						{
							label: 'Chart height',
							type: 'number',
							chartType: 'cuminc',
							settingsKey: 'svgh',
							title: 'The internal height of the chart plot'
						},
						{
							label: 'X-axis ticks',
							type: 'text',
							chartType: 'cuminc',
							settingsKey: 'xTickValues',
							placeholder: 'tick,tick,...',
							processInput: value => (value ? value.split(',').map(Number) : [])
						},
						{
							label: 'Y-axis ticks',
							type: 'text',
							chartType: 'cuminc',
							settingsKey: 'yTickValues',
							placeholder: 'tick,tick,...',
							processInput: value => (value ? value.split(',').map(Number) : [])
						},
						{
							label: 'At-risk counts',
							boxLabel: 'Visible',
							type: 'checkbox',
							chartType: 'cuminc',
							settingsKey: 'atRiskVisible',
							title: 'Display the at-risk counts'
						},
						{
							label: '95% confidence interval',
							boxLabel: 'Visible',
							type: 'checkbox',
							chartType: 'cuminc',
							settingsKey: 'ciVisible'
						},
						{
							label: 'Default color',
							type: 'color',
							chartType: 'cuminc',
							settingsKey: 'defaultColor'
						}
					]
				})
			}

			this.components.controls.on('downloadClick.cuminc', this.download)
		}
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		const parentConfig = this.parentId && appState.plots.find(p => p.id === this.parentId)
		const termfilter = getCombinedTermFilter(appState, config.filter || parentConfig?.filter)

		return {
			genome: this.app.vocabApi.vocab.genome,
			dslabel: this.app.vocabApi.vocab.dslabel,
			activeCohort: appState.activeCohort,
			termfilter,
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
			this.config = structuredClone(this.state.config)

			if (this.dom.header)
				this.dom.header.html(
					this.state.config.term.term.name +
						' <span style="opacity:.6;font-size:.7em;margin-left:10px;">CUMULATIVE INCIDENCE</span>'
				)

			if (this.config.term.term.type != 'condition') throw 'cuminc term is not a condition term'
			this.toggleLoadingDiv()
			Object.assign(this.settings, this.config.settings)
			this.settings.defaultHidden = this.getDefaultHidden()
			this.settings.hidden = this.settings.customHidden || this.settings.defaultHidden
			this.settings.xTitleLabel = 'Years since diagnosis' // TODO: do not harcode time unit (see survival.js)
			const reqOpts = this.getDataRequestOpts()
			const results = await this.app.vocabApi.getNestedChartSeriesData(reqOpts)
			if (results.error) throw results.error
			this.toggleLoadingDiv('none')
			this.app.vocabApi.syncTermData(this.config, results)
			this.processResults(results)
			this.pj.refresh({ data: this.currData })
			this.sortSerieses(this.pj.tree.charts)
			this.setTerm2Color(this.pj.tree.charts)
			this.render()
		} catch (e) {
			console.error(e)
		}
	}

	// creates an opts object for the vocabApi.getNestedChartsData()
	getDataRequestOpts() {
		const c = this.config
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

	getDefaultHidden() {
		const hidden = []
		const term2 = this.config.term2
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

	processResults(results) {
		const s = this.settings
		const c = this.config
		const estimates = {}
		const tests = {}
		const lowSampleSize = results.lowSampleSize
		const noEvents = results.noEvents
		this.currData = []
		this.uniqueSeriesIds = new Set()
		this.tests = {}
		this.noData = []
		this.refs = results.refs

		// filter the data
		for (const chartId in results.data) {
			const chart = results.data[chartId]
			// filter the estimates
			if (chart.estimates) {
				for (const seriesId in chart.estimates) {
					const series = chart.estimates[seriesId]
					if (!series.filter(timepoint => timepoint.nrisk >= s.minAtRisk && timepoint.est > 0).length) {
						// discard series with no events after applying
						// the at-risk count filter
						chartId in noEvents ? noEvents[chartId].push(seriesId) : (noEvents[chartId] = [seriesId])
						continue
					}
					chartId in estimates ? (estimates[chartId][seriesId] = series) : (estimates[chartId] = { [seriesId]: series })
				}
				if (!(chartId in estimates)) this.noData.push(chartId)
			} else {
				// chart does not have any data
				this.noData.push(chartId)
			}
			// filter the tests
			if (chart.tests) {
				// discard tests that have series that are either
				// discarded or hidden
				tests[chartId] = chart.tests.filter(
					test =>
						test.series1 in estimates[chartId] &&
						test.series2 in estimates[chartId] &&
						!s.hidden.includes(test.series1) &&
						!s.hidden.includes(test.series2)
				)
			}
		}

		// process the filtered data
		// process estimates
		for (const chartId in estimates) {
			const chart = estimates[chartId]
			for (const seriesId in chart) {
				const series = chart[seriesId]
				for (const timepoint of series) {
					const { time, est, low, up, nrisk, nevent, ncensor } = timepoint
					const d = {
						chartId,
						seriesId,
						time,
						cuminc: est * 100, // convert to percentage
						low: low * 100,
						high: up * 100,
						nrisk,
						nevent,
						ncensor
					}
					if (d.nrisk < s.minAtRisk) {
						// keep the first timepoint with a low at-risk count and
						// drop the remaining timepoints
						// this will allow the curve to extend horizontally up to
						// this timepoint
						this.currData.push(d)
						break
					}
					this.currData.push(d)
					this.uniqueSeriesIds.add(d.seriesId)
				}
			}
		}
		// process tests
		for (const chartId in tests) {
			for (const test of tests[chartId]) {
				const d = {
					pvalue: { id: 'pvalue', text: test.permutation ? test.pvalue + '*' : test.pvalue },
					series1: { id: test.series1 },
					series2: { id: test.series2 },
					permutation: test.permutation
				}
				chartId in this.tests ? this.tests[chartId].push(d) : (this.tests[chartId] = [d])
			}
		}

		// convert series ids to labels if necessary
		this.lowSampleSize = {}
		for (const chartId in lowSampleSize) {
			this.lowSampleSize[chartId] = lowSampleSize[chartId].map(
				seriesId => c.term2?.term.values?.[seriesId]?.label || seriesId
			)
		}
		this.noEvents = {}
		for (const chartId in noEvents) {
			this.noEvents[chartId] = noEvents[chartId].map(seriesId => c.term2?.term.values?.[seriesId]?.label || seriesId)
		}
	}

	sortSerieses(charts) {
		if (!charts) return
		for (const chart of charts) {
			// sort series of chart by sorting series that are not hidden by
			// default ahead of series that are hidden by default
			// this will ensure that the default visible series are
			// assigned the first colors of the color scheme, which
			// tend to be colors with the best contrasts
			// NOTE: do not sort by this.settings.hidden because the color
			// assignments will change when a series changes to hidden/visible
			const seriesIDs = chart.serieses.map(series => series.seriesId)
			const seriesOrder = [
				...seriesIDs.filter(seriesId => !this.settings.defaultHidden.includes(seriesId)),
				...seriesIDs.filter(seriesId => this.settings.defaultHidden.includes(seriesId))
			]
			chart.serieses.sort((a, b) => seriesOrder.indexOf(a.seriesId) - seriesOrder.indexOf(b.seriesId))
		}
	}

	setTerm2Color(charts) {
		if (!charts) {
			this.legendData = []
			return
		}
		this.term2toColor = {}
		this.colorScale = this.uniqueSeriesIds.size < 11 ? scaleOrdinal(schemeCategory10) : scaleOrdinal(schemeCategory20)
		const legendItems = []
		for (const chart of charts) {
			for (const series of chart.serieses) {
				const color = this.config.term2?.term.values?.[series.seriesId]?.color
				const c = {
					orig: color || (series.seriesId == '' ? this.settings.defaultColor : this.colorScale(series.seriesId))
				}
				c.rgb = rgb(c.orig)
				c.adjusted = c.rgb.toString()
				this.term2toColor[series.seriesId] = c

				if (!legendItems.find(d => d.seriesId == series.seriesId)) {
					legendItems.push({
						seriesId: series.seriesId,
						text: series.seriesLabel,
						color: this.term2toColor[series.seriesId].adjusted,
						isHidden: this.settings.hidden.includes(series.seriesId)
					})
				}
			}
		}
		if (this.config.term2 && legendItems.length) {
			this.legendData = [
				{
					name: this.config.term2.term.name,
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
					} else if (key.startsWith('series')) {
						// series of test
						const item = legendItems.find(item => item.seriesId == test[key].id)
						test[key].color = item.color
						test[key].text = item.text
					} else {
						// permutation flag
						continue
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

export const cumincInit = getCompInit(MassCumInc)
// this alias will allow abstracted dynamic imports
export const componentInit = cumincInit

function setRenderers(self) {
	self.render = function () {
		const data = self.pj.tree.charts || []
		if (self.noData?.length) {
			// add in charts with no data
			data.push(
				...self.noData.map(chartId => {
					let chartTitle = chartId
					const t0 = self.config.term0
					if (t0) {
						if (t0.q?.type == 'predefined-groupset' || t0.q?.type == 'custom-groupset') return { chartId, chartTitle }
						if (t0.term.values) {
							const value = t0.term.values[chartId]
							if (value && value.label) chartTitle = value.label
						}
					}
					return { chartId, chartTitle }
				})
			)
		}
		const chartDivs = self.dom.chartsDiv.selectAll('.pp-cuminc-chart').data(data, d => d.chartId)
		chartDivs.exit().remove()
		chartDivs.each(self.updateCharts)
		chartDivs.enter().each(self.addCharts)

		self.dom.holder.style('display', 'inline-block')
		self.dom.chartsDiv.on('mouseover', self.mouseover).on('mouseout', self.mouseout)

		self.legendRenderer(self.settings.atRiskVisible ? [] : self.legendData)

		if (!self.hiddenData?.[0]?.items.length || !self.config.term2) self.dom.hiddenDiv.style('display', 'none')
		else {
			self.dom.hiddenDiv.style('display', '')
			self.hiddenRenderer(self.hiddenData)
		}
	}

	self.addCharts = function (chart) {
		const s = self.settings

		const div = select(this)
			.append('div')
			.attr('class', 'pp-cuminc-chart')
			.style('opacity', chart.serieses ? 0 : 1) // if the data can be plotted, slowly reveal plot
			.style('display', 'inline-block')
			.style('margin', s.chartMargin + 'px')
			.style('padding', '10px')
			.style('top', 0)
			.style('left', 0)
			.style('text-align', 'center')
			.style('vertical-align', 'top')
			.style('background', 1 || s.orderChartsBy == 'organ-system' ? chart.color : '')

		div
			.append('div')
			.attr('class', 'sjpcb-cuminc-title')
			.style('text-align', 'center')
			.style('width', `${s.svgw + 50}px`)
			.style('height', s.chartTitleDivHt + 'px')
			.style('font-weight', '600')
			.style('margin', '5px')
			.datum(chart.chartId)
			.html(chart.chartTitle)

		if (self.hidePlotTitle) div.select('.sjpcb-cuminc-title').style('display', 'none')

		div
			.append('div')
			.attr('class', 'pp-cuminc-chart-noData')
			.style('display', 'none')
			.style('width', `${s.svgw + 50}px`)
			.style('margin', '40px 5px')
			.text('No cumulative incidence data')

		if (chart.serieses) {
			// series in chart
			setVisibleSerieses(chart, s)

			const svg = div.append('svg').attr('class', 'pp-cuminc-svg')
			renderSVG(svg, chart, s)

			div.style('opacity', 1)
		} else {
			// no series in chart
			div.select('.pp-cuminc-chart-noData').style('display', 'block')
		}

		// div for chart-specific legends
		div
			.append('div')
			.attr('class', 'pp-cuminc-chartLegends')
			.style('vertical-align', 'top')
			.style('text-align', chart.serieses ? 'left' : 'center')
			.style('margin', chart.serieses ? '10px 30px 0px 20px' : '0px')
			.style('display', 'none')

		if (self.tests && chart.chartId in self.tests) {
			// p-values legend
			const holder = div
				.select('.pp-cuminc-chartLegends')
				.style('display', 'inline-block')
				.append('div')
				.style('margin-bottom', '30px')
			renderPvalues({
				title: "Group comparisons (Gray's test)",
				holder,
				plot: 'cuminc',
				tests: self.tests[chart.chartId],
				s,
				bins: self.refs.bins
			})
		}

		if (self.noEvents && chart.chartId in self.noEvents) {
			// legend for series with no events
			const skipdiv = div
				.select('.pp-cuminc-chartLegends')
				.style('display', 'inline-block')
				.append('div')
				.style('margin-bottom', '30px')
			const title = 'Skipped series (no events)'
			renderSkippedSeries(skipdiv, title, self.noEvents[chart.chartId], s)
		}

		if (self.lowSampleSize && chart.chartId in self.lowSampleSize) {
			// legend for series with low sample size
			const skipdiv = div
				.select('.pp-cuminc-chartLegends')
				.style('display', 'inline-block')
				.append('div')
				.style('margin-bottom', '30px')
			const title = 'Skipped series (low sample size)'
			renderSkippedSeries(skipdiv, title, self.lowSampleSize[chart.chartId], s)
		}
	}

	function setVisibleSerieses(chart, s) {
		chart.visibleSerieses = s.hidden
			? chart.serieses.filter(series => !s.hidden.includes(series.seriesId))
			: chart.serieses
	}

	self.updateCharts = function (chart) {
		const s = self.settings

		const div = select(this)

		div.style('background', 1 || s.orderChartsBy == 'organ-system' ? chart.color : '')

		div
			.select('.sjpcb-cuminc-title')
			.style('width', `${s.svgw + 50}px`)
			.style('height', s.chartTitleDivHt + 'px')
			.datum(chart.chartId)
			.html(chart.chartTitle)

		if (self.hidePlotTitle) div.select('.sjpcb-cuminc-title').style('display', 'none')

		div.selectAll('.sjpcb-lock-icon').style('display', s.scale == 'byChart' ? 'block' : 'none')

		div.selectAll('.sjpcb-unlock-icon').style('display', s.scale == 'byChart' ? 'none' : 'block')

		if (chart.serieses) {
			div.select('.pp-cuminc-chart-noData').style('display', 'none')

			setVisibleSerieses(chart, s)

			renderSVG(div.select('svg'), chart, s)
		} else {
			div
				.select('.pp-cuminc-chart-noData')
				.style('display', 'block')
				.style('width', `${s.svgw + 50}px`)
			div.select('svg').remove()
			div.select('.pp-cuminc-chartLegends').style('text-align', 'center').style('margin', '0px')
		}

		// div for chart-specific legends
		div.select('.pp-cuminc-chartLegends').selectAll('*').remove()

		if (self.tests && chart.chartId in self.tests) {
			// p-values legend
			const holder = div
				.select('.pp-cuminc-chartLegends')
				.style('display', 'inline-block')
				.append('div')
				.style('margin-bottom', '30px')
			renderPvalues({
				title: "Group comparisons (Gray's test)",
				holder,
				plot: 'cuminc',
				tests: self.tests[chart.chartId],
				s,
				bins: self.refs.bins
			})
		}

		if (self.noEvents && chart.chartId in self.noEvents) {
			// legend for series with no events
			const skipdiv = div
				.select('.pp-cuminc-chartLegends')
				.style('display', 'inline-block')
				.append('div')
				.style('margin-bottom', '30px')
			const title = 'Skipped series (no events)'
			renderSkippedSeries(skipdiv, title, self.noEvents[chart.chartId], s)
		}

		if (self.lowSampleSize && chart.chartId in self.lowSampleSize) {
			// legend for series with low sample size
			const skipdiv = div
				.select('.pp-cuminc-chartLegends')
				.style('display', 'inline-block')
				.append('div')
				.style('margin-bottom', '30px')
			const title = 'Skipped series (low sample size)'
			renderSkippedSeries(skipdiv, title, self.lowSampleSize[chart.chartId], s)
		}
	}

	function renderSVG(svg, chart, s) {
		const extraHeight = s.atRiskVisible
			? s.axisTitleFontSize + 4 + chart.visibleSerieses.length * 2 * s.axisTitleFontSize
			: 0

		svg
			.attr('width', s.svgw)
			.attr('height', s.svgh + extraHeight)
			.style('overflow', 'visible')
			.style('padding-left', '20px')

		/* eslint-disable */
		const [clipRect, clipG, mainG, seriesesG, axisG, xAxis, yAxis, xTitle, yTitle, atRiskG, plotRect] = getSvgSubElems(
			svg,
			chart
		)
		/* eslint-enable */

		// set dimensions of clipRect
		// will be same as those of plotRect
		clipRect
			.attr('x', 0)
			.attr('width', s.svgw - s.svgPadding.left - s.svgPadding.right)
			.attr('y', 0)
			.attr('height', s.svgh - s.svgPadding.top - s.svgPadding.bottom + s.xAxisOffset)

		const xOffset = s.svgPadding.left
		mainG.attr('transform', 'translate(' + xOffset + ',' + s.svgPadding.top + ')')
		const serieses = seriesesG
			.selectAll('.sjpcb-cuminc-series')
			.data(chart.visibleSerieses, d => (d && d[0] ? d[0].seriesId : ''))

		serieses.exit().remove()
		serieses.each(function (series, i) {
			renderSeries(select(this), series, s)
		})
		serieses
			.enter()
			.append('g')
			.attr('class', 'sjpcb-cuminc-series')
			.each(function (series, i) {
				renderSeries(select(this), series, s)
			})

		renderAxes(xAxis, xTitle, yAxis, yTitle, s, chart)
		renderAtRiskG({
			g: atRiskG,
			s,
			chart,
			term2values: self.config.term2?.values,
			term2toColor: self.term2toColor,
			onSerieClick: self.legendClick
		})

		plotRect
			.attr('x', 0)
			.attr('width', s.svgw - s.svgPadding.left - s.svgPadding.right)
			.attr('y', 0)
			.attr('height', s.svgh - s.svgPadding.top - s.svgPadding.bottom + s.xAxisOffset)

		svg.seriesTip.update({
			xScale: chart.xScale,
			xTitleLabel: s.xTitleLabel,
			decimals: s.seriesTipDecimals,
			serieses: chart.visibleSerieses.map(s => {
				const seriesLabel = s.seriesLabel ? `${s.seriesLabel}:` : 'Cumulative Incidence:'
				const color = self.term2toColor[s.seriesId].adjusted
				return {
					data: s.data.map(d => {
						return {
							x: d.x,
							html:
								`<span style='color: ${color}'>` +
								`${seriesLabel} ${d.y.toFixed(2)} (${d.low.toFixed(2)} - ${d.high.toFixed(2)})` +
								`</span>`
						}
					})
				}
			})
		})
	}

	function renderSkippedSeries(div, title, serieses, s) {
		const fontSize = s.axisTitleFontSize - 2

		div.selectAll('*').remove()

		if (!serieses.some(v => v)) {
			// no series defined, so do not render legend
			return
		}

		// title div
		div
			.append('div')
			.style('padding-bottom', '5px')
			.style('font-size', fontSize + 'px')
			.style('font-weight', 'bold')
			.text(title)

		// serieses div
		const seriesesDiv = div
			.append('div')
			.style('padding-bottom', '5px')
			.style('font-size', fontSize + 'px')

		seriesesDiv
			.selectAll('div')
			.data(serieses)
			.enter()
			.append('div')
			.attr('class', 'pp-cuminc-chartLegends-skipped')
			.text(d => d)
	}

	function getSvgSubElems(svg, chart) {
		let clipRect, clipG, mainG, seriesesG, axisG, xAxis, yAxis, xTitle, yTitle, atRiskG, plotRect, line
		if (!svg.select('.sjpcb-cuminc-mainG').size()) {
			const clipId = `${self.id}-${self.chartIncrement++}`
			clipRect = svg.append('defs').append('clipPath').attr('id', clipId).append('rect')
			clipG = svg.append('g').attr('class', 'sjpcb-cuminc-clipG')
			mainG = svg.append('g').attr('class', 'sjpcb-cuminc-mainG').attr('data-testid', 'sja-cuminc-main-g')
			seriesesG = mainG.append('g').attr('class', 'sjpcb-cuminc-seriesesG').attr('clip-path', `url(#${clipId})`)
			axisG = mainG.append('g').attr('class', 'sjpcb-cuminc-axis')
			xAxis = axisG.append('g').attr('class', 'sjpcb-cuminc-x-axis')
			yAxis = axisG.append('g').attr('class', 'sjpcb-cuminc-y-axis')
			xTitle = axisG.append('g').attr('class', 'sjpcb-cuminc-x-title')
			yTitle = axisG.append('g').attr('class', 'sjpcb-cuminc-y-title')
			atRiskG = mainG.append('g').attr('class', 'sjpp-cuminc-atrisk')

			line = mainG
				.append('line')
				.attr('class', 'sjpcb-plot-tip-line')
				.attr('stroke', '#000')
				.attr('stroke-width', '2px')
			plotRect = mainG.append('rect').attr('class', 'sjpcb-plot-tip-rect').style('fill', 'transparent')
		} else {
			clipRect = svg.select('defs clipPath rect')
			clipG = svg.select('.sjpcb-cuminc-clipG')
			mainG = svg.select('.sjpcb-cuminc-mainG')
			seriesesG = mainG.select('.sjpcb-cuminc-seriesesG')
			axisG = mainG.select('.sjpcb-cuminc-axis')
			xAxis = axisG.select('.sjpcb-cuminc-x-axis')
			yAxis = axisG.select('.sjpcb-cuminc-y-axis')
			xTitle = axisG.select('.sjpcb-cuminc-x-title')
			yTitle = axisG.select('.sjpcb-cuminc-y-title')
			atRiskG = mainG.select('.sjpp-cuminc-atrisk')
			plotRect = mainG.select('.sjpcb-plot-tip-rect')
			line = mainG.select('.sjpcb-plot-tip-line')
		}

		if (!svg.seriesTip) {
			svg.seriesTip = getSeriesTip(line, plotRect, self.app?.tip)
		}

		return [clipRect, clipG, mainG, seriesesG, axisG, xAxis, yAxis, xTitle, yTitle, atRiskG, plotRect]
	}

	function renderSeries(g, series, s) {
		g.selectAll('path').remove()

		// cumulative incidence line
		g.append('path')
			.attr('d', self.lineFxn(series.data.map(d => ({ scaledX: d.scaledX, scaledY: d.scaledY[0] }))))
			.style('fill', 'none')
			.style('stroke', self.term2toColor[series.seriesId].adjusted)
			.style('stroke-width', 2)
			.style('stroke-linecap', 'square')
			.style('opacity', 1)
			.style('stroke-opacity', 1)

		// confidence intervals
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
	}

	function renderAxes(xAxis, xTitle, yAxis, yTitle, s, chart) {
		const xTicks = axisBottom(chart.xScale).tickValues(chart.xTickValues)
		const yTicks = axisLeft(chart.yScale).tickValues(chart.yTickValues)

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

		yAxis.attr('transform', `translate(${s.yAxisOffset + pixelOffset}, ${pixelOffset})`).call(yTicks)

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

	self.mouseover = function (event) {
		const d = event.target.__data__
		/*if (event.target.tagName == 'circle') {
			const label = labels[d.seriesName]
			const x = d.x.toFixed(1)
			const y = d.y.toPrecision(2)
			const rows = [
				`<tr><td colspan=2 style='text-align: center'>${
					d.seriesLabel ? d.seriesLabel : self.config.term.term.name
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

	self.mouseout = function () {
		self.app.tip.hide()
	}

	self.legendClick = function (d, x, y) {
		if (d === undefined) return
		const menu = self.tip.clear()
		if (self.config.term2 == null) {
			const color = rgb(self.settings.defaultColor).formatHex()
			const colorDiv = menu.d
				.append('div')
				.attr('class', 'sja_sharp_border')
				.style('padding', '0px 10px')
				.text('Edit color:')
			const input = colorDiv
				.append('input')
				.attr('type', 'color')
				.attr('value', color)
				.on('change', () => {
					const color = input.node().value
					self.app.dispatch({
						type: 'plot_edit',
						id: self.id,
						config: { settings: { cuminc: { defaultColor: color } } }
					})
					menu.hide()
				})
			menu.show(x, y)
			return
		}
		if (!d.seriesId) return

		menu.d
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text(`Hide`)
			.on('click', async e => {
				menu.hide()
				self.hideLegendItem(d)
			})
		let color = self.term2toColor[d.seriesId]?.adjusted
		if (color) {
			color = rgb(color).formatHex()
			const colorDiv = menu.d
				.append('div')
				.attr('class', 'sja_sharp_border')
				.style('padding', '0px 10px')
				.text('Edit color:')
			const input = colorDiv
				.append('input')
				.attr('type', 'color')
				.attr('value', color)
				.on('change', () => {
					const t2 = self.config.term2
					const term2 = structuredClone(t2)
					if (!term2.term.values) term2.term.values = { [d.seriesId]: {} }
					else if (!term2.term.values[d.seriesId]) term2.term.values[d.seriesId] = {}
					term2.term.values[d.seriesId].color = input.node().value
					self.app.dispatch({
						type: 'plot_edit',
						id: self.id,
						config: {
							term2
						}
					})
					menu.hide()
				})
		}
		menu.show(event.clientX, event.clientY)
	}

	self.hideLegendItem = function (d) {
		const hidden = self.settings.hidden.slice()
		const i = hidden.indexOf(d.seriesId)
		i == -1 ? hidden.push(d.seriesId) : hidden.splice(i, 1)
		self.app.dispatch({
			type: 'plot_edit',
			id: self.id,
			config: {
				settings: {
					cuminc: {
						customHidden: hidden
					}
				}
			}
		})
	}
}

const defaultSettings = JSON.stringify({
	controls: {
		term2: null, // the previous overlay value may be displayed as a convenience for toggling
		term0: null
	},
	cuminc: {
		minSampleSize: 10, // sent to server-side
		minAtRisk: 10,
		atRiskVisible: true,
		atRiskLabelOffset: -10,
		seriesTipDecimals: 0,
		ciVisible: true,
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
		xAxisOffset: 5,
		yAxisOffset: -5,
		defaultColor: '#2077b4'
	}
})

export async function getPlotConfig(opts, app) {
	if (!opts.term) throw 'cuminc: opts.term{} missing'
	try {
		await fillTermWrapper(opts.term, app.vocabApi, {
			condition: { mode: 'cuminc' }
		})
		// supply t0_t2_defaultQ if opts.term0/2.bins/q is undefined
		// so that t0_t2_defaultQ does not override bins or q from user
		if (opts.term2)
			await fillTermWrapper(opts.term2, app.vocabApi, opts.term2.bins || opts.term2.q ? null : t0_t2_defaultQ)
		if (opts.term0)
			await fillTermWrapper(opts.term0, app.vocabApi, opts.term0.bins || opts.term0.q ? null : t0_t2_defaultQ)
	} catch (e) {
		throw `${e} [cuminc getPlotConfig()]`
	}
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
			xMin: '>=x()',
			xMax: '<=x()',
			yMin: '>=yMin()',
			yMax: '<=yMax()',
			charts: [
				{
					chartId: '@key',
					chartTitle: '=chartTitle()',
					xMin: '>=x()',
					xMax: '<=x()',
					'__:xTickValues': '=xTickValues()',
					'__:yTickValues': '=yTickValues()',
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
				const cutoff = self.config.term.q.breaks[0]
				if (!row.chartId || row.chartId == '-') {
					return cutoff == 5 ? 'CTCAE grade 5' : `CTCAE grade ${cutoff}-5`
				}
				const t0 = self.config.term0
				if (!t0 || !t0.term.values) return row.chartId
				if (t0.q?.type == 'predefined-groupset' || t0.q?.type == 'custom-groupset') return row.chartId
				const value = self.config.term0.term.values[row.chartId]
				return value && value.label ? value.label : row.chartId
			},
			seriesLabel(row, context) {
				const t2 = self.config?.term2
				if (!t2) return context.self.seriesId
				const seriesId = context.self.seriesId
				if (t2?.q?.type == 'predefined-groupset' || t2?.q?.type == 'custom-groupset') return seriesId
				if (t2 && t2.term.values && seriesId in t2.term.values) return t2.term.values[seriesId].label
				return seriesId
			},
			x(row) {
				if (self.settings.hidden?.includes(row.seriesId)) return
				return row.time
			},
			yMin(row) {
				if (self.settings.hidden?.includes(row.seriesId)) return
				return self.settings.ciVisible ? row.low : row.cuminc
			},
			yMax(row) {
				if (self.settings.hidden?.includes(row.seriesId)) return
				return self.settings.ciVisible ? row.high : row.cuminc
			},
			xTickValues(row, context) {
				const s = self.settings
				if (s.xTickValues?.length) {
					// custom x-tick values
					return s.xTickValues
				} else {
					// compute x-tick values
					// uncomment .scale code when the control input is added
					const xMin = /*s.scale == 'byChart' ? context.self.xMin : */ context.root.xMin
					const xMax = /*s.scale == 'byChart' ? context.self.xMax : */ context.root.xMax
					return computeTickValues(xMin, xMax)
				}
			},
			xScale(row, context) {
				// scale axis according to tick values
				const s = self.settings
				const min = Math.min(...context.self.xTickValues)
				const max = Math.max(...context.self.xTickValues)
				return scaleLinear()
					.domain([min, max])
					.range([0, s.svgw - s.svgPadding.left - s.svgPadding.right])
			},
			scaledX(row, context) {
				const xScale = context.context.context.context.parent.xScale.clamp(false)
				return xScale(context.self.x)
			},
			yTickValues(row, context) {
				const s = self.settings
				if (s.yTickValues?.length) {
					// custom y-tick values
					return s.yTickValues
				} else {
					// compute y-tick values
					// uncomment .scale code when the control input is added
					const yMin = /*s.scale == 'byChart' ? context.self.yMin : */ context.root.yMin
					const yMax = /*s.scale == 'byChart' ? context.self.yMax : */ context.root.yMax
					return computeTickValues(yMin, yMax)
				}
			},
			yScale(row, context) {
				// scale axis according to tick values
				const s = self.settings
				const min = Math.min(...context.self.yTickValues)
				const max = Math.max(...context.self.yTickValues)
				return scaleLinear()
					.domain([max, min])
					.range([0, s.svgh - s.svgPadding.top - s.svgPadding.bottom])
			},
			scaledY(row, context) {
				const yScale = context.context.context.context.parent.yScale.clamp(false)
				const s = context.self
				return [yScale(s.y), yScale(s.low), yScale(s.high)]
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

function computeTickValues(min, max) {
	// compute width between ticks for a maximum of 5 ticks
	const tickWidth = (max - min) / 5
	// round tick width to the nearest 5
	const log = Math.floor(Math.log10(tickWidth))
	const tickWidth_rnd = Math.round(tickWidth / (5 * 10 ** log)) * (5 * 10 ** log) || 1 * 10 ** log
	// compute tick values using tick width
	const tickValues = []
	let tick = min
	while (tick <= Math.min(100, max + tickWidth_rnd)) {
		// using max + tickWidth_rnd to ensure that
		// the last tick will be greater than the max
		// value of the data
		tickValues.push(tick)
		tick = tick + tickWidth_rnd
	}
	if (!tickValues.includes(0)) tickValues.unshift(0)
	return tickValues
}
