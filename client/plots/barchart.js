import { getCompInit, copyMerge } from '../rx'
import rendererSettings from './bars.settings'
import barsRenderer from './bars.renderer'
import htmlLegend from '../dom/html.legend'
import svgLegend from '../dom/svg.legend'
import { select } from 'd3-selection'
import { scaleOrdinal } from 'd3-scale'
import { rgb } from 'd3-color'
import getHandlers from './barchart.events'
import { controlsInit } from './controls'
import { to_svg } from '../src/client'
import { renderTable } from '../dom/table'
import { fillTermWrapper } from '../termsetting/termsetting'
import { getColors } from '#shared/common'
import { mclass } from '#shared/common'

class Barchart {
	constructor(opts) {
		// rx.getComponentInit() will set this.app, this.id, this.opts
		this.type = 'barchart'
	}
	//freeze the api of this class. don't want embedder functions to modify it.
	preApiFreeze(api) {
		api.download = this.download
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
			banner: holder
				.append('div')
				.style('display', 'none')
				.style('text-align', 'center')
				.style('padding', '24px')
				.style('font-size', '16px')
				.style('color', '#aaa'),
			barDiv: holder.append('div'),
			legendDiv: holder.append('div').style('margin', '5px 5px 15px 5px')
		}
		if (this.dom.header) this.dom.header.html('Barchart')
		this.settings = JSON.parse(rendererSettings)

		setRenderers(this)
		setInteractivity(this)

		this.renderers = {}
		this.legendRenderer = htmlLegend(
			this.dom.legendDiv,
			{
				settings: {
					legendOrientation: 'vertical'
				},
				handlers: this.handlers
			},
			this.dom.barDiv
		)
		this.controls = {}
		this.term2toColor = {}
		await this.setControls(this.getState(appState))

