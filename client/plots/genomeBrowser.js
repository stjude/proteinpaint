import { getCompInit, copyMerge } from '#rx'
import { addGeneSearchbox, Menu, sayerror } from '#dom'
import { dofetch3 } from '#common/dofetch'
import { getNormalRoot } from '#filter/filter'
import { filterJoin } from '#shared/filter.js'
import { first_genetrack_tolist } from '#common/1stGenetk'
import { gbControlsInit, mayUpdateGroupTestMethodsIdx } from './genomeBrowser.controls'

/*
//////////////// instance structure

this{}
	app {}
		vocabApi{}
			termdbConfig{}
		opts {}
			genome{} // client-side genome obj
			state {}
				vocab {}
					dslabel:str
					genome:str
		dispatch()
		save()
	opts{}
		app{}
		header
		holder
		plotDiv
		id
	state {}
		filter{} // mass filter
		config {}
			blockIsProteinMode:bool
				required; if true show as protein mode and requires geneSearchResult.geneSymbol
				if false show in genomic mode and requires chr/start/stop
			variantFilter?{}
				filter{}
				opts{ joinWith }
				terms[]
			geneSearchResult{ chr/start/stop/geneSymbol}
			snvindel? {}
				details {} // this needs to be copied from tdbcnf in state to track customizations
				populations [{key,label}] // might not be part of state
				shown=bool // set to true if snvindel mds3 tk is shown
				filter{} // applies default cohort filter. quick fix to generate two-tk cohort comparison
				            should not be used together with "details{}"
			ld? {}
				tracks[]
					.shown=bool // set to true if a ld tk is shown TODO removed ld tk is not reflected on config ui
			subMds3TkFilters?[] // list of mds3 subtk filter objects created on mds3 tk sample summary ui
			trackLst?{}
				facets[]
				activeTracks[] // tracks list of active tracks from trackLst or facet
				removeTracks[] // quick fix, list of names marked for removal from facet table
	blockInstance // exists when block has been launched; one block in each plot


////////////////// functions

init
main
	launchCustomMds3tk
		preComputeData
			dofetch3
		furbishViewModeWithSnvindelComputeDetails
		launchBlockWithTracks
getPlotConfig
	getDefaultConfig
makeChartBtnMenu
*/

const geneTip = new Menu({ padding: '0px' })

class genomeBrowser {
	constructor() {
		this.type = 'genomeBrowser'
	}

	async init(appState) {
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

		this.dom = {
			tip: new Menu(),
			holder,
			errDiv,
			/*
			skipMcountWithoutAltDiv: messageRow
				.append('span')
				.style('opacity', 0.5)
				.style('margin-right', '10px'),
				*/
			loadingDiv: messageRow.append('span').text('Loading...'),
			controlsDiv: holder.append('div').style('margin-left', '25px'),
			blockHolder: holder.append('div')
		}

		this.components = {
			gbControls: await gbControlsInit({
				app: this.app,
				id: this.id,
				holder: this.dom.controlsDiv
			})
		}
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return {
			config,
			filter: getNormalRoot(appState.termfilter.filter)
		}
	}

	async main() {
		this.dom.loadingDiv.style('display', 'inline')
		try {
			const tklst = await this.generateTracks()
			await this.launchBlockWithTracks(tklst)
			this.hasActiveCoordChange = false
		} catch (e) {
			sayerror(this.dom.errDiv, e.message || e)
			if (e.stack) console.log(e.stack)
		}
		this.dom.loadingDiv.style('display', 'none')
	}

