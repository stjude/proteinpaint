import { getCompInit, copyMerge } from '#rx'
import { addGeneSearchbox } from '#dom/genesearch'
import { Menu } from '#dom/menu'
import { sayerror } from '#dom/error'
import { dofetch3 } from '#common/dofetch'
import { filterInit, getNormalRoot, getFilterItemByTag } from '#filter/filter'
import { first_genetrack_tolist } from '#common/1stGenetk'
import { mayDisplayVariantFilter } from '#termsetting/handlers/snplocus'
import { Tabs } from '#dom/toggleButtons'
import { appInit } from '#termdb/app'

/*
the control ui is generated based on various bits from this.state.config{}, and server data
it is made ad-hoc upon launching app, and not reactive to state change and data update

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
	state {}
		config {}
			filter{} // mass filter
			geneSearchResult{}
			snvindel {}
				details {}
					groupTypes[]
					groups:[]
						// each element is a group object
						{type=info, infoKey=str}
						{type=filter, filter={}}
						{type=population, key, label, ..}
					groupTestMethod{}
					groupTestMethodsIdx
				populations [{key,label}] // might not be part of state
		termdbConfig{}
	variantFilter {}
		terms [] // list of INFO fields expressed as terms
	blockInstance // exists when block has been launched; one block in each plot


////////////////// functions

main
	makeControls
		mayDisplayVariantFilter
		makeVariantValueComputingGroupControls
			render1group
				makePrompt2addNewGroup
					launchMenu_createGroup
				render1group_info
				render1group_population
				render1group_filter
	launchCustomMds3tk
		preComputeData
			dofetch3
		furbishViewModeWithSnvindelComputeDetails
		launchBlockWithTracks
			getTracks2show
getPlotConfig
makeChartBtnMenu
*/

const geneTip = new Menu({ padding: '0px' })
const groupTip = new Menu({ padding: '0px' })

class genomeBrowser {
	constructor() {
		this.type = 'genomeBrowser'
	}

