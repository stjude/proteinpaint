import { first_genetrack_tolist } from '#common/1stGenetk'
import { Tabs } from '#dom'
import { filterInit } from '#filter/filter'
import { appInit } from '#termdb/app'
import { mayUpdateGroupTestMethodsIdx } from '../interactions/Interactions.ts'

export class View {
	state: any
	data: any
	dom: any
	opts: any
	interactions: any
	blockInstance: any
	filterUI: any
	constructor(state, data, dom, opts, interactions) {
		this.state = state
		this.data = data
		this.dom = dom
		this.opts = opts
		this.interactions = interactions
		this.filterUI = {}
	}

	async main() {
		this.mayRenderGroups()
		this.mayRenderVariantFilter()
		await this.launchBlockWithTracks(this.data.tklst)
	}

	mayRenderGroups() {
		const groups = this.state.config.snvindel?.details?.groups
		if (groups) {
			// is equipped with comparison groups, render group ui
			this.render1group(0)
			this.render1group(1)

			if (this.state.config.snvindel.details.groupTestMethods) {
				this.renderTestMethod()
			}
		}
	}

	mayRenderVariantFilter() {
		if (this.state.config.variantFilter) {
			this.dom.variantFilterHolder.selectAll('*').remove()
			filterInit({
				joinWith: this.state.config.variantFilter.opts.joinWith,
				emptyLabel: '+Add Filter',
				holder: this.dom.variantFilterHolder,
				vocab: { terms: this.state.config.variantFilter.terms },
				callback: filter => this.interactions.launchVariantFilter(filter)
			}).main(this.state.config.variantFilter.filter)
		}
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
			this.makePrompt2addNewGroup(groupIdx, div)
			return
		}

		// the group exists; first show the group header button
		if (!canReuse) this.makeGroupHeaderButton(groupIdx, div)

