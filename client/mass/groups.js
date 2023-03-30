import { getCompInit } from '#rx'
import { Menu } from '#dom/menu'
import { filterInit, getNormalRoot, filterPromptInit, getFilterItemByTag } from '#filter/filter'
import { select } from 'd3-selection'
import { appInit } from '#termdb/app'
import { renderTable } from '#dom/table'
import { getSamplelstTW } from '../plots/sampleScatter.interactivity'

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
			groups: rebaseGroupFilter(appState),
			termdbConfig: appState.termdbConfig
		}
		return state
	}

	async main() {
		await updateUI(this)
	}

	//////////////// rest are app-specific logic

	getMassFilter() {
		if (!this.state.termfilter.filter || this.state.termfilter.filter.lst.length == 0) {
			return { type: 'tvslst', in: true, join: '', lst: [] }
		}
		const f = getNormalRoot(structuredClone(this.state.termfilter.filter)) // strip tag
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

	async openSummaryPlot(term, sltw) {
		const tw = { id: term.id, term }
		const config = {
			chartType: 'summary',
			childType: 'barchart',
			term: tw,
			term2: sltw
		}
		await this.app.dispatch({
			type: 'plot_create',
			config
		})
	}

	async openSurvivalPlot(term, sltw) {
		const tw = { id: term.id, term }
		const config = {
			chartType: 'survival',
			term: tw,
			term2: sltw
		}
		await this.app.dispatch({
			type: 'plot_create',
			config
		})
	}

	async groups2samplelst(groups) {
		const samplelstGroups = []
		for (const g of groups) {
			const samples = await this.app.vocabApi.getFilteredSampleCount(g.filter, 'list')
			const items = []
			for (const sample of samples) items.push({ sampleId: sample })
			samplelstGroups.push({ name: g.name, items })
		}
		const name = samplelstGroups.length == 1 ? samplelstGroups[0].name : 'Sample groups'
		const tw = getSamplelstTW(samplelstGroups, name, { disabled: true })
		return tw
	}

	updateLaunchButton() {
		const lst = [...this.selectedGroupsIdx]
		if (lst.length == 0) return this.dom.launchButton.style('display', 'none') // no selected groups
		this.dom.launchButton.style('display', '')
		if (lst.length == 1) return this.dom.launchButton.text(`Launch plot with "${this.state.groups[lst[0]].name}"`)
		this.dom.launchButton.text(`Launch plot with ${lst.length} groups`)
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
	self.dom.launchButton = btnRow
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

	// create "Add new group" button
	filterPromptInit({
		holder: self.dom.addNewGroupBtnHolder,
		vocab: self.app.opts.state.vocab,
		emptyLabel: 'Add new group',
		termdbConfig: self.state.termdbConfig,
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
				filter: f
			}
			groups.push(newGroup)
			self.app.dispatch({
				type: 'app_refresh',
				state: { groups }
			})
		}
	}).main(self.getMassFilter()) // provide mass filter to limit the term tree

	// duplicate groups[] array to mutate and add to action.state for dispatching
	const groups = structuredClone(self.state.groups)

	if (!groups.length) {
		// no groups, do not show launch button, hide table
		self.dom.launchButton.style('display', 'none')
		self.dom.filterTableDiv.style('display', 'none')
		return
	}

	// display table and populate rows
	self.dom.filterTableDiv
		.style('display', '')
		.selectAll('*')
		.remove()
	const tableArg = {
		div: self.dom.filterTableDiv,
		columns: [
			{
				label: 'NAME',
				editCallback: (i, cell) => {
					// group name is changed
					groups[i].name = cell.value
					self.app.dispatch({
						type: 'app_refresh',
						state: { groups }
					})
				}
			},
			{ label: '#SAMPLE' },
			{ label: 'FILTER' }
			// todo delete
		],
		rows: []
	}
	for (const g of groups) {
		tableArg.rows.push([
			{ value: g.name }, // to allow click to show <input>
			{ value: 'n=' + (await self.app.vocabApi.getFilteredSampleCount(g.filter)) },
			{} // blank cell to show filter ui
		])
	}

	// clear existing selected groups
	self.selectedGroupsIdx.clear()

	if (groups.length == 1) {
		// only one group, add index 0
		self.selectedGroupsIdx.add(0)
	} else {
		// more than 1 group, show checkboxes for each row
		tableArg.noButtonCallback = (i, node) => {
			if (node.checked) self.selectedGroupsIdx.add(i)
			else self.selectedGroupsIdx.delete(i)
			self.updateLaunchButton() // update button text, based on how many groups are selected
		}
		//
		tableArg.selectedRows = []
		for (let i = 0; i < groups.length; i++) {
			tableArg.selectedRows.push(i) // check all rows by default
			self.selectedGroupsIdx.add(i)
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
					// blank filter (user removed last tvs from this filter), delete this element from groups[]
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

	self.updateLaunchButton()
}

function clickLaunchBtn(self) {
	tip.clear().showunder(self.dom.launchButton.node())

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

/*
s = {groups[ {filter} ], termfilter{filter} }
termfilter is mass global filter
if provided, need to "rebase" group's visible filter to it
a group filter contains the shadowy global filter from previous state. when new state is provided, need to replace it
*/
function rebaseGroupFilter(s) {
	if (!s.termfilter?.filter || s.termfilter.filter.lst.length == 0) {
		// blank filter
		return s.groups
	}
	const groups = [] // new groups
	for (const g of s.groups) {
		const f = getNormalRoot(structuredClone(s.termfilter.filter))
		const f2 = getFilterItemByTag(g.filter, 'filterUiRoot')
		if (!f2) {
			console.log('filterUiRoot not found')
			groups.push(g)
			continue
		}
		f.lst.push(f2)
		f.join = f.lst.length > 1 ? 'and' : ''
		const g2 = {
			name: g.name,
			filter: f
		}
		groups.push(g2)
	}
	return groups
}