		if (this.opts.bar_click_override) {
			// will use this as callback to bar click
			// and will not set up bar click menu
		} else if (!this.opts.bar_click_opts) {
			this.opts.bar_click_opts = ['hide_bar']
			if (this.app.getState().nav.header_mode === 'with_tabs') this.opts.bar_click_opts.push('add_filter')
		}
	}

	async setControls(state) {
		if (this.opts.controls) {
			this.opts.controls.on('downloadClick.barchart', this.download)
		} else {
			this.dom.holder
				.attr('class', 'pp-termdb-plot-viz')
				.style('display', 'inline-block')
				.style('min-width', '300px')
				.style('margin-left', '50px')

			const inputs = [
				'term1',
				{
					type: 'overlay',
					configKey: 'term2',
					chartType: 'barchart',
					usecase: { target: 'barchart', detail: 'term2', term1type: state.config.term.term.type },
					title: 'Overlay data',
					label: 'Overlay',
					vocabApi: this.app.vocabApi,
					numericEditMenuVersion: this.opts.numericEditMenuVersion || ['continuous', 'discrete']
				},
				{
					type: 'divideBy',
					configKey: 'term0',
					chartType: 'barchart',
					usecase: { target: 'barchart', detail: 'term0', term1type: state.config.term0?.term?.type },
					title: 'Divide by data',
					label: 'Divide by',
					vocabApi: this.app.vocabApi,
					numericEditMenuVersion: this.opts.numericEditMenuVersion || ['continuous', 'discrete']
				},
				{
					label: 'Orientation',
					type: 'radio',
					chartType: 'barchart',
					settingsKey: 'orientation',
					options: [{ label: 'Vertical', value: 'vertical' }, { label: 'Horizontal', value: 'horizontal' }]
				},
				{
					label: 'Scale',
					type: 'radio',
					chartType: 'barchart',
					settingsKey: 'unit',
					options: [
						{ label: 'Linear', value: 'abs' },
						{ label: 'Log', value: 'log', getDisplayStyle: plot => (plot.term2 ? 'none' : 'inline-block') },
						{ label: 'Proportion', value: 'pct', getDisplayStyle: plot => (plot.term2 ? 'inline-block' : 'none') }
					]
				},
				{
					label: 'Multicolor bars',
					title: 'Colors bars using the colors preassigned if available, otherwise generates a color',
					type: 'checkbox',
					chartType: 'barchart',
					settingsKey: 'colorBars',
					boxLabel: 'Yes',
					getDisplayStyle: plot => (plot.term2 ? 'none' : 'table-row')
				},
				{
					label: 'Default color',
					title: 'Default color for bars when there is no overlay',
					type: 'color',
					chartType: 'barchart',
					settingsKey: 'defaultColor',
					getDisplayStyle: plot => (plot.settings.barchart.colorBars || plot.term2 ? 'none' : 'table-row')
				}
			]

			if (this.app.getState().termdbConfig.multipleTestingCorrection) {
				// a checkbox to allow users to show or hide asterisks on bars
				inputs.push({
					label: 'Asterisks',
					boxLabel: 'Visible',
					type: 'checkbox',
					chartType: 'barchart',
					settingsKey: 'asterisksVisible',
					title: 'Display the asterisks'
				})
			}
			this.components = {
				controls: await controlsInit({
					app: this.app,
					id: this.id,
					holder: this.dom.controls.attr('class', 'pp-termdb-plot-controls').style('display', 'inline-block'),
					inputs
				})
			}

			this.components.controls.on('downloadClick.barchart', this.download)
		}
	}

	reactsTo(action) {
		if (action.type.startsWith('plot_')) {
			return action.id === this.id && (!action.config.childType || action.config.childType == this.type)
		}
		return true
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}

		return {
			nav: {
				header_mode: appState.nav.header_mode
			},
			termfilter: appState.termfilter,
			config: Object.assign({}, config, {
				settings: {
					barchart: config.settings.barchart,
					common: config.settings.common
				},
				displaySampleIds: appState.termdbConfig.displaySampleIds && this.app.vocabApi.hasVerifiedToken()
			}),
			multipleTestingCorrection: appState.termdbConfig.multipleTestingCorrection,
			bar_click_menu: appState.bar_click_menu || {}
		}
	}

	async main() {
		const c = this.state.config
		if (c.chartType != this.type && c.childType != this.type) return
		try {
			this.config = structuredClone(c)
			if (!this.currServerData) this.dom.barDiv.style('max-width', window.innerWidth + 'px')
			this.prevConfig = this.config || {}
			if (this.dom.header)
				this.dom.header.html(
					this.config.term.term.name + ` <span style="opacity:.6;font-size:.7em;margin-left:10px;">BARCHART</span>`
				)

			this.toggleLoadingDiv()

			const reqOpts = this.getDataRequestOpts()
			await this.getDescrStats()
			const results = await this.app.vocabApi.getNestedChartSeriesData(reqOpts)
			const data = results.data
			this.samples = results.samples
			this.bins = results.bins
			this.toggleLoadingDiv('none')
			this.app.vocabApi.syncTermData(this.config, data, this.prevConfig)
			this.currServerData = data
			if (this.currServerData.refs && this.currServerData.refs.q) {
				for (const q of this.currServerData.refs.q) {
					if (q.error) throw q.error
				}
			}

			this.term1toColor = {}
			this.term2toColor = {} // forget any assigned overlay colors when refreshing a barchart
			this.updateSettings(this.config)
			this.colorScale = getColors(this.config.term.term2 ? this.settings.cols.length : this.settings.rows.length)

			this.chartsData = this.processData(this.currServerData)
			this.render()
		} catch (e) {
			throw e
		}
	}

	// creates an opts object for the vocabApi.getNestedChartsData()
	getDataRequestOpts() {
		const c = this.config
		const opts = { term: c.term, filter: this.state.termfilter.filter }
		if (c.term2) opts.term2 = c.term2
		if (c.term0) opts.term0 = c.term0
		return opts
	}

	async getDescrStats() {
		// get descriptive statistics for numerical terms
		const terms = [this.config.term]
		if (this.config.term2) terms.push(this.config.term2)
		if (this.config.term0) terms.push(this.config.term0)
		for (const t of terms) {
			if (t.term.type == 'integer' || t.term.type == 'float') {
				const data = await this.app.vocabApi.getDescrStats(t.id, this.state.termfilter.filter)
				if (data.error) throw data.error
				t.q.descrStats = data.values
			}
		}
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
			asterisksVisible: config.settings.barchart.asterisksVisible,
			defaultColor: config.settings.barchart.defaultColor,
			colorBars: config.settings.barchart.colorBars,
			// normalize bar thickness regardless of orientation
			colw: config.settings.common.barwidth,
			rowh: config.settings.common.barwidth,
			colspace: config.settings.common.barspace,
			rowspace: config.settings.common.barspace
		}

		/* mayResetHidden() was added before to prevent showing empty chart due to automatic hiding uncomputable categories
		this has following problems:
		1. when term1=diaggrp and term2=hrtavg, uncomputable categories from term2 can show up by default.
		2. inconsistent behavior: when term1=agedx, term2=hrtavg the uncomputable categories are hidden by default

		side effect of disabling this function can cause empty chart, but seems to be minor given above
		*/
		//this.mayResetHidden(this.config.term, this.config.term2, this.config.term0)

		this.setExclude(this.config.term, this.config.term2)
		Object.assign(this.settings, settings, this.currServerData.refs || {}, {
			exclude: this.settings.exclude
		})

		this.settings.numCharts = this.currServerData.charts ? this.currServerData.charts.length : 0
		if (!config.term2 && this.settings.unit == 'pct') {
			this.settings.unit = 'abs'
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
		this.settings.exclude.cols = Object.keys(term.q?.hiddenValues || {})
			.filter(id => term.q.hiddenValues[id])
			.map(id => {
				return term.term.type == 'categorical'
					? id
					: this.settings.cols?.includes(id)
					? id
					: term.term.values[id]?.label
					? term.term.values[id].label
					: id
			})

		this.settings.exclude.rows = !term2?.q?.hiddenValues
			? []
			: Object.keys(term2.q.hiddenValues)
					.filter(id => term2.q.hiddenValues[id])
					.map(id =>
						term2.term.type == 'categorical'
							? id
							: this.settings.rows?.includes(id)
							? id
							: term2.term.values[id]?.label
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

		const t1 = this.config.term
		const t2 = this.config.term2
		const chartsTests = chartsData.tests

		//get term1 and term2 labels
		for (const chartId in chartsTests) {
			const chartTests = chartsTests[chartId]
			for (const t1c of chartTests) {
				const t1label =
					t1.term.values && t1c.term1comparison in t1.term.values
						? t1.term.values[t1c.term1comparison].label
						: t1c.term1comparison
				t1c.term1Label = t1label

				for (const t2t of t1c.term2tests) {
					const t2label =
						t2.term.values && t2t.term2id in t2.term.values ? t2.term.values[t2t.term2id].label : t2t.term2id
					t2t.term2Label = t2label
				}
			}
		}
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
					data.seriesId = series.seriesId
					if (t1.term.type == 'geneVariant' || t2?.term.type == 'geneVariant') {
						//when term1 or term2 is a geneVariant term, totalsByDataId: {dataId: {chartId:total, ...}, ...}
						if (!(data.dataId in this.totalsByDataId)) {
							this.totalsByDataId[data.dataId] = {}
						}
						this.totalsByDataId[data.dataId][chart.chartId] = this.totalsByDataId[data.dataId][chart.chartId]
							? this.totalsByDataId[data.dataId][chart.chartId] + data.total
							: 0 + data.total
					} else {
						//when term1 or term2 isn't a geneVariant term, totalsByDataId: {dataId: total, ...}
						if (!(data.dataId in this.totalsByDataId)) {
							this.totalsByDataId[data.dataId] = 0
						}
						this.totalsByDataId[data.dataId] += data.total
					}
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
		this.term1toColor[series.seriesId] = this.settings.colorBars
			? this.getColor(this.config.term.term, series.seriesId, this.bins?.[1])
			: this.settings.defaultColor

		series.visibleData.sort(this.overlaySorter)
		let seriesLogTotal = 0
		for (const result of series.visibleData) {
			result.colgrp = '-'
			result.rowgrp = '-'
			result.chartId = chart.chartId
			result.seriesId = series.seriesId
			if (chartsData.tests) {
				// statistical tests result exist
				// put the pvalues corresponding to series.seriesId to result.groupPvalues
				result.groupPvalues = chartsData.tests[chart.chartId].find(x => x.term1comparison === series.seriesId)
			}
			result.seriesTotal = series.total
			result.chartTotal = chart.visibleTotal
			result.logTotal = Math.log10(result.total)
			seriesLogTotal += result.logTotal
			this.setTerm2Color(result)
			result.color = this.term2toColor[result.dataId] || this.term1toColor[series.seriesId]
		}
		if (seriesLogTotal > chart.maxSeriesLogTotal) {
			chart.maxSeriesLogTotal = seriesLogTotal
		}
		// assign color to hidden data for use in legend
		for (const result of series.data) {
			if (result.color) continue
			this.setTerm2Color(result)
			result.color = this.term2toColor[result.dataId] || this.term1toColor[series.seriesId]
		}
	}

	setTerm2Color(result) {
		if (!this.config.term2) return
		this.term2toColor[result.dataId] = this.getColor(this.config.term2.term, result.dataId, this.bins?.[2])
	}

	getColor(term, label, bins) {
		if (!term) return
		if (term.values) {
			for (const [key, v] of Object.entries(term.values)) {
				if (!v.color) continue
				if (key === label) return v.color
				if (v.label === label) return v.color
			}
		}
		const bin = bins?.find(bin => bin.label == label)
		if (bin?.color) return bin.color

		if (term.type == 'geneVariant') return this.getMutationColor(label)

		return rgb(this.colorScale(label)).toString()
	}

	// should move this outside of setTerm2Color(),
	// otherwise it will get *** recreated on every call *** to setTerm2Color()
	getMutationColor(label) {
		// for (const [key, mc] of Object.entries(mclass)) if (mc.label == label) return mc.color

		// key is not used in loop above, can do this instead
		for (const mc of Object.values(mclass)) if (mc.label === label && mc.color) return mc.color

		// can loop on the object directly
		for (const key in mclass) {
			if (mclass[key].label === label && mclass[key].color) return mclass[key].color
		}
	}

	/*
	  when term1 or term2 is a geneVariant term, return legendGrps: 
		[ 
			[
				{
					name: "...", 
					items: [...]
				},
				...
			],
			... 
		]
	*/
	getLegendGrps() {
		const t1 = this.config.term
		const t2 = this.config.term2
		if (t1.term.type == 'geneVariant' || t2?.term.type == 'geneVariant') {
			const legendGrps = []
			for (const chart of this.chartsData.charts) {
				legendGrps.push(this.getOneLegendGrps(chart))
			}
			return legendGrps
		}
		return this.getOneLegendGrps()
	}

	//Used by getLegendGrps to get one legendGrps
	getOneLegendGrps(chart) {
		const legendGrps = []
		const s = this.settings
		const t1 = this.config.term
		const t2 = this.config.term2
		const headingStyle = 'color: #aaa; font-weight: 400'

		// descriptive statistics
		if (t1.q.descrStats) {
			// term1 has descriptive stats
			const items = t1.q.descrStats.map(stat => {
				return {
					text: `${stat.label}: ${stat.value}`,
					noIcon: true
				}
			})
			// title of descriptive stats should include the term1 name if term2 is present
			const title = t2 ? `Descriptive statistics: ${t1.term.name}` : 'Descriptive statistics'
			const name = `<span style="${headingStyle}">${title}</span>`
			legendGrps.push({ name, items })
		}
		if (t2?.q.descrStats) {
			// term2 has descriptive stats
			const items = t2.q.descrStats.map(stat => {
				return {
					text: `${stat.label}: ${stat.value}`,
					noIcon: true
				}
			})
			// title of descriptive stats will include the term2 name
			// because two terms are present
			const title = `Descriptive statistics: ${t2.term.name}`
			const name = `<span style="${headingStyle}">${title}</span>`
			legendGrps.push({ name, items })
		}

		if (s.cols && s.exclude.cols.length) {
			const reducer = (sum, b) => sum + b.total
			const items = s.exclude.cols
				.filter(collabel => s.cols.includes(collabel)) // && (!t1.term.values || collabel in t1.term.values))
				.flatMap(collabel => {
					const filter = c => c.seriesId == collabel
					const total =
						t2?.term?.type == 'condition'
							? 0
							: t1.term.type == 'geneVariant' || t2?.term?.type == 'geneVariant'
							? chart.serieses.filter(filter).reduce(reducer, 0)
							: this.currServerData.charts.reduce((sum, chart) => {
									return sum + chart.serieses.filter(filter).reduce(reducer, 0)
							  }, 0)
					if (!total && !t2?.term?.type) return []
					const label = t1.term.values && collabel in t1.term.values ? t1.term.values[collabel].label : collabel
					const ntotal = total ? ', n=' + total : ''
					return [
						{
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
					]
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
					.flatMap(d => {
						const total = chart ? this.totalsByDataId[d]?.[chart.chartId] : this.totalsByDataId[d]
						if (!total) return []
						const ntotal = total ? ', n=' + total : ''
						const label = t2.term.values && d in t2.term.values ? t2.term.values[d].label : d
						return [
							{
								dataId: d,
								text: label + ntotal,
								color: this.term2toColor[d],
								type: 'row',
								isHidden: s.exclude.rows.includes(d)
							}
						]
					})
					.sort(this.overlaySorter)
			})
		}
		if (t2 && this.state.multipleTestingCorrection) {
			// the dataset requires multiple testing correction and therefore needs to show this legend of Statistical Significance
			// calculate total number of unskipped tests
			let testNum = 0
			for (const chartId in this.chartsData.tests) {
				testNum += this.chartsData.tests[chartId].reduce((a, b) => a + b.term2tests.filter(a => !a.skipped).length, 0)
			}
			legendGrps.push({
				name: `<span style="${headingStyle}">Statistical Significance</span>`,
				items: [{ text: `* p-value < (0.05 / ${testNum} tests)`, noEditColor: true }]
			})
		}

		return legendGrps
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

export const barInit = getCompInit(Barchart)
// this alias will allow abstracted dynamic imports
export const componentInit = barInit

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
			self.dom.legendDiv.selectAll('*').remove()
		} else {
			self.dom.banner.text('').style('display', 'none')
		}
	}

	self.exitChart = function(chart) {
		delete self.renderers[chart.chartId]
		select(this).remove()
	}

	self.updateChart = function(chart) {
		// this.dom.legendDiv.remove("*")
		chart.settings.cols.sort(self.barSorter)
		chart.maxAcrossCharts = self.chartsData.maxAcrossCharts
		chart.handlers = self.handlers
		chart.maxSeriesLogTotal = 0
		chart.visibleSerieses.forEach(series => self.sortStacking(series, chart, self.chartsData))
		self.renderers[chart.chartId](chart)

		const div = select(this)
		div
			.select('.pp-sbar-div-chartLengends')
			.selectAll('*')
			.remove()

		if (self.chartsData.tests && self.chartsData.tests[chart.chartId]) {
			//chart has pvalues
			generatePvalueTable(chart, div)
		}
	}

	self.addChart = function(chart, i) {
		const div = select(this)
			.attr('class', 'pp-sbar-div')
			.style('display', 'inline-block')
			.style('padding', '20px')
			.style('vertical-align', 'top')
		self.renderers[chart.chartId] = barsRenderer(self, select(this))
		//self.updateChart.call(this, chart)
		chart.settings.cols.sort(self.barSorter)
		chart.maxAcrossCharts = self.chartsData.maxAcrossCharts
		chart.handlers = self.handlers
		chart.maxSeriesLogTotal = 0
		chart.visibleSerieses.forEach(series => self.sortStacking(series, chart, self.chartsData))
		self.renderers[chart.chartId](chart)

		// div for chart-specific legends
		div
			.append('div')
			.attr('class', 'pp-sbar-div-chartLengends')
			.style('vertical-align', 'top')
			.style('margin', '10px 10px 10px 30px')
			.style('display', 'none')

		if (self.chartsData.tests && self.chartsData.tests[chart.chartId]) {
			//chart has pvalues
			generatePvalueTable(chart, div)
		}
	}

	/*
	A function to generate a p-value table for Chi-squared/Fisher's exact tests
	*/
	function generatePvalueTable(chart, div) {
		const holder = div
			.select('.pp-sbar-div-chartLengends')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.style('text-align', 'center')
			.append('div')

		// sort term1 categories based on self.chartsData.refs.cols
		self.chartsData.tests[chart.chartId].sort(function(a, b) {
			return self.chartsData.refs.cols.indexOf(a.term1comparison) - self.chartsData.refs.cols.indexOf(b.term1comparison)
		})

		// sort term2 categories based on self.chartsData.refs.rows
		for (const t1c of self.chartsData.tests[chart.chartId]) {
			t1c.term2tests.sort(function(a, b) {
				return self.chartsData.refs.rows.indexOf(a.term2id) - self.chartsData.refs.rows.indexOf(b.term2id)
			})
		}
		const columns = [
			{ label: 'Row 1' },
			{ label: 'Row 2' },
			{ label: 'Column 1' },
			{ label: 'Column 2' },
			{ label: 'P-value' }
		]
		const noSkipped = self.chartsData.tests[chart.chartId].every(term1 =>
			term1.term2tests.every(term2 => !term2.skipped)
		)
		const rows = []

		const visibleTests = self.chartsData.tests[chart.chartId].filter(term1Data =>
			chart.visibleSerieses.some(visibleTerm1 => visibleTerm1.seriesId === term1Data.term1comparison)
		)
		for (const term1 of visibleTests) {
			const visibleTerm1Data = chart.visibleSerieses.find(
				visibleTerm1 => visibleTerm1.seriesId === term1.term1comparison
			)
			const visibleTerm2Data = term1.term2tests.filter(term2Data =>
				visibleTerm1Data.visibleData.some(visibleTerm2 => visibleTerm2.dataId === term2Data.term2id)
			)
			for (const term2 of visibleTerm2Data) {
				rows.push([
					{ value: `${term1.term1Label}` },
					{ value: 'not ' + term1.term1Label },
					{ value: term2.term2Label },
					{ value: 'not ' + term2.term2Label },
					//if both chi-square and Fisher's exact tests were used. for the tests computed by Fisher's exact test, add a superscript letter 'a' after the pvalue.
					{
						html: term2.skipped
							? 'N/A'
							: term2.pvalue > 1e-4
							? Number(term2.pvalue.toFixed(4))
							: Number(term2.pvalue.toPrecision(4)).toExponential()
					}
				])
			}
		}
		//adding a title for the pvalue table
		//title is "Group comparisons (Fisher's exact test)" if all tests are Fisher's exact test, otherwise title is 'Group comparisons (Chi-square test)'
		const title = holder
			.append('div')
			.style('font-weight', 'bold')
			.style('padding-bottom', '0.5em')
			.html("2x2 Association test (Fisher's exact test)")
			.style('font-size', '0.9em')

		const table = holder.append('div').style('font-size', '0.9em')

		renderTable({ columns, rows, div: table, showLines: false, maxWidth: '50vw', maxHeight: '25vh', resize: true })

		//footnote: superscript letter 'a' indicates the pvalue was computed by Fisher's exact test
		table
			.append('div')
			.style('margin-top', '10px')
			.style('text-align', 'left')
			.style('font-size', '10px')
			.style('font-weight', 'normal')
			.html(noSkipped ? '' : 'N/A: association test skipped because of limited sample size <br>')
	}
}

