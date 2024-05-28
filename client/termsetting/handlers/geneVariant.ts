import { select } from 'd3-selection'
import { mclass, dt2label, dtsnvindel, dtcnv, dtsv, dtfusionrna } from '../../shared/common'
import { VocabApi, GeneVariantTermSettingInstance, GeneVariantTW } from '../../shared/types/index'
import { PredefinedGroupSetting } from '../../shared/types/terms/term'

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
			return { text: self.q.exclude?.length ? 'matching variants' : 'any variant class' }
		},

		//validateQ(data: Q) {},

		async showEditMenu(div: Element) {
			await makeEditMenu(self, div)
		}
	}
}

export function fillTW(tw: GeneVariantTW, vocabApi: VocabApi) {
	if (!tw.term.gene && !(tw.term.chr && Number.isInteger(tw.term.start) && Number.isInteger(tw.term.stop))) {
		// support saved states that have the older geneVariant term data shape
		if (tw.term.name) tw.term.gene = tw.term.name
		else throw 'no gene or position specified'
	}
	if (!tw.term.name) tw.term.name = tw.term.gene || `${tw.term.chr}:${tw.term.start + 1}-${tw.term.stop}`
	if (!tw.term.id) tw.term.id = tw.term.name // TODO: is this necessary?
	if (!('type' in tw.q)) tw.q.type = 'values' // TODO: is this necessary to specify? Note that q.type = 'values' works with predefined groupsetting for geneVariant term.

	// groupsetting
	// fill tw.term.groupsetting
	const protein_changing_keys = new Set(['D', 'F', 'I', 'L', 'M', 'N', 'P', 'ProteinAltering', 'Fuserna', 'SV'])
	const truncating_keys = new Set(['F', 'L', 'N', 'SV'])
	if (!tw.term.groupsetting) {
		tw.term.groupsetting = { disabled: false }
		/* for each groupsetting, groups[] is ordered by priority
		for example: for the 'Protein-changing vs. rest' groupsetting, the
		'Protein-changing' group is listed first in groups[] so that samples
		that have both missense and silent mutations are classified in the
		'Protein-changing' group */
		const lst = [
			{
				name: 'Mutated vs. wildtype',
				groups: [
					{
						name: 'Mutated',
						values: Object.keys(mclass)
							.filter(key => key != 'WT' && key != 'Blank')
							.map(key => {
								return { key, dt: mclass[key].dt, label: mclass[key].label }
							})
					},
					{
						name: 'Wildtype',
						values: [{ key: 'WT', label: 'Wildtype' }]
					},
					{
						name: 'Not tested',
						values: [{ key: 'Blank', label: 'Not tested' }]
					}
				]
			},
			{
				name: 'Protein-changing vs. rest',
				groups: [
					{
						name: 'Protein-changing',
						values: Object.keys(mclass)
							.filter(key => protein_changing_keys.has(key))
							.map(key => {
								return { key, dt: mclass[key].dt, label: mclass[key].label }
							})
					},
					{
						name: 'Rest',
						values: Object.keys(mclass)
							.filter(key => !protein_changing_keys.has(key) && key != 'Blank')
							.map(key => {
								return { key, dt: mclass[key].dt, label: mclass[key].label }
							})
					},
					{
						name: 'Not tested',
						values: [{ key: 'Blank', label: 'Not tested' }]
					}
				]
			},
			{
				name: 'Truncating vs. rest',
				groups: [
					{
						name: 'Truncating',
						values: Object.keys(mclass)
							.filter(key => truncating_keys.has(key))
							.map(key => {
								return { key, dt: mclass[key].dt, label: mclass[key].label }
							})
					},
					{
						name: 'Rest',
						values: Object.keys(mclass)
							.filter(key => !truncating_keys.has(key) && key != 'Blank')
							.map(key => {
								return { key, dt: mclass[key].dt, label: mclass[key].label }
							})
					},
					{
						name: 'Not tested',
						values: [{ key: 'Blank', label: 'Not tested' }]
					}
				]
			}
		]
		tw.term.groupsetting.lst = lst
	}

	// fill tw.q.groupsetting
	if (!tw.q.groupsetting) tw.q.groupsetting = {}
	delete tw.q.groupsetting.disabled
	if (!('inuse' in tw.q.groupsetting)) tw.q.groupsetting.inuse = false
	if (tw.q.groupsetting.inuse) {
		// groupsetting is active
		const gs = tw.q.groupsetting as PredefinedGroupSetting
		/* is the following necessary? (copied from client/termsetting/handlers/categorical.ts). useIndex does not seem to be used in the codebase.
		if (
			gs.lst &&
			//Typescript emits error that .useIndex could be undefined
			gs.useIndex &&
			//Fix checks if property is present
			gs.useIndex >= 0 &&
			gs.lst[gs.useIndex]
		) {
			gs.predefined_groupset_idx = gs.useIndex
		}*/
		gs.predefined_groupset_idx = 0

		// specify a single dt
		const ds_dts = [] // dts specified in dataset
		for (const query of Object.keys(vocabApi.termdbConfig.queries)) {
			if (query == 'snvindel') ds_dts.push(dtsnvindel)
			else if (query == 'cnv') ds_dts.push(dtcnv)
			else if (query == 'svfusion') ds_dts.push(dtfusionrna)
			else if (query == 'sv') ds_dts.push(dtsv) // TODO: is this correct?
			else continue
		}
		if (!tw.q.dt) tw.q.dt = ds_dts[0] // default dt will be first in dataset
		if (!(tw.q.dt in dt2label)) throw 'invalid dt'
		if (!ds_dts.includes(tw.q.dt)) throw 'dt not supported in dataset'

		// specify a single origin
		// TODO: verify that 'vocabApi.termdbConfig.assayAvailability.byDt[dt].byOrigin' will always be defined in dataset when dt has multiple origins
		if (vocabApi.termdbConfig.assayAvailability?.byDt[tw.q.dt]?.byOrigin) {
			// dt has multiple origins in dataset
			// so an origin must be specified
			if (!tw.q.origin) tw.q.origin = 'somatic' /*'germline'*/
			if (!(tw.q.origin in vocabApi.termdbConfig.assayAvailability.byDt[tw.q.dt].byOrigin)) throw 'invalid dt origin'
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

function makeEditMenu(self: GeneVariantTermSettingInstance, _div: any) {
	const div = _div.append('div').style('padding', '5px').style('cursor', 'pointer')

	div.append('div').style('font-size', '1.2rem').text(self.term.name)
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
		})
}
