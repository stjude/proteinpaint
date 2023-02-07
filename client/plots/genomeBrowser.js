import { getCompInit, copyMerge } from '#rx'
import { addGeneSearchbox } from '#dom/genesearch'
import { Menu } from '#dom/menu'
import { sayerror } from '#dom/error'
import { dofetch3 } from '#common/dofetch'
import { getNormalRoot } from '#filter/filter'
import { first_genetrack_tolist } from '#common/1stGenetk'
import { mayDisplayVariantFilter } from '#termsetting/handlers/snplocus'

/*

brief notes about structures:

this.app {
	opts {
		genome{} // client-side genome obj
		state {
			vocab: {
				dslabel:str
				genome:str
			}
		}
	}
	dispatch()
	save()
	vocabApi{}
}

this.state {
	config {
		filter // mass filter
		geneSearchResult{}
		snvindel {
			details {
				groupTypes[]
				groups:[]
					// a group may have its own filter
				groupTestMethod{}
				groupTestMethodsIdx
			}
		}
	}
	termdbConfig{}
}
this.blockInstance // exists when block has been launched; one block in each plot
*/

const geneTip = new Menu({ padding: '0px' })

class genomeBrowser {
	constructor() {
		this.type = 'genomeBrowser'
	}

	async init(opts) {
		const holder = this.opts.holder.append('div')
		this.dom = {
			tip: new Menu(),
			holder,
			errDiv: holder.append('div'),
			loadingDiv: holder
				.append('div')
				.text('Loading...')
				.style('margin-left', '25px'),
			skipMcountWithoutAltDiv: holder
				.append('div')
				.style('margin-left', '25px')
				.style('opacity', 0.5),

			// hardcode to 2 groups used by state.config.snvindel.details.groups[]
			group1div: holder.append('div'),
			group2div: holder.append('div'),

			variantFilterHolder: holder.append('div'),
			blockHolder: holder.append('div')
		}

		// to make sure api is accessible by mayDisplayVariantFilter
		this.vocabApi = this.app.vocabApi
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
		this.dom.loadingDiv.style('display', 'block')
		try {
			if (this.state.config?.snvindel?.details) {
				// pre-compute variant data in the app here, e.g. fisher test etc, but not in mds3 backend as the official track does
				// and launch custom mds3 tk to show the variants
				// show controls for precomputing variant data
				// controls are based on this.state and cannot be done in init() where state is not yet available
				await this.makeControls()
				await this.launchCustomMds3tk()
			} else {
				// launch official mds3 tk, same way as mds3/tk.js
				const tk = {
					type: 'mds3',
					filterObj: this.state.filter,
					dslabel: this.app.opts.state.vocab.dslabel
				}
				await this.launchMds3tk(tk)
			}
		} catch (e) {
			sayerror(this.dom.errDiv, e.message || e)
			if (e.stack) console.log(e.stack)
		}
		this.dom.loadingDiv.style('display', 'none')
	}

	///////////////////////////////////////////
	//   rest of methods are app-specific    //
	///////////////////////////////////////////

	async makeControls() {
		// if true, the ui is already made, and do not redo it
		// quick fix to create the control UI at the first time this.main() is run
		// this requires both this.vocabApi and this.state.config{} to be ready
		// and cannot do it in this.init()
		if (this.controlsAreMade) return
		this.controlsAreMade = true

		makeVariantValueComputingControls(this)

		// variant filter
		await mayDisplayVariantFilter(this, this.state.config.variantFilter, this.dom.variantFilterHolder, async () => {
			// run upon filter change to trigger state change
			await this.app.dispatch({
				type: 'plot_edit',
				id: this.id,
				config: { variantFilter: this.variantFilter.active }
			})
		})
		// this.variantFilter{active} is added
	}

