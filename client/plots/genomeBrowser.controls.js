import { getCompInit } from '#rx'
import { Menu } from '#dom/menu'
import { filterInit, getNormalRoot, getFilterItemByTag } from '#filter/filter'
import { Tabs } from '#dom/toggleButtons'
import { appInit } from '#termdb/app'

/*
main
	makeVariantValueComputingGroupControls
		render1group
			makePrompt2addNewGroup
				launchMenu_createGroup
			render1group_info
			render1group_population
			render1group_filter
*/
const groupTip = new Menu({ padding: '0px' })

class GbControls {
	constructor(opts) {
		/* opts = {}
		.app
		.id
		.holder
		.variantFilter
		*/
		this.type = 'gbControls'
	}

	async init(appState) {
		this.dom = {
			// hardcode to 2 groups used by state.config.snvindel.details.groups[]
			group1div: this.opts.holder.append('div'),
			group2div: this.opts.holder.append('div'),
			testMethodDiv: this.opts.holder.append('div')
		}
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return {
			config,
			termdbConfig: appState.termdbConfig,
			filter: getNormalRoot(appState.termfilter.filter)
		}
	}

	async main() {
		if (this.state.config.snvindel?.details?.groups) {
			// is equipped with comparison groups, render group ui
			this.render1group(0)
			this.render1group(1)

			if (this.state.config.snvindel.details.groupTestMethods) {
				this.renderTestMethod()
			}
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

		div.selectAll('*').remove()

		if (!group) {
			// group does not exist in groups[] based on array index, e.g. when there's just 1 group and groups[1] is undefined
			// add a prompt in place of header button
			makePrompt2addNewGroup(this, groupIdx, div)
			return
		}

		// the group exists; first show the group header button
		makeGroupHeaderButton(this, groupIdx, div)

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

		div
			.append('span')
			.text('TEST METHOD')
			.style('font-size', '.8em')
			.style('opacity', 0.6)

		if (g1.type != 'filter' && g2.type != 'filter') {
			// neither group is filter, test method can only be value diff and also not configurable
			div
				.append('span')
				.style('padding-left', '10px')
				.text('Value difference')
				.style('opacity', 0.6)
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
}

export const gbControlsInit = getCompInit(GbControls)

function render1group_info(self, groupIdx, group, div) {
	let name = group.infoKey
	if (self.opts.variantFilter?.terms) {
		const f = self.opts.variantFilter.terms.find(i => i.id == group.infoKey)
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

	self.opts.holder.g0 = div
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
			if (!self.opts.variantFilter || !self.opts.variantFilter.terms)
				throw 'looking for snvindel info fields but self.opts.variantFilter.terms[] missing'
			for (const f of self.opts.variantFilter.terms) {
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
