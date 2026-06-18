import { getCompInit, copyMerge, type RxComponent } from '#rx'
import { PlotBase } from '#plots/PlotBase.js'
import { getCombinedTermFilter } from '#filter'
import { PROTEOME_DAP, SINGLECELL_CELLTYPE } from '#types'
import { getDefaultGseaSettings } from './settings/defaults'
import { GSEAModel } from './model/GSEAModel'
import { isValidGseaParams } from './model/GseaParams'
import { setControls } from './view/GSEAControls'

export class GSEA extends PlotBase implements RxComponent {
	static type = 'gsea'

	type: string
	settings!: any
	components!: { controls: any }
	imageUrl: any
	config!: any
	testEnabled: boolean
	gsea_params!: any
	model!: GSEAModel

	constructor(opts) {
		super(opts)
		this.type = GSEA.type
		this.opts = opts
		this.components = {
			controls: {}
		}
		//Either allow a node to be passed or create a new div
		const controlsDiv =
			typeof opts.controls == 'object' ? opts.controls : opts.holder.append('div').style('display', 'inline-block')
		const main = opts.holder.append('div').style('display', 'inline-block')
		const actionsDiv = main
			.append('div')
			.attr('data-testid', 'sjpp-gsea-actions')
			.style('margin', '10px')
			.style('text-align', 'left')

		//TODO: implement toggleLoadingDiv from parent
		const loadingDiv = main
			.append('div')
			.attr('data-testid', 'sjpp-gsea-loading')
			.style('text-align', 'center')
			.style('display', 'none')
			.style('margin', '10px')
			.style('text-align', 'left')
			.text('Loading...')
		const holder = main
			.append('div')
			.style('margin-left', '50px')
			.style('display', 'inline-block')
			.attr('data-testid', 'sjpp-gsea-holder')
		const detailsDiv = main
			.append('div')
			.attr('data-testid', 'sjpp-gsea-details')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.style('margin-top', '50px')

		const tableDiv = main.append('div').style('margin', '10px').attr('data-testid', 'sjpp-gsea-results-table')

		this.dom = {
			holder,
			header: opts.header,
			actionsDiv,
			loadingDiv,
			controlsDiv,
			detailsDiv,
			tableDiv
		}

		this.testEnabled = JSON.parse(sessionStorage.getItem('optionalFeatures') || '{}')?.gsea_test
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw new Error(`No plot with id='${this.id}' found`)
		const parentConfig = appState.plots.find(p => p.id === this.parentId)
		const termfilter = getCombinedTermFilter(appState, config.filter || parentConfig?.filter)

		return {
			config,
			termfilter,
			genome: appState.vocab.genome,
			dslabel: appState.vocab.dslabel
		}
	}

	async init(appState) {
		const state = this.getState(appState)
		const config = structuredClone(state.config)

		this.model = new GSEAModel(this)
		/** Ensures plots init'ed from session are properly vetted and
		 * mutated as necessary. */
		validateConfigByTermType(config)

		if (!isValidGseaParams(config.gsea_params)) {
			this.gsea_params = await this.model.getGseaParams(config.gsea_params, state, config)
		}

		await setControls(this.dom.controlsDiv, this)
	}

	async main() {
		const state = structuredClone(this.state)
		//TODO: Fix this to use parentId instead
		if (state.config.chartType != this.type && state.config.childType != this.type) return

		if (this.dom.header) {
			const geneCount = this.gsea_params.genes_length ?? this.gsea_params.genes?.length ?? 0
			this.dom.header.html(
				geneCount + ' genes <span style="font-size:.8em;opacity:.7">GENE SET ENRICHMENT ANALYSIS</span>'
			)
		}
		this.imageUrl = null // Reset the image URL

		// render_gsea(this)
	}
}

export const gseaInit = getCompInit(GSEA)
// this alias will allow abstracted dynamic imports
export const componentInit = gseaInit

export async function getPlotConfig(opts, app) {
	// if (!opts.gsea_params) throw 'No gsea_params provided [gsea getPlotConfig()]'
	if (!opts.termType) throw new Error('No termType provided [gsea getPlotConfig()]')
	try {
		const config = {
			gsea_params: {
				genome: app.opts.state.vocab.genome
			},
			//idea for fixing nav button
			//samplelst: { groups: app.opts.state.groups}
			settings: {
				gsea: getDefaultGseaSettings(opts.overrides)
			}
		}

		copyMerge(config, opts)
		validateConfigByTermType(config)
		return config
	} catch (e) {
		throw `${e} [gsea getPlotConfig()]`
	}
}

function validateConfigByTermType(config) {
	if (!config.gsea_params) config.gsea_params = {}
	if (config.termType === PROTEOME_DAP) {
		if (!config.proteomeDetails) throw new Error('No proteomeDetails provided for DAP GSEA')
		config.gsea_params.dapParams = config.proteomeDetails
	} else if (config.termType === SINGLECELL_CELLTYPE) {
		if (!config.sample || !config.termId || !config.categoryName)
			throw new Error('Missing sample, termId, or categoryName for single cell cluster GSEA')
	}
}

export function makeChartBtnMenu(holder, chartsInstance) {
	/*
	holder: the holder in the tooltip
	chartsInstance: MassCharts instance
		termdbConfig is accessible at chartsInstance.state.termdbConfig{}
		mass option is accessible at chartsInstance.app.opts{}
	*/
	// to fill in menu, create options in "holder"
	// to hide menu, call chartsInstance.dom.tip.hide()
	// upon clicking an option, generate plot:
	chartsInstance.prepPlot({
		config: {
			chartType: 'gsea'
		}
	})
}
