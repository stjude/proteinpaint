import tape from 'tape'
import type { GvTW } from '#types'
import { vocabInit } from '#termdb/vocabulary'
import { GvBase, GvPredefinedGS } from '../geneVariant'

/*************************
 reusable helper functions
**************************/

async function getVocabApi() {
	const vocabApi = vocabInit({ state: { vocab: { genome: 'hg38-test', dslabel: 'TermdbTest' } } })
	if (!vocabApi) throw 'vocabApi is missing'
	await vocabApi.getTermdbConfig()
	return vocabApi
}

function testCnvGroupset(groupset, test) {
	test.ok(groupset.groups.length > 0, 'groupset should have at least one group')
}

function testSnvIndelGroupset(groupset, test) {
	test.equal(groupset.groups.length, 2, 'groupset should have 2 groups')
	const mutGrp = groupset.groups[0]
	const mutTvs = mutGrp.filter.lst[0].tvs
	const wtGrp = groupset.groups[1]
	const wtTvs = wtGrp.filter.lst[0].tvs
	test.deepEqual(
		mutTvs.values,
		[
			{ key: 'M', label: 'MISSENSE', value: 'M' },
			{ key: 'F', label: 'FRAMESHIFT', value: 'F' }
		],
		'mutant tvs should have mutant values'
	)
	test.equal(mutTvs.genotype, 'variant', 'mutant tvs should have .genotype=variant')
	test.equal(wtTvs.genotype, 'wt', 'wildtype tvs should have .genotype=wt')
	test.deepEqual(wtTvs.values, [], 'wildtype tvs should have empty values')
}

function testFusionGroupset(groupset, test) {
	test.equal(groupset.groups.length, 2, 'groupset should have 2 groups')
	const mutGrp = groupset.groups[0]
	const mutTvs = mutGrp.filter.lst[0].tvs
	const wtGrp = groupset.groups[1]
	const wtTvs = wtGrp.filter.lst[0].tvs
	test.deepEqual(
		mutTvs.values,
		[{ key: 'Fuserna', label: 'Fusion transcript', value: 'Fuserna' }],
		'mutant tvs should have mutant values'
	)
	test.equal(mutTvs.genotype, 'variant', 'mutant tvs should have .genotype=variant')
	test.equal(wtTvs.genotype, 'wt', 'wildtype tvs should have .genotype=wt')
	test.deepEqual(wtTvs.values, [], 'wildtype tvs should have empty values')
}

function testSvGroupset(groupset, test) {
	test.equal(groupset.groups.length, 2, 'groupset should have 2 groups')
	const mutGrp = groupset.groups[0]
	const mutTvs = mutGrp.filter.lst[0].tvs
	const wtGrp = groupset.groups[1]
	const wtTvs = wtGrp.filter.lst[0].tvs
	test.deepEqual(mutTvs.values, [], 'mutant tvs should have empty values because gene does not have SVs in dataset')
	test.equal(mutTvs.genotype, 'variant', 'mutant tvs should have .genotype=variant')
	test.equal(wtTvs.genotype, 'wt', 'wildtype tvs should have .genotype=wt')
	test.deepEqual(wtTvs.values, [], 'wildtype tvs should have empty values')
}

function testItdGroupset(groupset, test) {
	test.equal(groupset.groups.length, 2, 'groupset should have 2 groups')
	const mutGrp = groupset.groups[0]
	const mutTvs = mutGrp.filter.lst[0].tvs
	const wtGrp = groupset.groups[1]
	const wtTvs = wtGrp.filter.lst[0].tvs
	test.deepEqual(mutTvs.values, [{ key: 'ITD', label: 'ITD', value: 'ITD' }], 'mutant tvs should have mutant values')
	test.equal(mutTvs.genotype, 'variant', 'mutant tvs should have .genotype=variant')
	test.equal(wtTvs.genotype, 'wt', 'wildtype tvs should have .genotype=wt')
	test.deepEqual(wtTvs.values, [], 'wildtype tvs should have empty values')
}

/**************
 test sections
***************/

const vocabApi: any = await getVocabApi()

