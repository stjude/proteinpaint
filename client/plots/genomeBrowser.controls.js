import { getCompInit } from '#rx'
import { Menu, Tabs, make_one_checkbox, renderTable } from '#dom'
import { filterInit, getNormalRoot, getFilterItemByTag } from '#filter/filter'
import { appInit } from '#termdb/app'

/*
getState
	_partialData
main
	makeVariantValueComputingGroupControls
		render1group
			makePrompt2addNewGroup
				launchMenu_createGroup
			render1group_info
			render1group_population
			render1group_filter
	makeVariantFilter
*/
const groupTip = new Menu({ padding: '0px' })

class GbControls {
	constructor(opts) {
		/* opts = {}
		.app
		.id
		.holder
		*/
		this.type = 'gbControls'
		this.filterUI = {}
	}

	async init(appState) {
		this.initUI(this.getState(appState))
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		if (config._partialData) {
			// receives partial data but not full app state
			// quick fix: cannot update dom here as the doms are not rendered yet
			// thus will use this data later when rendering doms
			this._partialData = config._partialData
			return
		}

		// must not delete it if not available from config{}
		//delete this._partialData

		return {
			activeCohort: appState.activeCohort,
			config,
			termdbConfig: appState.termdbConfig,
			filter: getNormalRoot(appState.termfilter.filter)
		}
	}

	async main() {
		const groups = this.state.config.snvindel?.details?.groups
		if (groups) {
			// is equipped with comparison groups, render group ui
			this.render1group(0)
			this.render1group(1)

			if (this.state.config.snvindel.details.groupTestMethods) {
				this.renderTestMethod()
			}
		}

		if (this.state.config.variantFilter) {
			// quick fix -- only render this filter ui once
			if (!this.variantFilterRendered) {
				this.variantFilterRendered = true
				this.makeVariantFilter()
			}
		}
	}

	async makeVariantFilter() {
		filterInit({
			joinWith: this.state.config.variantFilter.opts.joinWith,
			emptyLabel: '+Add Filter',
			holder: this.dom.variantFilterHolder,
			vocab: { terms: this.state.config.variantFilter.terms },
			callback: async filter => {
				await this.app.dispatch({
					type: 'plot_edit',
					id: this.id,
					config: { variantFilter: { filter } }
				})
			}
		}).main(this.state.config.variantFilter.filter)
	}

	/*
	render ui contents of one group, both arguments are provided to be convenient for ad-hoc update

	groupIdx: array index of self.state.config.snvindel.details.groups[]
		determines which <div> to render to at self.dom.group1/2div
	group{}: element of same array
	*/
	render1group(groupIdx) {
		const group = this.state.config.snvindel.details.groups[groupIdx]
		const div = groupIdx == 0 ? this.dom.group1div : this.dom.group2div

		let canReuse = false
		if (group?.type == 'filter' && this.filterUI[groupIdx]) {
			// will reuse an existing filterUI[${groupIdx}] and div
			canReuse = true
		} else {
			delete this.filterUI[groupIdx] // ok to delete even if not existing
			div.selectAll('*').remove()
		}

		if (!group) {
			// group does not exist in groups[] based on array index, e.g. when there's just 1 group and groups[1] is undefined
			// add a prompt in place of header button
			makePrompt2addNewGroup(this, groupIdx, div)
			return
		}

		// the group exists; first show the group header button
		if (!canReuse) makeGroupHeaderButton(this, groupIdx, div)

		if (group.type == 'info') return render1group_info(this, groupIdx, group, div)
		if (group.type == 'population') return render1group_population(this, groupIdx, group, div)
		if (group.type == 'filter') return render1group_filter(this, groupIdx, group, div)
		throw 'render1group: unknown group type'
	}

	renderTestMethod() {
		const div = this.dom.testMethodDiv
		div.selectAll('*').remove()

		const [g1, g2] = this.state.config.snvindel.details.groups
		if (!g2) {
			// only 1 group, do not show ui as test method is not configurable
			return
		}

		div.append('span').text('TEST METHOD').style('font-size', '.8em').style('opacity', 0.6)

		if (g1.type != 'filter' && g2.type != 'filter') {
			// neither group is filter, test method can only be value diff and also not configurable
			div.append('span').style('padding-left', '10px').text('Value difference').style('opacity', 0.6)
			return
		}

		const select = div
			.append('select')
			.style('margin-left', '10px')
			.on('change', () => {
				this.app.dispatch({
					type: 'plot_edit',
					id: this.id,
					config: { snvindel: { details: { groupTestMethodsIdx: select.property('selectedIndex') } } }
				})
			})
		for (const m of this.state.config.snvindel.details.groupTestMethods) {
			select.append('option').text(m.name)
		}
		select.property('selectedIndex', this.state.config.snvindel.details.groupTestMethodsIdx)
	}

