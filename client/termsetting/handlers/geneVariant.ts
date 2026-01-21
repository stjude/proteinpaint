import { getPillNameDefault } from '../utils.ts'
import type { PillData } from '../types'
import { make_radios, renderTable } from '#dom'
import { filterInit, filterPromptInit, getNormalRoot, excludeFilterByTag } from '#filter/filter'
import type { TermSetting } from '../TermSetting.ts'
import { vocabInit } from '#termdb/vocabulary'
import { getDtTermValues } from '#filter/tvs.dt'
import { getColors } from '#shared/common.js'
import { rgb } from 'd3-color'

const colorScale = getColors(5)

// self is the termsetting instance
export function getHandler(self: TermSetting) {
	return {
		getPillName(d: PillData) {
			return getPillNameDefault(self, d)
		},

		getPillStatus() {
			let text
			const q = self.q as any // TODO: migrate this handler to use client/tw code
			if (q.type == 'predefined-groupset') {
				const groupsetting = self.term.groupsetting
				if (!groupsetting.lst?.length) throw 'no predefined groupsets found'
				const groupset = groupsetting.lst[q.predefined_groupset_idx]
				text = groupset.name
			} else if (q.type == 'custom-groupset') {
				const n = q.customset.groups.length
				text = `Divided into ${n} groups`
			} else {
				text = 'any variant class'
			}
			return { text }
		},

		async showEditMenu(div: Element) {
			await makeEditMenu(self, div)
		}
	}
}

async function makeEditMenu(self: TermSetting, _div: any) {
	/* TODO: instead of directly modifying self.q here, should create a separate property on the handler to store pending user
	configurations (similar to numeric continuous/discrete switching)
	const handler = self.handlerByType.geneVariant */
	const div = _div.append('div').style('margin', '10px')
	div.append('div').style('font-size', '1.2rem').text(self.term.name)
	const optsDiv = div.append('div').style('margin-top', '10px').style('margin-bottom', '1px')
	const groupsDiv = div.append('div').style('display', 'none').style('margin', '10px').style('vertical-align', 'top')
	// radio buttons for whether or not to group samples
	optsDiv.append('div').style('font-weight', 'bold').text('Group samples')
	const q = self.q as any // TODO: migrate this handler to use client/tw code
	const isGroupset = q.type == 'predefined-groupset' || q.type == 'custom-groupset'
	make_radios({
		holder: optsDiv,
		options: [
			{ label: 'No sample grouping', value: 'noGroup', checked: !isGroupset },
			{ label: 'Assign samples to groups', value: 'group', checked: isGroupset }
		],
		callback: async v => {
			if (v == 'group') {
				if (q.type == 'values') Object.assign(q, { type: 'custom-groupset', customset: { groups: [] } })
				await makeGroupUI(self, groupsDiv)
			} else {
				clearGroupset(self)
				groupsDiv.style('display', 'none')
			}
		}
	})
	if (isGroupset) await makeGroupUI(self, groupsDiv)

	if (
		(self.usecase?.detail && ['term', 'term0', 'term2'].includes(self.usecase.detail)) ||
		self.opts.geneVariantEditMenuOnlyGrp
	) {
		// only groupsetting is allowed
		// hide option for turning off groupsetting
		optsDiv.style('display', 'none')
		groupsDiv.style('margin', '0px')
	}

	// apply button
	div
		.append('div')
		.style('margin-top', '25px')
		.append('button')
		.text('Apply')
		.on('click', () => {
			const q = self.q as any // TODO: migrate this handler to use client/tw code
			if (q.type == 'predefined-groupset' || q.type == 'custom-groupset') {
				// groupsetting
				if (!self.groups?.length) {
					// no groups created
					window.alert('Samples must be assigned to at least one group.')
					return
				} else {
					// groups created, assign to custom groupset
					Object.assign(q, { type: 'custom-groupset', customset: { groups: self.groups } })
				}
			} else {
				// no groupsetting
				if (q.type != 'values') throw `q.type must be 'values'`
			}
			self.api.runCallback()
		})
}

