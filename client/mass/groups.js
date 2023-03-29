import { getCompInit } from '#rx'
import { Menu } from '#dom/menu'
import { filterInit, getNormalRoot } from '#filter/filter'
import { select } from 'd3-selection'
import { appInit } from '#termdb/app'

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
		delete f.tag // delete the "filterUiRoot" tag so it won't be visible in filter ui showing in this app
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

	async getGroupVsRest(group) {
		// group = {filter}
		const samplesInGroup = await this.app.vocabApi.getFilteredSampleCount(group.filter, 'list')
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
}

export const groupsInit = getCompInit(MassGroups)

function initUI(self) {
	self.dom.filterTable = self.dom.holder.append('table').style('margin-bottom', '10px')

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
		self.dom.filterTable.style('display', 'none')
		return
	}

	// display table and create header
	self.dom.filterTable
		.style('display', '')
		.selectAll('*')
		.remove()
	const tr = self.dom.filterTable
		.append('tr')
		.style('opacity', 0.5)
		.style('font-size', '.8em')
	tr.append('td').text('NAME')
	tr.append('td')
		.text('FILTERING CRITERIA')
		.style('padding-left', '10px') // equal to filter ui padding
	tr.append('td').text('#SAMPLE')

	// render each group
	for (const group of groups) {
		const tr = self.dom.filterTable.append('tr')
		// name
		{
			const td = tr.append('td')
			td.text(group.name)
			// TODO click to rename and dispatch
		}
		// filter
		{
			const td = tr.append('td')
			const fi = filterInit({
				holder: td,
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
			})
			fi.main(getJoinedFilter(self, group))
		}

		// #samples
		tr.append('td')
			.text('n=' + (await self.app.vocabApi.getFilteredSampleCount(group.filter)))
			.style('opacity', 0.5)

		// delete
	}

	// show launch btn, depends
	self.dom.launchBtn.style('display', '')
	self.dom.launchBtn.text(
		groups.length == 1 ? `Launch plot with "${groups[0].name}"` : 'Select group(s) to launch plot'
	)
}

function getJoinedFilter(self, group) {
	// clone the global filter; group filter will be joined into it
	const joinedFilter = self.getMassFilter()
	const gf = structuredClone(group.filter)
	// tag group filter for it to be rendered in filter ui
	// rest of state.filter will remain invisible
	gf.tag = 'filterUiRoot'
	joinedFilter.lst.push(gf)
	if (joinedFilter.lst.length > 1) joinedFilter.join = 'and'
	return joinedFilter
}

function clickLaunchBtn(self) {
	tip.clear().showunder(self.dom.launchBtn.node())

	if (self.state.groups.length == 0) return tip.d.append('p').text('No groups')

	if (self.state.groups.length == 1) {
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
					self.openSummaryPlot(term, await self.getGroupVsRest(self.state.groups[0]))
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
						self.openSurvivalPlot(term, await self.getGroupVsRest(self.state.groups[0]))
					},
					state
				)
			})
		}
		return
	}

	// multiple groups
	tip.d.append('div').text('List groups to select')
}
