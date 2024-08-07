import { mclass, dt2label, dtsnvindel, dtcnv, dtfusionrna, geneVariantTermGroupsetting } from '../../shared/common'
import { VocabApi } from '../../shared/types/vocab.ts'
import {
	GeneVariantBaseQ,
	GeneVariantQ,
	GeneVariantTW,
	GeneVariantTermSettingInstance
} from '../../shared/types/terms/geneVariant'
import { PredefinedGroupSettingQ, TermGroupSetting } from '../../shared/types/terms/term'
import { make_radios } from '#dom/radiobutton'
import { copyMerge } from '../../rx'
import { GroupSettingMethods } from './groupsetting.ts'

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
		getPillName() {
			return self.term.name
		},

		getPillStatus() {
			if (self.q.type == 'predefined-groupset' || self.q.type == 'custom-groupset') {
				const labels: string[] = []
				labels.push(dt2label[self.q.dt])
				const byOrigin = self.vocabApi.termdbConfig.assayAvailability?.byDt[self.q.dt!]?.byOrigin
				if (byOrigin) labels.push(byOrigin[self.q.origin!]?.label || self.q.origin)
				if (self.q.type == 'predefined-groupset') {
					const groupset = self.term.groupsetting.lst[self.q.predefined_groupset_idx]
					labels.push(groupset.name)
				} else if (self.q.type == 'custom-groupset') {
					const n = self.q.customset.groups.length
					labels.push(`Divided into ${n} groups`)
				} else {
					throw 'unknown setting for groupsetting'
				}
				return { text: labels.join(' - ') }
			} else {
				return { text: self.q.exclude?.length ? 'matching variants' : 'any variant class' }
			}
		},

		//validateQ(data: Q) {}, //TODO: should enable 'validateQ'

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

function setMethods(self) {
	self.validateGroupsetting = function () {
		// harmonize with validateGroupsetting() from client/termsetting/handlers/categorical.ts
	}
}

export function fillTW(tw: GeneVariantTW, vocabApi: VocabApi, defaultQ: GeneVariantQ | null = null) {
	if (!tw.term.id) tw.term.id = tw.term.name

	if (!tw.term.kind) {
		// support saved states that don't have term.kind, applied when rehydrating at runtime
		const term: any = tw.term
		if (term.gene || (term.name && !term.chr)) term.kind = 'gene'
		else if (term.chr) term.kind = 'coord'
		else throw 'unable to assign geneVariant term.kind'
	}

	if (tw.term.kind == 'gene') {
		if (!tw.term.gene) {
			if (!tw.term.name) throw 'no gene specified'
			tw.term.gene = tw.term.name //support saved states that have the older geneVariant term data shape
		}
	} else if (tw.term.kind == 'coord') {
		if (!tw.term.chr || !Number.isInteger(tw.term.start) || !Number.isInteger(tw.term.stop))
			throw 'no position specified'
		if (!tw.term.name) {
			tw.term.name = `${tw.term.chr}:${tw.term.start + 1}-${tw.term.stop}`
		}
	} else {
		throw 'cannot recognize tw.term.kind'
	}

	if (!Object.keys(tw.q).includes('type')) tw.q.type = 'values'

	// merge defaultQ into tw.q
	if (defaultQ) {
		defaultQ.isAtomic = true
		copyMerge(tw.q, defaultQ)
	}

	// groupsetting
	// fill term.groupsetting
	if (!tw.term.groupsetting) tw.term.groupsetting = geneVariantTermGroupsetting satisfies TermGroupSetting
	// fill groupsetting properties in q
	if (tw.q.type == 'predefined-groupset' || tw.q.type == 'custom-groupset') {
		// groupsetting in use
		// must specify a single data type
		if (!tw.q.dt) {
			const ds_dts = getDsDts(vocabApi.termdbConfig.queries)
			tw.q.dt = ds_dts[0]
		}
		// must specify a single orign (if dt has annotated origins)
		const byOrigin = vocabApi.termdbConfig.assayAvailability?.byDt[tw.q.dt]?.byOrigin
		if (byOrigin && !tw.q.origin) tw.q.origin = 'somatic'
		// fill groupsetting
		if (tw.q.type == 'predefined-groupset') {
			if (!Number.isInteger(tw.q.predefined_groupset_idx)) {
				const groupset_idxs = getGroupsetIdxs(tw.q.dt)
				tw.q.predefined_groupset_idx = groupset_idxs[0]
			}
		}
	}

	{
		// apply optional ds-level configs for this specific term
		const c = vocabApi.termdbConfig.customTwQByType?.geneVariant
		if (c && tw.term.name) {
			//if (c) valid js code but `&& tw.term.name` required to avoid type error
			// order of overide: 1) do not override existing settings in tw.q{} 2) c.byGene[thisGene] 3) c.default{}
			Object.assign(tw.q, c.default || {}, c.byGene?.[tw.term.name] || {}, tw.q)
		}
	}

	// cnv cutoffs; if the attributes are missing from q{}, add
	if ('cnvMaxLength' in tw.q) {
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
	}
}

