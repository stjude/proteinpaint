import { PlotBase } from '../PlotBase.ts'
import { getCompInit, type ComponentApi, type RxComponent } from '#rx'
import { Menu, sayerror } from '#dom'
import { getNormalRoot } from '#filter'
import { Model } from './model/Model.ts'
import { View } from './view/View.ts'
import { TabsRenderer } from './view/TabsRenderer.ts'
import { GeneSearchRenderer } from './view/GeneSearchRenderer.ts'
import { Interactions, mayUpdateGroupTestMethodsIdx } from './interactions/Interactions.ts'

class TdbGenomeBrowser extends PlotBase implements RxComponent {
	static type = 'genomeBrowser'

	// expected RxComponentInner props, some are already declared/set in PlotBase
	type: string
	parentId?: string
	dom!: {
		[index: string]: any
	}
	components: {
		[name: string]: ComponentApi | { [name: string]: ComponentApi }
	} = {}
	interactions: any

	constructor(opts, api) {
		super(opts, api)
		this.type = TdbGenomeBrowser.type
		this.dom = this.getDom()
	}

	getDom() {
		const holder = this.opts.holder.append('div')
		this.opts.header
			.append('div')
			.style('opacity', 0.6)
			.style('padding-left', '10px')
			.style('font-size', '0.75em')
			.text('GENOME BROWSER')
		// layout rows from top to bottom
		const loadingDiv = holder.append('div').style('display', 'none').style('margin-left', '25px').text('Loading...')
		const errDiv = holder.append('div').style('display', 'none').style('margin', '10px')
		const controlsDiv = holder.append('div').style('margin', '15px 0px 25px 25px')
		const dom = {
			tip: new Menu(),
			holder,
			loadingDiv,
			errDiv,
			tabsDiv: controlsDiv.append('div'),
			geneSearchDiv: controlsDiv.append('div'),
			blockHolder: holder.append('div')
		}
		return dom
	}

	async init() {
		this.interactions = new Interactions(this.app, this.dom, this.id)
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return {
			config,
			filter: getNormalRoot(appState.termfilter.filter),
			vocab: appState.vocab
		}
	}

	async main() {
		this.dom.loadingDiv.style('display', 'block')
		this.dom.errDiv.style('display', 'none')
		const state = this.getState(this.app.getState())
		if (state.config.chartType != this.type) return
		const opts = this.getOpts()
		// NOTE: tabs and genesearch will re-render upon every coordinate change
		const tabs = new TabsRenderer(state, this.dom, opts, this.interactions)
		tabs.main()
		const geneSearch = new GeneSearchRenderer(state, this.dom.geneSearchDiv, opts, this.interactions)
		geneSearch.main()
		if (state.config.geneSearchResult) {
			// valid gene search result
			// render genome browser
			try {
				this.dom.geneSearchDiv.style('display', 'none')
				const model = new Model(state, this.app)
				const data = await model.preComputeData()
				const view = new View(state, data, this.dom, opts, this.interactions)
				await view.main()
			} catch (e: any) {
				this.dom.errDiv.style('display', 'block')
				sayerror(this.dom.errDiv, 'Error: ' + (e.message || e))
				if (e.stack) console.log(e.stack)
			}
		}
		this.dom.loadingDiv.style('display', 'none')
	}

	// get options for view model and view
	getOpts() {
		const opts = {
			genome: this.app.opts.genome,
			vocabApi: this.app.vocabApi,
			debug: this.app.opts.debug,
			plotDiv: this.opts.plotDiv,
			header: this.opts.header
		}
		return opts
	}
}

export const genomeBrowserInit = getCompInit(TdbGenomeBrowser)
// this alias will allow abstracted dynamic imports
export const componentInit = genomeBrowserInit

export async function getPlotConfig(opts, app) {
	try {
		// request default queries config from dataset, and allows opts to override
		const c = await getDefaultConfig(app.vocabApi, opts)
		//console.log(c)
		return c
	} catch (e) {
		throw `${e} [genomeBrowser getPlotConfig()]`
	}
}

/* compute default config
vocabApi
override? {}
    optional custom state to override default
*/
async function getDefaultConfig(vocabApi, override) {
	const config = Object.assign(
		// clone for modifying
		structuredClone({
			snvindel: vocabApi.termdbConfig.queries.snvindel,
			trackLst: vocabApi.termdbConfig.queries.trackLst,
			ld: vocabApi.termdbConfig.queries.ld
		}),
		override || {}
	)
	computeBlockModeFlag(config, vocabApi)

	if (config.snvindel) {
		// presence of snvindel will generate the "mds3" tk, here setup associated config
		// request default variant filter (vcf INFO), required for snvindel
		if (!config.variantFilter) {
			const vf = await vocabApi.get_variantFilter()
			if (vf?.filter) {
				config.variantFilter = vf
			}
		}
		if (config.snvindel.details) {
			// test method may be inconsistent with group configuration (e.g. no fisher for INFO fields), update test method here
			// 1st arg is a fake "self"
			mayUpdateGroupTestMethodsIdx({ config }, config.snvindel.details)
			// a type=filter group may use filterByCohort. in such case, modify default state to assign proper filter based on current cohort
			const gf = config.snvindel.details.groups.find(i => i.type == 'filter')
			if (gf?.filterByCohort) {
				const activeCohort = vocabApi.state.activeCohort
				if (!Number.isInteger(activeCohort)) throw 'filterByCohort but activeCohort not integer'
				// modify and assign
				gf.filter = gf.filterByCohort[vocabApi.termdbConfig.selectCohort.values[activeCohort].keys.join(',')]
				if (!gf.filter) throw 'unknown filter by current cohort name'
				delete gf.filterByCohort
			}
		}

		if (typeof config.snvindel.shown != 'boolean') {
			// create missing tracker property with default value to determine if to show/hide snvindel mds3 tk
			if (config.trackLst) {
				// also has track lst/facet
				// hardcoded! hide snvindel by default! definitely change it later!
				config.snvindel.shown = false
			} else {
				// no tklst/facet
				config.snvindel.shown = true
			}
		}
	}

	if (config.trackLst) {
		if (!config.trackLst.facets) throw 'trackLst.facets[] missing'
		if (!config.trackLst.activeTracks) config.trackLst.activeTracks = []
	}
	return config
}

export function computeBlockModeFlag(config, vocabApi?) {
	// steps follow the order of priority
	if (typeof config.blockIsProteinMode == 'boolean') {
		// state has predefined mode, do not modify
		return
	}
	// lack of mode e.g. from urlparam shorthand state. compute default value
	switch (vocabApi.termdbConfig.queries.gbRestrictMode) {
		case undefined:
			// ds doesn't restrict mode; when user searched gene, assume it should be in genomic mode
			if (config.geneSearchResult?.geneSymbol) {
				config.blockIsProteinMode = true
			} else {
				config.blockIsProteinMode = false
			}
			break
		case 'protein':
			// ds only allow protein mode
			config.blockIsProteinMode = true
			break
		case 'genomic':
			// ds only allow genomic mode
			config.blockIsProteinMode = false
			break
		default:
			throw 'unknown gbRestrictMode'
	}
}

/*
called in mass/charts.js, to render the menu upon clicking the chart button in the charts tray
	holder: the holder in the tooltip
	chartsInstance: MassCharts instance
*/
export function makeChartBtnMenu(_holder, chartsInstance) {
	const chart = { config: { chartType: 'genomeBrowser' } }
	chartsInstance.prepPlot(chart)
}