tape('\n', function (test) {
	test.comment('-***- tw/geneVariant.integration -***-')
	test.end()
})

tape('fill(): invalid tw', async test => {
	const tw: any = {
		term: {
			kind: 'gene',
			id: 'TP53',
			gene: 'TP53',
			name: 'TP53',
			type: 'categorical'
		},
		isAtomic: true,
		q: { isAtomic: true }
	}
	try {
		await GvBase.fill(tw, { vocabApi })
	} catch (e) {
		test.equal(e, "incorrect term.type='categorical', expecting 'geneVariant'", 'should throw on incorrect term.type')
	}
})

tape('fill(): no q.type', async test => {
	const tw: any = {
		term: {
			kind: 'gene',
			id: 'TP53',
			gene: 'TP53',
			name: 'TP53',
			type: 'geneVariant'
		},
		isAtomic: true,
		q: { isAtomic: true }
	}
	const fullTw = await GvBase.fill(tw, { vocabApi })
	test.equal(fullTw.type, 'GvValuesTW', 'should fill in tw.type')
	const expectedQ = {
		isAtomic: true,
		type: 'values',
		hiddenValues: {}
	}
	test.deepEqual(fullTw.q, expectedQ, 'should fill in q')
	test.deepEqual(fullTw.term.groupsetting, { disabled: false }, 'should fill in term.groupsetting')
	test.end()
})

tape('fill(): q.type=values', async test => {
	const tw: any = {
		term: {
			kind: 'gene',
			id: 'TP53',
			gene: 'TP53',
			name: 'TP53',
			type: 'geneVariant'
		},
		isAtomic: true,
		q: { isAtomic: true, type: 'values' }
	}
	const fullTw = await GvBase.fill(tw, { vocabApi })
	test.equal(fullTw.type, 'GvValuesTW', 'should fill in tw.type')
	test.end()
})

tape('fill(): q.type=values, stale q.dtLst', async test => {
	// dtLst is left behind when a groupset is cleared, and would otherwise limit
	// the term to the dts of the groupset that is no longer in use
	const tw: any = {
		term: {
			kind: 'gene',
			id: 'TP53',
			gene: 'TP53',
			name: 'TP53',
			type: 'geneVariant'
		},
		isAtomic: true,
		q: { isAtomic: true, type: 'values', dtLst: [4] }
	}
	const fullTw = await GvBase.fill(tw, { vocabApi })
	test.equal(fullTw.type, 'GvValuesTW', 'should fill in tw.type')
	test.deepEqual(
		fullTw.q,
		{ isAtomic: true, type: 'values', hiddenValues: {} },
		'should delete stale q.dtLst of a values q'
	)
	test.end()
})

tape('fill(): q.type=predefined-groupset', async test => {
	const tw: any = {
		term: {
			name: 'TP53',
			genes: [
				{
					kind: 'gene',
					id: 'TP53',
					gene: 'TP53',
					name: 'TP53',
					type: 'geneVariant'
				}
			],
			type: 'geneVariant'
		},
		isAtomic: true,
		q: { isAtomic: true, type: 'predefined-groupset' }
	}
	const fullTw: GvTW = await GvBase.fill(tw, { vocabApi })
	if (fullTw.q.type != 'predefined-groupset') throw 'q.type must be predefined-groupset'
	test.equal(fullTw.type, 'GvPredefinedGsTW', 'should fill in tw.type')
	test.equal(fullTw.q.predefined_groupset_idx, 0, 'should fill q.predefined_groupset_idx to be 0')
	test.equal(fullTw.term.childTerms.length, 6, 'should create 6 child dt terms')
	if (!fullTw.term.groupsetting.lst) throw 'term.groupsetting.lst is missing'
	test.equal(fullTw.term.groupsetting.lst.length, 6, 'should get 6 predefined groupsets')
	for (const groupset of fullTw.term.groupsetting.lst) {
		if (groupset.dt == 1) {
			testSnvIndelGroupset(groupset, test)
		} else if (groupset.dt == 2) {
			testFusionGroupset(groupset, test)
		} else if (groupset.dt == 4) {
			testCnvGroupset(groupset, test)
		} else if (groupset.dt == 5) {
			testSvGroupset(groupset, test)
		} else if (groupset.dt == 6) {
			testItdGroupset(groupset, test)
		} else {
			test.fail('unexpected groupset')
		}
	}
	test.end()
})

