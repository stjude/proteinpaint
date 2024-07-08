import { getCompInit, copyMerge } from '#rx'
import { addGeneSearchbox } from '../dom/genesearch.ts'
import { Menu } from '#dom/menu'
import { sayerror } from '../dom/sayerror.ts'
import { dofetch3 } from '#common/dofetch'
import { getNormalRoot } from '#filter/filter'
import { first_genetrack_tolist } from '#common/1stGenetk'
import { gbControlsInit, mayUpdateGroupTestMethodsIdx } from './genomeBrowser.controls'

/*
//////////////// instance structure

this{}
	vocabApi{}
	app {}
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
		config {}
			filter{} // mass filter
			variantFilter{}
				filter{}
				opts{ joinWith }
				terms[]
			geneSearchResult{}
			snvindel {}
				details {}
					groupTypes[]
					groups:[]
						// each element is a group object
						{type='info', infoKey=str}
						{type='filter', filter={}}
						{type='population', key, label, ..}
					groupTestMethod{}
					groupTestMethodsIdx
				populations [{key,label}] // might not be part of state
			ld {}
				tracks[]
		termdbConfig{}
	blockInstance // exists when block has been launched; one block in each plot


////////////////// functions

init
main
	launchCustomMds3tk
		preComputeData
			dofetch3
		furbishViewModeWithSnvindelComputeDetails
		launchBlockWithTracks
			getTracks2show
getPlotConfig
	getDefaultConfig
makeChartBtnMenu
*/

const geneTip = new Menu({ padding: '0px' })

class genomeBrowser {
	constructor() {
		this.type = 'genomeBrowser'
	}

	async init() {
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
		// {plots[], termdbConfig{}, termfilter{}}
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return {
			config,
			termdbConfig: appState.termdbConfig,
			filter: getNormalRoot(appState.termfilter.filter)
		}
	}

	async main() {
		this.dom.loadingDiv.style('display', 'inline')
		try {
			if (this.state.config?.snvindel?.details) {
				// pre-compute variant data in the app here, e.g. fisher test etc, but not in mds3 backend as the official track does
				// and launch custom mds3 tk to show the variants
				await this.launchCustomMds3tk()
			} else if (this.state.config?.trackLst) {
				await this.launchBlockWithTracks(this.state.config.trackLst)
			} else {
				// launch official mds3 tk, same way as mds3/tk.js
				const tk = {
					type: 'mds3',
					dslabel: this.app.opts.state.vocab.dslabel,
					// for showing disco etc as ad-hoc sandbox, persistently in the mass plotDiv, rather than a menu
					newChartHolder: this.opts.plotDiv
				}
				if (this.state.filter?.lst?.length > 0) {
					// state has a non-empty filter, register at tk obj to pass to mds3 data queries
					tk.filterObj = structuredClone(this.state.filter)
					// TODO this will cause mds3 tk to show a leftlabel to indicate the filtering, which should be hidden
				}
				await this.launchBlockWithTracks([tk])
			}
			this.updateLDtrack()
		} catch (e) {
			sayerror(this.dom.errDiv, e.message || e)
			if (e.stack) console.log(e.stack)
		}
		this.dom.loadingDiv.style('display', 'none')
	}

	//////////////////////////////////////////////////
	//       rest of methods are app-specific       //
	//////////////////////////////////////////////////

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
		await this.launchBlockWithTracks([tk])
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

