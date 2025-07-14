import { getPillNameDefault } from '../termsetting'
import type { GeneVariantTermSettingInstance, RawGvTerm, RawGvCustomGsTW, VocabApi, DtTerm } from '#types'
import type { PillData } from '../types'
import { make_radios, renderTable } from '#dom'
import { dtTerms, getColors } from '#shared/common.js'
import { filterInit, filterPromptInit, getNormalRoot } from '#filter/filter'
import { rgb } from 'd3-color'
import { getWrappedTvslst } from '#filter/filter'

const colorScale = getColors(5)

// self is the termsetting instance
export function getHandler(self: GeneVariantTermSettingInstance) {
	return {
		getPillName(d: PillData) {
			return getPillNameDefault(self, d)
		},

		getPillStatus() {
			let text
			if (self.q.type == 'custom-groupset') {
				const n = self.q.customset.groups.length
				text = `Divided into ${n} groups`
			} else {
				text = 'any variant class'
			}
			return { text }
		},

		async showEditMenu(div: Element) {
			await makeEditMenu(self, div)
		},

		async postMain() {
			// need to regenerate child dt terms here to update
			// the terms upon data updates (e.g., filter)
			const body = self.opts.getBodyParams?.() || {}
			await getChildTerms(self.term, self.vocabApi, body)
		}
	}
}

async function makeEditMenu(self: GeneVariantTermSettingInstance, _div: any) {
	/* TODO: instead of directly modifying self.q here, should create a separate property on the handler to store pending user
	configurations (similar to numeric continuous/discrete switching)
	const handler = self.handlerByType.geneVariant
	*/
	const div = _div.append('div').style('padding', '10px')
	div.append('div').style('font-size', '1.2rem').text(self.term.name)
	const optsDiv = div.append('div').style('margin-top', '10px').style('margin-bottom', '1px')
	const groupsDiv = div
		.append('div')
		.style('display', 'none')
		.style('margin', '5px 0px 0px 30px')
		.style('vertical-align', 'top')
	// apply button
	// must create it at beginning to allow toggling applySpan message
	const applyRow = div.append('div').style('margin-top', '15px')
	applyRow
		.append('button')
		.style('display', 'inline-block')
		.text('Apply')
		.on('click', () => {
			let validGrpset = false
			if (self.q.type == 'custom-groupset') {
				// groupset is assigned
				if (self.q.customset?.groups.map((group: any) => group.filter?.lst).some(lst => lst.length)) {
					// filters in groupset are non-empty
					validGrpset = true
				}
			}
			if (!validGrpset) {
				// groupset is not valid, so clear it
				clearGroupset(self)
			}
			self.runCallback()
		})
	applyRow
		.append('span')
		.attr('id', 'applySpan')
		.style('display', 'none')
		.style('padding-left', '15px')
		.style('opacity', 0.8)
		.style('font-size', '.8em')
		.text('Only tested variants are considered')

	// radio buttons for whether or not to group variants
	optsDiv.append('div').style('font-weight', 'bold').text('Group variants')
	const isGroupset = self.q.type == 'custom-groupset'
	const radios = make_radios({
		holder: optsDiv,
		options: [
			{ label: 'No variant grouping', value: 'noGroup', checked: !isGroupset },
			{ label: 'Assign variants to groups', value: 'group', checked: isGroupset }
		],
		callback: async v => {
			if (v == 'group') {
				await makeGroupUI(self, groupsDiv)
			} else {
				clearGroupset(self)
				groupsDiv.style('display', 'none')
				applyRow.select('#applySpan').style('display', 'none')
			}
		}
	})

	if (
		(self.usecase?.detail && ['term', 'term0', 'term2'].includes(self.usecase.detail)) ||
		self.opts.geneVariantEditMenuOnlyGrp
	) {
		// hide option for turning off groupsetting
		optsDiv.style('display', 'none')
		groupsDiv.style('margin-top', '10px')
	}

	const selected = radios.inputs.filter(d => d.checked)
	if (selected.property('value') == 'group') await makeGroupUI(self, groupsDiv)
}