		if (group.type == 'info') return this.render1group_info(groupIdx, group, div)
		if (group.type == 'population') return this.render1group_population(groupIdx, group, div)
		if (group.type == 'filter') return this.render1group_filter(groupIdx, group, div)
		throw 'render1group: unknown group type'
	}

	makePrompt2addNewGroup(groupIdx, div) {
		// the prompt <div> is created in group2div
		div
			.append('div')
			.style('display', 'inline-block')
			.text('Create Group 2')
			.attr('class', 'sja_clbtext')
			.style('margin', '10px')
			.on('click', event => {
				this.dom.tip.showunder(event.target).clear()
				this.launchMenu_createGroup(groupIdx, this.dom.tip.d)
			})
	}

	makeGroupHeaderButton(groupIdx, div) {
		div
			.append('div')
			.style('display', 'inline-block')
			.text('Group ' + (groupIdx + 1))
			.attr('class', 'sja_menuoption')
			.style('margin-right', '10px')
			.on('click', event => {
				this.dom.tip.showunder(event.target).clear()
				if (groupIdx == 0) {
					// this is 1st group, directly launch menu to change group, but do not allow to delete
					this.launchMenu_createGroup(0, this.dom.tip.d)
					return
				}
				this.dom.tip.d
					.append('div')
					.text('Change')
					.attr('class', 'sja_menuoption')
					.style('border-radius', '0px')
					.on('click', () => {
						this.launchMenu_createGroup(1, this.dom.tip.clear().d)
					})
				this.dom.tip.d
					.append('div')
					.text('Delete')
					.attr('class', 'sja_menuoption')
					.style('border-radius', '0px')
					.on('click', () => {
						this.dom.tip.hide()
						/*
						// ui is not reactive
						div.selectAll('*').remove()
						makePrompt2addNewGroup(self, 1, div)
						*/

						const groups = [this.state.config.snvindel.details.groups[0]] // only keep first group
						this.interactions.launchGroupsFilter(groups)
					})
			})
	}

	render1group_info(groupIdx, group, div) {
		// this group is an INFO field
		let name = group.infoKey
		if (this.state.config.variantFilter?.terms) {
			const f = this.state.config.variantFilter.terms.find(i => i.id == group.infoKey)
			if (f && f.name) name = f.name
		}
		div
			.append('span')
			.text(name)
			.attr('class', 'sja_menuoption')
			.on('click', event => {
				if (this.state.config.variantFilter.terms.length <= 1) {
					// only 1, no other option to switch to
					return
				}
				// multiple options, allow to replace
				this.dom.tip
					.clear()
					.showunder(event.target)
					.d.append('div')
					.text('Replace with:')
					.style('margin', '10px')
					.style('font-size', '.8em')
				for (const f of this.state.config.variantFilter.terms) {
					if (f.type != 'integer' && f.type != 'float') continue // only allow numeric fields
					if (f.id == group.infoKey) continue // same one

					this.dom.tip.d
						.append('div')
						.text(f.name)
						.attr('class', 'sja_menuoption')
						.on('click', () => {
							/////////////////////////////////
							// create a new group using this info field
							this.dom.tip.hide()
							const groups = structuredClone(this.state.config.snvindel.details.groups)
							groups[groupIdx].infoKey = f.id
							groups[groupIdx].type = 'info'
							this.interactions.launchGroupsFilter(groups)
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

	render1group_population(groupIdx, group, div) {
		// this group is a predefined population
		div
			.append('span')
			.text(group.label)
			.attr('class', 'sja_menuoption')
			.on('click', event => {
				if (this.state.config.snvindel.populations.length <= 1) {
					// only 1, no other option to switch to
					return
				}
				// multiple options, allow to replace
				this.dom.tip
					.clear()
					.showunder(event.target)
					.d.append('div')
					.text('Replace with:')
					.style('margin', '10px')
					.style('font-size', '.8em')

				for (const p of this.state.config.snvindel.populations) {
					if (p.key == group.key) continue
					this.dom.tip.d
						.append('div')
						.text(p.label)
						.attr('class', 'sja_menuoption')
						.on('click', () => {
							this.dom.tip.hide()
							const groups = structuredClone(this.state.config.snvindel.details.groups)
							groups[groupIdx] = structuredClone(p)
							groups[groupIdx].type = 'population'
							this.interactions.launchGroupsFilter(groups)
						})
				}
			})
		div
			.append('span')
			.text(`POPULATION${group.adjust_race ? ', RACE ADJUSTED' : ''}`)
			.style('font-size', '.7em')
			.style('margin-left', '10px')
			.style('opacity', 0.6)

		if (this.data.pop2average) {
			// info available, computed for the other group comparing against this population, display here
			if (this.state.config.snvindel.details.groups[groupIdx == 1 ? 0 : 1]?.type == 'filter') {
				/*
				!!poor fix!!
				only render the text when the other group is "filter",
				so that when the other group is no longer type=filter, the admix text will disappear from this group
				this is because self._partialData is *sticky* and is never deleted, due to the way parent passing it to child
				and assume that pop2average must be from comparison between 2 groups of filter-vs-population
				e.g. when info-vs-population, despite the _partialData is still there, must not render it
				*/
				const lst: any = []
				for (const k in this.data.pop2average) {
					const value = this.data.pop2average[k]
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
							this.dom.tip
								.clear()
								.showunder(event.target)
								.d.append('div')
								.style('margin', '10px')
								.style('width', '500px').html(`These are average admixture coefficients based on current Group ${
								groupIdx == 1 ? 1 : 2
							} samples.
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

	async render1group_filter(groupIdx, group, div) {
		/*
		this group is based on a termdb-filter
		when initiating the filter ui, must join group's filter with mass global filter and submit the joined filter to main()
		this allows tvs edit to show correct number of samples
		*/
		if (!this.filterUI[groupIdx]) {
			this.filterUI[groupIdx] = await filterInit({
				holder: div,
				vocab: this.state.vocab,
				emptyLabel: 'Entire cohort',
				termdbConfig: this.opts.vocabApi.termdbConfig,
				callback: f => {
					const groups = JSON.parse(JSON.stringify(this.state.config.snvindel.details.groups))
					groups[groupIdx].filter = f
					this.interactions.launchGroupsFilter(groups)
				}
			})
		}

		this.filterUI[groupIdx].main(this.getJoinedFilter(group))
		div.select('.sjpp-gb-filter-count').remove()
		const count = this.data.groupSampleCounts?.[groupIdx]

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

	getJoinedFilter(group) {
		// clone the global filter; group filter will be joined into it
		const joinedFilter = structuredClone(this.state.filter || { type: 'tvslst', in: true, join: '', lst: [] })
		const gf = structuredClone(group.filter)
		// tag group filter for it to be rendered in filter ui
		// rest of state.filter will remain invisible
		gf.tag = 'filterUiRoot'
		joinedFilter.lst.push(gf)
		joinedFilter.join = 'and'
		return joinedFilter
	}

	// show vertical toggle options: filter/population/info
	// when any is selected, create a new group object and set to snvindel.details.groups[groupIdx]
	launchMenu_createGroup(groupIdx, div) {
		const opt: any = {
			holder: div.append('div').style('margin', '5px'),
			tabs: this.state.config.snvindel.details.groupTypes.map(i => {
				return { label: i.name }
			}),
			tabsPosition: 'vertical',
			linePosition: 'right'
		}
		new Tabs(opt).main()
		for (const [idx, groupType] of this.state.config.snvindel.details.groupTypes.entries()) {
			// { type:str, name:str }
			const tab = opt.tabs[idx]
			tab.contentHolder.style('margin', '10px')
			if (groupType.type == 'info') {
				if (!this.state.config.variantFilter?.terms)
					throw 'looking for snvindel info fields but self.state.config.variantFilter.terms[] missing'
				for (const f of this.state.config.variantFilter.terms) {
					if (f.type != 'integer' && f.type != 'float') continue // only allow numeric fields
					tab.contentHolder
						.append('div')
						.text(f.name)
						.attr('class', 'sja_menuoption')
						.on('click', () => {
							/////////////////////////////////
							// create a new group using this info field
							this.dom.tip.hide()
							const newGroup = {
								type: 'info',
								infoKey: f.id
							}
							const details = this.makeNewDetail(newGroup, groupIdx)
							mayUpdateGroupTestMethodsIdx(this.state, details)
							this.interactions.launchSnvIndelDetails(details)
						})
				}
				continue
			}
			if (groupType.type == 'population') {
				if (!this.state.config.snvindel.populations) throw 'state.config.snvindel.populations missing'
				for (const p of this.state.config.snvindel.populations) {
					// {key,label, allowto_adjust_race, adjust_race}
					tab.contentHolder
						.append('div')
						.text(p.label)
						.attr('class', 'sja_menuoption')
						.on('click', () => {
							/////////////////////////////////
							// create a new group using this population
							this.dom.tip.hide()
							const newGroup = {
								type: 'population',
								key: p.key,
								label: p.label,
								allowto_adjust_race: p.allowto_adjust_race,
								adjust_race: p.adjust_race
							}
							const details = this.makeNewDetail(newGroup, groupIdx)
							mayUpdateGroupTestMethodsIdx(this.state, details)
							this.interactions.launchSnvIndelDetails(details)
						})
				}
				continue
			}
			if (groupType.type == 'filter') {
				const arg = {
					holder: tab.contentHolder,
					vocabApi: this.opts.vocabApi,
					state: {
						activeCohort: this.state.activeCohort,
						termfilter: { filter: this.state.filter }
					},
					tree: {
						click_term2select_tvs: tvs => {
							/////////////////////////////////
							// create a new group using this tvs
							this.dom.tip.hide()
							const newGroup = {
								type: 'filter',
								filter: {
									in: true,
									join: '',
									type: 'tvslst',
									lst: [{ type: 'tvs', tvs }]
								}
							}
							const details = this.makeNewDetail(newGroup, groupIdx)
							mayUpdateGroupTestMethodsIdx(this.state, details)
							this.interactions.launchSnvIndelDetails(details)
						}
					}
				}
				appInit(arg)
				continue
			}
			throw 'unknown group type'
		}
	}

	makeNewDetail(newGroup, groupIdx) {
		const newDetail = {
			groups: JSON.parse(JSON.stringify(this.state.config.snvindel.details.groups))
		}
		newDetail.groups[groupIdx] = newGroup
		return newDetail
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
				const details = { groupTestMethodsIdx: select.property('selectedIndex') }
				this.interactions.launchSnvIndelDetails(details)
			})
		for (const m of this.state.config.snvindel.details.groupTestMethods) {
			select.append('option').text(m.name)
		}
		select.property('selectedIndex', this.state.config.snvindel.details.groupTestMethodsIdx)
	}

	/* tricky logic */
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
				let found = true
				while (found) {
					found = false
					for (const [i, tk] of this.blockInstance.tklst.entries()) {
						if (tk.type == 'mds3') {
							this.blockInstance.tk_remove(i)
							found = true
							break
						}
					}
				}
			}
			return
		}

		// no block instance, create new block

		this.dom.blockHolder.selectAll('*').remove()
		const arg: any = {
			holder: this.dom.blockHolder,
			genome: this.opts.genome, // genome obj
			nobox: true,
			tklst,
			debugmode: this.opts.debug,
			/*
            // use onsetheight but not onloadalltk_always, so callback will be called on all tk updates, including removing tk
            //onloadalltk_always:
            onsetheight: () => {
                // TODO on any tk update, collect tk config and save to state so they are recoverable from session
                // FIXME this is not called at protein mode
                this.maySaveTrackUpdatesToState()
            }
            */
			onAddRemoveTk: () => this.interactions.maySaveTrackUpdatesToState(this.blockInstance, this.state)
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
		first_genetrack_tolist(this.opts.genome, arg.tklst)

		arg.onCoordinateChange = this.interactions.onCoordinateChange

		const _ = await import('#src/block')
		this.blockInstance = new _.Block(arg)
	}
}