	async generateTracks() {
		// handle multiple possibilities of generating genome browser tracks

		const tklst = [] // list of tracks to be shown in block

		if (this.state.config.snvindel?.shown) {
			// show snvindel-based mds3 tk
			if (this.state.config.snvindel.details) {
				// pre-compute variant data in the app here
				// and launch custom mds3 tk to show the variants
				// TODO move computing logic to official mds3 tk and avoid tricky workaround using custom tk
				const tk = await this.launchCustomMds3tk()
				if (tk) {
					// tricky! will not return obj when block is already shown, since it updates data for existing tk obj
					tklst.push(tk)
				}
			} else {
				// official mds3 tk without precomputing tk data
				const tk = {
					type: 'mds3',
					dslabel: this.app.opts.state.vocab.dslabel,
					onClose: () => {
						// on closing subtk, the filterObj corresponding to the subtk will be "removed" from subMds3TkFilters[], by regenerating the array
						if (!this.hasActiveCoordChange) this.maySaveTrackUpdatesToState('onClose')
					},
					// for showing disco etc as ad-hoc sandbox, persistently in the mass plotDiv, rather than a menu
					newChartHolder: this.opts.plotDiv
				}
				// any cohort filter for this tk
				{
					const lst = []
					// register both global filter and local filter to pass to mds3 data queries
					if (this.state.filter?.lst?.length) lst.push(this.state.filter)
					if (this.state.config.snvindel.filter) lst.push(this.state.config.snvindel.filter)
					if (lst.length == 1) {
						tk.filterObj = structuredClone(lst[0])
					} else if (lst.length > 1) {
						tk.filterObj = filterJoin(lst)
					}
					// TODO this will cause mds3 tk to show a leftlabel to indicate the filtering, which should be hidden
				}
				tklst.push(tk)

				if (this.state.config?.subMds3TkFilters) {
					for (const subFilter of this.state.config.subMds3TkFilters) {
						// for every element, create a new subtk
						const t2 = {
							type: 'mds3',
							dslabel: this.app.opts.state.vocab.dslabel,
							// for showing disco etc as ad-hoc sandbox, persistently in the mass plotDiv, rather than a menu
							newChartHolder: this.opts.plotDiv
						}
						if (this.state.filter?.lst?.length) {
							// join sub filter with global
							t2.filterObj = filterJoin([this.state.filter, subFilter])
						} else {
							// no global. only sub
							t2.filterObj = structuredClone(subFilter)
						}
						tklst.push(t2)
					}
				}
			}
		}
		if (this.state.config?.trackLst?.activeTracks?.length) {
			// include active facet tracks
			for (const n of this.state.config.trackLst.activeTracks) {
				for (const f of this.state.config.trackLst.facets) {
					for (const t of f.tracks) {
						if (t.name == n) tklst.push(t)
					}
				}
			}
		}
		if (this.state.config.ld?.tracks) {
			for (const t of this.state.config.ld.tracks) {
				if (t.shown) tklst.push(t)
			}
		}
		return tklst
	}

	async launchCustomMds3tk() {
		const data = await this.preComputeData()
		this.mayDisplaySampleCountInControls(data)

		if (this.blockInstance) {
			// block already launched. update data on the tk and rerender
			const t2 = this.blockInstance.tklst.find(i => i.type == 'mds3')
			t2.custom_variants = data.mlst

			// details.groups[] may have changed. update label and tooltip callback etc, of tk numeric axis view mode object
			furbishViewModeWithSnvindelComputeDetails(
				this,
				t2.skewer.viewModes.find(i => i.type == 'numeric')
			)

			t2.load()
			return
		}

		const nm = {
			// numeric mode object; to fill in based on snvindel.details{}
			type: 'numeric',
			inuse: true,
			byAttribute: 'nm_axis_value'
		}
		furbishViewModeWithSnvindelComputeDetails(this, nm)
		const tk = {
			type: 'mds3',
			// despite having custom data, still provide dslabel for the mds3 tk to function as an official dataset
			dslabel: this.app.opts.state.vocab.dslabel,
			name: 'Variants',
			custom_variants: data.mlst,
			skewerModes: [nm]
		}
		return tk
	}

	mayDisplaySampleCountInControls(data) {
		/* quick fix
		group sample count returned by server is not part of state and is not accessible to controls component
		has to synthesize a "current" object with the _partialData special attribute
		and pass it to api.update() for component instance to receive it via getState()
		*/
		if (Number.isInteger(data.totalSampleCount_group1) || Number.isInteger(data.totalSampleCount_group2)) {
			const current = {
				appState: {
					plots: [
						{
							id: this.components.gbControls.id,
							_partialData: {
								groupSampleCounts: [data.totalSampleCount_group1, data.totalSampleCount_group2],
								pop2average: data.pop2average
							}
						}
					]
				}
			}
			this.components.gbControls.update(current)
		}
	}

	async preComputeData() {
		// analysis details including cohorts and compute methods are in state.config.snvindel.details{}
		// send to back to compute and get results back

		const body = {
			genome: this.app.opts.state.vocab.genome,
			dslabel: this.app.opts.state.vocab.dslabel,
			for: 'mds3variantData',
			chr: this.state.config.geneSearchResult.chr,
			start: this.state.config.geneSearchResult.start,
			stop: this.state.config.geneSearchResult.stop,
			details: this.state.config.snvindel.details,
			filter: this.state.filter,
			variantFilter: this.state.config.variantFilter?.filter
		}

		// using dofetch prevents the app from working with custom dataset; may change to vocab method later

		const data = await dofetch3('termdb', { body })
		if (data.error) throw data.error
		/*
		if (data.skipMcountWithoutAlt) {
			this.dom.skipMcountWithoutAltDiv.text(
				`${data.skipMcountWithoutAlt} variant${
					data.skipMcountWithoutAlt > 1 ? 's' : ''
				} skipped for absence of ALT allele from the cohort.`
			)
		} else {
			this.dom.skipMcountWithoutAltDiv.text('')
		}
		*/
		return data
	}