tape('fill(): q.type=custom-groupset', async test => {
	const tw: any = {
		term: {
			name: 'TP53',
			genes: [
				{
					kind: 'gene',
					id: 'TP53',
					gene: 'TP53',
					name: 'TP53',
					type: 'geneVariant'
				}
			],
			type: 'geneVariant'
		},
		isAtomic: true,
		q: customGsQ
	}
	const fullTw = await GvBase.fill(tw, { vocabApi })
	test.equal(fullTw.type, 'GvCustomGsTW', 'should fill in tw.type=GvCustomGsTW')
	test.deepEqual(fullTw.term.groupsetting, { disabled: false }, 'should fill in term.groupsetting')
	test.end()
})

tape('fill(): q.type=custom-groupset, stale mnames', async test => {
	// simulates a customset of a session saved before the mname tally became opt-in,
	// where it was stored on the dt term of every tvs
	const q: any = structuredClone(customGsQ)
	const tvsTerms = q.customset.groups.map(g => g.filter.lst[0].tvs.term)
	for (const t of tvsTerms) {
		t.mnames = [{ mname: 'R273H', class: 'M', samplecount: 1 }]
	}
	const tw: any = {
		term: {
			name: 'TP53',
			genes: [{ kind: 'gene', id: 'TP53', gene: 'TP53', name: 'TP53', type: 'geneVariant' }],
			type: 'geneVariant'
		},
		isAtomic: true,
		q
	}
	const fullTw: any = await GvBase.fill(tw, { vocabApi })
	const filled = fullTw.q.customset.groups.map(g => g.filter.lst[0].tvs.term)
	test.equal(filled.length, tvsTerms.length, 'should keep every customset group')
	test.ok(
		filled.every(t => !('mnames' in t)),
		'should delete the stale mname tally from every tvs of the customset'
	)
	test.ok(
		filled.every(t => t.values && Object.keys(t.values).length),
		'should leave the tvs term values intact'
	)
	test.end()
})

tape('getMinCopy(): trims the derived term properties', async test => {
	const tw: any = {
		term: {
			name: 'TP53',
			genes: [{ kind: 'gene', id: 'TP53', gene: 'TP53', name: 'TP53', type: 'geneVariant' }],
			type: 'geneVariant'
		},
		isAtomic: true,
		q: { isAtomic: true, type: 'predefined-groupset', predefined_groupset_idx: 0 }
	}
	const fullTw: any = await GvBase.fill(tw, { vocabApi })
	const beforeTerm = JSON.stringify(fullTw.term)
	const xtw = new GvPredefinedGS(fullTw, { vocabApi })
	const copy: any = xtw.getMinCopy()

	// no server code reads childTerms[]
	test.equal('childTerms' in copy.term, false, 'should remove term.childTerms[]')

	// get_active_groupset() reads lst[q.predefined_groupset_idx], so the other
	// groupsets are nulled rather than removed, to keep the indexes aligned
	const idx = copy.q.predefined_groupset_idx
	const lst = copy.term.groupsetting.lst
	test.equal(lst.length, fullTw.term.groupsetting.lst.length, 'should keep the groupsetting.lst[] length')
	test.equal(lst[idx].name, fullTw.term.groupsetting.lst[idx].name, 'should keep the selected groupset')
	test.ok(
		lst.every((groupset, i) => i == idx || groupset === null),
		'should null every groupset other than the selected one'
	)

	// the dt term of every tvs of the selected groupset
	const tvsTerms: any[] = []
	const walk = (obj: any) => {
		if (!obj || typeof obj != 'object') return
		if (obj.type == 'tvs' && obj.tvs?.term) tvsTerms.push(obj.tvs.term)
		for (const k in obj) walk(obj[k])
	}
	walk(lst[idx])
	test.ok(tvsTerms.length > 0, 'selected groupset should have tvs to check')
	test.ok(
		tvsTerms.every(t => !('mnames' in t)),
		'should remove mnames from every tvs term'
	)
	test.ok(
		tvsTerms.every(t => t.parentTerm?.genes?.length),
		'should keep tvs.term.parentTerm, which get_dtTerm() reads server-side'
	)

	// the trim is destructive, so it must only ever run on the copy
	test.equal(JSON.stringify(fullTw.term), beforeTerm, 'should not mutate the source tw.term')
	test.end()
})

