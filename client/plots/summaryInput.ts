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
		this.dom = {
			header: opts.header.html('Correlation Input'),
			holder: opts.holder,
			controls: opts.holder.append('div'),
			submit: opts.holder
				.append('div')
				.style('position', 'relative')
				.style('margin', '10px')
				.style('max-width', '200px')
		}
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

	async init(appState) {
		const state = this.getState(appState)
		this.renderSubmit()
		await this.setControls(state.config)
	}

	async setControls(config) {
		const controlLabels = config.controlLabels
		const inputs = [
			{
				type: 'term',
				configKey: 'term',
				usecase: { target: 'summaryInput', detail: 'term' },
				label: controlLabels.term1?.label || 'Primary variable',
				processConfig: config => {
					const { term, term2, term0, term2_surv, term0_surv } = this.state.config
					const editedType = config.term?.term?.type
					if (editedType === term?.term?.type) return
					if (editedType == 'survival') {
						if (term2 && term2.term?.name != term2_surv?.term?.name)
							config.term2 = { term: structuredClone(term2.term), q: {} }
						if (term0 && term0.term?.name != term0_surv?.term?.name)
							config.term0 = { term: structuredClone(term0.term), q: {} }
					} else {
						if (term2_surv && term2_surv.term?.name != term2?.term?.name)
							config.term2 = { term: structuredClone(term2_surv.term), q: {} }
						if (term0_surv && term0_surv.term.name != term0?.term?.name)
							config.term0 = { term: structuredClone(term0_surv.term), q: {} }
					}
				}
			},
			{
				type: 'term',
				configKey: 'term2',
				usecase: { target: 'summaryInput', detail: 'term2' },
				label: controlLabels.term2.label,
				defaultQ4fillTW: term0_term2_defaultQ,
				getDisplayStyle: plot => (plot.config.term?.term.type == 'survival' ? 'none' : 'table-row')
			},
			{
				type: 'term',
				configKey: 'term0',
				usecase: { target: 'summaryInput', detail: 'term0' },
				label: controlLabels.term0.label,
				defaultQ4fillTW: term0_term2_defaultQ,
				getDisplayStyle: plot => (plot.config.term?.term.type == 'survival' ? 'none' : 'table-row')
			},
			{
				type: 'term',
				configKey: 'term2_surv',
				usecase: { target: 'summaryInput', detail: 'term2' },
				label: controlLabels.term2.label,
				defaultQ4fillTW: term0_term2_defaultQ_surv,
				getDisplayStyle: plot => (plot.config.term?.term.type == 'survival' ? 'table-row' : 'none')
			},
			{
				type: 'term',
				configKey: 'term0_surv',
				usecase: { target: 'summaryInput', detail: 'term0' },
				label: controlLabels.term0.label,
				defaultQ4fillTW: term0_term2_defaultQ_surv + '_surv',
				getDisplayStyle: plot => (plot.config.term?.term.type == 'survival' ? 'table-row' : 'none')
			}
		]

		this.components.controls = await controlsInit({
			app: this.app,
			id: this.id,
			holder: this.dom.controls.style('display', 'inline-block'),
			isOpen: true,
			showTopBar: false,
			inputs,
			// may comment out loadingMasks option to be able to click the submit button and
			// manually test submitting before a config tw is fully filled, there should only be
			// a console warning and no displayed error messages in the app
			loadingMasks: [this.dom.submitMask]
		})

		//const appState = this.app.getState()
		//this.components.update({ state: this.state, appState })
	}

	renderSubmit() {
		this.dom.submitBtn = this.dom.submit
			.append('button')
			.property('disabled', true)
			.style('border', 'none')
			.style('border-radius', '20px')
			.style('padding', '10px 15px')
			.text('Submit')
			.on('click', () => {
				const { term, term2, term0, term2_surv, term0_surv } = structuredClone(this.config)

				if (!term) throw 'config.term is missing'
				// if term1 is surival term, launch survival plot
				// otherwise, launch summary plot
				const chartType = term.term.type == 'survival' ? 'survival' : 'summary'
				this.app.dispatch({
					type: 'app_refresh',
					subactions: [
						{
							type: 'plot_create',
							config: {
								chartType,
								term,
								term2: chartType == 'survival' ? term2_surv : term2,
								term0: chartType == 'survival' ? term0_surv : term0
							}
						},
						{
							type: 'plot_delete',
							id: this.id
						}
					]
				})
			})

		this.dom.submitMask = this.dom.submit
			.append('div')
			.style('position', 'absolute')
			.style('top', 0)
			.style('left', 0)
			.style('height', '100%')
			.style('width', '100%')
			.style('background-color', `rgba(240,240,240,0.6)`)
			.style('display', 'none')
	}

	async main() {
		this.config = await this.getMutableConfig()
		this.dom.submitBtn.property('disabled', !this.config.term).style('cursor', this.config.term ? 'pointer' : 'default')
		this.dom.submitMask.style('display', 'none')
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
