import { dtTerms } from '#shared/common.js'
import { getPillNameDefault, set_hiddenvalues } from '../termsetting'
import type { GeneVariantQ, GeneVariantTW, GeneVariantTermSettingInstance, VocabApi, DtTerm } from '#types'
import type { PillData } from '../types'
import { make_radios } from '#dom'
import { copyMerge } from '#rx'
import { GroupSettingMethods } from './groupsetting.ts'
import { getWrappedTvslst } from '#filter/filter'

/* 
instance attributes

self.term{}
	.name: str, not really used
	.type: "geneVariant"
*/

//TODO move to common.ts??? Corresponds to client/shared/common.js
// type MClassEntry = { label: string; color: string; dt: number; desc: string; key: string }
// type GroupsEntry = { name: string; items: MClassEntry[] }

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
				text = self.q.exclude?.length ? 'matching variants' : 'any variant class'
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

export async function fillTW(tw: GeneVariantTW, vocabApi: VocabApi, defaultQ: GeneVariantQ | null = null) {
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
		const c = vocabApi.termdbConfig.customTwQByType?.geneVariant
		if (c && tw.term.name) {
			//if (c) valid js code but `&& tw.term.name` required to avoid type error
			// order of overide: 1) do not override existing settings in tw.q{} 2) c.byGene[thisGene] 3) c.default{}
			Object.assign(tw.q, c.default || {}, c.byGene?.[tw.term.name] || {}, tw.q)
		}
	}

	// do not fill default cnv cutoffs here
	// will set custom cnv cutoffs when creating
	// variant filters in groupsetting UI
	/*if ('cnvMaxLength' in tw.q) {
		// has cutoff
		if (!Number.isInteger(tw.q.cnvMaxLength)) throw 'cnvMaxLength is not integer'
		// cnvMaxLength value<=0 will not filter by length
	} else {
		tw.q.cnvMaxLength = 2000000
	}
	// cutoffs on cnv quantifications, subject to change!
	if ('cnvGainCutoff' in tw.q) {
		if (!Number.isFinite(tw.q.cnvGainCutoff)) throw 'cnvGainCutoff is not finite'
		if (tw.q.cnvGainCutoff && tw.q.cnvGainCutoff < 0) throw 'cnvGainCutoff is not positive'
		// =0 for no filtering gains
	} else {
		tw.q.cnvGainCutoff = 0.2
	}
	if ('cnvLossCutoff' in tw.q) {
		if (!Number.isFinite(tw.q.cnvLossCutoff)) throw 'cnvLossCutoff is not finite'
		if (tw.q.cnvLossCutoff && tw.q.cnvLossCutoff > 0) throw 'cnvLossCutoff is not negative'
		// =0 for not filtering losses
	} else {
		tw.q.cnvLossCutoff = -0.2
	}*/

	set_hiddenvalues(tw.q, tw.term)
}