	async launchBlockWithTracks(tklst) {
		// when state changes, delete existing block and relaunch new one
		// since block/tk is not state-controlled
		// attaches this.blockInstance
		this.dom.blockHolder.selectAll('*').remove()

		const arg = {
			holder: this.dom.blockHolder,
			genome: this.app.opts.genome, // genome obj
			nobox: true,
			tklst: await this.getTracks2show(tklst),
			debugmode: true
		}
		if (this.state.termdbConfig?.queries.defaultBlock2GeneMode && this.state.config.geneSearchResult.geneSymbol) {
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
		// launch locus
		arg.chr = this.state.config.geneSearchResult.chr
		arg.start = this.state.config.geneSearchResult.start
		arg.stop = this.state.config.geneSearchResult.stop
		first_genetrack_tolist(this.app.opts.genome, arg.tklst)

		arg.onCoordinateChange = async rglst => {
			await this.app.dispatch({
				type: 'plot_edit',
				id: this.id,
				config: { geneSearchResult: { chr: rglst[0].chr, start: rglst[0].start, stop: rglst[0].stop } }
			})
		}

		const _ = await import('#src/block')
		this.blockInstance = new _.Block(arg)
	}

	async getTracks2show(tklst) {
		const showLst = []
		for (const i of tklst) {
			if (i.isfacet) {
				// legacy method to insert facet table into genome.tkset[]

				// must duplicate as i is frozen
				const j = JSON.parse(JSON.stringify(i))

				if (!this.app.opts.genome.tkset) this.app.opts.genome.tkset = []
				if (!j.tklst) throw '.tklst[] missing from a facet table'
				if (!Array.isArray(j.tklst)) throw '.tklst[] not an array from a facet table'
				for (const t of j.tklst) {
					if (!t.assay) throw '.assay missing from a facet track'
					if (!t.sample) throw '.sample missing from a facet track'
					// must assign tkid otherwise the tk buttons from facet table won't work
					t.tkid = Math.random().toString()
					if (t.defaultShown) showLst.push(t)
				}
				this.app.opts.genome.tkset.push(j)
			} else {
				// must be a track
				showLst.push(i)
			}
		}
		return showLst
	}

	updateLDtrack() {
		/* based on ld.tracks[] whether each track is shown, to add/remove ld tracks from blockInstance
		 */
		if (!this.state.config.ld) return // no ld tracks
		if (!this.blockInstance) return // no block, cannot update ld
		for (const tk of this.state.config.ld.tracks) {
			const tkidx = this.blockInstance.tklst.findIndex(j => j.file == tk.file0)
			if (tk.shown) {
				// tk should be shown
				if (tkidx == -1) {
					// tk not in block, add
					const arg = {
						type: 'ld',
						name: tk.name,
						file: tk.file0
					}
					const t = this.blockInstance.block_addtk_template(arg)
					this.blockInstance.tk_load(t)
				}
				// tk already in block
				continue
			}
			// tk should be hidden
			if (tkidx == -1) continue
			// remove
			this.blockInstance.tk_remove(tkidx)
		}
	}
}

///////////////////////////////////////////////////////
//                  end of class                     //
///////////////////////////////////////////////////////

export const genomeBrowserInit = getCompInit(genomeBrowser)
// this alias will allow abstracted dynamic imports
export const componentInit = genomeBrowserInit

export async function getPlotConfig(opts, app) {
	try {
		// request default queries config from dataset, and allows opts to override
		return await getDefaultConfig(app.vocabApi, opts)
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
		termdbConfig{}
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
		geneOnly: chartsInstance.state.termdbConfig.queries.defaultBlock2GeneMode,
		callback: async () => {
			// found a gene {chr,start,stop,geneSymbol}
			// dispatch to create new plot

			try {
				// must do this as 'plot_prep' does not call getPlotConfig()
				// request default queries config from dataset, and allows opts to override
				// this config{} will become this.state.config{}
				const config = await getDefaultConfig(chartsInstance.app.vocabApi)

				config.chartType = 'genomeBrowser'
				config.geneSearchResult = result
				const chart = { config }
				chartsInstance.prepPlot(chart)
			} catch (e) {
				// upon err, create div in chart button menu to display err
				holder.append('div').text('Error: ' + (e.message || e))
				console.log(e)
			}
		}
	}
	if (!chartsInstance.state.termdbConfig.queries.defaultBlock2GeneMode) {
		// block is not shown in gene mode, add default coord to arg
		arg.defaultCoord = chartsInstance.state.termdbConfig.queries.defaultCoord
	}
	const result = addGeneSearchbox(arg)
}

// get default config of the app from vocabApi
async function getDefaultConfig(vocabApi, override) {
	const config = await vocabApi.getMds3queryDetails()
	// request default variant filter (against vcf INFO)
	const vf = await vocabApi.get_variantFilter()
	if (vf?.filter) {
		config.variantFilter = vf
	}
	const c2 = override ? copyMerge(config, override) : config
	if (c2.snvindel?.details) {
		// test method may be inconsistent with group configuration (e.g. no fisher for INFO fields), update test method here
		// 1st arg is a fake "self"
		mayUpdateGroupTestMethodsIdx({ state: { config: c2 } }, c2.snvindel.details)
	}
	return c2
}

//////////////////////////////////////////////////
//                  helpers                     //
//////////////////////////////////////////////////

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
