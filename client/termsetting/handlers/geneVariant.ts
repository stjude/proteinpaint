import { dtTerms } from '#shared/common.js'
import { getPillNameDefault, set_hiddenvalues } from '../termsetting'
import type { GvQ, GvTW, GeneVariantTermSettingInstance, VocabApi, DtTerm } from '#types'
import type { PillData } from '../types'
import { make_radios } from '#dom'
import { copyMerge } from '#rx'
import { GroupSettingMethods } from './groupsetting.ts'
import { getWrappedTvslst } from '#filter/filter'

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
			// for rendering groupsetting menu
			const body = self.opts.getBodyParams?.() || {}
			const data = await self.vocabApi.getCategories(self.term, self.filter!, body)
			self.category2samplecount = data.lst
		}
	}
}

// TODO: can eventually retire fillTW() as it has been replaced with
// fill() functions in client/tw/geneVariant.ts
export async function fillTW(tw: GvTW, vocabApi: VocabApi, defaultQ: GvQ | null = null) {
	if (!tw.term.kind) {
		// support saved states that don't have term.kind, applied when rehydrating at runtime
		const term: any = tw.term
		if (term.gene || (term.name && !term.chr)) term.kind = 'gene'
		else if (term.chr) term.kind = 'coord'
		else throw 'unable to assign geneVariant term.kind'
	}

	if (tw.term.kind == 'gene') {
		if (!tw.term.gene) tw.term.gene = tw.term.name
		if (!tw.term.name) tw.term.name = tw.term.gene
		if (!tw.term.gene || !tw.term.name) throw 'missing gene/name'
	} else if (tw.term.kind == 'coord') {
		if (!tw.term.chr || !Number.isInteger(tw.term.start) || !Number.isInteger(tw.term.stop))
			throw 'no position specified'
		if (!tw.term.name) {
			tw.term.name = `${tw.term.chr}:${tw.term.start + 1}-${tw.term.stop}`
		}
	} else {
		throw 'cannot recognize tw.term.kind'
	}

	if (!tw.term.id) tw.term.id = tw.term.name

	if (!Object.keys(tw.q).includes('type')) tw.q.type = 'values'

	// merge defaultQ into tw.q
	if (defaultQ) {
		defaultQ.isAtomic = true
		copyMerge(tw.q, defaultQ)
	}

	// fill term.groupsetting
	if (!tw.term.groupsetting) tw.term.groupsetting = { disabled: false }

	// may fill variant filter
	await mayMakeVariantFilter(tw, vocabApi)

	// may fill groups
	mayMakeGroups(tw)

	{
		// apply optional ds-level configs for this specific term
		const c = vocabApi.termdbConfig.queries?.cnv
		if (c && tw.term.name) {
			//if (c) valid js code but `&& tw.term.name` required to avoid type error
			// order of overide: 1) do not override existing settings in tw.q{} 2) c.cnvCutoffsByGene[thisGene] 3) default cutoffs in c
			const { cnvMaxLength, cnvGainCutoff, cnvLossCutoff } = c
			const defaultCnvCutoff =
				cnvMaxLength || cnvGainCutoff || cnvLossCutoff ? { cnvMaxLength, cnvGainCutoff, cnvLossCutoff } : {}
			Object.assign(tw.q, defaultCnvCutoff, c.cnvCutoffsByGene?.[tw.term.name] || {}, tw.q)
		}
	}

	set_hiddenvalues(tw.q, tw.term)
}

// TODO: can remove mayMakeVariantFilter() as it is already in use
// in client/tw/geneVariant.ts
// function to make a variant filter based on dts specified in dataset
export async function mayMakeVariantFilter(tw: GvTW, vocabApi: VocabApi) {
	if (tw.term.filter) return
	const dtTermsInDs: DtTerm[] = [] // dt terms in dataset
	const categories = await vocabApi.getCategories(tw.term)
	for (const _t of dtTerms) {
		const t = structuredClone(_t)
		if (!Object.keys(vocabApi.termdbConfig.queries).includes(t.query)) continue // dt is not in dataset
		const data = categories.lst.find(x => x.dt == t.dt)
		if (!data) continue
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
		t.values = values
		dtTermsInDs.push(t)
	}
	tw.term.filter = {
		opts: { joinWith: ['and', 'or'] },
		terms: dtTermsInDs // will load dt terms as custom terms in frontend vocab
	}
}

// TODO: can remove mayMakeGroups() as it is already in use
// in client/tw/geneVariant.ts
function mayMakeGroups(tw) {
	if (tw.q.type != 'custom-groupset' || tw.q.customset?.groups.length) return
	// custom groupset, but customset.groups[] is empty
	// fill with mutated group vs. wildtype group
	// for the first applicable dt in dataset
	const dtFilter = tw.term.filter
	let WTfilter, WTname, MUTfilter, MUTtvs, MUTname
	for (const dtTerm of dtFilter.terms) {
		// wildtype filter
		WTfilter = structuredClone(dtFilter)
		WTfilter.group = 2
		const WT = 'WT'
		const WTvalue = { key: WT, label: dtTerm.values[WT].label, value: WT }
		const WTtvs = { type: 'tvs', tvs: { term: dtTerm, values: [WTvalue] } }
		WTfilter.active = getWrappedTvslst([WTtvs])
		WTname = 'Wildtype'
		if (dtTerm.origin) WTname += ` (${dtTerm.origin})`
		// mutated filter
		MUTfilter = structuredClone(dtFilter)
		MUTfilter.group = 1
		const classes = Object.keys(dtTerm.values)
		if (classes.length < 2) {
			// fewer than 2 classes, try next dt term
			continue
		}
		if (classes.length == 2) {
			// only 2 classes
			// mutant filter will filter for the mutant class
			const MUT = classes.find(c => c != WT)
			if (!MUT) throw 'mutant class cannot be found'
			const MUTvalue = { key: MUT, label: dtTerm.values[MUT].label, value: MUT }
			MUTtvs = { type: 'tvs', tvs: { term: dtTerm, values: [MUTvalue] } }
			MUTname = dtTerm.values[MUT].label
			if (dtTerm.origin) MUTname += ` (${dtTerm.origin})`
		} else {
			// more than 2 classes
			// mutant filter will filter for all non-wildtype classes
			MUTtvs = { type: 'tvs', tvs: { term: dtTerm, values: [WTvalue], isnot: true } }
			MUTname = dtTerm.name
		}
		MUTfilter.active = getWrappedTvslst([MUTtvs])
		break
	}
	// excluded filter
	const EXCLUDEfilter = structuredClone(dtFilter)
	EXCLUDEfilter.group = 0
	EXCLUDEfilter.active = getWrappedTvslst()
	// assign filters to groups
	const WTgroup = {
		name: WTname,
		type: 'filter',
		uncomputable: false,
		filter: WTfilter
	}
	const MUTgroup = {
		name: MUTname,
		type: 'filter',
		uncomputable: false,
		filter: MUTfilter
	}
	const EXCLUDEgroup = {
		name: 'Excluded categories',
		type: 'filter',
		uncomputable: true,
		filter: EXCLUDEfilter
	}
	// assign groups to custom groupset
	tw.q.customset = { groups: [EXCLUDEgroup, MUTgroup, WTgroup] }
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
				if (self.q.customset?.groups.map((group: any) => group.filter?.active.lst).some(lst => lst.length)) {
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
