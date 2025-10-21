import { PlotBase } from './PlotBase.ts'
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

	async init() {
		const customControls = this.app.getState().termdbConfig.customControls
		const inputs = [
			{
				type: 'term',
				configKey: 'term',
				label: customControls?.term?.label || 'Primary Variable'
			},
			{
				type: 'term',
				configKey: 'term2',
				label: customControls?.term2?.label || 'Overlay Variable'
			},
			{
				type: 'term',
				configKey: 'term0',
				label: customControls?.term0?.label || 'Divide by Variable'
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

		this.dom.submit
			.append('button')
			.property('disabled', true)
			.style('border', 'none')
			.style('border-radius', '20px')
			.style('padding', '10px 15px')
			.text('Submit')
			.on('click', () => {
				const config = structuredClone(this.config)
				if (!config.term) throw 'config.term is missing'
				config.chartType = config.term.term.type == 'survival' ? 'survival' : 'summary'
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

	async main() {
		this.config = await this.getMutableConfig()
		const submitBtn = this.dom.submit.select('button')
		submitBtn.property('disabled', !this.config.term)
		submitBtn.style('cursor', this.config.term ? 'pointer' : 'default')
	}
}

export const summaryInputInit = getCompInit(SummaryInputPlot)
export const componentInit = summaryInputInit

export function getPlotConfig() {
	const config = {
		chartType: 'summaryInput',
		settings: {}
	}
	return config
}