// make UI for grouping variants
async function makeGroupUI(self, div) {
	div.style('display', 'block')
	div.selectAll('*').remove()

	// filter table
	const filterTableDiv = div
		.append('div')
		.attr('id', 'filterTableDiv')
		.style('margin-left', '15px')
		.style('margin-bottom', '10px')
	// row of buttons
	const btnRow = div.append('div').attr('id', 'btnRow')
	// btn 1: prompt to add new group
	const addNewGroupBtnHolder = btnRow.append('span').style('margin-right', '20px')

	self.q.type = 'custom-groupset'
	if (!self.q.customset?.groups) self.q.customset = { groups: [] }
	const groups = self.q.customset.groups

	// prompt button is an instance to a blank filter, can only make the button after state is filled
	// but not in instance.init()
	// create "Add new group" button as needed
	const filterPrompt = await filterPromptInit({
		holder: addNewGroupBtnHolder,
		vocab: {
			terms: self.term.childTerms,
			parent_termdbConfig: self.vocabApi.termdbConfig
		},
		emptyLabel: 'Add group',
		//termdbConfig: self.vocabApi.termdbConfig,
		callback: f => {
			const filter = getNormalRoot(f)
			addNewGroup(filter, groups)
			makeGroupUI(self, div)
		},
		debug: self.opts.debug
	})

	// filterPrompt.main() always empties the filterUiRoot data
	filterPrompt.main(getMassFilter(self.filter)) // provide mass filter to limit the term tree

	if (!groups.length) {
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
					const index = groups.findIndex(group => group.name == newName)
					if (index != -1) {
						alert(`Group named ${newName} already exists`)
						makeGroupUI(self, div)
					} else {
						groups[i].name = newName
						makeGroupUI(self, div)
					}
				}
			},
			{
				label: 'COLOR',
				editCallback: async (i, cell) => {
					groups[i].color = cell.color
					makeGroupUI(self, div)
				}
			},
			{ label: '#SAMPLE' },
			{ label: 'FILTER' }
		],
		rows: [],
		striped: false // no alternating row bg color so delete button appears more visible
	}

	for (const g of groups) {
		tableArg.rows.push([
			{}, // blank cell to add delete button
			{ value: g.name }, // to allow click to show <input>
			{ color: g.color },
			{ value: 'n=' + (await self.vocabApi.getFilteredSampleCount(g.filter)) },
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
				groups.splice(i, 1)
				makeGroupUI(self, div)
			})

		// create fitlter ui in its cell
		const group = groups[i]
		//console.log('group.filter:', structuredClone(group.filter))
		filterInit({
			holder: row[4].__td,
			vocab: {
				terms: self.term.childTerms,
				parent_termdbConfig: self.vocabApi.termdbConfig
			},
			//termdbConfig: self.vocabApi.termdbConfig,
			callback: f => {
				if (!f || f.lst.length == 0) {
					// blank filter (user removed last tvs from this filter), delete this element from groups[]
					const i = groups.findIndex(g => g.name == group.name)
					groups.splice(i, 1)
				} else {
					// update filter
					group.filter = f
				}
				makeGroupUI(self, div)
			}
		}).main(group.filter)
	}

	//applyRow.select('#applySpan').style('display', 'inline')
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
	filter.lst.forEach(item => (item.tvs.excludeGeneName = true)) // no need to show gene name in filter pill
	const newGroup = {
		name,
		type: 'filter',
		filter,
		color: rgb(colorScale(groups.length)).formatHex()
	}
	groups.push(newGroup)
}