	async init() {
		const holder = this.opts.holder.append('div')
		// layout rows from top to bottom
		const errDiv = holder.append('div')
		const messageRow = holder.append('div').style('margin-left', '25px')
		messageRow.append('span').html('&nbsp;') // to not to collapse row when empty

		this.dom = {
			tip: new Menu(),
			holder,
			errDiv,
			skipMcountWithoutAltDiv: messageRow
				.append('span')
				.style('opacity', 0.5)
				.style('margin-right', '10px'),
			loadingDiv: messageRow.append('span').text('Loading...'),
			// hardcode to 2 groups used by state.config.snvindel.details.groups[]
			group1div: holder.append('div').style('margin-left', '25px'),
			group2div: holder.append('div').style('margin-left', '25px'),
			// the whole holder has white-space=nowrap (likely from sjpp-output-sandbox-content)
			// must set white-space=normal to let INFO filter wrap and not to extend beyond holder
			variantFilterHolder: holder.append('div').style('white-space', 'normal'),
			blockHolder: holder.append('div'),
			groupShowCountDiv: [] // elements are <span> of that "filter" group, by the order of details.groups[]
		}

		// to make sure api is accessible by mayDisplayVariantFilter
		this.vocabApi = this.app.vocabApi

		this.components = {} // TODO a subcomponent for controls
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
				// show controls for precomputing variant data
				// controls are based on this.state and cannot be done in init() where state is not yet available
				await this.makeControls()
				await this.launchCustomMds3tk()
			} else if (this.state.config?.trackLst) {
				await this.launchBlockWithTracks(this.state.config.trackLst)
			} else {
				// launch official mds3 tk, same way as mds3/tk.js
				const tk = {
					type: 'mds3',
					filterObj: this.state.filter,
					dslabel: this.app.opts.state.vocab.dslabel
				}
				await this.launchBlockWithTracks([tk])
			}
		} catch (e) {
			sayerror(this.dom.errDiv, e.message || e)
			if (e.stack) console.log(e.stack)
		}
		this.dom.loadingDiv.style('display', 'none')
	}

	//////////////////////////////////////////////////
	//       rest of methods are app-specific       //
	//////////////////////////////////////////////////

	async makeControls() {
		// if true, the ui is already made, and do not redo it
		// quick fix to create the control UI at the first time this.main() is run
		// this requires both this.vocabApi and this.state.config{} to be ready
		// and cannot do it in this.init()
		if (this.controlsAreMade) return
		this.controlsAreMade = true

		// to init and render variant filter; must do it first then render group controls,
		// as group controls require this.variantFilter.terms[]
		// this.variantFilter={} is always set
		// if dataset does not use info filter, variantFilter.terms[] is missing
		await mayDisplayVariantFilter(
			this,
			this.state.config.variantFilter,
			this.dom.variantFilterHolder,
			async () => {
				// run upon filter change to trigger state change
				await this.app.dispatch({
					type: 'plot_edit',
					id: this.id,
					config: { variantFilter: this.variantFilter.active }
				})
			},
			true // hide filter body by default
		)
		// this.variantFilter{active} is added

		makeVariantValueComputingGroupControls(this)
		this.components.controls = {
			update: () => {
				//console.log('test')
			}
		}
	}

	async launchCustomMds3tk() {
		const data = await this.preComputeData()
		if (data.totalSampleCount_group1 && this.dom.groupShowCountDiv[0])
			this.dom.groupShowCountDiv[0].text('n=' + data.totalSampleCount_group1)
		if (data.totalSampleCount_group2 && this.dom.groupShowCountDiv[1])
			this.dom.groupShowCountDiv[1].text('n=' + data.totalSampleCount_group2)

		if (this.blockInstance) {
			// block already launched. update data on the tk and rerender
			const t2 = this.blockInstance.tklst.find(i => i.type == 'mds3')
			t2.custom_variants = data.mlst

			// details.groups[] may have changed. update label and tooltip callback etc, of tk numeric axis view mode object
			furbishViewModeWithSnvindelComputeDetails(this, t2.skewer.viewModes.find(i => i.type == 'numeric'))

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
		this.blockInstance = await this.launchBlockWithTracks([tk])
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
			variantFilter: this.variantFilter?.active
		}

		// using dofetch prevents the app from working with custom dataset; may change to vocab method later

		const data = await dofetch3('termdb', { body })
		if (data.error) throw data.error
		if (data.skipMcountWithoutAlt) {
			this.dom.skipMcountWithoutAltDiv.text(
				`${data.skipMcountWithoutAlt} variant${
					data.skipMcountWithoutAlt > 1 ? 's' : ''
				} skipped for absence of ALT allele from the cohort.`
			)
		} else {
			this.dom.skipMcountWithoutAltDiv.text('')
		}
		return data
	}

	async launchBlockWithTracks(tklst) {
		// when state changes, delete existing block and relaunch new one
		// since block/tk is not state-controlled
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
		const config = await app.vocabApi.getMds3queryDetails()
		const c2 = copyMerge(config, opts)
		if (c2.snvindel?.details) {
			// 1st arg is a fake "self"
			mayUpdateGroupTestMethodsIdx({ state: { config: c2 } }, c2.snvindel.details)
		}
		return c2
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
				const config = await chartsInstance.app.vocabApi.getMds3queryDetails()
				if (config.snvindel?.details) {
					// 1st arg is a fake "self"
					mayUpdateGroupTestMethodsIdx({ state: { config } }, config.snvindel.details)
				}
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

//////////////////////////////////////////////////
//                  helpers                     //
//////////////////////////////////////////////////

function makeVariantValueComputingGroupControls(self) {
	render1group(self, 0, self.state.config.snvindel.details.groups[0])
	render1group(self, 1, self.state.config.snvindel.details.groups[1])
}

/*
render ui contents of one group, both arguments are provided to be convenient for ad-hoc update

groupIdx: array index of self.state.config.snvindel.details.groups[]
	determines which <div> to render to at self.dom.group1/2div
group{}: element of same array
*/
function render1group(self, groupIdx, group) {
	const div = groupIdx == 0 ? self.dom.group1div : self.dom.group2div

	div.selectAll('*').remove()

	if (!group) {
		// group does not exist in groups[] based on array index, e.g. when there's just 1 group and groups[1] is undefined
		// add a prompt in place of header button
		makePrompt2addNewGroup(self, groupIdx, div)
		return
	}

	// the group exists; first show the group header button
	makeGroupHeaderButton(self, groupIdx, div)

	if (group.type == 'info') return render1group_info(self, groupIdx, group, div)
	if (group.type == 'population') return render1group_population(self, groupIdx, group, div)
	if (group.type == 'filter') return render1group_filter(self, groupIdx, group, div)
	throw 'render1group: unknown group type'
}

function render1group_info(self, groupIdx, group, div) {
	let name = group.infoKey
	if (self?.variantFilter?.terms) {
		const f = self.variantFilter.terms.find(i => i.id == group.infoKey)
		if (f && f.name) name = f.name
	}
	div.append('span').text(name)
	div
		.append('span')
		.text('INFO FIELD')
		.style('font-size', '.5em')
		.style('margin-left', '10px')
}

function render1group_population(self, groupIdx, group, div) {
	div.append('span').text(group.label)
	div
		.append('span')
		.text(`POPULATION${group.adjust_race ? ', RACE ADJUSTED' : ''}`)
		.style('font-size', '.5em')
		.style('margin-left', '10px')
}

function render1group_filter(self, groupIdx, group, div) {
	/*
	this group is based on a termdb-filter
	TODO sample counts in tvs menu should reflect global mass filter; on every app update (e.g. cohort change) the cohort choice should be combined into group.filter (but remain invisible)
	TODO subcohort from global mass filter should be combined into group.filter, but no need to render cohort choice in this filter ui. 
	*/
	filterInit({
		holder: div,
		vocab: self.app.opts.state.vocab,
		emptyLabel: 'Entire cohort',
		termdbConfig: self.state.termdbConfig,
		callback: async f => {
			const groups = JSON.parse(JSON.stringify(self.state.config.snvindel.details.groups))
			groups[groupIdx].filter = f
			self.app.dispatch({
				type: 'plot_edit',
				id: self.id,
				config: { snvindel: { details: { groups } } }
			})
		}
	}).main(group.filter)

	self.dom.groupShowCountDiv[groupIdx] = div
		.append('span')
		.style('margin-left', '10px')
		.style('opacity', 0.5)
		.style('font-size', '.9em')
}

function makePrompt2addNewGroup(self, groupIdx, div) {
	// the prompt <div> is created in group2div
	div
		.append('div')
		.style('display', 'inline-block')
		.text('Create Group 2')
		.attr('class', 'sja_clbtext')
		.style('margin', '10px')
		.on('click', event => {
			groupTip.showunder(event.target).clear()
			launchMenu_createGroup(self, groupIdx, groupTip.d)
		})
}

function makeGroupHeaderButton(self, groupIdx, div) {
	div
		.append('div')
		.style('display', 'inline-block')
		.text('Group ' + (groupIdx + 1))
		.attr('class', 'sja_menuoption')
		.style('margin-right', '10px')
		.on('click', event => {
			groupTip.showunder(event.target).clear()
			if (groupIdx == 0) {
				// this is 1st group, directly launch menu to change group, but do not allow to delete
				launchMenu_createGroup(self, 0, groupTip.d)
				return
			}
			groupTip.d
				.append('div')
				.text('Change')
				.attr('class', 'sja_menuoption')
				.style('border-radius', '0px')
				.on('click', () => {
					launchMenu_createGroup(self, 1, groupTip.clear().d)
				})
			groupTip.d
				.append('div')
				.text('Delete')
				.attr('class', 'sja_menuoption')
				.style('border-radius', '0px')
				.on('click', () => {
					groupTip.hide()
					// ui is not reactive
					div.selectAll('*').remove()
					makePrompt2addNewGroup(self, 1, div)

					const groups = [self.state.config.snvindel.details.groups[0]] // only keep first group
					self.app.dispatch({
						type: 'plot_edit',
						id: self.id,
						config: { snvindel: { details: { groups } } }
					})
				})
		})
}

// show vertical toggle options: filter/population/info
// when any is selected, create a new group object and set to snvindel.details.groups[groupIdx]
function launchMenu_createGroup(self, groupIdx, div) {
	const opt = {
		holder: div.append('div').style('margin', '5px'),
		tabs: self.state.config.snvindel.details.groupTypes.map(i => {
			return { label: i.name }
		}),
		tabsPosition: 'vertical',
		linePosition: 'right'
	}
	new Tabs(opt).main()
	for (const [idx, groupType] of self.state.config.snvindel.details.groupTypes.entries()) {
		// { type:str, name:str }
		const tab = opt.tabs[idx]
		tab.contentHolder.style('margin', '10px')
		if (groupType.type == 'info') {
			if (!self.variantFilter || !self.variantFilter.terms)
				throw 'looking for snvindel info fields but self.variantFilter.terms[] missing'
			for (const f of self.variantFilter.terms) {
				if (f.type != 'integer' && f.type != 'float') continue // only allow numeric fields
				tab.contentHolder
					.append('div')
					.text(f.name)
					.attr('class', 'sja_menuoption')
					.on('click', () => {
						/////////////////////////////////
						// create a new group using this info field
						groupTip.hide()
						const newGroup = {
							type: 'info',
							infoKey: f.id
						}
						render1group(self, groupIdx, newGroup)
						const details = makeNewDetail(self, newGroup, groupIdx)
						mayUpdateGroupTestMethodsIdx(self, details)
						self.app.dispatch({
							type: 'plot_edit',
							id: self.id,
							config: { snvindel: { details } }
						})
					})
			}
			continue
		}
		if (groupType.type == 'population') {
			if (!self.state.config.snvindel.populations) throw 'state.config.snvindel.populations missing'
			for (const p of self.state.config.snvindel.populations) {
				// {key,label, allowto_adjust_race, adjust_race}
				tab.contentHolder
					.append('div')
					.text(p.label)
					.attr('class', 'sja_menuoption')
					.on('click', () => {
						/////////////////////////////////
						// create a new group using this population
						groupTip.hide()
						const newGroup = {
							type: 'population',
							key: p.key,
							label: p.label,
							allowto_adjust_race: p.allowto_adjust_race,
							adjust_race: p.adjust_race
						}
						render1group(self, groupIdx, newGroup)
						const details = makeNewDetail(self, newGroup, groupIdx)
						mayUpdateGroupTestMethodsIdx(self, details)
						self.app.dispatch({
							type: 'plot_edit',
							id: self.id,
							config: { snvindel: { details } }
						})
					})
			}
			continue
		}
		if (groupType.type == 'filter') {
			const arg = {
				holder: tab.contentHolder,
				vocabApi: self.vocabApi,
				state: {},
				tree: {
					click_term2select_tvs: tvs => {
						/////////////////////////////////
						// create a new group using this tvs
						groupTip.hide()
						const newGroup = {
							type: 'filter',
							filter: {
								in: true,
								join: '',
								type: 'tvslst',
								lst: [{ type: 'tvs', tvs }]
							}
						}
						render1group(self, groupIdx, newGroup)
						const details = makeNewDetail(self, newGroup, groupIdx)
						mayUpdateGroupTestMethodsIdx(self, details)
						self.app.dispatch({
							type: 'plot_edit',
							id: self.id,
							config: { snvindel: { details } }
						})
					}
				}
			}
			const activeCohortIdx = mayGetActiveCohortIdx(self)
			if (Number.isInteger(activeCohortIdx)) arg.state.activeCohort = activeCohortIdx
			appInit(arg)
			continue
		}
		throw 'unknown group type'
	}
}

function makeNewDetail(self, newGroup, groupIdx) {
	const newDetail = {
		groups: JSON.parse(JSON.stringify(self.state.config.snvindel.details.groups))
	}
	newDetail.groups[groupIdx] = newGroup
	return newDetail
}

function mayUpdateGroupTestMethodsIdx(self, d) {
	if (d.groups.length != 2) return // not two groups, no need to update test method
	// depending on types of two groups, may need to update test method
	const [g1, g2] = d.groups
	if (g1.type == 'info' || g2.type == 'info' || (g1.type == 'population' && g2.type == 'population')) {
		// if any group is INFO, or both are population, can only allow value difference and not fisher test
		const i = self.state.config.snvindel.details.groupTestMethods.findIndex(
			i => i.name == 'Allele frequency difference'
		)
		if (i == -1) throw 'Allele frequency difference not found'
		d.groupTestMethodsIdx = i
	} else {
		// otherwise, do not change existing method idx
	}
}

// from mass filter, find a tvs as cohortFilter, to know its array index in selectCohort.values[]
// return undefined for anything that's not valid
function mayGetActiveCohortIdx(self) {
	if (!self.state.config.filter) return // no mass filter
	const cohortFilter = getFilterItemByTag(self.config.filter, 'cohortFilter') // the tvs object
	if (cohortFilter && self.state.termdbConfig.selectCohort) {
		// the tvs is found
		const cohortName = cohortFilter.tvs.values
			.map(d => d.key)
			.sort()
			.join(',')
		const idx = self.state.termdbConfig.selectCohort.values.findIndex(v => v.keys.sort().join(',') == cohortName)
		if (idx == -1) throw 'subcohort key is not in selectCohort.values[]'
		return idx
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
			viewmode.tooltipPrintValue = m => 'AF diff = ' + m.nm_axis_value
		} else if (testMethod.name == "Fisher's exact test") {
			viewmode.tooltipPrintValue = m => 'p-value = ' + m.p_value
		} else {
		}
		return
	}

	// only 1 group
	if (g1.type == 'info') {
		const f = self.variantFilter.terms.find(i => i.id == g1.infoKey)
		viewmode.label = f?.name || g1.infoKey
		viewmode.tooltipPrintValue = m => viewmode.label + ' = ' + m.info[g1.infoKey]
		return
	}
	if (g1.type == 'filter') {
		viewmode.label = 'Allele frequency'
		viewmode.tooltipPrintValue = m => 'Allele frequency = ' + m.nm_axis_value
		return
	}
	if (g1.type == 'population') {
		viewmode.label = 'Allele frequency'
		viewmode.tooltipPrintValue = m => 'Allele frequency = ' + m.nm_axis_value
		return
	}
	throw 'unknown type of the only group'
}
