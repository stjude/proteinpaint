import { mclass, dt2label, dtsnvindel, dtcnv, dtfusionrna, geneVariantTermGroupsetting } from '../../shared/common'
import {
	VocabApi,
	GeneVariantTermSettingInstance,
	GeneVariantTW,
	GeneVariantQ,
	GeneVariantGeneTerm
} from '../../shared/types/index'
import { make_radios } from '#dom/radiobutton'
import { copyMerge } from '../../rx'
import { GroupSettingMethods } from './groupsetting.ts'
import { PredefinedQGroupSetting, CustomQGroupSetting } from '../../shared/types/terms/term'
/* 
instance attributes

self.term{}
	.name: str, not really used
	.type: "geneVariant"
*/

//TODO move to common.ts??? Corresponds to client/shared/common.js
type MClassEntry = { label: string; color: string; dt: number; desc: string; key: string }
type GroupsEntry = { name: string; items: MClassEntry[] }

// self is the termsetting instance
export function getHandler(self: GeneVariantTermSettingInstance) {
	return {
		getPillName() {
			return self.term.name
		},

		getPillStatus() {
			if (self.q.groupsetting.inuse) {
				const labels: string[] = []
				labels.push(dt2label[self.q.dt])
				const byOrigin = self.vocabApi.termdbConfig.assayAvailability?.byDt[self.q.dt as number]?.byOrigin
				if (byOrigin) labels.push(byOrigin[self.q.origin as string]?.label || self.q.origin)
				if ('predefined_groupset_idx' in self.q.groupsetting) {
					self.q.groupsetting as PredefinedQGroupSetting
					if (Number.isInteger(self.q.groupsetting.predefined_groupset_idx)) {
						const groupset = self.term.groupsetting.lst[self.q.groupsetting.predefined_groupset_idx as number]
						labels.push(groupset.name as string)
					}
				} else if (self.q.groupsetting['customset']) {
					self.q.groupsetting as CustomQGroupSetting
					const n = self.q.groupsetting.customset.groups.length
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

export function fillTW(tw: GeneVariantTW, vocabApi: VocabApi, defaultQ = null) {
	if (
		!('gene' in tw.term) &&
		!('chr' in tw.term && Number.isInteger(tw.term['start']) && Number.isInteger(tw.term['stop']))
	) {
		// support saved states that have the older geneVariant term data shape
		if (tw.term.name) (tw.term as GeneVariantGeneTerm).gene = tw.term.name
		else throw 'no gene or position specified'
	}
	if (!tw.term.name) {
		const gt = tw.term as GeneVariantGeneTerm
		if (gt.gene) tw.term.name = gt.gene
		//Check to see if all the parts of the position are present
		else if (gt.chr && gt.start && gt.stop) tw.term.name = `${gt.chr}:${gt.start + 1}-${gt.stop}`
		else throw 'All or part position or gene'
	}
	if (!tw.term.id) tw.term.id = tw.term.name
	if (!('type' in tw.q)) tw.q.type = 'values'

	// merge defaultQ into tw.q
	if (defaultQ) {
		;(defaultQ as GeneVariantQ).isAtomic = true
		copyMerge(tw.q, defaultQ)
	}

	// groupsetting
	// fill term.groupsetting
	if (!tw.term.groupsetting) tw.term.groupsetting = geneVariantTermGroupsetting
	// fill q.groupsetting
	if (!tw.q.groupsetting) (tw.q.groupsetting as any) = {}

	if (!('inuse' in tw.q.groupsetting)) (tw.q.groupsetting as any).inuse = false
	if (tw.q.groupsetting.inuse) {
		// groupsetting in use
		// fill a single data type
		const ds_dts = getDsDts(vocabApi.termdbConfig.queries)
		if (!tw.q.dt) tw.q.dt = ds_dts[0]
		// fill a single orign, if applicable
		const byOrigin = vocabApi.termdbConfig.assayAvailability?.byDt[tw.q.dt]?.byOrigin
		if (byOrigin) {
			if (!tw.q.origin || !(tw.q.origin in byOrigin)) tw.q.origin = 'somatic'
		}
		// fill a single groupset index
		const groupset_idxs = getGroupsetIdxs(tw.q.dt)
		if (!Number.isInteger(tw.q.groupsetting['predefined_groupset_idx']) && !tw.q.groupsetting['customset']) {
			tw.q.type = 'predefined-groupset'
			;(tw.q.groupsetting as PredefinedQGroupSetting).predefined_groupset_idx = groupset_idxs[0]
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
	make_radios({
		holder: optsDiv,
		options: [
			{ label: 'No variant grouping', value: false, checked: !self.q.groupsetting.inuse },
			{ label: 'Assign variants to groups', value: true, checked: self.q.groupsetting.inuse }
		],
		callback: async v => {
			if (v) {
				self.q.groupsetting.inuse = true
				await makeRadiosForGrouping()
			} else {
				self.q.groupsetting.inuse = false
				delete self.q.dt
				delete self.q.origin
				clearGroupset(self)
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

	if (self.q.groupsetting.inuse) await makeRadiosForGrouping()

	// make radio buttons for grouping variants
	async function makeRadiosForGrouping() {
		groupsDiv.style('display', 'inline-block')
		makeDtRadios()
		mayMakeOriginRadios()
		const groupset_idxs = getGroupsetIdxs(self.q.dt)
		if (self.q.dt == dtsnvindel) {
			// dt is SNV/indel
			// groupsetting is customizable
			// display as radio buttons and draggables
			makeGroupsetRadios(groupset_idxs)
			await mayMakeGroupsetDraggables()
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
				await makeRadiosForGrouping()
			}
		})
	}

	// radio buttons for variant origin
	function mayMakeOriginRadios() {
		const byOrigin = self.vocabApi.termdbConfig.assayAvailability?.byDt[self.q.dt as number]?.byOrigin
		if (!byOrigin) {
			delete self.q.origin
			originDiv.style('display', 'none')
			return
		}
		if (!self.q.origin || !(self.q.origin in byOrigin)) self.q.origin = 'somatic'
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
				await makeRadiosForGrouping()
			}
		})
	}

	// radio buttons for variant groupset
	function makeGroupsetRadios(groupset_idxs) {
		groupsetDiv.selectAll('*').remove()
		groupsetDiv.append('div').style('font-weight', 'bold').text('Variant grouping')
		if (
			!Number.isInteger((self.q.groupsetting as PredefinedQGroupSetting).predefined_groupset_idx) &&
			!(self.q.groupsetting as CustomQGroupSetting).customset
		) {
			self.q.type = 'predefined-groupset'
			;(self.q.groupsetting as PredefinedQGroupSetting).predefined_groupset_idx = groupset_idxs[0]
		}
		const qgs = self.q.groupsetting as PredefinedQGroupSetting
		const isPredefined = Number.isInteger(qgs.predefined_groupset_idx)
		// radios for whether to use predefined groups or custom groups
		const radios = make_radios({
			holder: groupsetDiv,
			options: [
				{ label: 'Predefined groups', value: 'predefined', checked: isPredefined },
				{ label: 'Custom groups', value: 'custom', checked: !isPredefined }
			],
			callback: async v => {
				if (v == 'predefined') {
					self.q.type = 'predefined-groupset'
					qgs.predefined_groupset_idx = groupset_idxs[0]
					delete self.q.groupsetting['customset']
				} else {
					predefinedGroupsetDiv.style('display', 'none')
					makeCustomGroups()
				}
				await makeRadiosForGrouping()
			}
		})
		// get the div of the predefined radio button and append
		// new div for making radio buttons of predefined groupset options
		const predefinedGroupsetDiv = radios.divs
			.filter((d, i) => i === 0)
			.append('div')
			.style('margin', '5px 0px 0px 30px')
		if (isPredefined) {
			// groupsetting is predefined
			// make radios for predefined groupsetting options
			predefinedGroupsetDiv.style('display', 'block')
			predefinedGroupsetDiv.selectAll('*').remove()
			const qgs = self.q.groupsetting as PredefinedQGroupSetting
			if (!Number.isInteger(qgs.predefined_groupset_idx)) {
				qgs.predefined_groupset_idx = groupset_idxs[0]
			}
			make_radios({
				holder: predefinedGroupsetDiv,
				options: groupset_idxs.map(i => {
					const groupset = self.term.groupsetting.lst[i]
					return { label: groupset.name, value: i, checked: i == qgs.predefined_groupset_idx }
				}),
				callback: async v => {
					qgs.predefined_groupset_idx = v
					await makeRadiosForGrouping()
				}
			})
		} else {
			// groupsetting is not predefined
			// prepare custom groups
			predefinedGroupsetDiv.style('display', 'none')
			makeCustomGroups()
		}
	}

	function makeGroupsetText(groupset_idxs) {
		// dt is either CNV or SV Fusion
		// use fixed groupsetting
		draggablesDiv.style('display', 'none')
		delete self['groupSettingInstance']
		groupsetDiv.selectAll('*').remove()
		groupsetDiv.append('div').style('font-weight', 'bold').text('Variant grouping')
		self.q.type = 'predefined-groupset'
		const qgs = self.q.groupsetting as PredefinedQGroupSetting
		qgs.predefined_groupset_idx = groupset_idxs[0]
		if (self.term.groupsetting.lst) {
			const groupset = self.term.groupsetting.lst[qgs.predefined_groupset_idx]
			groupsetDiv.append('div').style('margin', '5px 0px 0px 10px').text(groupset.name)
		}
	}

	// function for preparing custom groups
	function makeCustomGroups() {
		self.q.type = 'custom-groupset'
		delete self.q.groupsetting['predefined_groupset_idx']
		const dt = self.category2samplecount.find(i => i.dt == self.q.dt)
		const classes = dt.classes.byOrigin ? dt.classes.byOrigin[self.q.origin as string] : dt.classes
		if (!self.q.groupsetting['customset']) {
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
			;(self.q.groupsetting as CustomQGroupSetting).customset = { groups }
		}
	}

	// function for making groupset draggables
	async function mayMakeGroupsetDraggables() {
		draggablesDiv.style('display', 'inline-block')
		draggablesDiv.selectAll('*').remove()
		self['groupSettingInstance'] = new GroupSettingMethods(self, { holder: draggablesDiv, hideApply: true })
		await self['groupSettingInstance'].main()
	}

	// Apply button
	div
		.append('button')
		.style('margin-top', '20px')
		.style('display', 'block')
		.text('Apply')
		.on('click', () => {
			if (self.q.groupsetting.inuse && self['groupSettingInstance']) self['groupSettingInstance'].processDraggables()
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
	delete self.q.groupsetting.predefined_groupset_idx
	delete self.q.groupsetting.customset
	delete self.groupSettingInstance
}