	/* tricky logic
	 */
	async launchBlockWithTracks(tklst) {
		if (this.blockInstance) {
			/* block instance is present
			this should be updating tracks in this block, by adding new ones listed in tklst[],
			and deleting old ones via a tricky method
			*/
			for (const tk of tklst) {
				let tki // index of this tk in block
				if (tk.dslabel) {
					// tk has dslabel and must be identified by it
					tki = this.blockInstance.tklst.findIndex(i => i.dslabel == tk.dslabel)
				} else if (tk.name) {
					// identify tk by name
					tki = this.blockInstance.tklst.findIndex(i => i.name == tk.name)
				} else {
					throw 'tk missing dslabel & name'
				}
				if (tki == -1) {
					// this tk is not in block, add to block
					const t = this.blockInstance.block_addtk_template(tk)
					this.blockInstance.tk_load(t)
				}
			}
			if (this.state.config.trackLst?.removeTracks) {
				// facet table marks these tracks for removal. they are all identified by tk.name
				for (const n of this.state.config.trackLst.removeTracks) {
					const i = this.blockInstance.tklst.findIndex(i => i.name == n)
					if (i != -1) this.blockInstance.tk_remove(i)
				}
			}
			// tricky! if snvindel.shown is false, means user has toggled it off. thus find all mds3 tk and remove them
			if (this.state.config.snvindel && !this.state.config.snvindel.shown) {
				while (true) {
					let end = true
					for (const [i, tk] of this.blockInstance.tklst.entries()) {
						if (tk.type == 'mds3') {
							this.blockInstance.tk_remove(i)
							end = false
							break
						}
					}
					if (end) break
				}
			}
			return
		}

		// no block instance, create new block

		const arg = {
			holder: this.dom.blockHolder,
			genome: this.app.opts.genome, // genome obj
			nobox: true,
			tklst,
			debugmode: this.app.opts.debug,
			// use onsetheight but not onloadalltk_always, so callback will be called on all tk updates, including removing tk
			//onloadalltk_always:
			onsetheight: () => {
				// !!! may conflict with onCoordinateChange() dispatch if no state change is detected after this callback is called first !!!
				// !!! should not trigger a dispatch unless it's certain that a state change has occurred !!!
				// TODO on any tk update, collect tk config and save to state so they are recoverable from session
				// FIXME this is not called at protein mode
				if (!this.hasActiveCoordChange) this.maySaveTrackUpdatesToState('onsetheight')
			}
		}
		if (this.state.config.blockIsProteinMode) {
			// must be in protein mode and requires gene symbol
			if (!this.state.config.geneSearchResult.geneSymbol) throw 'blockIsProteinMode=true but geneSymbol missing'
			// dataset config wants to default to gene view, and gene symbol is available
			// call block.init to launch gene view
			arg.query = this.state.config.geneSearchResult.geneSymbol
			const _ = await import('#src/block.init')
			await _.default(arg)
			this.blockInstance = arg.__blockInstance

			// update sandbox header with gene name
			this.opts.header.text(arg.query)
			return
		}
		// must be in genomic mode and requires coord
		if (!this.state.config.geneSearchResult.chr) throw 'blockIsProteinMode=false but chr missing'
		arg.chr = this.state.config.geneSearchResult.chr
		arg.start = this.state.config.geneSearchResult.start
		arg.stop = this.state.config.geneSearchResult.stop
		first_genetrack_tolist(this.app.opts.genome, arg.tklst)

		arg.onCoordinateChange = async rglst => {
			this.hasActiveCoordChange = true
			const { chr, start, stop } = rglst[0]
			await this.app.dispatch({
				type: 'plot_edit',
				id: this.id,
				config: { geneSearchResult: { chr, start, stop } }
			})
		}

		const _ = await import('#src/block')
		this.blockInstance = new _.Block(arg)
	}

