import { getPillNameDefault } from '../termsetting'
import type { GeneVariantTermSettingInstance, RawGvTerm, RawGvPredefinedGsTW, VocabApi, DtTerm } from '#types'
import type { PillData } from '../types'
import { make_radios, renderTable } from '#dom'
import { dtTerms, getColors, cnvGainClasses, cnvLossClasses, mclass, dtcnv } from '#shared/common.js'
import { filterInit, filterPromptInit, getNormalRoot } from '#filter/filter'
import { rgb } from 'd3-color'
import { getWrappedTvslst } from '#filter/filter'

let colorScale = getColors(3)

// self is the termsetting instance
export function getHandler(self: GeneVariantTermSettingInstance) {
	return {
		getPillName(d: PillData) {
			return getPillNameDefault(self, d)
		},

		getPillStatus() {
			let text
			if (self.q.type == 'predefined-groupset') {
				const groupsetting = self.term.groupsetting
				if (!groupsetting.lst?.length) throw 'no predefined groupsets found'
				const groupset = groupsetting.lst[self.q.predefined_groupset_idx]
				text = groupset.name
			} else if (self.q.type == 'custom-groupset') {
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
	const handler = self.handlerByType.geneVariant */
	const div = _div.append('div').style('margin', '10px')
	div.append('div').style('font-size', '1.2rem').text(self.term.name)
	const optsDiv = div.append('div').style('margin-top', '10px').style('margin-bottom', '1px')
	const groupsDiv = div.append('div').style('display', 'none').style('margin', '10px').style('vertical-align', 'top')
	// radio buttons for whether or not to group samples
	optsDiv.append('div').style('font-weight', 'bold').text('Group samples')
	const isGroupset = self.q.type == 'predefined-groupset' || self.q.type == 'custom-groupset'
	make_radios({
		holder: optsDiv,
		options: [
			{ label: 'No sample grouping', value: 'noGroup', checked: !isGroupset },
			{ label: 'Assign samples to groups', value: 'group', checked: isGroupset }
		],
		callback: async v => {
			if (v == 'group') {
				if (self.q.type == 'values') Object.assign(self.q, { type: 'custom-groupset', customset: { groups: [] } })
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
			if (self.q.type == 'predefined-groupset' || self.q.type == 'custom-groupset') {
				// groupsetting
				if (!self.groups?.length) {
					// no groups created
					window.alert('Samples must be assigned to at least one group.')
					return
				} else {
					// groups created, assign to custom groupset
					Object.assign(self.q, { type: 'custom-groupset', customset: { groups: self.groups } })
				}
			} else {
				// no groupsetting
				if (self.q.type != 'values') throw `q.type must be 'values'`
			}
			self.runCallback()
		})
}

// make UI for grouping variants
async function makeGroupUI(self: GeneVariantTermSettingInstance, div) {
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

	// get groups
	if (self.q.type != 'predefined-groupset' && self.q.type != 'custom-groupset') throw 'unexpected q.type'
	if (!self.groups) {
		let groupset
		if (self.q.type == 'predefined-groupset') {
			const groupsetting = self.term.groupsetting
			if (!groupsetting.lst?.length) throw 'no predefined groupsets found'
			groupset = groupsetting.lst[self.q.predefined_groupset_idx]
		} else {
			groupset = self.q.customset
		}
		if (!groupset) throw 'groupset is missing'
		if (!Array.isArray(groupset.groups)) throw 'groupset.groups is not array'
		self.groups = structuredClone(groupset.groups)
	}

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
			addNewGroup(filter, self.groups)
			makeGroupUI(self, div)
		},
		debug: self.opts.debug
	})

	// filterPrompt.main() always empties the filterUiRoot data
	filterPrompt.main(getMassFilter(self.filter)) // provide mass filter to limit the term tree

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

		// create fitlter ui in its cell
		const group = self.groups[i]
		filterInit({
			holder: row[3].__td,
			vocab: {
				terms: self.term.childTerms,
				parent_termdbConfig: self.vocabApi.termdbConfig
			},
			//termdbConfig: self.vocabApi.termdbConfig,
			callback: f => {
				if (!f || f.lst.length == 0) {
					// blank filter (user removed last tvs from this filter), delete this element from groups[]
					const i = self.groups.findIndex(g => g.name == group.name)
					self.groups.splice(i, 1)
				} else {
					// update filter
					f.lst.forEach(item => (item.tvs.excludeGeneName = true)) // no need to show gene name in filter pill
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
	filter.lst.forEach(item => (item.tvs.excludeGeneName = true)) // no need to show gene name in filter pill
	const newGroup = {
		name,
		type: 'filter',
		filter,
		color: '#000000'
	}
	groups.push(newGroup)
}

export async function getPredefinedGroupsets(tw: RawGvPredefinedGsTW, vocabApi: VocabApi) {
	if (tw.q.type != 'predefined-groupset') throw 'unexpected tw.q.type'
	// get child dt terms of geneVariant term
	await getChildTerms(tw.term, vocabApi)
	if (!tw.term.childTerms?.length) throw 'tw.term.childTerms[] is missing'
	const termdbmclass = vocabApi.termdbConfig.mclass // custom mclass labels from dataset
	// build predefined groupsets based on child dt terms
	tw.term.groupsetting = {
		disabled: false,
		lst: tw.term.childTerms.map(dtTerm => {
			const groupset = dtTerm.dt == dtcnv ? getCnvGroupset(dtTerm) : getNonCnvGroupset(dtTerm)
			return groupset
		})
	}

	// function to get cnv groupset
	// will compare gain vs. loss vs. wildtype groups
	// only groups present in the data will be included
	// e.g. if samples are only cnv loss and wildtype for the gene
	// then only cnv loss and wildtype groups will be included in the groupset
	function getCnvGroupset(dtTerm) {
		const groupset: any = {
			name: `${dtTerm.name_noOrigin}:`,
			groups: [],
			dt: dtTerm.dt
		}
		// cnv gain group
		const gainValues = getValues(cnvGainClasses, dtTerm)
		if (gainValues.length) {
			// cnv gain is present in data
			// add cnv gain group to groupset
			const gainFilter = getWrappedTvslst([
				{
					type: 'tvs',
					tvs: {
						term: dtTerm,
						values: gainValues,
						excludeGeneName: true
					}
				}
			])
			const gainName = `${dtTerm.name_noOrigin} ${dtTerm.origin ? `Gain (${dtTerm.origin})` : 'Gain'}`
			groupset.groups.push({
				name: gainName,
				type: 'filter',
				filter: gainFilter
			})
			groupset.name += ' Gain vs.'
		}
		// cnv loss group
		const lossValues = getValues(cnvLossClasses, dtTerm)
		if (lossValues.length) {
			// cnv loss is present in data
			// add cnv loss group to groupset
			const lossFilter = getWrappedTvslst([
				{
					type: 'tvs',
					tvs: {
						term: dtTerm,
						values: lossValues,
						excludeGeneName: true
					}
				}
			])
			const lossName = `${dtTerm.name_noOrigin} ${dtTerm.origin ? `Loss (${dtTerm.origin})` : 'Loss'}`
			groupset.groups.push({
				name: lossName,
				type: 'filter',
				filter: lossFilter
			})
			groupset.name += ' Loss vs.'
		}
		// cnv wildtype group
		const wtValues = getValues(['WT'], dtTerm)
		if (wtValues.length) {
			// wildtype is present in data
			// add wildtype group to groupset
			const wtFilter = getWrappedTvslst([
				{
					type: 'tvs',
					tvs: {
						term: dtTerm,
						values: wtValues,
						excludeGeneName: true
					}
				}
			])
			const wtName = `${dtTerm.name_noOrigin} ${dtTerm.origin ? `Wildtype (${dtTerm.origin})` : 'Wildtype'}`
			groupset.groups.push({
				name: wtName,
				type: 'filter',
				filter: wtFilter
			})
			groupset.name += ' Wildtype'
		}
		if (dtTerm.origin) groupset.name += ` (${dtTerm.origin})`
		// set color scale based on number of groups
		colorScale = getColors(groupset.groups.length)
		// assign colors to each group
		for (const group of groupset.groups) {
			group.color = rgb(colorScale(group.name)).formatHex()
		}
		return groupset
	}

	// function to get non-cnv (e.g. snv/indel, fusion, etc.) groupset
	// will compare mutant vs. wildtype
	function getNonCnvGroupset(dtTerm) {
		colorScale = getColors(2)
		const groupset: any = {
			name: `${dtTerm.name_noOrigin}: Mutated vs. Wildtype${dtTerm.origin ? ` (${dtTerm.origin})` : ''}`,
			groups: [],
			dt: dtTerm.dt
		}
		// group 1: mutant
		const grp1Name = `${dtTerm.name_noOrigin} ${dtTerm.origin ? `Mutated (${dtTerm.origin})` : 'Mutated'}`
		const grp1Filter = getWrappedTvslst([
			{
				type: 'tvs',
				tvs: {
					term: dtTerm,
					values: [{ key: 'WT', label: 'Wildtype', value: 'WT' }],
					isnot: true,
					excludeGeneName: true
				}
			}
		])
		groupset.groups.push({
			name: grp1Name,
			type: 'filter',
			filter: grp1Filter,
			color: rgb(colorScale(grp1Name)).formatHex()
		})
		// group 2: wildtype
		const grp2Name = `${dtTerm.name_noOrigin} ${dtTerm.origin ? `Wildtype (${dtTerm.origin})` : 'Wildtype'}`
		const grp2Filter = getWrappedTvslst([
			{
				type: 'tvs',
				tvs: { term: dtTerm, values: [{ key: 'WT', label: 'Wildtype', value: 'WT' }], excludeGeneName: true }
			}
		])
		groupset.groups.push({
			name: grp2Name,
			type: 'filter',
			filter: grp2Filter,
			color: rgb(colorScale(grp2Name)).formatHex()
		})
		return groupset
	}

	// get values for tvs from mutation classes
	function getValues(classes, dtTerm) {
		const values = classes
			.filter(key => Object.keys(dtTerm.values).includes(key))
			.map(key => {
				const label =
					termdbmclass && Object.keys(termdbmclass).includes(key) ? termdbmclass[key].label : mclass[key].label
				return { key, label, value: key }
			})
		return values
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
	// get union of dt terms in data for all genes of term
	// TODO: need to also get union of values within each dt term
	for (const gene of term.genes) {
		const categories = await vocabApi.getCategories(gene, filter, body)
		for (const _t of dtTerms) {
			if (dtTermsInDs.find(t => t.id == _t.id)) continue // dt term already found for another gene
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
			delete t.parentTerm.groupsetting // remove nested term groupsetting
			dtTermsInDs.push(t)
		}
	}
	term.childTerms = dtTermsInDs
}
