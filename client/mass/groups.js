import { getCompInit } from '#rx'
import { Menu } from '#dom/menu'
import { filterInit, getNormalRoot } from '#filter/filter'
import { select } from 'd3-selection'
import { appInit } from '#termdb/app'
import { renderTable } from '#dom/table'

/*
this
	app
		vocabApi
		opts
			genome{}
			state
				vocab{}
	state {}
		groups []
			group.name=str
			group.filter={}
		termfilter{}
			filter{}
		termdbConfig{}
*/

const tip = new Menu({ padding: '0px' })
const tip2 = new Menu({ padding: '0px' }) // to show tree ui

class MassGroups {
	constructor(opts = {}) {
		this.type = 'groups'
		this.filterUI = {} // key: group name, value: filter instance for this group
		this.selectedGroupsIdx = new Set() // set of array index for this.state.groups[], for those selected in table ui
	}

	async init() {
		this.dom = {
			holder: this.opts.holder.append('div').style('margin', '10px')
		}
		initUI(this)
	}

	getState(appState) {
		const state = {
			termfilter: appState.termfilter,
			groups: appState.groups,
			termdbConfig: appState.termdbConfig
		}
		return state
	}

	async main() {
		console.log(this)
		await updateUI(this)
	}

	//////////////// rest are app-specific logic

	getMassFilter() {
		if (!this.state.termfilter.filter) return { type: 'tvslst', in: true, join: '', lst: [] }
		const f = structuredClone(this.state.termfilter.filter)
		if (f.tag == 'filterUiRoot') delete f.tag // delete tag so it won't be visible in filter ui showing in this app
		// the mass filter should be "hidden" in the filter uis
		return f
	}

	async showTree(div, callback, state = { tree: { usecase: { detail: 'term' } } }) {
		tip2.clear().showunderoffset(div.node())
		appInit({
			holder: tip2.d,
			vocabApi: this.app.vocabApi,
			state,
			tree: {
				termfilter: this.state.termfilter,
				click_term: term => {
					callback(term)
					tip.hide()
					tip2.hide()
				}
			}
		})
	}

	async openSummaryPlot(term, groups) {
		const tw = { id: term.id, term }
		const config = {
			chartType: 'summary',
			childType: 'barchart',
			term: tw,
			term2: {
				term: { name: 'Groups', type: 'samplelst' },
				q: {
					mode: 'custom-groupsetting',
					groups,
					groupsetting: { disabled: true }
				}
			}
		}
		await this.app.dispatch({
			type: 'plot_create',
			config
		})
	}

	async openSurvivalPlot(term, groups) {
		const tw = { id: term.id, term }
		const config = {
			chartType: 'survival',
			term: tw,
			term2: {
				term: { name: 'Groups', type: 'samplelst' },
				q: {
					mode: 'custom-groupsetting',
					groups,
					groupsetting: { disabled: true }
				}
			}
		}
		await this.app.dispatch({
			type: 'plot_create',
			config
		})
	}

	async groups2samplelst(groups) {
		// groups is array of one or more ele from this.state.groups[]
		if (groups.length == 1) {
			// only 1 group, in samplelst generate two sets, one for samples in this group, the other for samples out of this group
			const samplesInGroup = await this.app.vocabApi.getFilteredSampleCount(groups[0].filter, 'list')
			const samplesAll = await this.app.vocabApi.getFilteredSampleCount(this.state.termfilter.filter, 'list')
			// each is array of sample ids
			const samplesNotInGroup = []
			for (const s of samplesAll) {
				if (!samplesInGroup.includes(s)) samplesNotInGroup.push(s)
			}
			return [
				{
					name: 'Samples in group',
					key: 'sample', // ?
					values: samplesInGroup.map(i => {
						return { sampleId: i }
					})
				},
				{
					name: 'Samples not in group',
					key: 'sample', // ?
					values: samplesNotInGroup.map(i => {
						return { sampleId: i }
					})
				}
			]
		}
		// multiple groups
		const lst = []
		for (const g of groups) {
			const samples = await this.app.vocabApi.getFilteredSampleCount(g.filter, 'list')
			lst.push({
				name: g.name,
				key: 'sample',
				values: samples.map(i => {
					return { sampleId: i }
				})
			})
		}
		return lst
	}

	updateLaunchBtn() {
		const lst = [...this.selectedGroupsIdx]
		if (lst.length == 0) return this.dom.launchBtn.style('display', 'none') // no selected groups
		this.dom.launchBtn.style('display', '')
		if (lst.length == 1) return this.dom.launchBtn.text(`Launch plot with "${this.state.groups[lst[0]].name}"`)
		this.dom.launchBtn.text(`Launch plot with ${lst.length} groups`)
	}
}

export const groupsInit = getCompInit(MassGroups)

function initUI(self) {
	self.dom.filterTableDiv = self.dom.holder.append('div').style('margin-bottom', '10px')
	//self.dom.filterTable = self.dom.holder.append('table').style('margin-bottom', '10px')

	// bottom row of buttons
	const btnRow = self.dom.holder.append('div')

	// btn 1: prompt to add new group
	self.dom.addNewGroupBtnHolder = btnRow.append('span')

	// btn 2: launch plot
	self.dom.launchBtn = btnRow
		.append('span')
		.attr('class', 'sja_menuoption')
		.style('margin-left', '20px')
		.on('click', () => clickLaunchBtn(self))
}