async function makeEditMenu(self: GeneVariantTermSettingInstance, _div: any) {
	/* TODO: instead of directly modifying self.q here, should create a separate property on the handler to store pending user
	configurations (similar to numeric continuous/discrete switching)
	const handler = self.handlerByType.geneVariant
	*/
	const div = _div.append('div').style('padding', '8px')
	div.append('div').style('font-size', '1.2rem').text(self.term.name)
	const optsDiv = div.append('div').style('margin-top', '10px')
	const groupsDiv = div
		.append('div')
		.style('display', 'none')
		.style('margin', '5px 0px 0px 30px')
		.style('vertical-align', 'top')
	const dtDiv = groupsDiv.append('div')
	const originDiv = groupsDiv.append('div').style('margin-top', '15px')
	const groupsetDiv = groupsDiv.append('div').style('margin-top', '15px')
	const draggablesDiv = div
		.append('div')
		.style('display', 'none')
		.style('margin-left', '20px')
		.style('vertical-align', 'top')

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
			if (v == 'group') {
				await makeGroupUI()
			} else {
				clearGroupset(self)
				delete self.q.dt
				delete self.q.origin
				groupsDiv.style('display', 'none')
				draggablesDiv.style('display', 'none')
			}
		}
	})

	if (self.opts.geneVariantEditMenuOnlyGrp) {
		// only show groupsetting options
		// so that user does not turn off groupsetting
		optsDiv.style('display', 'none')
		groupsDiv.style('margin', '10px 0px 0px 00px')
	}

	const selected = radios.inputs.filter(d => d.checked)
	if (selected.property('value') == 'group') await makeGroupUI()

	// make radio buttons for grouping variants
	async function makeGroupUI() {
		groupsDiv.style('display', 'inline-block')
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
		}
	}

	// radio buttons for data type
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
		if (q.type == 'values') {
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
	}

	// function for making groupset draggables
	async function makeGroupsetDraggables() {
		draggablesDiv.style('display', 'inline-block')
		draggablesDiv.selectAll('*').remove()
		self.groupSettingInstance = new GroupSettingMethods(self, { holder: draggablesDiv, hideApply: true })
		await self.groupSettingInstance.main()
	}

	// Apply button
	div
		.append('button')
		.style('margin-top', '20px')
		.style('display', 'block')
		.text('Apply')
		.on('click', () => {
			if ((self.q.type == 'predefined-groupset' || self.q.type == 'custom-groupset') && self.groupSettingInstance)
				self.groupSettingInstance.processDraggables()
			self.runCallback()
		})

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

// get dts specified in dataset
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
}

function clearGroupset(self) {
	delete self.q.type
	delete self.q.predefined_groupset_idx
	delete self.q.customset
	delete self.groupSettingInstance
}
