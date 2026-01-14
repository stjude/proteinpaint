import { PlotBase, defaultUiLabels } from './PlotBase.ts'
import { getCompInit, copyMerge, type ComponentApi, type RxComponent } from '#rx'
import { controlsInit, term0_term2_defaultQ } from './controls'
import { t0_t2_defaultQ as term0_term2_defaultQ_surv } from './survival/survival.ts'
import { fillTermWrapper } from '#termsetting'

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
		const controlLabels = this.config.controlLabels
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
				label: controlLabels.term2.label,
				defaultQ4fillTW: this.config.term?.term.type == 'survival' ? term0_term2_defaultQ_surv : term0_term2_defaultQ
			},
			{
				type: 'term',
				configKey: 'term0',
				usecase: { target: 'summaryInput', detail: 'term0' },
				label: controlLabels.term0.label,
				defaultQ4fillTW: this.config.term?.term.type == 'survival' ? term0_term2_defaultQ_surv : term0_term2_defaultQ
			}
		]

		const controls = await controlsInit({
			app: this.app,
			id: this.id,
			holder: this.dom.controls.style('display', 'inline-block'),
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
				// if term1 is surival term, launch survival plot
				// otherwise, launch summary plot
				config.chartType = config.term.term.type == 'survival' ? 'survival' : 'summary'
				this.app.dispatch({
					type: 'app_refresh',
					subactions: [
						{
							type: 'plot_create',
							config
						},
						{
							type: 'plot_delete',
							id: this.id
						}
					]
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

export async function getPlotConfig(opts, app) {
	try {
		// don't supply defaultQ if term.bins or term.q is defined (e.g. if q.mode='continuous', shouldn't override it with defaultQ)
		if (opts.term) {
			const defaultQ: any = opts.term.bins || opts.term.q ? undefined : { geneVariant: { type: 'predefined-groupset' } }
			await fillTermWrapper(opts.term, app.vocabApi, defaultQ)
		}
		if (opts.term2) {
			const defaultQ =
				opts.term2.bins || opts.term2.q
					? undefined
					: opts.term.term.type == 'survival'
					? term0_term2_defaultQ_surv
					: term0_term2_defaultQ
			await fillTermWrapper(opts.term2, app.vocabApi, defaultQ)
		}
		if (opts.term0) {
			const defaultQ =
				opts.term0.bins || opts.term0.q
					? undefined
					: opts.term.term.type == 'survival'
					? term0_term2_defaultQ_surv
					: term0_term2_defaultQ
			await fillTermWrapper(opts.term0, app.vocabApi, defaultQ)
		}
	} catch (e: any) {
		if (e.stack) console.log(e.stack)
		throw `${e} [summaryInput getPlotConfig()]`
	}

	const config = {
		chartType: 'summaryInput',
		settings: {},
		controlLabels: Object.assign({}, defaultUiLabels, app.vocabApi.termdbConfig.uiLabels || {})
	}

	// may apply term-specific changes to the default object
	return copyMerge(config, opts)
}
