import { getCompInit, copyMerge } from '../rx'
import { controlsInit } from './controls'
import violinRenderer from './violin.renderer'
import htmlLegend from '../dom/html.legend'
import { fillTermWrapper } from '#termsetting'
import { setInteractivity } from './violin.interactivity'

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

		violinRenderer(this)
		setInteractivity(this)

		if (this.opts.mode != 'minimal') {
			this.legendRenderer = htmlLegend(this.dom.legendDiv, {
				settings: {
					legendOrientation: 'vertical'
				},
				handlers: {}
			})
		}
		await this.setControls(this.getState(appState))
	}

	async setControls(state) {
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

				usecase: { target: 'violin', detail: 'term2' }
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
				title: 'Thickness of plots, min:60 and max:150',
				type: 'number',
				chartType: 'violin',
				settingsKey: 'plotThickness',
				step: 10,
				max: 500,
				min: 60,
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
			config: Object.assign({}, config, {
				settings: {
					violin: config.settings.violin
				}
			}),
			displaySampleIds: appState.termdbConfig.displaySampleIds,
			hasVerifiedToken: this.app.vocabApi.hasVerifiedToken()
		}
	}

	async main() {
		const c = this.state.config

		if (c.chartType != this.type && c.childType != this.type) return
		this.config = structuredClone(this.state.config)

		if (this.dom.header)
			this.dom.header.text(
				this.config.term.term.name + ` <span style="opacity:.6;font-size:1em;margin-left:10px;">Violin Plot</span>`
			)

		await this.getDescrStats()

		const arg = this.validateArg()

		this.data = await this.app.vocabApi.getViolinPlotData(arg)
		if (this.data.plotThickness) this.config.settings.violin.plotThickness = this.data.plotThickness
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
				.binValueCount
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
		const s = settings.violin
		const thicknessMargin = s.orientation === 'horizontal' ? 70 : 55
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
			screenThickness: window.document.body.clientWidth - thicknessMargin
		}
		if (s.plotThickness) arg.plotThickness = s.plotThickness

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
		datasymbol: 'bean',
		radius: 5,
		strokeWidth: 0.2,
		axisHeight: 60,
		rightMargin: 50,
		displaySampleIds: app?.getState()?.termdbConfig?.displaySampleIds ? true : false,
		lines: [],
		unit: 'abs', // abs: absolute scale, log: log scale
		plotThickness: 150,
		medianLength: 7,
		medianThickness: 3
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
