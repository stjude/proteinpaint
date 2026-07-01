import { PlotBase } from '../PlotBase.ts'
import { getCompInit, type ComponentApi, type RxComponent } from '#rx'
import { Menu, sayerror } from '#dom'
import { getCombinedTermFilter, getNormalRoot, filterJoin } from '#filter'
import { fillTermWrapper } from '#termsetting'
import { controlsInit } from '#plots/controls.js'
import { Model } from './model/Model.ts'
import { View } from './view/View.ts'
import { Interactions, mayUpdateGroupTestMethodsIdx } from './interactions/Interactions.ts'
import { sanitizeTrackLstConfig } from './trackLst.ts'

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
	blockInstance: any
	_prevFilterSig?: string
	configTermKeys = ['facetTw1', 'facetTw2', 'facetTw3']

	constructor(opts, api) {
		super(opts, api)
		this.type = TdbGenomeBrowser.type
		this.dom = this.getDom()
	}

	getDom() {
		const holder = this.opts.holder.append('div')
		if (this.opts.header) {
			/** Plot may not launch in a sandbox (such as in GDC), hence no header. */
			this.opts.header
				.append('div')
				.style('opacity', 0.6)
				.style('padding-left', '10px')
				.style('font-size', '0.75em')
				.text('GENOME BROWSER')
		}
		const body = holder.append('div').style('display', 'flex').style('align-items', 'flex-start').style('gap', '12px')
		const controlsDiv = body.append('div').style('flex', '0 0 auto')
		const mainDiv = body
			.append('div')
			.style('flex', '1 1 auto')
			.style('min-width', 0)
			.style('margin', '15px 0px 0px 25px')
		const errDiv = mainDiv.append('div').style('display', 'none').style('margin', '10px')
		const dom = {
			tip: new Menu(),
			holder,
			errDiv,
			controls: controlsDiv.append('div'),
			tabsDiv: mainDiv.append('div'),
			geneSearchDiv: mainDiv.append('div').style('margin', '20px 0px'),
			blockHolder: mainDiv.append('div')
		}
		return dom
	}

	async init() {
		this.interactions = new Interactions(this.app, this.dom, this.id)
		await this.setControls()
	}

	async setControls() {
		const state = this.getState(this.app.getState())
		if (!state.config.trackLst) return
		this.dom.holder.attr('class', 'pp-termdb-plot-viz').style('display', 'inline-block').style('min-width', '300px')
		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: this.dom.controls.style('display', 'inline-block'),
				title: 'Genome Browser',
				inputs: [
					{
						type: 'term',
						configKey: 'facetTw1',
						chartType: 'genomeBrowser',
						usecase: { target: 'genomeBrowser', detail: 'facetTw1' },
						title: 'Add column',
						label: 'Add column',
						vocabApi: this.app.vocabApi,
						processConfig: config => {
							if (!config.facetTw1) {
								config.facetTw2 = null
								config.facetTw3 = null
							}
						}
					},
					{
						type: 'term',
						configKey: 'facetTw2',
						chartType: 'genomeBrowser',
						usecase: { target: 'genomeBrowser', detail: 'facetTw2' },
						title: 'Add column',
						label: 'Add column',
						vocabApi: this.app.vocabApi,
						getDisplayStyle: plot => (getGbConfig(plot).facetTw1 ? 'table-row' : 'none'),
						processConfig: config => {
							if (!config.facetTw2) config.facetTw3 = null
						}
					},
					{
						type: 'term',
						configKey: 'facetTw3',
						chartType: 'genomeBrowser',
						usecase: { target: 'genomeBrowser', detail: 'facetTw3' },
						title: 'Add column',
						label: 'Add column',
						vocabApi: this.app.vocabApi,
						getDisplayStyle: plot => (getGbConfig(plot).facetTw2 ? 'table-row' : 'none')
					}
				]
			})
		}
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		const parentConfig = appState.plots.find(p => p.id === this.parentId)
		const termfilter = getCombinedTermFilter(appState, config.filter || parentConfig?.filter)
		return {
			config,
			filter: getNormalRoot(termfilter.filter),
			filter0: termfilter.filter0,
			vocab: appState.vocab
		}
	}

	async main() {
		this.dom.holder.style('opacity', 0.5).style('pointer-events', 'none')
		this.dom.errDiv.style('display', 'none')
		const state = this.getState(this.app.getState())
		if (state.config.chartType != this.type) return
		const opts = this.getOpts()

		// ---- force UI/track refresh when effective filters changed ----
		// include:
		// - global/local combined filter (state.filter)
		// - filter0 mass filter
		// - snvindel local filter (used by mds3 filterObj merge in View.generateTracks)
		const mergedTkFilter =
			state.filter && state.config.snvindel?.filter
				? filterJoin([state.filter, state.config.snvindel.filter])
				: state.filter || state.config.snvindel?.filter || null

		const filterSig = JSON.stringify({
			filter: mergedTkFilter || null,
			filter0: state.filter0 || null
		})

		if (this._prevFilterSig && this._prevFilterSig !== filterSig && this.blockInstance) {
			// clear stale block so View.main() launches a fresh block+tracks from latest filters
			// this guarantees mds3 main/sub tracks re-materialize with updated filterObj/filter0
			this.dom.blockHolder.selectAll('*').remove()
			this.blockInstance = null
		}
		this._prevFilterSig = filterSig

		try {
			const model = new Model(state, this.app)
			const [data, facetData] = await Promise.all([model.preComputeData(), this.getFacetData(state)])
			this.interactions.setFacetTrackNames(getFacetTrackNames(facetData))
			const view = new View(state, this.blockInstance, data, this.dom, opts, this.interactions, facetData)
			await view.main()
			this.blockInstance = view.blockInstance
		} catch (e: any) {
			this.dom.errDiv.style('display', 'block')
			sayerror(this.dom.errDiv, 'Error: ' + (e.message || e))
			if (e.stack) console.log(e.stack)
		}
		this.dom.holder.style('opacity', 1).style('pointer-events', 'auto')
	}

	async getFacetData(state) {
		if (!state.config.trackLst?.facets?.length) return []

		const headers = await this.app.vocabApi.mayGetAuthHeaders('termdb')
		return await Promise.all(
			state.config.trackLst.facets.map(async facet => {
				const body: any = {
					genome: this.app.vocabApi.vocab.genome,
					dslabel: this.app.vocabApi.vocab.dslabel,
					facetname: facet.name,
					twLst: getFacetTwLst(state.config)
				}
				if (state.filter?.lst?.length) body.filter = state.filter
				const data = await this.app.vocabApi.dofetch3(
					'termdb/facet',
					{ headers, body },
					this.app.vocabApi.opts.fetchOpts
				)
				if (data.error) throw data.error
				return {
					...facet,
					tracks: data.tracks || [],
					samples: data.samples
				}
			})
		)
	}

	// get options for view instance
	getOpts() {
		const opts = {
			genome: this.app.opts.genome,
			app: this.app,
			vocabApi: this.app.vocabApi,
			debug: this.app.opts.debug,
			plotDiv: this.opts.plotDiv,
			header: this.opts.header,
			allow2selectSamples: this.opts.allow2selectSamples
		}
		return opts
	}
}

