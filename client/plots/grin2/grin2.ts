import { getCompInit, copyMerge, type RxComponent, type ComponentApi } from '#rx'
import type { BasePlotConfig, MassAppApi, MassState } from '#mass/types/mass'
import type { GRIN2Dom, GRIN2Opts } from './GRIN2Types'
import { GRIN2Model } from './model/GRIN2Model'
import { GRIN2ViewModel } from './viewModel/GRIN2ViewModel'
import { GRIN2ResultsView } from './view/GRIN2ResultsView'
import { GRIN2ControlsView } from './view/GRIN2ControlsView'
import { getDefaultGRIN2Settings } from './settings/defaults'
import { getCombinedTermFilter, getNormalRoot } from '#filter'
import { sayerror } from '#dom'
import { dtsnvindel, dtcnv, dtfusionrna, dtsv, dt2lesion } from '#shared/common.js'
import { PlotBase } from '#plots/PlotBase.ts'
import { controlsInit } from '#plots/controls.js'

class GRIN2 extends PlotBase implements RxComponent {
	static type = 'grin2'
	readonly type = 'grin2'
	dom: GRIN2Dom
	components: { controls: ComponentApi }
	private model!: GRIN2Model
	private resultsView!: GRIN2ResultsView
	private controlsView: GRIN2ControlsView | null = null

	constructor(opts: any, api) {
		super(opts, api)
		this.opts = opts
		this.components = { controls: {} as ComponentApi }
		opts.holder.classed('sjpp-grin2-main', true)
		this.dom = {
			massControls: opts.holder.append('div').style('display', 'inline-block'),
			headerText: opts.holder.append('div').style('display', 'inline-block'),
			controls: opts.holder.append('div'),
			div: opts.holder.append('div').style('margin', '20px')
		}
		if (opts.header) this.dom.header = opts.header.text('GRIN2')
	}

	getState(appState: MassState) {
		const config = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		const parentConfig = appState.plots.find((p: BasePlotConfig) => p.id === this.parentId)
		const termfilter = getCombinedTermFilter(appState, config.filter || parentConfig?.filter)
		return { config, termfilter }
	}

	async init() {
		this.model = new GRIN2Model(this.app.vocabApi)
		this.resultsView = new GRIN2ResultsView(this.dom.div, this.app)
		this.components.controls = await controlsInit({
			app: this.app,
			id: this.id,
			holder: this.dom.massControls.style('display', 'inline-block'),
			inputs: []
		})

		// Remove the burger and download buttons for now
		const burgerMenu = this.dom.massControls.select('div > svg.bi.bi-copy')
		if (burgerMenu) burgerMenu.remove()
		const downloadBtn = this.dom.massControls.select('div > svg.bi.bi-download')
		if (downloadBtn) downloadBtn.remove()

		this.components.controls.on('helpClick.grin2', () => {
			window.open('https://github.com/stjude/proteinpaint/wiki/Grin2')
		})
	}

	async main() {
		const config = structuredClone(this.state.config)
		if (config.childType != this.type && config.chartType != this.type) return

		if (!this.controlsView) {
			this.controlsView = new GRIN2ControlsView({
				headerHolder: this.dom.headerText,
				controlsHolder: this.dom.controls,
				config: this.state.config,
				vocabApi: this.app.vocabApi,
				genome: this.app.opts.genome,
				callbacks: { onRun: () => this.handleRun() }
			})
			this.controlsView.build()
			if (this.state.config.settings.runAnalysis) this.handleRun()
		}
	}

	private async handleRun() {
		if (!this.controlsView) return
		this.controlsView.setBusy(true)
		try {
			const dtUsage = this.controlsView.getDtUsage()
			this.resultsView.clear()

			const configValues = this.controlsView.getConfigValues(dtUsage)
			const manhattan = this.state.config.settings.manhattan
			const requestData = {
				filter: getNormalRoot(this.state.termfilter.filter),
				filter0: this.state.termfilter.filter0,
				width: manhattan?.plotWidth,
				height: manhattan?.plotHeight,
				pngDotRadius: manhattan?.pngDotRadius,
				devicePixelRatio: window.devicePixelRatio,
				maxGenesToShow: manhattan?.maxGenesToShow,
				lesionTypeColors: manhattan?.lesionTypeColors,
				qValueThreshold: manhattan?.qValueThreshold,
				maxCappedPoints: manhattan?.maxCappedPoints,
				hardCap: manhattan?.hardCap,
				binSize: manhattan?.binSize,
				...configValues
			}

			const response = await this.model.fetchGrin2Data(requestData, this.api!.getAbortSignal())
			if (response.status === 'error') throw `GRIN2 analysis failed: ${response.error}`

			const vm = new GRIN2ViewModel(response, manhattan, dtUsage)
			this.resultsView.render(vm.viewData)

			this.app.dispatch({
				type: 'plot_edit',
				id: this.id,
				config: {
					...this.state.config,
					settings: {
						...this.state.config.settings,
						...configValues,
						dtUsage,
						runAnalysis: true
					}
				}
			})
		} catch (error) {
			// dom.div may be undefined if the sandbox was deleted mid-request — don't crash in that case
			if (this.dom.div) {
				sayerror(this.dom.div, `Error running GRIN2: ${error instanceof Error ? error.message : error}`)
			}
		} finally {
			this.controlsView?.setBusy(false)
		}
	}
}

export const grin2Init = getCompInit(GRIN2)
export const componentInit = grin2Init

export async function getPlotConfig(opts: GRIN2Opts, app: MassAppApi) {
	const queries = app.vocabApi.termdbConfig.queries
	const defaultSettings = getDefaultGRIN2Settings(opts)

	const dtUsage: any = {}

	// Dynamically add data type options based on availability
	if (queries?.snvindel) {
		dtUsage[dtsnvindel] = { checked: true, label: dt2lesion[dtsnvindel].uilabel }
	}
	if (queries?.cnv) {
		dtUsage[dtcnv] = { checked: true, label: dt2lesion[dtcnv].uilabel }
	}
	if (queries?.svfusion) {
		if (queries.svfusion.dtLst.includes(dtfusionrna)) {
			dtUsage[dtfusionrna] = { checked: false, label: dt2lesion[dtfusionrna].uilabel }
		}
		if (queries.svfusion.dtLst.includes(dtsv)) {
			dtUsage[dtsv] = { checked: false, label: dt2lesion[dtsv].uilabel }
		}
	}

	// snvindelOptions / cnvOptions / fusionOptions / svOptions are intentionally not seeded here.
	// ControlsView supplies the user-visible defaults via its own fallback chain
	// (savedCnv ?? dsConfig ?? CNV_*_FALLBACK), and handleRun writes the live form values
	// back into settings on each Run. So before the first Run these stay undefined; after,
	// they are always present from the form. Seeding them here would only add magic numbers
	// that no code reads.
	const config = {
		chartType: 'grin2',
		settings: {
			controls: {},
			dtUsage,
			runAnalysis: false,
			manhattan: {
				...defaultSettings.manhattan,
				...opts?.manhattan
			}
		}
	}

	return copyMerge(config, opts)
}