	async maySaveTrackUpdatesToState(eventTrigger) {
		// should be more selective when running
		if (this.hasActiveCoordChange) return
		/* following changes will be saved in state:
		- when a mds3 subtk is created/updated, its tk.filterObj should be saved to state so it can be recovered from session
		- a facet track is removed by user via block ui
		*/
		const config = structuredClone(this.state.config)
		for (const t of this.blockInstance.tklst) {
			if (t.type == 'mds3' && t.filterObj) {
				if (this.state.filter) {
					if (JSON.stringify(t.filterObj) == JSON.stringify(this.state.filter)) {
						// this tk filter is identical as state (mass global filter). this means the tk is the "main" tk and the filter was auto-added via mass global filter.
						// do not add such filter in subMds3TkFilters[], that will cause an issue of auto-creating unwanted subtk on global filter change
						continue
					}
				} else {
					if (!config.subMds3TkFilters) config.subMds3TkFilters = []
					config.subMds3TkFilters.push(t.filterObj)
					// filter0?
				}
			}
		}
		if (config.trackLst?.activeTracks) {
			// active facet tracks are inuse; if user deletes such tracks from block ui, must update state
			const newLst = config.trackLst.activeTracks.filter(n => this.blockInstance.tklst.find(i => i.name == n))
			config.trackLst.activeTracks = newLst
		}
		await this.app.save({
			type: 'plot_edit',
			id: this.id,
			config
		})
	}
}

///////////////////////////////////////////////////////
//                  end of class                     //
///////////////////////////////////////////////////////

export const genomeBrowserInit = getCompInit(genomeBrowser)
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

	const arg = {
		tip: geneTip,
		genome: genomeObj,
		row: holder.append('div').style('margin', '10px'),
		callback: async () => {
			// found a hit {chr,start,stop,geneSymbol}; dispatch to create new plot
			try {
				await launchPlotAfterGeneSearch(result, chartsInstance, holder)
			} catch (e) {
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

/* compute default config
vocabApi
override? {}
	optional custom state to override default
activeCohort int -1/0/1..
	-1 if ds is not using cohort, 0/1 etc if true
blockIsProteinMode? bool
	optional. if missing auto compute
*/
async function getDefaultConfig(vocabApi, override, activeCohort, blockIsProteinMode) {
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
		const vf = await vocabApi.get_variantFilter()
		if (vf?.filter) {
			config.variantFilter = vf
		}
		if (config.snvindel.details) {
			// test method may be inconsistent with group configuration (e.g. no fisher for INFO fields), update test method here
			// 1st arg is a fake "self"
			mayUpdateGroupTestMethodsIdx({ state: { config } }, config.snvindel.details)
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

export function computeBlockModeFlag(config, blockIsProteinMode, vocabApi) {
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

/* given group configuration, determine: numeric track axis label
- viewmode.label as axis label of numeric mode
- viewmode.tooltipPrintValue()
*/
function furbishViewModeWithSnvindelComputeDetails(self, viewmode) {
	delete viewmode.tooltipPrintValue

	const [g1, g2] = self.state.config.snvindel.details.groups
	if (g1 && g2) {
		if (g1.type == 'info' || g2.type == 'info') {
			// either group is info field. value type can only be value difference
			viewmode.label = 'Value difference'
			return
		}
		// none of the group is info field. each group should derive AF and there can be different ways of comparing it from two groups
		const testMethod =
			self.state.config.snvindel.details.groupTestMethods[self.state.config.snvindel.details.groupTestMethodsIdx]
		viewmode.label = testMethod.axisLabel || testMethod.name
		if (testMethod.name == 'Allele frequency difference') {
			// callback returns value separated by ' = ', which allows this to be also displayed in itemtable.js
			viewmode.tooltipPrintValue = m => [{ k: 'AF diff', v: m.nm_axis_value }]
		} else if (testMethod.name == "Fisher's exact test") {
			viewmode.tooltipPrintValue = m => [{ k: 'p-value', v: m.p_value }]
		} else {
		}
		return
	}

	// only 1 group
	if (g1.type == 'info') {
		const f = self.state.config.variantFilter?.terms?.find(i => i.id == g1.infoKey)
		viewmode.label = f?.name || g1.infoKey
		viewmode.tooltipPrintValue = m => [{ k: viewmode.label, v: m.info[g1.infoKey] }]
		return
	}
	if (g1.type == 'filter') {
		viewmode.label = 'Allele frequency'
		viewmode.tooltipPrintValue = m => [{ k: 'Allele frequency', v: m.nm_axis_value }]
		return
	}
	if (g1.type == 'population') {
		viewmode.label = 'Allele frequency'
		viewmode.tooltipPrintValue = m => [{ k: 'Allele frequency', v: m.nm_axis_value }]
		return
	}
	throw 'unknown type of the only group'
}