	initUI(state) {
		/* everything rendered into this.opts.holder
		state = {
		  config: {}
		  	ld{}
			snvindel{}
			variantFilter{}
		  termdbConfig {}
		}
		*/

		this.dom = {}

		const tabs = []
		/* based on ds configuration and data/query type availability, 
		get list of tabs corresponding to different functionalities of the genome browser
		due to constrain of how tab works, must generate tab array first, call `new Tabs` to initiate holder for each tab
		then render contents into each holder for each tab
		thus has to duplicate the logic for computing tabs
		*/
		if (state.config.snvindel?.details) {
			tabs.push({ label: 'Variant Values', active: true })
		}
		if (state.config.variantFilter) {
			tabs.push({ label: 'Variant Filter' })
		}
		if (state.config.ld) {
			tabs.push({ label: 'LD Map' })
		}
		if (state.config.trackLst?.facets) {
			// one tab for each facet table
			for (const facet of state.config.trackLst.facets) {
				tabs.push({ label: facet.name || 'Facet Table' })
			}
		}

		if (tabs.length == 0) {
			// no content for config ui
			return
		}

		// has some tabs! initiate the tab ui, then at <div> of each tab, render contents
		const toggles = new Tabs({
			holder: this.opts.holder.append('div').style('border-bottom', 'solid 1px #ccc').style('padding-bottom', '20px'),
			tabs
		})
		toggles.main()

		// tabs[] array index; on rendering contents for an optional tab, advance this index
		let tabsIdx = 0

		//////////////////////
		// must repeat tab-computing logic in exact order above!! otherwise out of sync
		//////////////////////
		if (state.config.snvindel?.details) {
			// first tab is for variant group setting
			const div = tabs[tabsIdx++].contentHolder.append('div')
			// hardcode to 2 groups used by state.config.snvindel.details.groups[]
			this.dom.group1div = div.append('div')
			this.dom.group2div = div.append('div')
			this.dom.testMethodDiv = div.append('div').style('margin-top', '3px')
		}
		if (state.config.variantFilter) {
			// the whole holder has white-space=nowrap (likely from sjpp-output-sandbox-content)
			// must set white-space=normal to let INFO filter wrap and not to extend beyond holder
			this.dom.variantFilterHolder = tabs[tabsIdx++].contentHolder.append('div').style('white-space', 'normal')
		}
		if (state.config.ld) {
			/* ticky: must duplicate ld.tracks[] and scope it here
			and use it to preserve the "shown" flag changes via checkboxes
			when dispatching, commit the tracks[] to state, this ensures the syncing between scoped and state versions
			TODO better way to track in state, as well as visibility of snvindel etc
			*/
			const tracks = structuredClone(state.config.ld.tracks)

			const div = tabs[tabsIdx++].contentHolder.append('div')
			div.append('div').text('Show/hide linkage disequilibrium map from an ancestry:').style('opacity', 0.5)
			for (const [i, t] of tracks.entries()) {
				make_one_checkbox({
					labeltext: t.name,
					checked: t.shown,
					holder: div,
					callback: () => {
						tracks[i].shown = !tracks[i].shown
						this.app.dispatch({
							type: 'plot_edit',
							id: this.id,
							config: { ld: { tracks } }
						})
					}
				})
			}
		}
		if (state.config.trackLst?.facets) {
			for (const facet of state.config.trackLst.facets) {
				const div = tabs[tabsIdx++].contentHolder.append('div')
				renderFacetTable(this, facet, div)
			}
		}
	}
}

export const gbControlsInit = getCompInit(GbControls)

