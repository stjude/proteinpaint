import tape from 'tape'
import type { GvTW } from '#types'
import { vocabInit } from '#termdb/vocabulary'
import { GvBase } from '../geneVariant'

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
	test.notOk(mutTvs.wt, 'mutant tvs should have wt=false')
	test.deepEqual(wtTvs.values, [], 'wildtype tvs should have empty values')
	test.ok(wtTvs.wt, 'wildtype tvs should have wt=true')
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
	test.notOk(mutTvs.wt, 'mutant tvs should have wt=false')
	test.deepEqual(wtTvs.values, [], 'wildtype tvs should have empty values')
	test.ok(wtTvs.wt, 'wildtype tvs should have wt=true')
}

function testSvGroupset(groupset, test) {
	test.equal(groupset.groups.length, 2, 'groupset should have 2 groups')
	const mutGrp = groupset.groups[0]
	const mutTvs = mutGrp.filter.lst[0].tvs
	const wtGrp = groupset.groups[1]
	const wtTvs = wtGrp.filter.lst[0].tvs
	test.deepEqual(mutTvs.values, [], 'mutant tvs should have empty values because gene does not have SVs in dataset')
	test.notOk(mutTvs.wt, 'mutant tvs should have wt=false')
	test.deepEqual(wtTvs.values, [], 'wildtype tvs should have empty values')
	test.ok(wtTvs.wt, 'wildtype tvs should have wt=true')
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
	test.equal(fullTw.term.childTerms.length, 5, 'should create 5 child dt terms')
	if (!fullTw.term.groupsetting.lst) throw 'term.groupsetting.lst is missing'
	test.equal(fullTw.term.groupsetting.lst.length, 5, 'should get 5 predefined groupsets')
	for (const groupset of fullTw.term.groupsetting.lst) {
		if (groupset.dt == 1) {
			testSnvIndelGroupset(groupset, test)
		} else if (groupset.dt == 2) {
			testFusionGroupset(groupset, test)
		} else if (groupset.dt == 4) {
			testCnvGroupset(groupset, test)
		} else if (groupset.dt == 5) {
			testSvGroupset(groupset, test)
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
