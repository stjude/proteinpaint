import { getCompInit, copyMerge } from '../rx'
import { controlsInit } from './controls'
import setViolinRenderer from './violin.renderer'
import htmlLegend from '../dom/html.legend'
import { fillTermWrapper } from '#termsetting'
import { setInteractivity } from './violin.interactivity'
import { plotColor } from '../shared/common'

/*
when opts.mode = 'minimal', a minimal violin plot will be rendered that will have a single term and minimal features (i.e. no controls, legend, labels, brushing, transitions, etc.)

TODO default to unit=log if term enables
*/

class ViolinPlot {
	constructor(opts) {
		this.type = 'violin'
	}

	async init(appState) {
		const controls = this.opts.holder.append('div').attr('class', 'sjpp-plot-controls').style('display', 'inline-block')
		const config = appState.plots.find(p => p.id === this.id)

		const holder = this.opts.holder
			.append('div')
			.style('display', 'inline-block')
			.style('padding', this.opts.mode != 'minimal' ? '5px' : '0px')
			.style('padding-left', this.opts.mode != 'minimal' ? '45px' : '0px')
			.attr('id', 'sjpp-vp-holder')

		this.dom = {
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
				// set attr('class') class when using a constant string value below;
				// should not set a constant attr('id') value for the violinDiv,
				// since multiple violin plots in the same view must not share the same ID value
				.attr('class', 'sjpp-vp-violinDiv')
				.style('padding-left', this.opts.mode != 'minimal' ? '10px' : '0px'),
			legendDiv: holder.append('div').classed('sjpp-vp-legend', true).style('padding-left', '5px'),

			tableHolder: this.opts.holder
				.append('div')
				.classed('sjpp-tableHolder', true)
				.style('display', 'inline-block')
				.style('padding', '10px')
				.style('vertical-align', 'top')
				.style('margin-left', '0px')
				.style('margin-top', '30px')
				.style('margin-right', '30px')
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
		await this.setControls()
	}

	async setControls() {
		//this.dom.controls.selectAll('*').remove()
		this.components = {}
		if (this.opts.mode == 'minimal') return
		const inputs = [
			{
				type: 'term1',
				// TODO: when used under the summary chart, this.opts.usecase may replace the usecase here
				usecase: { target: 'violin', detail: 'term' }
			},
			{
				type: 'overlay',
				title: 'Overlay data',
				//TODO: when term is numeric use 'overlay' otherwise for categories use 'Divide by'
				// TODO: when used under the summary chart, this.opts.usecase may replace the usecase here

				usecase: { target: 'violin', detail: 'term2' },
				callback: value => (this.settings.plotThickness = undefined)
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
				label: 'Method',
				title: `If selected uses the KDE method, otherwise uses a histogram`,
				type: 'radio',
				chartType: 'violin',
				settingsKey: 'method',
				options: [
					{ label: 'KDE', value: 0 },
					{ label: 'Histogram', value: 1 }
				]
			},
			{
				label: 'Bandwidth',
				type: 'number',
				title:
					'It only applies to the KDE method. If the bandwidth is too small, the estimate may include spurious bumps and wiggles; too large, and the estimate reveals little about the underlying distribution',
				chartType: 'violin',
				settingsKey: 'bandwidth',
				min: 1,
				max: 20
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
					{ label: 'Log', value: 'log' }
				]
			},
			{
				label: 'Symbol size',
				type: 'number',
				chartType: 'violin',
				settingsKey: 'radius',
				step: 1,
				max: 15,
				min: 3
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
				label: 'Ticks',
				type: 'number',
				chartType: 'violin',
				settingsKey: 'ticks',
				title: 'Number of ticks used to build the plot',
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
				title: 'Thickness of plots, can be between 40 and 200',
				type: 'number',
				chartType: 'violin',
				settingsKey: 'plotThickness',
				step: 10,
				max: 500,
				min: 40,
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
			termfilter: appState.termfilter,
			config,
			displaySampleIds: appState.termdbConfig.displaySampleIds,
			hasVerifiedToken: this.app.vocabApi.hasVerifiedToken()
		}
	}

	async main() {
		this.config = structuredClone(this.state.config)
		this.settings = this.config.settings.violin

		if (this.config.chartType != this.type && this.config.childType != this.type) return

		if (this.dom.header)
			this.dom.header.text(
				this.config.term.term.name + ` <span style="opacity:.6;font-size:1em;margin-left:10px;">Violin Plot</span>`
			)

		await this.getDescrStats()

		const arg = this.validateArg()

		this.data = await this.app.vocabApi.getViolinPlotData(arg)

		if (this.settings.plotThickness == undefined) {
			const thickness = this.data.plots.length == 1 ? 200 : 150
			this.settings.plotThickness = Math.min(1400 / this.data.plots.length, thickness)
		}
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
				this.renderPvalueTable()
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
		for (const t of terms) {
			if (t.term.type == 'integer' || t.term.type == 'float') {
				const data = await this.app.vocabApi.getDescrStats(t.id, this.state.termfilter.filter, this.config.settings)
				if (data.error) throw data.error
				t.q.descrStats = data.values
			}
		}
	}

	validateArg() {
		const { term, term2, settings } = this.config
		const s = this.settings
		const arg = {
			filter: this.state.termfilter.filter,
			svgw: s.svgw / window.devicePixelRatio,
			orientation: s.orientation,
			devicePixelRatio: window.devicePixelRatio,
			datasymbol: s.datasymbol,
			radius: s.radius,
			strokeWidth: s.strokeWidth,
			axisHeight: s.axisHeight,
			rightMargin: s.rightMargin,
			unit: s.unit,
			isKDE: s.method == 0,
			ticks: s.ticks,
			bandwidth: s.bandwidth
		}

		if (this.opts.mode == 'minimal') {
			// assume a single term for minimal plot
			if (term2) throw 'only a single term allowed for minimal plot'
			arg.termid = term.id
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
		} else if ((term.term.type === 'float' || term.term.type === 'integer') && term.q.mode === 'continuous') {
			arg.termid = term.id
			if (term2) arg.divideTw = term2
		} else if ((term2?.term?.type === 'float' || term2?.term?.type === 'integer') && term2.q.mode === 'continuous') {
			if (term2) arg.termid = term2.id
			arg.divideTw = term
		} else {
			throw 'both term1 and term2 are not numeric/continuous'
		}
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
		radius: 3,
		strokeWidth: 0.2,
		axisHeight: 60,
		rightMargin: 50,
		lines: [],
		unit: 'abs', // abs: absolute scale, log: log scale
		plotThickness: undefined,
		medianLength: 7,
		medianThickness: 3,
		ticks: 20,
		bandwidth: 5,
		defaultColor: plotColor,
		method: 0
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
				isOpen: false, // control panel is hidden by default
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