function render1group_info(self, groupIdx, group, div) {
	// this group is an INFO field
	let name = group.infoKey
	if (self.state.config.variantFilter?.terms) {
		const f = self.state.config.variantFilter.terms.find(i => i.id == group.infoKey)
		if (f && f.name) name = f.name
	}
	div
		.append('span')
		.text(name)
		.attr('class', 'sja_menuoption')
		.on('click', event => {
			if (self.state.config.variantFilter.terms.length <= 1) {
				// only 1, no other option to switch to
				return
			}
			// multiple options, allow to replace
			groupTip
				.clear()
				.showunder(event.target)
				.d.append('div')
				.text('Replace with:')
				.style('margin', '10px')
				.style('font-size', '.8em')
			for (const f of self.state.config.variantFilter.terms) {
				if (f.type != 'integer' && f.type != 'float') continue // only allow numeric fields
				if (f.id == group.infoKey) continue // same one

				groupTip.d
					.append('div')
					.text(f.name)
					.attr('class', 'sja_menuoption')
					.on('click', () => {
						/////////////////////////////////
						// create a new group using this info field
						groupTip.hide()
						const groups = structuredClone(self.state.config.snvindel.details.groups)
						groups[groupIdx].infoKey = f.id
						groups[groupIdx].type = 'info'
						self.app.dispatch({
							type: 'plot_edit',
							id: self.id,
							config: { snvindel: { details: { groups } } }
						})
					})
			}
		})
	div
		.append('span')
		.text('PER-VARIANT NUMERICAL VALUES')
		.style('font-size', '.7em')
		.style('opacity', 0.6)
		.style('margin-left', '10px')
}

function render1group_population(self, groupIdx, group, div) {
	// this group is a predefined population
	div
		.append('span')
		.text(group.label)
		.attr('class', 'sja_menuoption')
		.on('click', event => {
			if (self.state.config.snvindel.populations.length <= 1) {
				// only 1, no other option to switch to
				return
			}
			// multiple options, allow to replace
			groupTip
				.clear()
				.showunder(event.target)
				.d.append('div')
				.text('Replace with:')
				.style('margin', '10px')
				.style('font-size', '.8em')

			for (const p of self.state.config.snvindel.populations) {
				if (p.key == group.key) continue
				groupTip.d
					.append('div')
					.text(p.label)
					.attr('class', 'sja_menuoption')
					.on('click', () => {
						groupTip.hide()
						const groups = structuredClone(self.state.config.snvindel.details.groups)
						groups[groupIdx] = structuredClone(p)
						groups[groupIdx].type = 'population'
						self.app.dispatch({
							type: 'plot_edit',
							id: self.id,
							config: { snvindel: { details: { groups } } }
						})
					})
			}
		})
	div
		.append('span')
		.text(`POPULATION${group.adjust_race ? ', RACE ADJUSTED' : ''}`)
		.style('font-size', '.7em')
		.style('margin-left', '10px')
		.style('opacity', 0.6)

	if (self._partialData?.pop2average) {
		// info available, computed for the other group comparing against this population, display here
		if (self.state.config.snvindel.details.groups[groupIdx == 1 ? 0 : 1]?.type == 'filter') {
			/*
			!!poor fix!!
			only render the text when the other group is "filter",
			so that when the other group is no longer type=filter, the admix text will disappear from this group
			this is because self._partialData is *sticky* and is never deleted, due to the way parent passing it to child
			and assume that pop2average must be from comparison between 2 groups of filter-vs-population
			e.g. when info-vs-population, despite the _partialData is still there, must not render it
			*/
			const lst = []
			for (const k in self._partialData.pop2average) {
				const value = self._partialData.pop2average[k]
				if (!Number.isFinite(value)) continue // if there are no samples involved in current view, admix value is null
				lst.push(`${k}=${value.toFixed(2)}`)
			}

			if (lst.length) {
				// has valid admix values to display
				div
					.append('span')
					.text(`Group ${groupIdx == 1 ? 1 : 2} average admixture: ${lst.join(', ')}`)
					.style('margin-left', '20px')
					.attr('class', 'sja_clbtext')
					.on('click', event => {
						groupTip.clear().showunder(event.target).d.append('div').style('margin', '10px').style('width', '500px')
							.html(`These are average admixture coefficients based on current Group ${groupIdx == 1 ? 1 : 2} samples.
						They are used to adjust variant allele counts of matching ancestries from <span class=sja_menuoption style="padding:2px 5px">${
							group.label
						}</span>,
						so that the adjusted allele counts can be compared against Group ${groupIdx == 1 ? 1 : 2} allele counts.
						This allows to account for ancestry composition difference between the two groups.
						`)
					})
			}
		}
	}
}