function getFacetTrackNames(facets) {
	const names = new Set<string>()
	for (const facet of facets || []) {
		for (const track of facet.tracks || []) {
			if (track.name) names.add(track.name)
		}
	}
	return names
}

export const genomeBrowserInit = getCompInit(TdbGenomeBrowser)
// this alias will allow abstracted dynamic imports
export const componentInit = genomeBrowserInit

export async function getPlotConfig(opts, app, activeCohort) {
	try {
		// request default queries config from dataset, and allows opts to override
		const c = await getDefaultConfig(app.vocabApi, opts, activeCohort)
		return c
	} catch (e) {
		throw `${e} [genomeBrowser getPlotConfig()]`
	}
}

/* compute default config
vocabApi
override? {}
    optional custom state to override default
activeCohort
	index of active cohort (-1/0/1)
*/
async function getDefaultConfig(vocabApi, override, activeCohort) {
	const config = Object.assign(
		// clone for modifying
		structuredClone({
			snvindel: vocabApi.termdbConfig.queries.snvindel,
			trackLst: vocabApi.termdbConfig.queries.trackLst,
			ld: vocabApi.termdbConfig.queries.ld
		}),
		override || {}
	)
	sanitizeTrackLstConfig(config)
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
		const facetTwLst = [config.facetTw1, config.facetTw2, config.facetTw3].some(Boolean)
			? [config.facetTw1, config.facetTw2, config.facetTw3]
			: config.trackLst.facetTwLst || []
		for (const [i, tw] of facetTwLst.slice(0, 3).entries()) {
			if (!tw) continue
			const key = `facetTw${i + 1}`
			config[key] = await fillTermWrapper(tw, vocabApi)
		}
		delete config.trackLst.facetTwLst
		config.settings = config.settings || {}
		config.settings.controls = config.settings.controls || {}
	}
	return config
}

function getGbConfig(plotOrState) {
	return plotOrState?.config || plotOrState || {}
}

export function getFacetTwLst(config) {
	const facetTwLst: any[] = []
	for (const tw of [config.facetTw1, config.facetTw2, config.facetTw3]) {
		if (!tw) break
		facetTwLst.push(tw)
	}
	return facetTwLst
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
