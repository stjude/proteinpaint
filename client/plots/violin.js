import { getCompInit, copyMerge } from '../rx'
import { controlsInit, term0_term2_defaultQ, renderTerm1Label } from './controls'
import setViolinRenderer from './violin.renderer'
//import htmlLegend from '../dom/html.legend'
import { htmlLegend, Menu } from '#dom'
import { fillTermWrapper } from '#termsetting'
import { setInteractivity } from './violin.interactivity'
import { plotColor } from '#shared/common.js'
import { isNumericTerm } from '#shared/terms.js'
import { getCombinedTermFilter } from '#filter'
import { PlotBase, defaultUiLabels } from '#plots/PlotBase.js'
/*
when opts.mode = 'minimal', a minimal violin plot will be rendered that will have a single term and minimal features (i.e. no controls, legend, labels, brushing, transitions, etc.)

TODO default to unit=log if term enables
*/

class ViolinPlot extends PlotBase {
	static type = 'violin'

	constructor(opts) {
		super(opts)
		this.type = ViolinPlot.type
	}

	async init(appState) {
		const controls = this.opts.holder.append('div').attr('class', 'sjpp-plot-controls').style('display', 'inline-block')
		const config = appState.plots.find(p => p.id === this.id)

		const holder = this.opts.holder
			.append('div')
			.style('display', 'inline-block')
			.style('padding', this.opts.mode != 'minimal' ? '5px' : '0px')
			.style('padding-left', this.opts.mode != 'minimal' ? '20px' : '0px')
			.attr('id', 'sjpp-vp-holder')

		this.dom = {
			hovertip: new Menu({ padding: '3px' }), // separate tips for hover & click on violin labels to avoid interfering
			clicktip: new Menu({ padding: '0px' }),
			sampletabletip: new Menu({ padding: '3px' }), // sampletable is lauched from option shown in clicktip which closes on clicking, thus need its own menu..
			header: this.opts.header,
			controls,
			banner: holder
				.append('div')
				.style('display', 'none')
				.style('text-align', 'center')
				.style('padding', '24px')
				.style('font-size', '16px'),
			loadingDiv: holder
				.append('div')
				.style('display', this.opts.mode != 'minimal' ? 'inline-block' : 'none')
				.style('padding', '24px')
				.text('Loading ...'),
			violinDiv: holder
				.append('div')
				.attr('class', 'sjpp-vp-violinDiv')
				.style('display', 'flex')
				.style('flex-direction', 'row')
				.style('flex-wrap', 'wrap')
				.style('max-width', '100vw'),
			legendDiv: holder
				.append('div')
				.classed('sjpp-vp-legend', true)
				.style('margin-left', '-15px')
				.style('padding-top', '20px')
		}

		setViolinRenderer(this)
		setInteractivity(this)

		if (this.opts.mode != 'minimal') {
			this.legendRenderer = htmlLegend(this.dom.legendDiv, {
				settings: {
					legendOrientation: 'vertical'
				},
				handlers: {}
			})
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

	preApiFreeze(api) {
		api.download = this.download
		api.getChartImages = () => this.getChartImages()
	}

	async setControls() {
		// do not replace this.components.controls on every re-render,
		// that could lead to missing control.state if there are errors
		// with config.terms filling, etc. Better to set getDisplayStyle()
		// option for an input that doesn't have to be rendered for a given
		// term/term2/term0 combination.
		if (this.components.controls) return
		this.dom.controls.selectAll('*').remove()
		const controlLabels = this.state.config.controlLabels
		if (!controlLabels) throw 'controls labels not found'
		this.components = {}
		if (this.opts.mode == 'minimal') return
		const inputs = [
			{
				type: 'term',
				configKey: 'term',
				chartType: 'violin',
				usecase: { target: 'violin', detail: 'term' },
				label: controlLabels.term1?.label || renderTerm1Label,
				vocabApi: this.app.vocabApi,
				menuOptions: 'edit'
			},
			{
				type: 'term',
				configKey: 'term2',
				chartType: 'violin',
				usecase: { target: 'violin', detail: 'term2' },
				title: controlLabels.term2.title || controlLabels.term2.label,
				label: controlLabels.term2.label,
				vocabApi: this.app.vocabApi,
				numericEditMenuVersion: this.opts.numericEditMenuVersion,
				defaultQ4fillTW: term0_term2_defaultQ
			},
			{
				type: 'term',
				configKey: 'term0',
				chartType: 'violin',
				usecase: { target: 'violin', detail: 'term0' },
				title: controlLabels.term0.title || controlLabels.term0.label,
				label: controlLabels.term0.label,
				vocabApi: this.app.vocabApi,
				// by default, do not allow continuous mode for divide-by term, since
				// it will create a separate violin-overlay group per unique float or integer value
				// and there will nonsensical tens/hundreds of these charts based on the cohort size
				numericEditMenuVersion: this.opts.numericEditMenuVersion || ['discrete'],
				defaultQ4fillTW: term0_term2_defaultQ
			},
			{
				label: 'Orientation',
				title: 'Orientation of the chart',
				type: 'radio',
				chartType: 'violin',
				settingsKey: 'orientation',
				options: [
					{ label: 'Vertical', value: 'vertical' },
					{ label: 'Horizontal', value: 'horizontal' }
				]
			},
			{
				label: 'Data symbol',
				title: 'Symbol type',
				type: 'radio',
				chartType: 'violin',
				settingsKey: 'datasymbol',
				options: [
					{ label: 'Ticks', value: 'rug' },
					{ label: 'Circles', value: 'bean' },
					{ label: 'Off', value: 'none' }
				]
			},
			{
				label: 'Scale',
				title: 'Axis scale',
				type: 'radio',
				chartType: 'violin',
				settingsKey: 'unit',
				options: [
					{ label: 'Linear', value: 'abs' },
					{ label: 'Log10', value: 'log' }
				]
			},
			{
				label: 'Order by',
				title: 'Order violin plots by parameters',
				type: 'radio',
				chartType: 'violin',
				settingsKey: 'orderByMedian',
				options: [
					{ label: 'Default', value: false },
					{ label: 'Median', value: true }
				],
				getDisplayStyle: () => {
					let style = 'none'
					const charts = this.data?.charts || {}
					for (const k of Object.keys(charts)) {
						const chart = charts[k]
						if (chart?.plots.length > 1) style = ''
					}
					return style
				}
			},
			{
				label: 'Symbol size',
				type: 'number',
				chartType: 'violin',
				settingsKey: 'radius',
				step: 1,
				max: 30,
				min: 4
			},
			{
				label: 'Bins',
				type: 'number',
				chartType: 'violin',
				settingsKey: 'ticks',
				title: 'Number of bins used to build the plot',
				min: 1,
				max: 50
			},
			{
				label: 'Plot length',
				title: 'Length of the plot',
				type: 'number',
				chartType: 'violin',
				settingsKey: 'svgw',
				step: 10,
				max: 1000,
				min: 200,
				debounceInterval: 1000
			},
			{
				label: 'Plot thickness',
				title: 'If not specified, the plot thickness is calculated based on the number of categories',
				type: 'number',
				chartType: 'violin',
				settingsKey: 'plotThickness',
				step: 10,
				max: 200,
				min: 20,
				debounceInterval: 1000
			},
			{
				label: 'Plot padding',
				type: 'number',
				chartType: 'violin',
				settingsKey: 'rowSpace',
				step: 1,
				max: 20,
				min: 0,
				debounceInterval: 1000
			},
			{
				label: 'Median length',
				title: 'Length of median',
				type: 'number',
				chartType: 'violin',
				settingsKey: 'medianLength',
				step: 1,
				max: 50,
				min: 3,
				debounceInterval: 1000
			},
			{
				label: 'Median color',
				title: 'color of median',
				type: 'color',
				chartType: 'violin',
				settingsKey: 'medianColor'
			},
			{
				label: 'Median thickness',
				title: 'Width of median',
				type: 'number',
				chartType: 'violin',
				settingsKey: 'medianThickness',
				step: 1,
				max: 10,
				min: 3,
				debounceInterval: 100
			},
			{
				label: 'Default violin color',
				type: 'color',
				chartType: 'violin',
				settingsKey: 'defaultColor'
			},
			{
				label: 'Show stats',
				type: 'checkbox',
				chartType: 'violin',
				settingsKey: 'showStats',
				boxLabel: 'Yes'
			},
			{
				label: 'Show association tests',
				type: 'checkbox',
				chartType: 'violin',
				settingsKey: 'showAssociationTests',
				boxLabel: 'Yes',
				getDisplayStyle: plot => (plot.term2 ? 'table-row' : 'none')
			}
		]

		this.components.controls = await controlsInit({
			app: this.app,
			id: this.id,
			holder: this.dom.controls,
			inputs
		})

		this.components.controls.on('downloadClick.violin', this.download)
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		const parentConfig = appState.plots.find(p => p.id === this.parentId)

		const termfilter = getCombinedTermFilter(appState, config.filter || parentConfig?.filter)
		return {
			termfilter,
			config,
			displaySampleIds: appState.termdbConfig.displaySampleIds,
			hasVerifiedToken: this.app.vocabApi.hasVerifiedToken()
		}
	}

	async main() {
		this.config = structuredClone(this.state.config)
		this.settings = this.config.settings.violin
		await this.setControls()

		if (this.config.chartType != this.type && this.config.childType != this.type) return
		if (this.dom.header)
			this.dom.header.html(
				this.config.term.term.name + ` <span style="opacity:.6;font-size:1em;margin-left:10px;">Violin Plot</span>`
			)

		//Fix for rm'ing error message when plot re-renders
		//Leave in main() so the message doesn't linger whilst
		//the plot is rendering
		const existingMsg = this.dom.banner.style('display', 'none').select('span')
		if (!existingMsg.empty()) existingMsg.remove()

		// Check if we're dealing with a numeric termCollection
		let data
		try {
			this.toggleLoadingDiv()
			if (this.isNumericTermCollection()) {
				data = await this.getDataForNumericTermCollection()
			} else {
				const args = this.validateArgs()
				data = await this.app.vocabApi.getViolinPlotData(args, null, this.api.getAbortSignal())
				if (data.descrStats) args.tw.q.descrStats = data.descrStats
			}
		} catch (e) {
			this.toggleLoadingDiv('none')
			if (this.app.isAbortError(e)) return
			throw e
		}

		this.data = data
		if (this.data.error) {
			this.toggleLoadingDiv('none')
			throw this.data.error
		}

		this.toggleLoadingDiv(this.opts.mode == 'minimal' ? 'none' : '')
		setTimeout(
			() => {
				this.render()
			},
			this.opts.mode == 'minimal' ? 0 : 500
		)
		this.toggleLoadingDiv('none')
	}

	/** Check if term is a numeric termCollection */
	isNumericTermCollection() {
		const t1 = this.config.term
		return t1?.term?.type === 'termCollection' && t1.term.memberType === 'numeric'
	}

	/** Get data for each member term in a numeric termCollection */
	async getDataForNumericTermCollection() {
		const termCollection = this.config.term
		const memberTerms = termCollection.term.termlst || []
		
		if (!memberTerms.length) {
			throw new Error('No member terms found in numeric termCollection')
		}

		// Make requests for member terms in bounded-size batches to limit concurrency
		const BATCH_SIZE = 5
		const allResults = []

		for (let i = 0; i < memberTerms.length; i += BATCH_SIZE) {
			const batch = memberTerms.slice(i, i + BATCH_SIZE)
			const batchResults = await Promise.all(
				batch.map(async (memberTerm) => {
					// Create a term wrapper for this member term
					const memberTw = {
						term: memberTerm,
						q: { mode: 'continuous' }
					}
					
					const args = this.validateArgs(memberTw)
					
					const data = await this.app.vocabApi.getViolinPlotData(
						args,
						null,
						this.api.getAbortSignal()
					)
					
					return { memberTerm, data }
				})
			)
			allResults.push(...batchResults)
		}

		// Combine all results into a single response
		return this.combineNumericTermCollectionData(allResults, termCollection)
	}

	/** Combine data from multiple member terms into a single violin response */
	combineNumericTermCollectionData(results, termCollection) {
		// Find the overall min/max across all member terms
		let min = Infinity
		let max = -Infinity
		const combinedCharts = {}

		results.forEach(({ memberTerm, data }) => {
			if (data.min !== undefined && data.min < min) min = data.min
			if (data.max !== undefined && data.max > max) max = data.max

			// For each chart in this member term's data
			Object.entries(data.charts || {}).forEach(([chartId, chart]) => {
				if (!combinedCharts[chartId]) {
					combinedCharts[chartId] = {
						chartId,
						plots: [],
						pvalues: chart.pvalues // Include pvalues if present
					}
				}

				// Add this member term's plots to the combined chart
				// Update the label to include the member term name
				chart.plots.forEach((plot) => {
					const updatedPlot = {
						...plot,
						label: memberTerm.name || memberTerm.id,
						// Use member term color if available from propsByTermId
						color: termCollection.term.propsByTermId?.[memberTerm.id]?.color || plot.color
					}
					combinedCharts[chartId].plots.push(updatedPlot)
				})
			})
		})

		// Calculate combined descriptive statistics across all member terms
		const combinedDescrStats = this.calculateCombinedDescrStats(results)

		return {
			min: min === Infinity ? undefined : min,
			max: max === -Infinity ? undefined : max,
			bins: results[0]?.data.bins || {},
			charts: combinedCharts,
			descrStats: combinedDescrStats,
			uncomputableValues: null
		}
	}

	/** Calculate combined descriptive statistics from all member terms */
	calculateCombinedDescrStats(results) {
		const allDescrStats = results.map(({ data }) => data.descrStats).filter(Boolean)
		
		if (allDescrStats.length === 0) return undefined
		if (allDescrStats.length === 1) return allDescrStats[0]

		// For violin plots, descrStats is typically an object with properties like min, max, mean, etc.
		// We'll create an aggregate that shows the overall min and max across all member terms
		const firstStats = allDescrStats[0]
		
		// If descrStats is not in the expected format, just return the first one
		if (typeof firstStats !== 'object' || !firstStats) {
			return firstStats
		}

		// Create combined stats showing the range across all member terms
		const combinedStats = { ...firstStats }
		
		// Update min and max to reflect the overall range
		allDescrStats.forEach(stats => {
			if (stats.min !== undefined && (combinedStats.min === undefined || stats.min < combinedStats.min)) {
				combinedStats.min = stats.min
			}
			if (stats.max !== undefined && (combinedStats.max === undefined || stats.max > combinedStats.max)) {
				combinedStats.max = stats.max
			}
		})

		return combinedStats
	}

	validateArgs(memberTw = null) {
		const { term, term2, term0, settings } = this.config
		const s = this.settings
		const arg = {
			svgw: s.svgw,
			orientation: s.orientation,
			devicePixelRatio: window.devicePixelRatio,
			datasymbol: s.datasymbol,
			radius: s.radius,
			axisHeight: s.axisHeight,
			rightMargin: s.rightMargin,
			unit: s.unit,
			ticks: s.ticks,
			orderByMedian: s.orderByMedian,
			filter: this.state.termfilter.filter
		}

		if (this.opts.mode == 'minimal') {
			arg.tw = memberTw || term
			// assume a single term for minimal plot
			if (term2 || term0) throw 'only a single term allowed for minimal plot'
			if ((memberTw || term).q.mode == 'spline') {
				/** FIXME bad design; should not modify setting or even plot state in runtime, 
				instead supply this in constructor arg and generalize it beyond spline
				// term may be cubic spline from regression analysis
				// render knot values as vertical lines on the plot
				*/
				s.lines = (memberTw || term).q.knots.map(x => Number(x.value))
			} else {
				s.lines = []
			}
			if ((memberTw || term).q.scale) {
				// term may be scaled from regression analysis
				// scale the data on the server-side
				arg.scale = (memberTw || term).q.scale
			}
		} else if (isNumericTerm((memberTw || term).term) && (memberTw || term).q.mode === 'continuous') {
			arg.tw = memberTw || term
			if (term2) arg.overlayTw = term2
		} else if (isNumericTerm(term2?.term) && term2.q.mode === 'continuous') {
			arg.tw = term2
			arg.overlayTw = memberTw || term
		} else {
			throw 'both term1 and term2 are not numeric/continuous'
		}

		if (term0) arg.divideTw = term0
		return arg
	}
}

export const violinInit = getCompInit(ViolinPlot)
export const componentInit = violinInit

export function getDefaultViolinSettings(app, overrides = {}) {
	const defaults = {
		orientation: 'horizontal',
		rowlabelw: 250,
		brushRange: null, //object with start and end if there is a brush selection
		svgw: 500, // span length of a plot/svg, not including margin
		datasymbol: 'rug',
		radius: 10,
		axisHeight: 60,
		rightMargin: 50,
		lines: [],
		unit: 'abs', // abs: absolute scale, log: log scale
		rowSpace: 10,
		medianLength: 7,
		medianColor: '#FF0000',
		medianThickness: 3,
		ticks: 15,
		defaultColor: plotColor,
		method: 0,
		orderByMedian: false,
		showStats: true,
		showAssociationTests: true
	}
	return Object.assign(defaults, overrides)
}

export async function getPlotConfig(opts, app) {
	if (!opts.term) throw 'violin getPlotConfig: opts.term{} missing'
	try {
		await fillTermWrapper(opts.term, app.vocabApi)
		if (opts.term2) await fillTermWrapper(opts.term2, app.vocabApi)
		if (opts.term0) await fillTermWrapper(opts.term0, app.vocabApi)
	} catch (e) {
		throw `${e} [violin getPlotConfig()]`
	}

	const config = {
		id: opts.term.term.id,
		controlLabels: Object.assign({}, defaultUiLabels, app.vocabApi.termdbConfig.uiLabels || {}),
		settings: {
			controls: {
				term2: null, // the previous overlay value may be displayed as a convenience for toggling
				term0: null
			},
			// common: {
			// 	use_logscale: false, // flag for y-axis scale type, 0=linear, 1=log
			// 	use_percentage: false,
			// 	barheight: 300, // maximum bar length
			// 	barwidth: 20, // bar thickness
			// 	barspace: 2 // space between two bars
			// },
			violin: getDefaultViolinSettings(app)
		}
	}

	// may apply term-specific changes to the default object
	return copyMerge(config, opts)
}