async function render1group_filter(self, groupIdx, group, div) {
	/*
	this group is based on a termdb-filter
	when initiating the filter ui, must join group's filter with mass global filter and submit the joined filter to main()
	this allows tvs edit to show correct number of samples
	*/
	let span
	if (!self.filterUI[groupIdx]) {
		self.filterUI[groupIdx] = await filterInit({
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
		})
	}

	self.filterUI[groupIdx].main(getJoinedFilter(self, group))
	div.select('.sjpp-gb-filter-count').remove()
	const count = self._partialData?.groupSampleCounts?.[groupIdx]

	if (Number.isInteger(count)) {
		// quick fix! sample count for this group is already present from partial data, create field to display
		div
			.append('span')
			.attr('class', 'sjpp-gb-filter-count')
			.style('margin-left', '10px')
			.style('opacity', 0.5)
			.style('font-size', '.9em')
			.text('n=' + count)
	}
}

function getJoinedFilter(self, group) {
	// clone the global filter; group filter will be joined into it
	const joinedFilter = structuredClone(self.state.filter || { type: 'tvslst', in: true, join: '', lst: [] })
	const gf = structuredClone(group.filter)
	// tag group filter for it to be rendered in filter ui
	// rest of state.filter will remain invisible
	gf.tag = 'filterUiRoot'
	joinedFilter.lst.push(gf)
	joinedFilter.join = 'and'
	return joinedFilter
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
					/*
					// ui is not reactive
					div.selectAll('*').remove()
					makePrompt2addNewGroup(self, 1, div)
					*/

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
			if (!self.state.config.variantFilter?.terms)
				throw 'looking for snvindel info fields but self.state.config.variantFilter.terms[] missing'
			for (const f of self.state.config.variantFilter.terms) {
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
				vocabApi: self.app.vocabApi,
				state: {
					activeCohort: self.state.activeCohort,
					termfilter: { filter: self.state.filter }
				},
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

export function mayUpdateGroupTestMethodsIdx(self, d) {
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

function renderFacetTable(self, facet, div) {
	/* facet.tracks[] each is {name/assay/sample}
	layout a table with assay for columns, sample for rows, cells are tracks
	*/
	const assayset = new Set(),
		sampleset = new Set()
	for (const t of facet.tracks) {
		if (t.assay) assayset.add(t.assay)
		if (t.sample) sampleset.add(t.sample)
	}

	const sampleLst = [...sampleset]
	const assayLst = [...assayset] // TODO facet hardcodes assay order

	// TODO click on row/column header to batch operate

	const columns = [{ label: 'Sample' }] // TODO use ds sample type
	for (const assay of assayLst) {
		columns.push({
			label: assay,
			fillCell: (td, si) => {
				// "si" index of sample/rows[]; find tracks belonging to this assay+sample combo
				const tklst = facet.tracks.filter(i => i.assay == assay && i.sample == sampleLst[si])
				if (tklst.length == 0) return // no tracks for this combo
				// has track(s) for this combo; render <div> in table cell; click to launch tracks
				// TODO text color based on if track is already shown, but might be hard to update facet table on any change made in block
				td.append('div')
					.attr('class', 'sja_clbtext')
					.style('text-align', 'center')
					.text(tklst.length)
					.on('click', () => {
						// TODO click cell may show menu of track name and type, with add/remove button for each tk
						// btn works like a toggle button; click once to show, click 2nd time to hide
						let allTkShown = true // if all from tklst[] is in activeTracks[]
						for (const t of tklst) {
							if (!self.state.config.trackLst.activeTracks.includes(t.name)) allTkShown = false
						}
						let newLst
						if (allTkShown) {
							// all are shown. on clicking btn remove all
							newLst = self.state.config.trackLst.activeTracks.filter(n => !tklst.find(i => i.name == n))
						} else {
							// not all shown. add all
							newLst = structuredClone(self.state.config.trackLst.activeTracks)
							for (const t of tklst) {
								if (!newLst.includes(t.name)) newLst.push(t.name)
							}
						}
						self.app.dispatch({
							type: 'plot_edit',
							id: self.id,
							config: { trackLst: { activeTracks: newLst } }
						})
					})
			}
		})
	}
	const rows = []
	for (const sample of sampleLst) {
		// 1st column is sample name
		// TODO may link sample to sampleview
		const row = [{ value: sample }]
		// one blank cell for each assay
		for (let i = 0; i < assayLst.length; i++) {
			row.push({})
		}
		rows.push(row)
	}
	renderTable({
		columns,
		rows,
		div
	})
}
