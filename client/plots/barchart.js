import { getCompInit, copyMerge } from '../rx'
import getHandlers from './barchart.events'
import barsRenderer from './bars.renderer'
import rendererSettings from './bars.settings'
import { htmlLegend, svgLegend, renderTable } from '#dom'
import { select } from 'd3-selection'
import { rgb } from 'd3-color'
import { controlsInit, term0_term2_defaultQ, renderTerm1Label } from './controls'
import { to_svg } from '../src/client'
import { fillTermWrapper } from '#termsetting'
import { getColors, mclass, plotColor } from '#shared/common.js'
import { isNumericTerm } from '#shared/terms.js'
import { roundValueAuto } from '#shared/roundValue.js'
import { getCombinedTermFilter } from '#filter'
import { DownloadMenu } from '#dom/downloadMenu'

export class Barchart {
	constructor(opts) {
		// rx.getComponentInit() will set this.app, this.id, this.opts
		this.type = 'barchart'
		if (opts?.parentId) this.parentId = opts.parentId
	}
	//freeze the api of this class. don't want embedder functions to modify it.
	preApiFreeze(api) {
		api.download = this.download
		api.getChartImages = () => this.getChartImages()
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
			barDiv: holder
				.append('div')
				.style('display', 'flex')
				.style('flex-direction', 'row')
				.style('flex-wrap', 'wrap')
				.style('max-width', '100vw'),
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

		if (this.opts.bar_click_override) {
			// will use this as callback to bar click
			// and will not set up bar click menu
		} else if (!this.opts.bar_click_opts) {
			this.opts.bar_click_opts = ['hide_bar']
			if (this.app.getState().nav.header_mode === 'with_tabs') this.opts.bar_click_opts.push('add_filter')
		}
	}

