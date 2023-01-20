import { getCompInit } from '../rx'
import { controlsInit } from './controls'
import violinRenderer from './violin.renderer'
import { to_svg } from '#src/client'
import htmlLegend from '../dom/html.legend'

class ViolinPlot {
	constructor(opts) {
		this.type = 'violin'
		setInteractivity(this)
	}

	async init() {
		const controls = this.opts.holder
			.append('div')
			.attr('class', 'sjpp-plot-controls')
			.style('display', 'inline-block')

		const holder = this.opts.holder
			.append('div')
			.style('display', 'inline-block')
			.style('padding', '5px')
			.style('padding-left', '45px')
			.attr('id', 'sjpp-vp-holder')

		this.dom = {
			loadingDiv: this.opts.holder
				.append('div')
				.style('position', 'absolute')
				.style('display', 'inline-block')
				.style('padding-left', '10px')
				.style('padding-top', '20px')
				.text('Loading ...'),
			controls,
			violinDiv: holder
				.append('div')
				.attr('id', 'sjpp-vp-violinDiv')
				.style('padding-left', '10px'),
			legendDiv: holder
				.append('div')
				.classed('sjpp-vp-legend', true)
				.style('padding-left', '5px'),
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

		this.legendRenderer = htmlLegend(this.dom.legendDiv, {
			settings: {
				legendOrientation: 'vertical'
			},
			handlers: {}
		})

		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: this.dom.controls,
				inputs: [
					{
						type: 'term1',
						// TODO: when used under the summary chart, this.opts.usecase may replace the usecase here
						usecase: { target: 'violin', detail: 'term' }
					},
					{
						type: 'overlay',
						//TODO: when term is numeric use 'overlay' otherwise for categories use 'Divide by'
						// TODO: when used under the summary chart, this.opts.usecase may replace the usecase here
						usecase: { target: 'violin', detail: 'term2' }
					},
					{
						label: 'Orientation',
						type: 'radio',
						chartType: 'violin',
						settingsKey: 'orientation',
						options: [{ label: 'Vertical', value: 'vertical' }, { label: 'Horizontal', value: 'horizontal' }]
					},
					{
						label: 'Data symbol',
						type: 'radio',
						chartType: 'violin',
						settingsKey: 'datasymbol',
						options: [{ label: 'Ticks', value: 'rug' }, { label: 'Circles', value: 'bean' }]
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
						type: 'number',
						chartType: 'violin',
						settingsKey: 'strokeWidth',
						step: 0.1,
						max: 2,
						min: 0.1
					}
				]
			})
		}
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
			})
		}
	}

	async main() {
		if (this.state.config.childType != this.type) return
		this.config = structuredClone(this.state.config)
		if (this.dom.header)
			this.dom.header.text(
				this.config.term.term.name + ` <span style="opacity:.6;font-size:1em;margin-left:10px;">Violin Plot</span>`
			)

		await this.getDescrStats()

		const arg = this.validateArg()

		this.data = await this.app.vocabApi.getViolinPlotData(arg)

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
		this.toggleLoadingDiv('')
		setTimeout(() => {
			this.render()
			this.renderPvalueTable()
		}, 800)
		this.toggleLoadingDiv('none')
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

	validateArg() {
		const { term, term2, settings } = this.config
		const s = settings.violin
		const arg = {
			filter: this.state.termfilter.filter,
			svgw: s.svgw / window.devicePixelRatio,
			orientation: s.orientation,
			devicePixelRatio: window.devicePixelRatio,
			datasymbol: s.datasymbol,
			radius: s.radius,
			strokeWidth: s.strokeWidth
		}

		if (term?.q?.mode === 'continuous' && term2?.q?.mode === 'continuous') {
			throw 'both term1 and term2 are numeric/continuous, please use Scatter plot'
		} else if ((term.term.type == 'float' || term.term.type == 'integer') && term.q.mode == 'continuous') {
			arg.termid = term.id
			arg.divideTw = term2
		} else if ((term2?.term?.type == 'float' || term2?.term?.type == 'integer') && term2.q.mode == 'continuous') {
			arg.termid = term2.id
			arg.divideTw = term
		} else {
			throw 'both term1 and term2 are not numeric/continuous'
		}
		return arg
	}

	getLegendGrps() {
		// TODO: add excluded categories to legend (see barchart.js)
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

		return legendGrps
	}
}

export const violinInit = getCompInit(ViolinPlot)
export const componentInit = violinInit

function setInteractivity(self) {
	self.download = function() {
		if (!self.state) return

		// has to be able to handle multichart view
		// const mainGs = []
		// const translate = { x: undefined, y: undefined }
		// const titles = []
		// let maxw = 0,
		// 	maxh = 0,
		// 	tboxh = 0
		// let prevY = 0,
		// 	numChartsPerRow = 0

		self.dom.violinDiv.selectAll('.sjpp-violin-plot').each(function() {
			to_svg(this, 'violin', { apply_dom_styles: true })
		})
	}
}

export function getDefaultViolinSettings() {
	return {
		orientation: 'horizontal',
		rowlabelw: 250,
		brushRange: null, //object with start and end if there is a brush selection
		svgw: 500, // span length of a plot/svg, not including margin
		datasymbol: 'bean',
		radius: 5,
		strokeWidth: 0.2,
		axisHeight: 60,
		rightMargin: 50
	}
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
			violin: getDefaultViolinSettings()
		}
	}

	// may apply term-specific changes to the default object
	return copyMerge(config, opts)
}