tape('getTwMinCopy(): trims without mutating the source term', async test => {
	// the non-xtw path, used for the terms of a matrix data request
	const tw: any = {
		term: {
			name: 'TP53',
			genes: [{ kind: 'gene', id: 'TP53', gene: 'TP53', name: 'TP53', type: 'geneVariant' }],
			type: 'geneVariant'
		},
		isAtomic: true,
		q: { isAtomic: true, type: 'predefined-groupset', predefined_groupset_idx: 0 }
	}
	const fullTw: any = await GvBase.fill(tw, { vocabApi })
	const beforeTerm = JSON.stringify(fullTw.term)
	const copy: any = vocabApi.getTwMinCopy(fullTw)

	test.equal('childTerms' in copy.term, false, 'should remove term.childTerms[] on this path too')
	test.ok(copy.term.groupsetting.lst[copy.q.predefined_groupset_idx], 'should keep the selected groupset')
	/* only tw.term is asserted: getTwMinCopy() holds tw.q by reference and deletes
	q.isAtomic from it, which is a separate pre-existing issue. tw.term is what the
	trim touches, and it must stay untouched on the source */
	test.equal(JSON.stringify(fullTw.term), beforeTerm, 'should not mutate the source tw.term')
	test.end()
})

/**********
 variables
***********/

const customGsQ = {
	isAtomic: true,
	type: 'custom-groupset',
	hiddenValues: {},
	customset: {
		groups: [
			{
				name: 'SNV/indel Missense (somatic)',
				type: 'filter',
				filter: {
					type: 'tvslst',
					in: true,
					join: '',
					lst: [
						{
							type: 'tvs',
							tvs: {
								term: {
									id: 'snvindel_somatic',
									query: 'snvindel',
									name: 'SNV/indel (somatic)',
									parent_id: null,
									isleaf: true,
									type: 'dtsnvindel',
									dt: 1,
									values: {
										M: { label: 'MISSENSE' },
										F: { label: 'FRAMESHIFT' },
										WT: { label: 'Wildtype' }
									},
									name_noOrigin: 'SNV/indel',
									origin: 'somatic',
									parentTerm: {
										name: 'TP53',
										genes: [
											{
												kind: 'gene',
												id: 'TP53',
												gene: 'TP53',
												name: 'TP53',
												type: 'geneVariant'
											}
										],
										type: 'geneVariant'
									}
								},
								values: [
									{
										key: 'M',
										label: 'MISSENSE',
										value: 'M'
									}
								],
								isnot: false,
								excludeGeneName: true
							}
						}
					]
				},
				color: '#e75480'
			},
			{
				name: 'SNV/indel Wildtype (somatic)',
				type: 'filter',
				filter: {
					type: 'tvslst',
					in: true,
					join: '',
					lst: [
						{
							type: 'tvs',
							tvs: {
								term: {
									id: 'snvindel_somatic',
									query: 'snvindel',
									name: 'SNV/indel (somatic)',
									parent_id: null,
									isleaf: true,
									type: 'dtsnvindel',
									dt: 1,
									values: {
										M: { label: 'MISSENSE' },
										F: { label: 'FRAMESHIFT' },
										WT: { label: 'Wildtype' }
									},
									name_noOrigin: 'SNV/indel',
									origin: 'somatic',
									parentTerm: {
										name: 'TP53',
										genes: [
											{
												kind: 'gene',
												id: 'TP53',
												gene: 'TP53',
												name: 'TP53',
												type: 'geneVariant'
											}
										],
										type: 'geneVariant'
									}
								},
								values: [{ key: 'WT', label: 'Wildtype', value: 'WT' }],
								excludeGeneName: true
							}
						}
					]
				},
				color: '#0000ff'
			}
		]
	}
}
