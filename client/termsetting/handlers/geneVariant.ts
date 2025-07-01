import { getPillNameDefault } from '../termsetting'
import type { GeneVariantTermSettingInstance, RawGvTerm, VocabApi, DtTerm } from '#types'
import type { PillData } from '../types'
import { make_radios } from '#dom'
import { GroupSettingMethods } from './groupsetting.ts'
import { dtTerms } from '#shared/common.js'

// self is the termsetting instance
export function getHandler(self: GeneVariantTermSettingInstance) {
	return {
		getPillName(d: PillData) {
			return getPillNameDefault(self, d)
		},

		getPillStatus() {
			let text
			if (self.q.type == 'custom-groupset') {
				const n = self.q.customset.groups.filter(group => !group.uncomputable).length
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
			await getChildTerms(self.term, self.vocabApi)
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
	const draggablesDiv = div.append('div').style('display', 'none').style('margin-left', '15px')
	// apply button
	// must create it at beginning to allow toggling applySpan message
	const applyRow = div.append('div').style('margin-top', '15px')
	applyRow
		.append('button')
		.style('display', 'inline-block')
		.text('Apply')
		.on('click', () => {
			if (self.groupSettingInstance) self.groupSettingInstance.processDraggables()
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
				await makeGroupUI()
			} else {
				clearGroupset(self)
				groupsDiv.style('display', 'none')
				draggablesDiv.style('display', 'none')
				applyRow.select('#applySpan').style('display', 'none')
			}
		}
	})

	if (self.usecase?.detail == 'term0' || self.usecase?.detail == 'term2' || self.opts.geneVariantEditMenuOnlyGrp) {
		// hide option for turning off groupsetting
		optsDiv.style('display', 'none')
		groupsDiv.style('margin-top', '10px')
	}

	const selected = radios.inputs.filter(d => d.checked)
	if (selected.property('value') == 'group') await makeGroupUI()

	// make radio buttons for grouping variants
	async function makeGroupUI() {
		self.q.type = 'custom-groupset'
		await makeGroupsetDraggables()
		applyRow.select('#applySpan').style('display', 'inline')
	}

	// function for making groupset draggables
	async function makeGroupsetDraggables() {
		draggablesDiv.style('display', 'inline-block')
		draggablesDiv.selectAll('*').remove()
		self.groupSettingInstance = new GroupSettingMethods(self, {
			type: 'filter',
			holder: draggablesDiv,
			hideApply: true
		})
		await self.groupSettingInstance.main()
	}
}

function clearGroupset(self) {
	self.q.type = 'values'
	delete self.q.predefined_groupset_idx
	delete self.q.customset
	delete self.groupSettingInstance
}

// function to get child dt terms
// will use these terms to generate a frontend vocab
export async function getChildTerms(term: RawGvTerm, vocabApi: VocabApi) {
	if (!vocabApi.termdbConfig?.queries) throw 'termdbConfig.queries is missing'
	const termdbmclass = vocabApi.termdbConfig.mclass // custom mclass labels from dataset
	const dtTermsInDs: DtTerm[] = [] // dt terms in dataset
	const body: any = {}
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
		const t = structuredClone(_t)
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
		dtTermsInDs.push(t)
	}
	term.childTerms = dtTermsInDs
}
