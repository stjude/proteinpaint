import { getCompInit } from '../rx'
import { controlsInit } from './controls'
import violinRenderer from './violin.renderer'

class ViolinPlot {
	constructor(opts) {
		this.type = 'violin'
	}

	async init() {
		this.dom = {
			controls: this.opts.holder
				.append('div')
				.attr('class', 'sjpp-plot-controls')
				.style('display', 'inline-block'),

			holder: this.opts.holder
				.append('div')
				.style('display', 'inline-block')
				.style('padding', '5px'),

			tableHolder: this.opts.holder
				.append('div')
				.classed('sjpp-tableHolder', true)
				.style('display', 'inline-block')
				.style('padding', '5px')
				.style('vertical-align', 'top')
				.style('margin-left', '0px')
				.style('margin-top', '30px')
		}
		violinRenderer(this)

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
						// TODO: when used under the summary chart, this.opts.usecase may replace the usecase here
						usecase: { target: 'violin', detail: 'term2' }
					},
					{
						label: 'Orientation',
						type: 'radio',
						chartType: 'violin',
						settingsKey: 'orientation',
						options: [{ label: 'Vertical', value: 'vertical' }, { label: 'Horizontal', value: 'horizontal' }]
					}
				]
			})
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
			genome: appState.vocab.genome,
			dslabel: appState.vocab.dslabel,
			nav: appState.nav,
			termfilter: appState.termfilter,
			config,
			bar_click_menu: appState.bar_click_menu || {},
			// optional
			activeCohort: appState.activeCohort,
			termdbConfig: appState.termdbConfig
		}
	}

	async main() {
		this.config = this.state.config
		if (this.dom.header)
			this.dom.header.html(
				this.config.term.term.name + ` <span style="opacity:.6;font-size:1em;margin-left:10px;">Violin Plot</span>`
			)

		this.data = await this.app.vocabApi.getViolinPlotData({
			termid: this.config.term.term.id,
			term2: this.config.term2
		})
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
		this.render()
	}

	getLegendGrps() {
		const t2 = this.config.term2
		const maxPvalsToShow = 5

		this.dom.tableHolder
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.selectAll('*')
			.remove()

		if (t2 == undefined || t2 == null) {
			// no term2, no legend to show
			this.dom.tableHolder.style('display', 'none')
			return
		}

		//disabled separate legend for now

		// const legendHolder = this.dom.tableHolder.append('div').classed('sjpp-legend-div', true)

		// legendHolder.append('div').text(this.config.term2.term.name)

		// for (const plot of this.data.plots) {
		// 	legendHolder
		// 		.append('div')
		// 		.style('font-size', '15px')
		// 		.text(plot.label)
		// }

		//show pvalue table
		// TODO cleanup in a separate component
		let title
		if (this.type == 'violin') {
			title = "Group comparisons (Wilcoxon's rank sum test)"
		}

		const pvalueHolder = this.dom.tableHolder
			.append('div')
			.classed('sjpp-pvalue-div', true)
			.style('margin-top', '30px')
			.style('margin-right', '30px')

		pvalueHolder
			.append('div')
			.style('font-weight', 'bold')
			.style('font-size', '15px')
			.text(title)

		const tablediv = pvalueHolder
			.append('div')
			.style('position', 'inline-block')
			.style('border', '1px solid #ccc')

		console.log(this.data.pvalues.length)

		if (this.data.pvalues.length > maxPvalsToShow) {
			tablediv.style('overflow', 'auto').style('height', '250px')
		}

		const table = tablediv.append('table').style('width', '70%')

		table
			.append('thead')
			.append('tr')
			.selectAll('td')
			.data(['Group 1', 'Group 2', 'P-value'])
			.enter()
			.append('td')
			.style('padding', '1px 8px 1px')
			.style('color', '#858585')
			.style('position', 'sticky')
			.style('top', '0px')
			.style('background', 'white')
			.style('font-size', '15px')
			.text(column => column)

		const tbody = table.append('tbody')
		const tr = tbody
			.selectAll('tr')
			.data(this.data.pvalues)
			.enter()
			.append('tr')
			.attr('class', `pp-${this.type}-chartLegends-pvalue`)

		tr.selectAll('td')
			.data(d => [d.group1, d.group2, d.pvalue])
			.enter()
			.append('td')
			.attr('title', this.type == 'violin' ? 'Click to hide a p-value' : '')
			.style('color', 'black')
			.style('padding', '1px 8px 1px')
			.style('font-size', '15px')
			.style('cursor', this.type == 'violin' ? 'pointer' : 'auto')
			.text(d => d)
	}
}

export const violinInit = getCompInit(ViolinPlot)
export const componentInit = violinInit

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
			violin: {
				orientation: 'horizontal',
				// unit: 'abs',
				// overlay: 'none',
				// divideBy: 'none',
				rowlabelw: 250
			}
		}
	}

	// may apply term-specific changes to the default object
	return copyMerge(config, opts)
}