function setInteractivity(self) {
	self.handlers = getHandlers(self)

	self.download = function() {
		if (!self.state) return
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

		const svgSel = select(svg)
			.style('display', 'block')
			.style('opacity', 1)
			.attr('width', numChartsPerRow * maxw)
			.attr('height', Math.floor(mainGs.length / numChartsPerRow) * maxh)

		const svgStyles = window.getComputedStyle(document.querySelector('.pp-bars-svg'))
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

		// svg + legend must be attached to DOM in order for getBBox() to work within svgLegendRenderer
		const hiddenDiv = select('body')
			.append('div')
			.style('opacity', 0)
		hiddenDiv.node().appendChild(svg)

		if (!self.svgLegendRenderer)
			self.svgLegendRenderer = svgLegend({
				holder: svgSel.append('g'),
				rectFillFxn: d => d.color,
				iconStroke: '#aaa'
			})

		const s = self.settings
		const svg0 = self.dom.barDiv.select('svg')
		let data = self.getLegendGrps()
		data.forEach(d => {
			d.name = d.name.replace(/<[^>]*>?/gm, '')
			if (d.items) d.items = d.items.filter(c => !c.isHidden)
		})
		data = data.filter(d => d.items.length && !d.name.includes('tatistic'))

		const fontsize = 14
		self.svgLegendRenderer(data, {
			settings: Object.assign(
				{
					ontop: false,
					lineh: 25,
					padx: 5,
					padleft: 0, //150,
					padright: 20,
					padbtm: 30,
					fontsize,
					iconh: fontsize - 2,
					iconw: fontsize - 2,
					hangleft: 1,
					linesep: false
				},
				{
					svgw: self.visibleCharts.length * svg0.attr('width'),
					svgh: svg0.attr('height'),
					dimensions: {
						xOffset: 50
					},
					padleft: s.legendpadleft + 50
				}
			)
		})

		const box = self.dom.legendDiv.node().getBoundingClientRect()
		select(svg).attr('height', select(svg).attr('height') + box.height)
		hiddenDiv.remove()

		const svg_name = self.config.term.term.name + ' barchart'
		to_svg(svg, svg_name, { apply_dom_styles: true })
	}
}

export function getDefaultBarSettings(app) {
	return {
		orientation: 'horizontal',
		unit: 'abs',
		overlay: 'none',
		divideBy: 'none',
		rowlabelw: 250,
		asterisksVisible: app?.getState()?.termdbConfig?.multipleTestingCorrection ? true : false,
		defaultColor: 'rgb(144, 23, 57)',
		colorBars: false
	}
}

export async function getPlotConfig(opts, app) {
	if (!opts.term) throw 'barchart getPlotConfig: opts.term{} missing'
	try {
		await fillTermWrapper(opts.term, app.vocabApi)
		if (opts.term2) await fillTermWrapper(opts.term2, app.vocabApi)
		if (opts.term0) await fillTermWrapper(opts.term0, app.vocabApi)
	} catch (e) {
		throw `${e} [barchart getPlotConfig()]`
	}

	const config = {
		id: opts.term.term.id,
		settings: {
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
			barchart: getDefaultBarSettings(app)
		}
	}

	// may apply term-specific changes to the default object
	return copyMerge(config, opts)
}