// function to make a variant filter based on dts specified in dataset
async function mayMakeVariantFilter(tw: GeneVariantTW, vocabApi: VocabApi) {
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

function mayMakeGroups(tw) {
	if (tw.q.type != 'custom-groupset' || tw.q.customset?.groups.length) return
	// custom groupset, but customset.groups[] is empty
	// fill with mutated group vs. wildtype group
	// for the first dt specified in dataset
	const dtFilter = tw.term.filter
	const dtTerm = dtFilter.terms[0]
	// wildtype filter
	const WTfilter = structuredClone(dtFilter)
	WTfilter.group = 2
	const WT = 'WT'
	const WTvalue = { key: WT, label: dtTerm.values[WT].label, value: WT }
	const WTtvs = { type: 'tvs', tvs: { term: dtTerm, values: [WTvalue] } }
	WTfilter.active = getWrappedTvslst([WTtvs])
	let WTname = 'Wildtype'
	if (dtTerm.origin) WTname += ` (${dtTerm.origin})`
	// mutated filter
	const MUTfilter = structuredClone(dtFilter)
	MUTfilter.group = 1
	const classes = Object.keys(dtTerm.values)
	if (classes.length < 2) throw 'should have at least 2 classes'
	let MUTtvs, MUTname
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
	const optsDiv = div.append('div').style('margin-top', '10px')
	const groupsDiv = div
		.append('div')
		.style('display', 'none')
		.style('margin', '5px 0px 0px 30px')
		.style('vertical-align', 'top')
	/*const dtDiv = groupsDiv.append('div')
	const originDiv = groupsDiv.append('div').style('margin-top', '15px')
	const groupsetDiv = groupsDiv.append('div').style('margin-top', '15px')*/
	const draggablesDiv = div.append('div').style('display', 'none').style('margin-left', '15px')

	// radio buttons for whether or not to group variants
	optsDiv.append('div').style('font-weight', 'bold').text('Group variants')
	const isGroupset = self.q.type == 'predefined-groupset' || self.q.type == 'custom-groupset'
	const radios = make_radios({
		holder: optsDiv,
		options: [
			{ label: 'No variant grouping', value: 'noGroup', checked: !isGroupset },
			{ label: 'Assign variants to groups', value: 'group', checked: isGroupset }
		],
		callback: async v => {
			const applySpan = div.select('#applySpan')
			if (v == 'group') {
				await makeGroupUI()
				applySpan.style('display', 'inline')
			} else {
				clearGroupset(self)
				groupsDiv.style('display', 'none')
				draggablesDiv.style('display', 'none')
				applySpan.style('display', 'none')
			}
		}
	})

	if (self.usecase?.detail == 'term0' || self.usecase?.detail == 'term2') {
		// hide option for turning off groupsetting for term0/term2
		optsDiv.style('display', 'none')
		groupsDiv.style('margin', '10px 0px 0px 00px')
	}

	const selected = radios.inputs.filter(d => d.checked)
	if (selected.property('value') == 'group') await makeGroupUI()

	// make radio buttons for grouping variants
	async function makeGroupUI() {
		if (self.q.type != 'predefined-groupset' && self.q.type != 'custom-groupset') self.q.type = 'filter'
		await makeGroupsetDraggables()
		/*groupsDiv.style('display', 'inline-block')
		makeDtRadios()
		makeOriginRadios()
		const groupset_idxs = getGroupsetIdxs(self.q.dt)
		if (self.q.dt == dtsnvindel) {
			// dt is SNV/indel
			// groupsetting is customizable
			// display as radio buttons and draggables
			makeGroupsetRadios(groupset_idxs)
			await makeGroupsetDraggables()
		} else {
			// dt is either CNV or SV Fusion
			// groupsetting is fixed
			// display as text
			makeGroupsetText(groupset_idxs)
		}*/
	}

	/*// radio buttons for data type
	function makeDtRadios() {
		dtDiv.selectAll('*').remove()
		dtDiv.append('div').style('font-weight', 'bold').text('Variant type')
		const ds_dts = getDsDts(self.vocabApi.termdbConfig.queries)
		if (!self.q.dt) self.q.dt = ds_dts[0]
		make_radios({
			holder: dtDiv,
			options: ds_dts.map(dt => ({ label: dt2label[dt], value: dt, checked: dt == self.q.dt })),
			callback: async v => {
				self.q.dt = v
				clearGroupset(self)
				await makeGroupUI()
			}
		})
	}

	// radio buttons for variant origin
	function makeOriginRadios() {
		const byOrigin = self.vocabApi.termdbConfig.assayAvailability?.byDt[self.q.dt!]?.byOrigin
		if (!byOrigin) {
			delete self.q.origin
			originDiv.style('display', 'none')
			return
		}
		if (!self.q.origin) self.q.origin = 'somatic'
		originDiv.style('display', 'block')
		originDiv.selectAll('*').remove()
		originDiv.append('div').style('font-weight', 'bold').text('Variant origin')
		make_radios({
			holder: originDiv,
			options: ['somatic', 'germline'].map(origin => ({
				label: byOrigin[origin].label,
				value: origin,
				checked: origin == self.q.origin
			})),
			callback: async v => {
				self.q.origin = v
				clearGroupset(self)
				await makeGroupUI()
			}
		})
	}

	// radio buttons for variant groupset
	function makeGroupsetRadios(groupset_idxs) {
		groupsetDiv.selectAll('*').remove()
		groupsetDiv.append('div').style('font-weight', 'bold').text('Variant grouping')
		if (self.q.type != 'predefined-groupset' && self.q.type != 'custom-groupset') {
			self.q = { ...getBaseQ(self.q), type: 'predefined-groupset', predefined_groupset_idx: groupset_idxs[0] }
		}
		// radios for whether to use predefined groups or custom groups
		const radios = make_radios({
			holder: groupsetDiv,
			options: [
				{ label: 'Predefined groups', value: 'predefined', checked: self.q.type == 'predefined-groupset' },
				{ label: 'Custom groups', value: 'custom', checked: self.q.type == 'custom-groupset' }
			],
			callback: async v => {
				if (v == 'predefined') {
					self.q = { ...getBaseQ(self.q), type: 'predefined-groupset', predefined_groupset_idx: groupset_idxs[0] }
				} else {
					predefinedGroupsetDiv.style('display', 'none')
					getDefaultCustomGroups()
				}
				await makeGroupUI()
			}
		})
		// radios for predefined groupsetting options
		// display the radios under the predefined radio button
		const predefinedGroupsetDiv = radios.divs
			.filter(d => d.value == 'predefined')
			.append('div')
			.style('margin', '5px 0px 0px 30px')
		const selected = radios.inputs.filter(d => d.checked)
		if (selected.property('value') == 'predefined') {
			// predefined groupset option is selected
			const q = self.q as PredefinedGroupSettingQ
			make_radios({
				holder: predefinedGroupsetDiv,
				options: groupset_idxs.map(i => {
					const groupset = self.term.groupsetting.lst[i]
					return { label: groupset.name, value: i, checked: i == q.predefined_groupset_idx }
				}),
				callback: async v => {
					q.predefined_groupset_idx = v
					await makeGroupUI()
				}
			})
		} else {
			// custom groupsetting option is selected
			predefinedGroupsetDiv.style('display', 'none')
		}
	}

	function makeGroupsetText(groupset_idxs) {
		// dt is either CNV or SV Fusion
		// will use the predefined groupset of the dt
		// will display the name of the groupset on the UI
		draggablesDiv.style('display', 'none')
		delete self.groupSettingInstance
		groupsetDiv.selectAll('*').remove()
		groupsetDiv.append('div').style('font-weight', 'bold').text('Variant grouping')
		self.q = { ...getBaseQ(self.q), type: 'predefined-groupset', predefined_groupset_idx: groupset_idxs[0] }
		const groupset = self.term.groupsetting.lst[self.q.predefined_groupset_idx]
		groupsetDiv.append('div').style('margin', '5px 0px 0px 10px').text(groupset.name)
	}

	function getBaseQ(q: GeneVariantQ): GeneVariantBaseQ {
		if (q.type == 'values' || q.type == 'filter') {
			const { type, ...baseQ } = q
			return baseQ
		} else if (q.type == 'predefined-groupset') {
			const { type, predefined_groupset_idx, ...baseQ } = q
			return baseQ
		} else {
			const { type, customset, ...baseQ } = q
			return baseQ
		}
	}

	function getDefaultCustomGroups() {
		const dt = self.category2samplecount.find(i => i.dt == self.q.dt)
		const classes = dt.classes.byOrigin ? dt.classes.byOrigin[self.q.origin!] : dt.classes
		const groups = [
			{
				name: 'Group 1',
				type: 'values',
				values: Object.keys(classes).map(k => {
					return { key: k, label: mclass[k].label }
				})
			},
			{
				name: 'Group 2',
				type: 'values',
				values: []
			}
		]
		self.q = { ...getBaseQ(self.q), type: 'custom-groupset', customset: { groups } }
	}*/

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

	// Apply button
	const applyRow = div.append('div').style('margin-top', '15px')
	applyRow
		.append('button')
		.style('display', 'inline-block')
		.text('Apply')
		.on('click', () => {
			if (self.groupSettingInstance) self.groupSettingInstance.processDraggables()
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

	/*
	const applyBtn = div
		.append('button')
		.property('disabled', true)
		.style('margin-top', '3px')
		.text('Apply')
		.on('click', () => {
			self.runCallback({
				term: JSON.parse(JSON.stringify(self.term)),
				q: { exclude }
			})
		})

	const exclude = self.q?.exclude?.slice().sort() || []
	const origExclude = JSON.stringify(exclude)
	const mclasses = Object.values(mclass)

	const dtNums = [...new Set(mclasses.map((c: any) => c.dt))].sort() as number[] // must add type "any" to avoid tsc err

	const groups: GroupsEntry[] = []
	for (const dt of dtNums) {
		const items = mclasses.filter((c: any) => c.dt === dt) as MClassEntry[] // must add type "any" to avoid tsc err

		if (items.length) {
			groups.push({
				name: dt2label[dt],
				items
			})
		}
	}

	div
		.append('div')
		.selectAll(':scope>div')
		.data(groups, (d: GroupsEntry) => d.name)
		.enter()
		.append('div')
		.style('max-width', '500px')
		.style('margin', '5px')
		.style('padding-left', '5px')
		.style('text-align', 'left')
		.each(function (this: any, grp: GroupsEntry) {
			const div = select(this)
			div.append('div').style('font-weight', 600).html(grp.name)
			//.on('click', )

			div
				.selectAll(':scope>div')
				.data(grp.items, (d: any) => d.label)
				.enter()
				.append('div')
				.style('margin', '5px')
				.style('display', 'inline-block')
				.on('click', function (this: any, event: Event, d: MClassEntry) {
					const i = exclude.indexOf(d.key)
					if (i == -1) exclude.push(d.key)
					else exclude.splice(i, 1)
					select(this.lastChild).style('text-decoration', i == -1 ? 'line-through' : '')
					applyBtn.property('disabled', JSON.stringify(exclude) === origExclude)
				})
				.each(function (this: any, d: MClassEntry) {
					const itemDiv = select(this)
					itemDiv
						.append('div')
						.style('display', 'inline-block')
						.style('width', '1rem')
						.style('height', '1rem')
						.style('border', '1px solid #ccc')
						.style('background-color', d.color)
						.html('&nbsp;')

					itemDiv
						.append('div')
						.style('display', 'inline-block')
						.style('margin-left', '3px')
						.style('text-decoration', exclude.includes(d.key) ? 'line-through' : '')
						.style('cursor', 'pointer')
						.text(d.label)
				})
		})*/
}

/*// get dts specified in dataset
function getDsDts(ds_queries) {
	const ds_dts: number[] = []
	for (const query of Object.keys(ds_queries)) {
		if (query == 'snvindel') ds_dts.push(dtsnvindel)
		else if (query == 'cnv') ds_dts.push(dtcnv)
		else if (query == 'svfusion') ds_dts.push(dtfusionrna)
		else continue
	}
	return ds_dts
}

// get indices of predefined groupsets that are
// relevant to given dt
function getGroupsetIdxs(dt) {
	const groupset_idxs = dt == dtsnvindel ? [0, 1, 2] : dt == dtcnv ? [3] : dt == dtfusionrna ? [4] : []
	if (!groupset_idxs.length) throw 'groupset_idxs is empty'
	return groupset_idxs
}*/

function clearGroupset(self) {
	self.q.type = 'values'
	delete self.q.predefined_groupset_idx
	delete self.q.customset
	delete self.groupSettingInstance
}
