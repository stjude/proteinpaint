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
		axisLabelFromSnvindelComputeDetails
		launchMds3tk

*/

const geneTip = new Menu({ padding: '0px' })
const groupTip = new Menu({ padding: '0px' })

class genomeBrowser {
	constructor() {
		this.type = 'genomeBrowser'
	}

	async init(appState) {
		const holder = this.opts.holder.append('div')
		// layout rows from top to bottom
		const errDiv = holder.append('div')
		const messageRow = holder.append('div').style('margin-left', '25px')
		messageRow.append('span').html('&nbsp;') // to not to collapse row when empty

		this.dom = {
			tip: new Menu(),
			holder,
			errDiv,
			skipMcountWithoutAltDiv: messageRow.append('span').style('margin-right', '10px'),
			loadingDiv: messageRow.append('span').text('Loading...'),
			// hardcode to 2 groups used by state.config.snvindel.details.groups[]
			group1div: holder.append('div').style('margin-left', '25px'),
			group2div: holder.append('div').style('margin-left', '25px'),
			variantFilterHolder: holder.append('div'),
			blockHolder: holder.append('div')
		}

		// to make sure api is accessible by mayDisplayVariantFilter
		this.vocabApi = this.app.vocabApi

		this.components = {}
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
		await mayDisplayVariantFilter(this, this.state.config.variantFilter, this.dom.variantFilterHolder, async () => {
			// run upon filter change to trigger state change
			await this.app.dispatch({
				type: 'plot_edit',
				id: this.id,
				config: { variantFilter: this.variantFilter.active }
			})
		})
		// this.variantFilter{active} is added

		makeVariantValueComputingGroupControls(this)
		this.components.controls = {
			update: () => {
				console.log('test')
			}
		}
	}

	async launchCustomMds3tk() {
		const data = await this.preComputeData()

		if (this.blockInstance) {
			// block already launched. update data on the tk and rerender
			const t2 = this.blockInstance.tklst.find(i => i.type == 'mds3')
			t2.custom_variants = data.mlst

			// details.groups[] may have changed. update label of tk numeric axis
			{
				const n = t2.skewer.viewModes.find(i => i.type == 'numeric')
				if (n) n.label = axisLabelFromSnvindelComputeDetails(this)
			}

			t2.load()
			return
		}

		const nm = {
			// numeric mode object; to fill in based on snvindel.details{}
			type: 'numeric',
			inuse: true,
			byAttribute: 'nm_axis_value',
			label: axisLabelFromSnvindelComputeDetails(this)
		}
		const tk = {
			type: 'mds3',
			name: 'Variants',
			custom_variants: data.mlst,
			skewerModes: [nm]
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

// launch menu to show options: filter/population/info
// when any is selected, create a new group object and set to snvindel.details.groups[groupIdx]
function launchMenu_createGroup(self, groupIdx, div) {
	const opt = {
		holder: div,
		tabs: self.state.config.snvindel.details.groupTypes.map(i => {
			return { label: i.name }
		}),
		tabsPosition: 'vertical',
		linePosition: 'right'
	}
	const a = new Tabs(opt)
	a.main()
	for (const [idx, groupType] of self.state.config.snvindel.details.groupTypes.entries()) {
		// { type:str, name:str }
		const tab = opt.tabs[idx]
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
						const groups = JSON.parse(JSON.stringify(self.state.config.snvindel.details.groups))
						groups[groupIdx] = newGroup
						self.app.dispatch({
							type: 'plot_edit',
							id: self.id,
							config: { snvindel: { details: { groups } } }
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
						const groups = JSON.parse(JSON.stringify(self.state.config.snvindel.details.groups))
						groups[groupIdx] = newGroup
						self.app.dispatch({
							type: 'plot_edit',
							id: self.id,
							config: { snvindel: { details: { groups } } }
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
						const groups = JSON.parse(JSON.stringify(self.state.config.snvindel.details.groups))
						groups[groupIdx] = newGroup
						self.app.dispatch({
							type: 'plot_edit',
							id: self.id,
							config: { snvindel: { details: { groups } } }
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

// given group configuration, determine numeric track axis label
// a lot of room for further refinement
function axisLabelFromSnvindelComputeDetails(self) {
	const details = self.state.config.snvindel.details
	if (details.groups.length == 1) {
		const g = details.groups[0]
		if (g.type == 'info') {
			const f = self.variantFilter.terms.find(i => i.id == g.infoKey)
			if (f && f.name) return f.name
			return g.infoKey
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
