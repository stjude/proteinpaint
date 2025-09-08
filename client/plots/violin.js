import { getCompInit, copyMerge } from '../rx'
import { controlsInit, term0_term2_defaultQ, renderTerm1Label } from './controls'
import setViolinRenderer from './violin.renderer'
import htmlLegend from '../dom/html.legend'
import { fillTermWrapper } from '#termsetting'
import { setInteractivity } from './violin.interactivity'
import { plotColor } from '#shared/common.js'
import { isNumericTerm } from '#shared/terms.js'
import { getCombinedTermFilter } from '#filter'

/*
when opts.mode = 'minimal', a minimal violin plot will be rendered that will have a single term and minimal features (i.e. no controls, legend, labels, brushing, transitions, etc.)

TODO default to unit=log if term enables
*/

class ViolinPlot {
	constructor(opts) {
		this.type = 'violin'
		if (opts?.parentId) this.parentId = opts.parentId
	}

	async init(appState) {
		const controls = this.opts.holder.append('div').attr('class', 'sjpp-plot-controls').style('display', 'inline-block')
		const config = appState.plots.find(p => p.id === this.id)

		const holder = this.opts.holder
			.append('div')
			.style('display', 'inline-block')
			.style('padding', this.opts.mode != 'minimal' ? '5px' : '0px')
			.style('padding-left', this.opts.mode != 'minimal' ? '10px' : '0px')
			.attr('id', 'sjpp-vp-holder')

		this.dom = {
			header: this.opts.header,
			loadingDiv: this.opts.holder
				.append('div')
				.style('position', 'absolute')
				.style('display', this.opts.mode != 'minimal' ? 'inline-block' : 'none')
				.style('padding-left', '10px')
				.style('padding-top', '20px')
				.text('Loading ...'),
			controls,
			violinDiv: holder
				.append('div')
				.attr('class', 'sjpp-vp-violinDiv')
				.style('display', 'flex')
				.style('flex-direction', 'row')
				.style('flex-wrap', 'wrap')
				.style('max-width', '100vw')
				.style('padding-left', this.opts.mode != 'minimal' ? '10px' : '0px'),
			legendDiv: holder
				.append('div')
				.classed('sjpp-vp-legend', true)
				.style('padding-left', '5px')
				.style('padding-top', '10px')
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

	async setControls() {
		this.dom.controls.selectAll('*').remove()
		this.components = {}
		if (this.opts.mode == 'minimal') return
		const inputs = [
			{
				type: 'term',
				configKey: 'term',
				chartType: 'violin',
				usecase: { target: 'violin', detail: 'term' },
				label: renderTerm1Label,
				vocabApi: this.app.vocabApi,
				menuOptions: 'edit'
			},
			{
				type: 'term',
				configKey: 'term2',
				chartType: 'violin',
				usecase: { target: 'violin', detail: 'term2' },
				title: 'Overlay data',
				label: 'Overlay',
				vocabApi: this.app.vocabApi,
				numericEditMenuVersion: this.opts.numericEditMenuVersion,
				defaultQ4fillTW: term0_term2_defaultQ
			},
			{
				type: 'term',
				configKey: 'term0',
				chartType: 'violin',
				usecase: { target: 'violin', detail: 'term0' },
				title: 'Divide by data',
				label: 'Divide by',
				vocabApi: this.app.vocabApi,
				numericEditMenuVersion: this.opts.numericEditMenuVersion,
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
					for (const k of Object.keys(this.data.charts)) {
						const chart = this.data.charts[k]
						if (chart.plots.length > 1) style = ''
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
				max: 10,
				min: 4
			},
			{
				label: 'Stroke width',
				title: 'Size of Symbol stroke',
				type: 'number',
				chartType: 'violin',
				settingsKey: 'strokeWidth',
				step: 0.1,
				max: 2,
				min: 0.1
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
				min: 500,
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
				min: 40,
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
				max: 15,
				min: 3,
				debounceInterval: 1000
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
				label: 'Default color',
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
			}
		]
		if (this.config.term2)
			inputs.push({
				label: 'Show association tests',
				type: 'checkbox',
				chartType: 'violin',
				settingsKey: 'showAssociationTests',
				boxLabel: 'Yes'
			})
		this.components.controls = await controlsInit({
			app: this.app,
			id: this.id,
			holder: this.dom.controls,
			inputs
		})

		this.components.controls.on('downloadClick.violin', this.download)
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

		const args = this.validateArgs()
		await Promise.all([
			this.getDescrStats(),
			this.app.vocabApi
				.getViolinPlotData(args)
				.then(data => {
					this.data = data
				})
				.catch(e => {
					throw e
				})
		])
		if (this.data.error) throw this.data.error
		/*
		.min
		.max
		.plots[]
			.biggestBin
			.label
			.plotValueCount
			.bins[]
				.x0
				.x1
				.density
		*/
		this.toggleLoadingDiv(this.opts.mode == 'minimal' ? 'none' : '')
		setTimeout(
			() => {
				this.render()
			},
			this.opts.mode == 'minimal' ? 0 : 500
		)
		this.toggleLoadingDiv('none')
	}

	async getDescrStats() {
		// get descriptive statistics for numerical terms
		const terms = [this.config.term]
		if (this.config.term2) terms.push(this.config.term2)
		if (this.config.term0) terms.push(this.config.term0)
		const promises = []
		for (const t of terms) {
			if (!isNumericTerm(t.term)) continue
			promises.push(
				this.app.vocabApi
					.getDescrStats(t, this.state.termfilter, this.config.settings?.violin?.unit == 'log')
					.then(data => {
						if (data.error) throw data.error
						t.q.descrStats = data.values
					})
			)
		}
		if (promises.length) await Promise.all(promises)
	}

	validateArgs() {
		const { term, term2, term0, settings } = this.config
		const s = this.settings
		const arg = {
			filter: this.state.termfilter.filter,
			filter0: this.state.termfilter.filter0,
			svgw: s.svgw / window.devicePixelRatio,
			orientation: s.orientation,
			devicePixelRatio: window.devicePixelRatio,
			datasymbol: s.datasymbol,
			radius: s.radius,
			strokeWidth: s.strokeWidth,
			axisHeight: s.axisHeight,
			rightMargin: s.rightMargin,
			unit: s.unit,
			ticks: s.ticks,
			orderByMedian: s.orderByMedian
		}

		if (this.opts.mode == 'minimal') {
			arg.tw = term
			// assume a single term for minimal plot
			if (term2 || term0) throw 'only a single term allowed for minimal plot'
			if (term.q.mode == 'spline') {
				// term may be cubic spline from regression analysis
				// render knot values as vertical lines on the plot
				s.lines = term.q.knots.map(x => Number(x.value))
			} else {
				s.lines = []
			}
			if (term.q.scale) {
				// term may be scaled from regression analysis
				// scale the data on the server-side
				arg.scale = term.q.scale
			}
		} else if (isNumericTerm(term.term) && term.q.mode === 'continuous') {
			arg.tw = term
			if (term2) arg.overlayTw = term2
		} else if (isNumericTerm(term2?.term) && term2.q.mode === 'continuous') {
			arg.tw = term2
			arg.overlayTw = term
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
		radius: 4,
		strokeWidth: 0.2,
		axisHeight: 60,
		rightMargin: 50,
		lines: [],
		unit: 'abs', // abs: absolute scale, log: log scale
		rowSpace: 10,
		medianLength: 7,
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