	async setControls() {
		const state = this.state
		this.dom.controls.selectAll('*').remove()
		if (this.opts.controls) {
			this.opts.controls.on('downloadClick.barchart', this.download)
		} else {
			this.dom.holder.attr('class', 'pp-termdb-plot-viz').style('display', 'inline-block').style('min-width', '300px')
			//.style('margin-left', '10px')

			const inputs = [
				{
					type: 'term',
					configKey: 'term',
					chartType: 'barchart',
					usecase: { target: 'barchart', detail: 'term' },
					label: renderTerm1Label,
					vocabApi: this.app.vocabApi,
					menuOptions: 'edit',
					defaultQ4fillTW: { geneVariant: { type: 'custom-groupset' } },
					getBodyParams: () => {
						const tw = this.config['term']
						if (!tw) return { skip_categories: true }
						if (tw.term.categories) return { categories: tw.term.categories }
						return {}
					}
				},
				{
					type: 'term',
					configKey: 'term2',
					chartType: 'barchart',
					usecase: { target: 'barchart', detail: 'term2' },
					title: 'Overlay data',
					label: 'Overlay',
					vocabApi: this.app.vocabApi,
					numericEditMenuVersion: this.opts.numericEditMenuVersion,
					defaultQ4fillTW: term0_term2_defaultQ,
					// overlay option should always be visible, but must convert unit from log to abs
					// when an overlay is added
					//getDisplayStyle: () => (this.settings.unit == 'log' ? 'none' : ''),
					processConfig: config => {
						//config.settings not usually passed for logic check below
						const s = this.state.config.settings.barchart
						if (!config.settings) config.settings = { barchart: {} }
						//Prevent showing Log option when overlay is selected
						if (config.term2 && s.unit == 'log') config.settings.barchart.unit = 'abs'
						//Revert back to Linear radio when Proportion is selected
						//but the overlay term is removed
						if (!config.term2 && s.unit == 'pct') config.settings.barchart.unit = 'abs'
					},
					getBodyParams: () => {
						const tw = this.config['term2']
						if (!tw) return { skip_categories: true }
						if (tw.term.categories) return { categories: tw.term.categories }
						return {}
					}
				},
				{
					type: 'term',
					configKey: 'term0',
					chartType: 'barchart',
					usecase: { target: 'barchart', detail: 'term0' },
					title: 'Divide by data',
					label: 'Divide by',
					vocabApi: this.app.vocabApi,
					numericEditMenuVersion: this.opts.numericEditMenuVersion,
					defaultQ4fillTW: term0_term2_defaultQ,
					getBodyParams: () => {
						const tw = this.config['term0']
						if (!tw) return { skip_categories: true }
						if (tw.term.categories) return { categories: tw.term.categories }
						return {}
					}
				},

				{
					label: 'Bar orientation',
					type: 'radio',
					chartType: 'barchart',
					settingsKey: 'orientation',
					options: [
						{ label: 'Vertical', value: 'vertical' },
						{ label: 'Horizontal', value: 'horizontal' }
					]
				},

				{
					label: 'Scale',
					type: 'radio',
					chartType: 'barchart',
					settingsKey: 'unit',
					options: [
						{ label: 'Linear', value: 'abs' },
						/** Option not available when term2 is present:
						 * 1. The scale for the plot renders incorrectly
						 * 2. The bars do not appear to be rendering correctly as a result
						 * TODOs: Investigate the cause of the rendering issue
						 */
						{
							label: 'Log',
							value: 'log',
							getDisplayStyle: (plot, computedDisplay = 'inline-block') => (plot.term2 ? 'none' : computedDisplay)
						},
						{
							label: 'Proportion',
							value: 'pct',
							getDisplayStyle: (plot, computedDisplay = 'inline-block') => (plot.term2 ? computedDisplay : 'none')
						}
					]
				},
				{
					label: 'Multicolor bars',
					title: 'Color bars',
					type: 'checkbox',
					chartType: 'barchart',
					settingsKey: 'colorBars',
					boxLabel: 'Yes',
					getDisplayStyle: plot => (plot.term2 ? 'none' : 'table-row')
				},

				{
					label: 'Deduplicate',
					title: 'Use separate bars samples that has multiple values or belong to multiple groups',
					type: 'checkbox',
					chartType: 'barchart',
					settingsKey: 'dedup',
					boxLabel: 'Yes',
					getDisplayStyle: plot =>
						this.chartsData?.charts.find(c => c.serieses.length != c.dedupedSerieses.length) ? 'table-row' : 'none'
				}
			]
			if (isNumericTerm(this.config.term.term))
				inputs.push({
					label: 'Show stats',
					type: 'checkbox',
					chartType: 'barchart',
					settingsKey: 'showStats',
					boxLabel: 'Yes'
				})
			if (!this.config.term2)
				inputs.push({
					label: 'Show percent',
					type: 'checkbox',
					chartType: 'barchart',
					settingsKey: 'showPercent',
					boxLabel: 'Yes'
				})
			else
				inputs.push({
					label: 'Show association tests',
					type: 'checkbox',
					chartType: 'barchart',
					settingsKey: 'showAssociationTests',
					boxLabel: 'Yes'
				})
			if (state.config.settings.barchart.colorBars && (state.config.term2 || state.config.term0))
				inputs.splice(7, 0, {
					label: 'Assign colors to',
					title: `Colors bars either considering all the categories or the present categories. If there are many categories and only few are present the present choice will provide more contrast.`,
					type: 'radio',
					chartType: 'barchart',
					settingsKey: 'colorUsing',
					options: [
						{ label: 'All values', value: 'all' },
						{ label: 'Present values', value: 'present' }
					]
				})
			else if (!state.config.settings.barchart.colorBars)
				inputs.splice(6, 0, {
					label: 'Default color',
					title: 'Default color for bars when there is no overlay',
					type: 'color',
					chartType: 'barchart',
					settingsKey: 'defaultColor'
					//getDisplayStyle: plot => (plot.settings.barchart.colorBars || plot.term2 ? 'none' : 'table-row')
				})

			const multipleTestingCorrection = this.app.getState().termdbConfig.multipleTestingCorrection
			if (multipleTestingCorrection) {
				// a checkbox to allow users to show or hide asterisks on bars
				inputs.push({
					label: 'Asterisks',
					boxLabel: 'Visible',
					type: 'checkbox',
					chartType: 'barchart',
					settingsKey: 'asterisksVisible',
					title: 'Display the asterisks'
				})
				const mtcMethod = multipleTestingCorrection.method
				if (!mtcMethod) throw 'no multiple testing correction method specified'
				inputs.push({
					label: `Multiple testing correction (${mtcMethod == 'bon' ? 'Bonferroni' : mtcMethod})`,
					boxLabel: '',
					type: 'checkbox',
					chartType: 'barchart',
					settingsKey: 'multiTestingCorr',
					title: `Perform multiple testing correction (${mtcMethod == 'bon' ? 'Bonferroni' : mtcMethod})`
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
			return (
				(action.id === this.id || action.id == this.parentId) &&
				(!action.config?.childType || action.config?.childType == this.type)
			)
		}
		return true
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		const parentConfig = appState.plots.find(p => p.id === this.parentId)
		const termfilter = getCombinedTermFilter(appState, parentConfig?.filter)
		return {
			nav: {
				header_mode: appState.nav.header_mode
			},
			termfilter,
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
			await this.setControls() //needs to be called after getDescrStats() to set hasStats

			const results = await this.app.vocabApi.getNestedChartSeriesData(reqOpts)
			if (results.error) throw results
			const data = results.data
			this.charts = data.charts
			if (results.descrStats) this.config.term.q.descrStats = results.descrStats
			this.sampleType = results.sampleType
			this.bins = results.bins
			if (results.chartid2dtterm) this.chartid2dtterm = results.chartid2dtterm
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
			for (const chart of data.charts) {
				const categoriesPerSerie = chart.serieses.map(s => s.data.length)
				const numColors = this.config.term2 ? Math.max(...categoriesPerSerie) : chart.serieses.length
				chart.colorScale = getColors(numColors)
			}
			this.chartsData = this.processData(this.currServerData)
			this.render()
			this.dom.barDiv.style('display', 'flex')
		} catch (e) {
			this.toggleLoadingDiv('none')
			this.dom.barDiv.style('display', 'none')
			throw e
		}
	}

	// creates an opts object for the vocabApi.getNestedChartsData()
	getDataRequestOpts() {
		const c = this.config
		const opts = { term: c.term, filter: this.state.termfilter.filter }
		if (this.state.termfilter.filter0) opts.filter0 = this.state.termfilter.filter0
		if (c.term2) opts.term2 = c.term2
		if (c.term0) opts.term0 = c.term0
		return opts
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
			multiTestingCorr: config.settings.barchart.multiTestingCorr,
			defaultColor: config.settings.barchart.defaultColor,
			colorBars: config.settings.barchart.colorBars,
			dedup: config.settings.barchart.dedup,
			// normalize bar thickness regardless of orientation
			colw: config.settings.common.barwidth,
			rowh: config.settings.common.barwidth,
			colspace: config.settings.common.barspace,
			rowspace: config.settings.common.barspace,
			colorUsing: config.settings.barchart.colorUsing,
			showStats: config.settings.barchart.showStats,
			showAssociationTests: config.settings.barchart.showAssociationTests
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

		this.settings.cols = this.settings.dedup ? this.currServerData.refs.dedupCols : this.currServerData.refs.cols
		this.settings.numCharts = this.currServerData.charts ? this.currServerData.charts.length : 0
		if (!config.term2 && this.settings.unit == 'pct') {
			this.settings.unit = 'abs'
		}
	}

	mayResetHidden(term, term2, term0) {
		const combinedTermIds = (term && term.term.id) + ';;' + (term2 && term2.term.id) + ';;' + (term0 && term0.term.id)
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
		this.seriesOrder = this.setMaxVisibleTotals(chartsData)
		if (!chartsData.charts.length) {
			this.seriesOrder = []
		} else if (chartsData.refs.useColOrder) {
			this.seriesOrder = this.settings.cols
		}

		const rows = chartsData.refs.rows

		this.barSorter = (a, b) => this.seriesOrder.indexOf(a) - this.seriesOrder.indexOf(b)
		this.overlaySorter = chartsData.refs.useRowOrder
			? (a, b) => rows.indexOf(a.dataId) - rows.indexOf(b.dataId)
			: (a, b) =>
					this.totalsByDataId[b.dataId] > this.totalsByDataId[a.dataId]
						? 1
						: this.totalsByDataId[b.dataId] < this.totalsByDataId[a.dataId]
						? -1
						: a.dataId < b.dataId
						? -1
						: 1

		this.visibleCharts = chartsData.charts.filter(chart => chart.visibleSerieses.length)

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
		// this will prioritize sorting series totals in the first chart,
		// then serieses in the subsequent chart that are not already in the first chart, and so on
		const visibleTotalsByChartSeriesId = {}
		let maxVisibleAcrossCharts = 0
		for (const chart of chartsData.charts) {
			if (!chart.settings) chart.settings = JSON.parse(rendererSettings)
			Object.assign(chart.settings, this.settings)
			chart.visibleTotal = 0
			const serieses = this.settings.dedup ? chart.dedupedSerieses : chart.serieses
			chart.visibleSerieses = serieses.filter(series => {
				if (chart.settings.exclude.cols.includes(series.seriesId)) return false
				series.visibleData = series.data.filter(d => !chart.settings.exclude.rows.includes(d.dataId))
				series.visibleTotal = series.visibleData.reduce((sum, a) => sum + a.total, 0)
				if (!series.visibleTotal) return false
				chart.visibleTotal += series.visibleTotal
				if (!(series.seriesId in visibleTotalsByChartSeriesId))
					visibleTotalsByChartSeriesId[series.seriesId] = series.visibleTotal
				for (const data of series.data) {
					data.seriesId = series.seriesId
					if (
						(t1.term.type == 'geneVariant' && t1.q.type == 'values') ||
						(t2?.term.type == 'geneVariant' && t2?.q.type == 'values')
					) {
						// term1 or term2 is a geneVariant term not using groupsetting
						// need specialized processing
						if (!(data.dataId in this.totalsByDataId)) {
							this.totalsByDataId[data.dataId] = {}
						}
						this.totalsByDataId[data.dataId][chart.chartId] = this.totalsByDataId[data.dataId][chart.chartId]
							? this.totalsByDataId[data.dataId][chart.chartId] + data.total
							: 0 + data.total
					} else {
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

		return Object.keys(visibleTotalsByChartSeriesId).sort(
			(a, b) => visibleTotalsByChartSeriesId[b] - visibleTotalsByChartSeriesId[a]
		)
	}

	sortStacking(series, chart, chartsData) {
		this.term1toColor[series.seriesId] = this.settings.colorBars
			? this.getColor(chart, this.config.term, series.seriesId, this.bins?.[1])
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
			this.setTerm2Color(chart, result)
			result.color = this.term2toColor[result.dataId] || this.term1toColor[series.seriesId]
		}
		if (seriesLogTotal > chart.maxSeriesLogTotal) {
			chart.maxSeriesLogTotal = seriesLogTotal
		}
		// assign color to hidden data for use in legend
		for (const result of series.data) {
			if (result.color) continue
			this.setTerm2Color(chart, result)
			result.color = this.term2toColor[result.dataId] || this.term1toColor[series.seriesId]
		}
	}

	setTerm2Color(chart, result) {
		if (!this.config.term2) return
		this.term2toColor[result.dataId] = this.getColor(chart, this.config.term2, result.dataId, this.bins?.[2])
	}

	getColor(chart, t, label, bins) {
		if (!t.term) return
		if (t.q.type == 'predefined-groupset' || t.q.type == 'custom-groupset') {
			const groupset =
				t.q.type == 'predefined-groupset' ? t.term.groupsetting.lst[t.q.predefined_groupset_idx] : t.q.customset
			if (!groupset) throw 'groupset is missing'
			const group = groupset.groups.find(g => g.name == label)
			if (group?.color) return group.color
		}
		//use predefined colors unless colorBars is set to true.
		// Assigning colors to bars uses a better color scale as the scale considers the categories present, not in all the categories
		if (t.term.values && this.settings.colorUsing == 'all') {
			for (const [key, v] of Object.entries(t.term.values)) {
				if (!v.color) continue
				if (key === label) return v.color
				if (v.label === label) return v.color
			}
		}
		const bin = bins?.find(bin => bin.label == label)
		if (bin?.color) return bin.color

		if (t.term.type == 'geneVariant' && t.q.type == 'values') return this.getMutationColor(label)
		return rgb(chart.colorScale(label)).toString()
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
		if (
			(t1.term.type == 'geneVariant' && t1.q.type == 'values') ||
			(t2?.term.type == 'geneVariant' && t2?.q.type == 'values')
		) {
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
		if (t1.q.descrStats && s.showStats) {
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
		if (t2?.q.descrStats && s.showAssociationTests) {
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
							: (t1.term.type == 'geneVariant' && t1.q.type == 'values') ||
							  (t2?.term.type == 'geneVariant' && t2?.q.type == 'values')
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
					`<span style="${headingStyle}">` +
					(t2.term.type == 'geneVariant' ? '' : t2.term.name) +
					(value_by_label ? ', ' + value_by_label : '') +
					'</span>',
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
			const items =
				testNum > 1 && this.state.config.settings.barchart.multiTestingCorr
					? [{ text: `* p-value < (0.05 / ${testNum} tests)`, noEditColor: true }]
					: [{ text: `* p-value < 0.05`, noEditColor: true }]
			legendGrps.push({
				name: `<span style="${headingStyle}">&nbsp;</span>`,
				items
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
	self.render = function () {
		const charts = self.dom.barDiv.selectAll('.pp-sbar-div').data(self.visibleCharts, chart => chart.chartId)

		charts.exit().each(self.exitChart)
		charts.each(self.updateChart)
		charts.enter().append('div').each(self.addChart)

		self.dom.holder.selectAll('.pp-chart-title').style('display', self.visibleCharts.length < 2 ? 'none' : 'block')
		const grps = self.getLegendGrps()
		self.legendRenderer(grps)

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

	self.exitChart = function (chart) {
		delete self.renderers[chart.chartId]
		select(this).remove()
	}

	self.updateChart = function (chart) {
		// this.dom.legendDiv.remove("*")
		chart.settings.cols.sort(self.barSorter)
		chart.maxAcrossCharts = self.chartsData.maxAcrossCharts
		chart.handlers = self.handlers
		chart.maxSeriesLogTotal = 0
		chart.visibleSerieses.forEach(series => self.sortStacking(series, chart, self.chartsData))
		self.renderers[chart.chartId] = barsRenderer(self, select(this)) //rerender as settings may have changed
		self.renderers[chart.chartId](chart)

		const div = select(this)
		div.style('display', 'inline-block')
		div
			.append('div')
			.attr('class', 'pp-sbar-div-chartLengends')
			.attr('data-testid', 'sjpcb-bars-chartLengends')
			.style('vertical-align', 'top')
			.style('margin', '10px 10px 10px 30px')
			.style('display', 'none')
		if (
			self.chartsData.tests &&
			self.chartsData.tests[chart.chartId] &&
			self.config.settings.barchart.showAssociationTests
		) {
			//chart has pvalues
			generatePvalueTable(chart, div)
		}
	}

	self.addChart = function (chart, i) {
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
			.attr('data-testid', 'sjpcb-bars-chartLengends')
			.style('vertical-align', 'top')
			.style('margin', '10px 10px 10px 30px')
			.style('display', 'none')
		if (
			self.chartsData.tests &&
			self.chartsData.tests[chart.chartId] &&
			self.config.settings.barchart.showAssociationTests
		) {
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
		// const cols = self.settings.dedup ?  self.chartsData.refs.cols
		self.chartsData.tests[chart.chartId].sort(function (a, b) {
			return self.settings.cols.indexOf(a.term1comparison) - self.settings.cols.indexOf(b.term1comparison)
		})

		// sort term2 categories based on self.chartsData.refs.rows
		for (const t1c of self.chartsData.tests[chart.chartId]) {
			t1c.term2tests.sort(function (a, b) {
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
		for (const [index, term1] of visibleTests.entries()) {
			if (visibleTests.length == 2 && index == 1) {
				// when term1 has only 2 categories, then only a single category needs to be tested in the
				// association test (because the other category will get tested in that same test).
				break
			}
			const visibleTerm1Data = chart.visibleSerieses.find(
				visibleTerm1 => visibleTerm1.seriesId === term1.term1comparison
			)
			const visibleTerm2Data = term1.term2tests.filter(term2Data =>
				visibleTerm1Data.visibleData.some(visibleTerm2 => visibleTerm2.dataId === term2Data.term2id)
			)
			for (const [index2, term2] of visibleTerm2Data.entries()) {
				if (chart.settings.rows.length - chart.settings.exclude.rows.length == 2 && index2 == 1) {
					// when term2 has only 2 visible categories, then only a single category needs to be tested in the
					// association test (because the other category will get tested in that same test).
					break
				}
				let negateTerm2Label = negateTermLabel(term2.term2Label)
				if (chart.settings.rows.length - chart.settings.exclude.rows.length == 2) {
					// when term2 has only 2 visible categories, Col2 would be the other category instead of "not Col1"
					const visibleTerm2CatsKeys = chart.settings.rows.filter(row => !chart.settings.exclude.rows.includes(row))
					const visibleTerm2Labels = visibleTerm2CatsKeys
						.map(catK => self.config.term2?.term?.values?.[catK]?.label)
						.filter(x => x != undefined)
					if (visibleTerm2Labels?.length == 2)
						negateTerm2Label = visibleTerm2Labels[0] == term2.term2Label ? visibleTerm2Labels[1] : visibleTerm2Labels[0]
				}

				rows.push([
					{ value: `${term1.term1Label}` },
					// when term1 has only 2 categories, Row2 would be the other category instead of "not Row1"
					{ value: visibleTests.length == 2 ? visibleTests[1].term1Label : negateTermLabel(term1.term1Label) },
					{ value: term2.term2Label },
					{ value: negateTerm2Label },
					//if both chi-square and Fisher's exact tests were used. for the tests computed by Fisher's exact test, add a superscript letter 'a' after the pvalue.
					{
						html: term2.skipped
							? 'N/A'
							: term2.pvalue > 1e-4
							? roundValueAuto(Number(term2.pvalue))
							: roundValueAuto(Number(term2.pvalue))
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
		renderTable({
			columns,
			rows,
			div: table,
			showLines: false,
			maxWidth: '70vw',
			maxHeight: `${chart.svgh - 100}px`,
			resize: true
		})

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

	self.getChartImages = function () {
		const charts = []
		const node = self.dom.barDiv.select('.sjpcb-bars-mainG').node() //node to read the style

		for (const chart of self.charts) {
			const name = `${this.config.term.term.name}  ${chart.name ? chart.name : ''}`
			charts.push({ name, svg: chart.svg, parent: node })
		}
		return charts
	}

	self.download = function (event) {
		const charts = self.getChartImages()
		const dm = new DownloadMenu(charts, self.config.term.term.name)
		dm.show(event.clientX, event.clientY)
	}

	/** Downloads all charts as a single svg image, including the legend for each barchart, needs review as it
	 * has some glitches. The legend rendering may be moved to the same svg and then it will be included in the download or a callback may be provided
	 * to the downloadMenu to use this download when generating a single svg, once it works well
	 */
	// self.download = function () {
	// 	if (!self.state) return
	// 	// has to be able to handle multichart view
	// 	const mainGs = []
	// 	const translate = { x: undefined, y: undefined }
	// 	const titles = []
	// 	let maxw = 0,
	// 		maxh = 0,
	// 		tboxh = 0
	// 	let prevY = 0,
	// 		numChartsPerRow = 0

	// 	self.dom.barDiv.selectAll('.sjpcb-bars-mainG').each(function () {
	// 		mainGs.push(this)
	// 		const bbox = this.getBBox()
	// 		if (bbox.width > maxw) maxw = bbox.width
	// 		if (bbox.height > maxh) maxh = bbox.height
	// 		const divY = Math.round(this.parentNode.parentNode.getBoundingClientRect().y)
	// 		if (!numChartsPerRow) {
	// 			prevY = divY
	// 			numChartsPerRow++
	// 		} else if (Math.abs(divY - prevY) < 5) {
	// 			numChartsPerRow++
	// 		}
	// 		const xy = select(this)
	// 			.attr('transform')
	// 			.split('translate(')[1]
	// 			.split(')')[0]
	// 			.split(',')
	// 			.map(d => +d.trim())
	// 		if (translate.x === undefined || xy[0] > translate.x) translate.x = +xy[0]
	// 		if (translate.y === undefined || xy[1] > translate.y) translate.y = +xy[1]

	// 		const title = this.parentNode.parentNode.firstChild
	// 		const tbox = title.getBoundingClientRect()
	// 		if (tbox.width > maxw) maxw = tbox.width
	// 		if (tbox.height > tboxh) tboxh = tbox.height
	// 		titles.push({ text: title.innerText, styles: window.getComputedStyle(title) })
	// 	})

	// 	// add padding between charts
	// 	maxw += 30
	// 	maxh += 30

	// 	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')

	// 	const svgSel = select(svg)
	// 		.style('display', 'block')
	// 		.style('opacity', 1)
	// 		.attr('width', numChartsPerRow * maxw)
	// 		.attr('height', Math.floor(mainGs.length / numChartsPerRow) * maxh)

	// 	const svgStyles = window.getComputedStyle(document.querySelector('.pp-bars-svg'))
	// 	for (const prop of svgStyles) {
	// 		if (prop.startsWith('font')) svgSel.style(prop, svgStyles.getPropertyValue(prop))
	// 	}

	// 	mainGs.forEach((g, i) => {
	// 		const mainG = g.cloneNode(true)
	// 		const colNum = i % numChartsPerRow
	// 		const rowNum = Math.floor(i / numChartsPerRow)
	// 		const corner = { x: colNum * maxw + translate.x, y: rowNum * maxh + translate.y }
	// 		const title = select(svg)
	// 			.append('text')
	// 			.attr('transform', 'translate(' + corner.x + ',' + corner.y + ')')
	// 			.text(titles[i].text)
	// 		for (const prop of titles[i].styles) {
	// 			if (prop.startsWith('font')) title.style(prop, titles[i].styles.getPropertyValue(prop))
	// 		}

	// 		select(mainG).attr('transform', 'translate(' + corner.x + ',' + (corner.y + tboxh) + ')')
	// 		svg.appendChild(mainG)
	// 	})

	// 	// svg + legend must be attached to DOM in order for getBBox() to work within svgLegendRenderer
	// 	const hiddenDiv = select('body').append('div').style('opacity', 0)
	// 	hiddenDiv.node().appendChild(svg)

	// 	self.svgLegendRenderer = svgLegend({
	// 		holder: svgSel.append('g'),
	// 		rectFillFxn: d => d.color,
	// 		iconStroke: '#aaa'
	// 	})

	// 	const s = self.settings
	// 	const svg0 = self.dom.barDiv.select('svg').node().getBoundingClientRect()
	// 	let data = self.getLegendGrps()
	// 	data.forEach(d => {
	// 		d.name = d.name.replace(/<[^>]*>?/gm, '')
	// 		if (d.items) d.items = d.items.filter(c => !c.isHidden)
	// 	})
	// 	data = data.filter(d => d.items.length && !d.name.includes('tatistic'))
	// 	const fontsize = 14
	// 	self.svgLegendRenderer(data, {
	// 		settings: Object.assign(
	// 			{
	// 				ontop: false,
	// 				lineh: 25,
	// 				padx: 5,
	// 				padleft: 0, //150,
	// 				padright: 20,
	// 				padbtm: 30,
	// 				fontsize,
	// 				iconh: fontsize - 2,
	// 				iconw: fontsize - 2,
	// 				hangleft: 1,
	// 				linesep: false
	// 			},
	// 			{
	// 				svgw: self.visibleCharts.length * svg0.width,
	// 				svgh: svg0.height,
	// 				dimensions: {
	// 					xOffset: 50
	// 				},
	// 				padleft: 50
	// 			}
	// 		)
	// 	})

	// 	const box = self.dom.legendDiv.node().getBoundingClientRect()
	// 	select(svg).attr('height', svg0.height + box.height + 30)
	// 	if (box.width > svg0.width) select(svg).attr('width', box.width)
	// 	hiddenDiv.remove()

	// 	const svg_name = self.config.term.term.name + ' barchart'
	// 	to_svg(svg, svg_name, { apply_dom_styles: true })
	// }
}

export function getDefaultBarSettings(app) {
	return {
		orientation: 'horizontal',
		unit: 'abs',
		overlay: 'none',
		divideBy: 'none',
		rowlabelw: 250,
		asterisksVisible: app?.getState()?.termdbConfig?.multipleTestingCorrection ? true : false,
		multiTestingCorr: app?.getState()?.termdbConfig?.multipleTestingCorrection?.applyByDefault ? true : false,
		defaultColor: plotColor,
		colorBars: false,
		colorUsing: 'all',
		dedup: false,
		showStats: true,
		showAssociationTests: true,
		showPercent: false
	}
}

export async function getPlotConfig(opts, app) {
	if (!opts.term) throw 'barchart getPlotConfig: opts.term{} missing'
	try {
		await fillTermWrapper(opts.term, app.vocabApi)
		if (opts.term2) await fillTermWrapper(opts.term2, app.vocabApi)
		if (opts.term0) await fillTermWrapper(opts.term0, app.vocabApi)
	} catch (e) {
		console.log('Error reading config: ' + JSON.stringify(opts))
		console.error(e)
		throw `${e} [barchart getPlotConfig()]`
	}

	const config = {
		id: opts.term.term.id,
		settings: {
			controls: {
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

// a function used by generatePvalueTable to negate a term label
// TODO: add more conditions for better negation than "not termLable"
export function negateTermLabel(termLabel) {
	const termLabelStr = String(termLabel)
	if (termLabelStr.toUpperCase().startsWith('NOT ')) {
		return termLabelStr.substring(4) // Remove the "not" prefix
	} else {
		return 'not ' + termLabelStr // Otherwise, add "not" prefix
	}
}