	async launchCustomMds3tk() {
		const data = await this.preComputeData()

		if (this.blockInstance) {
			// block already launched. update data on the tk and rerender
			const t2 = this.blockInstance.tklst.find(i => i.type == 'mds3')
			t2.custom_variants = data.mlst
			t2.load()
			return
		}

		const nm = {
			// numeric mode object; to fill in based on snvindel.details{}
			type: 'numeric',
			inuse: true,
			byAttribute: 'nm_axis_value'
		}
		const tk = {
			type: 'mds3',
			name: 'Variants',
			custom_variants: data.mlst,
			skewerModes: [nm],
			label: axisLabelFromSnvindelComputeDetails(this)
		}
		this.blockInstance = await this.launchMds3tk(tk)
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
			variantFilter: this?.variantFilter?.active
		}
		const data = await dofetch3('termdb', { body })
		if (data.error) throw data.error
		if (data.skipMcountWithoutAlt) {
			this.dom.skipMcountWithoutAltDiv
				.style('display', 'block')
				.text(data.skipMcountWithoutAlt + ' variants skipped for absence of ALT allele from the cohort.')
		} else {
			this.dom.skipMcountWithoutAltDiv.style('display', 'none')
		}
		return data
	}

	async launchMds3tk(tk) {
		// when state changes, delete existing block and relaunch new one
		// since block/tk is not state-controlled
		this.dom.blockHolder.selectAll('*').remove()

		const arg = {
			holder: this.dom.blockHolder,
			genome: this.app.opts.genome, // genome obj
			nobox: true,
			tklst: [tk]
		}
		if (this.state.termdbConfig?.queries.defaultBlock2GeneMode && this.state.config.geneSearchResult.geneSymbol) {
			// dataset config wants to default to gene view, and gene symbol is available
			// call block.init to launch gene view
			arg.query = this.state.config.geneSearchResult.geneSymbol
			const _ = await import('#src/block.init')
			await _.default(arg)
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
		return new _.Block(arg)
	}
}

export const genomeBrowserInit = getCompInit(genomeBrowser)
// this alias will allow abstracted dynamic imports
export const componentInit = genomeBrowserInit

export async function getPlotConfig(opts, app) {
	try {
		// request default queries config from dataset, and allows opts to override
		const config = await app.vocabApi.getMds3queryDetails()

		return copyMerge(config, opts)
	} catch (e) {
		throw `${e} [genomeBrowser getPlotConfig()]`
	}
}

export function makeChartBtnMenu(holder, chartsInstance) {
	/*
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
				const config = await chartsInstance.app.vocabApi.getMds3queryDetails()
				// request default variant filter (against vcf INFO)
				const vf = await chartsInstance.app.vocabApi.get_variantFilter()
				if (vf?.filter) {
					config.variantFilter = vf.filter
				}

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

///////////////////////////////// helper functions

function makeVariantValueComputingControls(self) {
	renderGroupUI(self, 0)
	renderGroupUI(self, 1)
}

function renderGroupUI(self, groupIdx) {
	const div = groupIdx == 0 ? self.dom.group1div : self.dom.group2div
	const group = self.state.config.snvindel.details.groups[groupIdx]
	if (!group) {
		// group does not exist in groups[] based on array index, e.g. when there's just 1 group and groups[1] is undefined
		// prompt to add new group
		div
			.append('span')
			.text('Add new group')
			.attr('class', 'sja_clbtext')
			.on('click', () => {
				launchMenu_createGroup(self, groupIdx)
			})
		return
	}

	// the group exists
	// first show a button allowing to replace/delete this group

	if (group.type == 'info') {
		return
	}
	if (group.type == 'population') {
		return
	}
	if (group.type == 'filter') {
		return
	}
	throw 'renderGroupUI: unknown group type'
}

function launchMenu_createGroup(self, groupIdx) {}

// given group configuration, determine numeric track axis label
// a lot of room for further refinement
function axisLabelFromSnvindelComputeDetails(self) {
	const details = self.state.config.snvindel.details
	if (details.groups.length == 1) {
		const g = details.groups[0]
		if (g.type == 'info') {
			return 'TODO info name'
		}
		if (g.type == 'filter') {
			return 'Allele frequency'
		}
		if (g.type == 'population') {
			return 'Allele frequency'
		}
		throw 'unknown type of the only group'
	}

	if (details.groups.length == 2) {
		const [g1, g2] = details.groups
		if (g1.type == 'info' || g2.type == 'info') {
			// either group is info field. value type can only be value difference
			return 'Value difference'
		}
		// none of the group is info field. each group should derive AF and there can be different ways of comparing it from two groups
		const m =
			self.state.config.snvindel.details.groupTestMethods[self.state.config.snvindel.details.groupTestMethodsIdx]
		return m.axisLabel || m.name
	}

	throw 'snvindel.details.groups.length not 1 or 2'
}
