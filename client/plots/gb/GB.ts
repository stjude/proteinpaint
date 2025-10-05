import { PlotBase } from '../PlotBase.ts'
import { getCompInit, type ComponentApi, type RxComponent } from '#rx'
import { addGeneSearchbox, Menu, sayerror } from '#dom'
import { getNormalRoot } from '#filter'
import { Model } from './model/Model.ts'
import { ViewModel } from './viewModel/ViewModel.ts'
import { View } from './view/View.ts'
import { TabsRenderer } from './view/TabsRenderer.ts'
import { Interactions, mayUpdateGroupTestMethodsIdx } from './interactions/Interactions.ts'

const geneTip = new Menu({ padding: '0px' })

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
		const errDiv = holder.append('div')
		const messageRow = holder.append('div').style('margin-left', '25px')
		messageRow.append('span').html('&nbsp;') // to not to collapse row when empty
		const dom = {
			tip: new Menu(),
			holder,
			errDiv,
			loadingDiv: messageRow.append('span').text('Loading...'),
			controlsDiv: holder.append('div').style('margin-left', '25px'),
			blockHolder: holder.append('div')
		}
		return dom
	}

	async init(appState) {
		this.interactions = new Interactions(this.app, this.dom, this.id)
		const state = this.getState(appState)
		const tabs = new TabsRenderer(state, this.dom, this.interactions)
		tabs.main()
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
		this.dom.loadingDiv.style('display', 'inline')
		const state = this.getState(this.app.getState())
		if (state.config.chartType != this.type) return
		try {
			const model = new Model(state, this.app)
			const data = await model.preComputeData()
			const opts = this.getOpts()
			const viewModel = new ViewModel(state, opts, data)
			await viewModel.generateTracks()
			const view = new View(state, viewModel.viewData, this.dom, opts, this.interactions)
			await view.main()
		} catch (e: any) {
			sayerror(this.dom.errDiv, e.message || e)
			if (e.stack) console.log(e.stack)
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

export async function getPlotConfig(opts, app, activeCohort) {
	// 3rd arg is initial active cohort
	try {
		// request default queries config from dataset, and allows opts to override
		const c = await getDefaultConfig(app.vocabApi, opts, activeCohort)
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
activeCohort int -1/0/1..
    -1 if ds is not using cohort, 0/1 etc if true
blockIsProteinMode? bool
    optional. if missing auto compute
*/
async function getDefaultConfig(vocabApi, override, activeCohort, blockIsProteinMode?) {
	const config = Object.assign(
		// clone for modifying
		structuredClone({
			snvindel: vocabApi.termdbConfig.queries.snvindel,
			trackLst: vocabApi.termdbConfig.queries.trackLst,
			ld: vocabApi.termdbConfig.queries.ld
		}),
		override || {}
	)
	computeBlockModeFlag(config, blockIsProteinMode, vocabApi)

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

export function computeBlockModeFlag(config, blockIsProteinMode?, vocabApi?) {
	// steps follow the order of priority
	if (typeof blockIsProteinMode == 'boolean') {
		// this setting is set by chart button menu by user choice or saved state
		config.blockIsProteinMode = blockIsProteinMode
		return
	}
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
{
    app {
        vocabApi
        opts { // the mass ui options
            genome{} // client-side genome object
        }
    }
    state {
        termdbConfig{} // should no longer track it in plot state
    }
}
*/
export function makeChartBtnMenu(holder, chartsInstance) {
	const genomeObj = chartsInstance.app.opts.genome
	if (typeof genomeObj != 'object') throw 'chartsInstance.app.opts.genome not an object and needed for gene search box'

	const arg: any = {
		tip: geneTip,
		genome: genomeObj,
		row: holder.append('div').style('margin', '10px'),
		callback: async () => {
			// found a hit {chr,start,stop,geneSymbol}; dispatch to create new plot
			try {
				await launchPlotAfterGeneSearch(result, chartsInstance, holder)
			} catch (e: any) {
				// upon err, create div in chart button menu to display err
				holder.append('div').text('Error: ' + (e.message || e))
				console.log(e)
			}
		}
	}
	switch (chartsInstance.state.termdbConfig.queries.gbRestrictMode) {
		case undefined:
			// not set. allowed
			break
		case 'genomic':
			// gb can only be block mode, add default coord to arg
			arg.defaultCoord = chartsInstance.state.termdbConfig.queries.defaultCoord
			break
		case 'protein':
			// gb can only be protein mode, only allow searching gene
			arg.searchOnly = 'gene'
			break
		default:
			throw 'unknown gbRestrictMode'
	}
	const result = addGeneSearchbox(arg)
}

async function launchPlotAfterGeneSearch(result, chartsInstance, holder) {
	if (result.geneSymbol && !chartsInstance.state.termdbConfig.queries.gbRestrictMode) {
		// user found a gene and no restricted mode from ds, ask user if to use either protein/genomic mode

		// on repeated gene search, detect if btndiv is present, and remove, avoiding showing duplicate buttons
		holder.select('.sjpp_gbmodebtndiv').remove()
		// create new div and buttons
		const btndiv = holder.append('div').attr('class', 'sjpp_gbmodebtndiv').style('margin', '15px')
		btndiv
			.append('button')
			.style('margin-right', '10px')
			.text('Protein view of ' + result.geneSymbol)
			.on('click', () => launch(true)) // true for going to protein mode
		btndiv
			.append('button')
			.text('Genomic view of ' + result.geneSymbol)
			.on('click', () => launch(false)) // explicitely set false for genomic mode so downstream won't auto set
		return
	}
	// only one possibility of gb mode and it can be auto determined
	await launch(chartsInstance.state.termdbConfig.queries.gbRestrictMode == 'protein')

	async function launch(blockIsProteinMode) {
		// must do this as 'plot_prep' does not call getPlotConfig()
		// request default queries config from dataset, and allows opts to override
		// this config{} will become this.state.config{}
		const config = await getDefaultConfig(
			chartsInstance.app.vocabApi,
			null,
			chartsInstance.state.activeCohort,
			blockIsProteinMode
		)
		config.chartType = 'genomeBrowser'
		config.geneSearchResult = result
		const chart = { config }
		chartsInstance.prepPlot(chart)
	}
}