// make UI for grouping variants
async function makeGroupUI(self: TermSetting, div) {
	div.style('display', 'block')
	div.selectAll('*').remove()

	// message
	div
		.append('div')
		.style('margin', '15px 0px')
		.text(
			'Group samples by mutation status. Samples are assigned to first possible group. Only tested samples are considered.'
		)

	// filter table
	const filterTableDiv = div.append('div')
	// add new group button
	const addNewGroupBtnHolder = div.append('div')

	const q = self.q as any // TODO: migrate this handler to use client/tw code
	// get groups
	if (q.type != 'predefined-groupset' && q.type != 'custom-groupset') throw 'unexpected q.type'
	if (!self.groups) {
		let groupset
		if (q.type == 'predefined-groupset') {
			const groupsetting = self.term.groupsetting
			if (!groupsetting.lst?.length) throw 'no predefined groupsets found'
			groupset = groupsetting.lst[q.predefined_groupset_idx]
		} else {
			groupset = q.customset
		}
		if (!groupset) throw 'groupset is missing'
		if (!Array.isArray(groupset.groups)) throw 'groupset.groups is not array'
		self.groups = structuredClone(groupset.groups)
	}

	// fill values of child dt terms with mutation classes of gene in dataset
	for (const dtTerm of self.term.childTerms) {
		await getDtTermValues(dtTerm, self.filter, self.vocabApi)
	}

	// build frontend vocab using child dt terms
	const vocabApi: any = vocabInit({ vocab: { terms: self.term.childTerms } })
	// need termdbConfig.queries for cnv tvs (see getDtCnvType() in filter/tvs.js and
	// fillMenu() in filter/tvs.dtcnv.continuous.js)
	// not passing complete termdbConfig as presence of .allowedTermTypes will
	// trigger term type toggles (see init() in termdb/TermTypeSearch.ts)
	vocabApi.termdbConfig = { queries: self.vocabApi.termdbConfig.queries }

	// filter prompt
	const filterPrompt = await filterPromptInit({
		holder: addNewGroupBtnHolder,
		vocabApi,
		emptyLabel: 'Add group',
		header_mode: 'hide_search',
		callback: f => {
			const filter = getNormalRoot(f)
			addNewGroup(filter, self.groups)
			makeGroupUI(self, div)
		},
		debug: self.opts.debug
	})

	// filterPrompt.main() always empties the filterUiRoot data
	const filter = structuredClone(self.filter)
	filterPrompt.main(excludeFilterByTag(filter, 'cohortFilter')) // provide mass filter to limit the term tree

	if (!self.groups.length) {
		// no groups, hide table
		filterTableDiv.style('display', 'none')
		return
	}

	// clear table and populate rows
	filterTableDiv.style('display', '').selectAll('*').remove()
	const tableArg: any = {
		div: filterTableDiv,
		columns: [
			{}, // blank column to add delete buttons
			{
				label: 'NAME',
				editCallback: async (i, cell) => {
					const newName = cell.value
					const index = self.groups.findIndex(group => group.name == newName)
					if (index != -1) {
						alert(`Group named ${newName} already exists`)
						makeGroupUI(self, div)
					} else {
						self.groups[i].name = newName
						makeGroupUI(self, div)
					}
				}
			},
			{
				label: 'COLOR',
				editCallback: async (i, cell) => {
					self.groups[i].color = cell.color
					makeGroupUI(self, div)
				}
			},
			//{ label: '#SAMPLE' }, // will re-enable when filtered sample count can be supported for gdc
			{ label: 'FILTER' }
		],
		rows: [],
		striped: false, // no alternating row bg color so delete button appears more visible
		showLines: false
	}

	for (const g of self.groups) {
		tableArg.rows.push([
			{}, // blank cell to add delete button
			{ value: g.name }, // to allow click to show <input>
			{ color: g.color },
			// { value: 'n=' + (await self.vocabApi.getFilteredSampleCount(g.filter)) }, // will re-enable when filtered sample count can be supported for gdc
			{} // blank cell to show filter ui
		])
	}

	renderTable(tableArg)

	// after rendering table, iterate over rows again to fill cells with control elements
	for (const [i, row] of tableArg.rows.entries()) {
		// add delete button in 1st cell
		row[0].__td
			.append('div')
			.attr('class', 'sja_menuoption')
			.style('padding', '1px 6px')
			.html('&times;')
			.on('click', () => {
				self.groups.splice(i, 1)
				makeGroupUI(self, div)
			})

		// create filter ui in its cell
		const group = self.groups[i]
		filterInit({
			holder: row[3].__td,
			vocabApi,
			header_mode: 'hide_search',
			callback: f => {
				if (!f || f.lst.length == 0) {
					// blank filter (user removed last tvs from this filter), delete this element from groups[]
					const i = self.groups.findIndex(g => g.name == group.name)
					self.groups.splice(i, 1)
				} else {
					// update filter
					excludeGeneNameFromFilter(f) // no need to show gene name in filter pill
					group.filter = f
				}
				makeGroupUI(self, div)
			}
		}).main(group.filter)
	}
}

function addNewGroup(filter, groups, name?: string) {
	if (!groups) throw 'groups is missing'
	if (!name) {
		const base = 'New group'
		name = base
		for (let i = 0; ; i++) {
			name = base + (i === 0 ? '' : ' ' + i)
			if (!groups.find(g => g.name === name)) break
		}
	}
	excludeGeneNameFromFilter(filter) // no need to show gene name in filter pill
	const newGroup = {
		name,
		type: 'filter',
		filter,
		color: rgb(colorScale(groups.length)).formatHex()
	}
	groups.push(newGroup)
}

function excludeGeneNameFromFilter(filter) {
	for (const item of filter.lst) {
		if (item.type == 'tvslst') {
			excludeGeneNameFromFilter(item)
		} else if (item.type == 'tvs') {
			item.tvs.excludeGeneName = true
		} else {
			throw 'unexpected item.type'
		}
	}
}

function clearGroupset(self) {
	self.q.type = 'values'
	delete self.q.predefined_groupset_idx
	delete self.q.customset
}
