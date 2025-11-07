import { PlotBase, defaultUiLabels } from './PlotBase.ts'
import { getCompInit, type ComponentApi, type RxComponent } from '#rx'
import { controlsInit } from './controls'

class SummaryInputPlot extends PlotBase implements RxComponent {
	static type = 'summaryInput'

	// expected RxComponent props, some are already declared/set in PlotBase
	type: string
	parentId?: string
	dom!: {
		[index: string]: any
	}
	components: {
		[name: string]: ComponentApi | { [name: string]: ComponentApi }
	} = {}
	// expected class-specific props
	configTermKeys = ['term', 'term0', 'term2']
	config: any

	constructor(opts, api) {
		super(opts, api)
		this.type = SummaryInputPlot.type
		this.dom = this.getDom()
	}

	getDom() {
		const opts = this.opts
		const dom = {
			header: opts.header,
			holder: opts.holder,
			controls: opts.holder.append('div'),
			submit: opts.holder.append('div').style('margin', '10px')
		}
		if (dom.header) dom.header.html('Correlation Input')
		return dom
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			termfilter: appState.termfilter,
			config,
			// quick fix to skip history tracking as needed
			_scope_: appState._scope_
		}
	}

	async setControls() {
		this.dom.controls.selectAll('*').remove()
		const controlLabels = this.state.config.controlLabels
		const inputs = [
			{
				type: 'term',
				configKey: 'term',
				usecase: { target: 'summaryInput', detail: 'term' },
				label: controlLabels.term1?.label || 'Primary variable'
			},
			{
				type: 'term',
				configKey: 'term2',
				usecase: { target: 'summaryInput', detail: 'term2' },
				label: controlLabels.term2.label
			},
			{
				type: 'term',
				configKey: 'term0',
				usecase: { target: 'summaryInput', detail: 'term0' },
				label: controlLabels.term0.label
			}
		]

		const controls = await controlsInit({
			app: this.app,
			id: this.id,
			holder: this.dom.controls.attr('class', 'pp-termdb-plot-controls').style('display', 'inline-block'),
			isOpen: true,
			showTopBar: false,
			inputs
		})

		const appState = this.app.getState()
		controls.update({ state: this.state, appState })
	}

	renderSubmit() {
		this.dom.submit.selectAll('*').remove()
		this.dom.submit
			.append('button')
			.property('disabled', !this.config.term)
			.style('border', 'none')
			.style('border-radius', '20px')
			.style('padding', '10px 15px')
			.style('cursor', this.config.term ? 'pointer' : 'default')
			.text('Submit')
			.on('click', () => {
				const config = structuredClone(this.config)
				if (!config.term) throw 'config.term is missing'
				config.chartType = 'summary'
				if (config.term.term.type == 'survival') {
					config.chartType = 'survival'
					// remove q from term2 and term0 so that they use defaultQ
					// specified in getPlotConfig() of survival plot
					if (config.term2) config.term2 = { term: config.term2.term }
					if (config.term0) config.term0 = { term: config.term0.term }
				}
				this.app.dispatch({
					type: 'plot_create',
					config
				})
				this.app.dispatch({
					type: 'plot_delete',
					id: this.id
				})
			})
	}

	async main() {
		this.config = await this.getMutableConfig()
		await this.setControls()
		this.renderSubmit()
	}
}

export const summaryInputInit = getCompInit(SummaryInputPlot)
export const componentInit = summaryInputInit

export function getPlotConfig(_opts, app) {
	const config = {
		chartType: 'summaryInput',
		settings: {},
		controlLabels: Object.assign({}, defaultUiLabels, app.vocabApi.termdbConfig.uiLabels || {})
	}
	return config
}