// fill custom groupset with 2 groups based on the first applicable dt term
export async function mayMakeGroups(tw: RawGvCustomGsTW, vocabApi: VocabApi) {
	if (tw.q.type != 'custom-groupset' || tw.q.customset?.groups.length) return
	tw.q.type = 'custom-groupset'
	tw.q.customset = { groups: [] }
	await getChildTerms(tw.term, vocabApi)
	const dtTerms = tw.term.childTerms
	if (!dtTerms) throw 'dtTerms is missing'
	let grp1Class, grp1Name, grp1Value, grp1Tvs, grp1Filter
	let grp2Class, grp2Name, grp2Value, grp2Tvs, grp2Filter
	for (const dtTerm of dtTerms) {
		const classes = Object.keys(dtTerm.values)
		if (classes.length < 2) {
			// fewer than 2 classes, try next dt term
			continue
		}
		// group 1 will be wildtype or first available mutant class
		grp1Class = classes.includes('WT') ? 'WT' : classes[0]
		grp1Name = dtTerm.values[grp1Class].label
		grp1Value = { key: grp1Class, label: grp1Name, value: grp1Class }
		grp1Tvs = { type: 'tvs', tvs: { term: dtTerm, values: [grp1Value] } }
		grp1Filter = getWrappedTvslst([grp1Tvs])
		if (dtTerm.origin) grp1Name += ` (${dtTerm.origin})`
		addNewGroup(grp1Filter, tw.q.customset.groups, grp1Name)
		// group 2 will be all other classes
		if (classes.length == 2) {
			grp2Class = classes.find(c => c != grp1Class)
			if (!grp2Class) throw 'mutant class cannot be found'
			grp2Name = dtTerm.values[grp2Class].label
			grp2Value = { key: grp2Class, label: grp2Name, value: grp2Class }
			grp2Tvs = { type: 'tvs', tvs: { term: dtTerm, values: [grp2Value] } }
			if (dtTerm.origin) grp2Name += ` (${dtTerm.origin})`
		} else {
			grp2Tvs = { type: 'tvs', tvs: { term: dtTerm, values: [grp1Value], isnot: true } }
			grp2Name = classes.includes('WT') ? dtTerm.name : `Other ${dtTerm.name}`
		}
		grp2Filter = getWrappedTvslst([grp2Tvs])
		addNewGroup(grp2Filter, tw.q.customset.groups, grp2Name)
		break
	}
}

function getMassFilter(filter) {
	if (!filter || !filter.lst.length) {
		return { type: 'tvslst', in: true, join: '', lst: [] }
	}
	const f = getNormalRoot(structuredClone(filter)) // strip tag
	return f
}

function clearGroupset(self) {
	self.q.type = 'values'
	delete self.q.predefined_groupset_idx
	delete self.q.customset
	delete self.groupSettingInstance
}

// function to get child dt terms
// will use these terms to generate a frontend vocab
export async function getChildTerms(term: RawGvTerm, vocabApi: VocabApi, body: any = {}) {
	if (!vocabApi.termdbConfig?.queries) throw 'termdbConfig.queries is missing'
	const termdbmclass = vocabApi.termdbConfig.mclass // custom mclass labels from dataset
	const dtTermsInDs: DtTerm[] = [] // dt terms in dataset
	const filter = vocabApi.state?.termfilter?.filter
	const filter0 = vocabApi.state?.termfilter?.filter0
	if (filter0) {
		// TODO: currently adding filter0 to body{}, but should
		// refactor the input of getCategories() to be a single opts{}
		// object, which can include .term, .filter, .filter0, and
		// any other properties
		body.filter0 = filter0
	}
	const categories = await vocabApi.getCategories(term, filter, body)
	for (const _t of dtTerms) {
		const t: any = structuredClone(_t)
		if (!Object.keys(vocabApi.termdbConfig.queries).includes(t.query)) continue // dt is not in dataset
		const data = categories.lst.find(x => x.dt == t.dt)
		if (!data) continue // gene does not have this dt
		const byOrigin = vocabApi.termdbConfig.assayAvailability?.byDt[t.dt]?.byOrigin
		let classes
		if (byOrigin) {
			// dt has origins in dataset
			if (!t.origin) continue // dt term does not have origin, so skip
			if (!Object.keys(byOrigin).includes(t.origin)) throw 'unexpected origin of dt term'
			classes = data.classes.byOrigin[t.origin]
		} else {
			// dt does not have origins in dataset
			if (t.origin) continue // dt term has origin, so skip
			classes = data.classes
		}
		// filter for only those mutation classes that are in the dataset
		const values = Object.fromEntries(Object.entries(t.values).filter(([k, _v]) => Object.keys(classes).includes(k)))
		// add custom mclass labels from dataset
		for (const k of Object.keys(values)) {
			const v: any = values[k]
			if (termdbmclass && Object.keys(termdbmclass).includes(k)) v.label = termdbmclass[k].label
		}
		t.values = values
		t.parentTerm = structuredClone(term)
		delete t.parentTerm.childTerms // remove any nested child terms
		dtTermsInDs.push(t)
	}
	term.childTerms = dtTermsInDs
}