async function updateUI(self) {
	// reset prompt button;
	// prompt button is an instance to a blank filter, can only make the button after state is filled
	// but not in init()
	self.dom.addNewGroupBtnHolder.selectAll('*').remove()

	filterInit({
		holder: self.dom.addNewGroupBtnHolder,
		vocab: self.app.opts.state.vocab,
		emptyLabel: 'Add new group',
		termdbConfig: self.state.termdbConfig,

		// can add later
		doNotShowWholeFilterWhenNoUiRootTag: true,

		callback: f => {
			// create new group
			const name = 'New group'
			let i = 0
			while (1) {
				const name2 = name + (i == 0 ? '' : ' ' + i)
				if (!groups.find(g => g.name == name2)) break
				i++
			}
			const newGroup = {
				name: name + (i == 0 ? '' : ' ' + i),
				filter: getJoinedFilter(self, { filter: f })
			}
			groups.push(newGroup)
			self.app.dispatch({
				//type:'groups_edit',
				type: 'app_refresh',
				state: { groups }
			})
		}
	}).main(self.getMassFilter())

	// duplicate groups[] array to be mutable, and add to action.state for dispatching
	const groups = structuredClone(self.state.groups)

	if (!groups.length) {
		// no groups, do not show launch button, hide table
		self.dom.launchBtn.style('display', 'none')
		self.dom.filterTableDiv.style('display', 'none')
		return
	}

	// display table and create header
	self.dom.filterTableDiv
		.style('display', '')
		.selectAll('*')
		.remove()
	const tableArg = {
		div: self.dom.filterTableDiv,
		columns: [
			{ label: 'NAME' },
			{ label: '#SAMPLE' },
			{ label: 'FILTER' }
			// todo delete
		],
		rows: []
	}

	for (const group of groups) {
		const row = [
			{ value: group.name }, // to allow click to show <input>
			{ value: 'n=' + (await self.app.vocabApi.getFilteredSampleCount(group.filter)) },
			{} // blank cell to show filter ui
		]
		tableArg.rows.push(row)
	}

	self.selectedGroupsIdx.clear()

	if (groups.length == 1) {
		self.selectedGroupsIdx.add(0)
	} else {
		// more than 1 group, show checkboxes for each row
		tableArg.selectedRows = []
		for (let i = 0; i < groups.length; i++) {
			tableArg.selectedRows.push(i) // check all rows by default
			self.selectedGroupsIdx.add(i)
		}
		tableArg.noButtonCallback = (i, node) => {
			if (node.checked) self.selectedGroupsIdx.add(i)
			else self.selectedGroupsIdx.delete(i)
			self.updateLaunchBtn() // update button text, based on how many groups are selected
		}
	}

	renderTable(tableArg)

	for (const [i, row] of tableArg.rows.entries()) {
		const group = groups[i]
		filterInit({
			holder: row[2].__td,
			vocab: self.app.opts.state.vocab,
			termdbConfig: self.state.termdbConfig,
			callback: f => {
				if (!f || f.lst.length == 0) {
					// blank filter (user removed last tvs from this filter), delete group
					const i = groups.findIndex(g => g.name == group.name)
					groups.splice(i, 1)
				} else {
					// update filter
					group.filter = f
				}
				self.app.dispatch({
					type: 'app_refresh',
					state: { groups }
				})
			}
		}).main(group.filter)
	}

	self.updateLaunchBtn()
}

function getJoinedFilter(self, group) {
	// group = { filter{} }
	// if there's global filter, clone it and join with group.filter to return; tag group filter as visible part
	// otherwise, only return group filter
	const joinedFilter = self.getMassFilter()
	const gf = structuredClone(group.filter)

	if (!joinedFilter || joinedFilter.lst.length == 0) {
		// there's no global filter
		return gf
	}

	// has global filter, join with gf (label as visible), and return
	gf.tag = 'filterUiRoot'
	joinedFilter.lst.push(gf)
	if (joinedFilter.lst.length > 1) joinedFilter.join = 'and'
	return joinedFilter
}

function clickLaunchBtn(self) {
	tip.clear().showunder(self.dom.launchBtn.node())

	// collect groups in use
	const groups = []
	for (const i of self.selectedGroupsIdx) {
		const g = self.state.groups[i]
		if (g) groups.push(g)
	}
	if (groups.length == 0) return tip.d.append('p').text('No groups, should not happen')

	// 1 or more groups are in use, generate menu options to act on them

	// option = summary
	{
		const opt = tip.d
			.append('div')
			.attr('class', 'sja_menuoption')
			.style('border-radius', '0px')
			.text('Summarize')
		opt
			.insert('div')
			.html('›')
			.style('float', 'right')
		opt.on('click', () => {
			self.showTree(opt, async term => {
				self.openSummaryPlot(term, await self.groups2samplelst(groups))
			})
		})
	}

	if (self.state.termdbConfig.allowedTermTypes.includes('survival')) {
		const opt = tip.d
			.append('div')
			.attr('class', 'sja_menuoption')
			.style('border-radius', '0px')
			.html('Survival analysis&nbsp;&nbsp;')
		opt
			.insert('div')
			.html('›')
			.style('float', 'right')
		opt.on('click', () => {
			const state = {
				nav: { header_mode: 'hide_search' },
				tree: { usecase: { target: 'survival', detail: 'term' } }
			}
			self.showTree(
				opt,
				async term => {
					self.openSurvivalPlot(term, await self.groups2samplelst(groups))
				},
				state
			)
		})
	}
}
