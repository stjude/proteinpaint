import tape from 'tape'
import type { GvCustomGsQ, RawGvTW, DtTerm, GvTW } from '#types'
import { vocabInit } from '#termdb/vocabulary'
import { GvBase } from '../geneVariant'
import { getPredefinedGroupsets } from '../../termsetting/handlers/geneVariant.ts'

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
	test.ok(groupset.groups.length, 'groupset should have at least one group')
}

function testNonCnvGroupset(groupset, test) {
	test.equal(groupset.groups.length, 2, 'groupset should have 2 groups')
	const mutGrp = groupset.groups[0]
	const mutTvs = mutGrp.filter.lst[0].tvs
	const wtGrp = groupset.groups[1]
	const wtTvs = wtGrp.filter.lst[0].tvs
	test.deepEqual(
		mutTvs.values[0],
		{ key: 'WT', label: 'Wildtype', value: 'WT' },
		'mutant tvs should have wildtype value'
	)
	test.ok(mutTvs.isnot, 'mutant tvs should have isnot=true')
	test.deepEqual(
		wtTvs.values[0],
		{ key: 'WT', label: 'Wildtype', value: 'WT' },
		'wildtype tvs should have wildtype value'
	)
	test.notok(wtTvs.isnot, 'wildtype tvs should have isnot=false')
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
	const tw: RawGvTW = {
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
	const tw: RawGvTW = {
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
	const tw: RawGvTW = {
		term: {
			kind: 'gene',
			id: 'TP53',
			gene: 'TP53',
			name: 'TP53',
			type: 'geneVariant'
		},
		isAtomic: true,
		q: { isAtomic: true, type: 'predefined-groupset' }
	}
	const fullTw: GvTW = await GvBase.fill(tw, { vocabApi })
	if (fullTw.q.type != 'predefined-groupset') throw 'q.type must be predefined-groupset'
	test.equal(fullTw.type, 'GvPredefinedGsTW', 'should fill in tw.type')
	test.equal(fullTw.q.predefined_groupset_idx, 0, 'should fill q.predefined_groupset_idx to be 0')
	test.deepEqual(fullTw.term.childTerms, childTerms, 'should fill in term.childTerms')
	if (!fullTw.term.groupsetting.lst) throw 'term.groupsetting.lst is missing'
	test.equal(fullTw.term.groupsetting.lst.length, 4, 'should get 4 predefined groupsets')
	for (const groupset of fullTw.term.groupsetting.lst) {
		if (groupset.dt == 4) {
			testCnvGroupset(groupset, test)
		} else {
			testNonCnvGroupset(groupset, test)
		}
	}
	test.end()
})

tape('fill(): q.type=custom-groupset', async test => {
	const tw: RawGvTW = {
		term: {
			kind: 'gene',
			id: 'TP53',
			gene: 'TP53',
			name: 'TP53',
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

tape('getPredefinedGroupsets: fill groupsets', async test => {
	const tw: any = {
		term: {
			type: 'geneVariant',
			gene: 'TP53',
			kind: 'gene',
			name: 'TP53',
			id: 'TP53',
			groupsetting: { disabled: false }
		},
		isAtomic: true,
		q: {
			isAtomic: true,
			type: 'predefined-groupset',
			predefined_groupset_idx: 0
		},
		type: 'GvPredefinedGsTW'
	}
	await getPredefinedGroupsets(tw, vocabApi)
	test.deepEqual(tw.term.childTerms, childTerms, 'should fill in term.childTerms')
	test.equal(tw.term.groupsetting.lst.length, 4, 'should get 4 predefined groupsets')
	for (const groupset of tw.term.groupsetting.lst) {
		if (groupset.dt == 4) {
			testCnvGroupset(groupset, test)
		} else {
			testNonCnvGroupset(groupset, test)
		}
	}
	test.end()
})

tape('getPredefinedGroupsets: incorrect tw.q.type', async test => {
	const tw: any = {
		term: {
			type: 'geneVariant',
			gene: 'TP53',
			kind: 'gene',
			name: 'TP53',
			id: 'TP53',
			groupsetting: { disabled: false }
		},
		isAtomic: true,
		q: {
			isAtomic: true,
			type: 'values'
		},
		type: 'GvValuesTW'
	}
	try {
		await getPredefinedGroupsets(tw, vocabApi)
		test.fail('should throw upon incorrect tw.q.type')
	} catch (e) {
		test.equal(e, 'unexpected tw.q.type', 'should throw upon incorrect tw.q.type')
	}
	test.end()
})

/**********
 variables
***********/

const childTerms: DtTerm[] = [
	{
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
			kind: 'gene',
			id: 'TP53',
			gene: 'TP53',
			name: 'TP53',
			type: 'geneVariant'
		}
	},
	{
		id: 'snvindel_germline',
		query: 'snvindel',
		name: 'SNV/indel (germline)',
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
		origin: 'germline',
		parentTerm: {
			kind: 'gene',
			id: 'TP53',
			gene: 'TP53',
			name: 'TP53',
			type: 'geneVariant'
		}
	},
	{
		id: 'cnv',
		query: 'cnv',
		name: 'CNV',
		parent_id: null,
		isleaf: true,
		type: 'dtcnv',
		dt: 4,
		values: {
			CNV_amp: { label: 'Copy number gain' },
			WT: { label: 'Wildtype' }
		},
		name_noOrigin: 'CNV',
		parentTerm: {
			kind: 'gene',
			id: 'TP53',
			gene: 'TP53',
			name: 'TP53',
			type: 'geneVariant'
		}
	},
	{
		id: 'fusion',
		query: 'svfusion',
		name: 'Fusion RNA',
		parent_id: null,
		isleaf: true,
		type: 'dtfusion',
		dt: 2,
		values: {
			Fuserna: { label: 'Fusion transcript' },
			WT: { label: 'Wildtype' }
		},
		name_noOrigin: 'Fusion RNA',
		parentTerm: {
			kind: 'gene',
			id: 'TP53',
			gene: 'TP53',
			name: 'TP53',
			type: 'geneVariant'
		}
	}
]

const customGsQ: GvCustomGsQ = {
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
										kind: 'gene',
										id: 'TP53',
										gene: 'TP53',
										name: 'TP53',
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
										kind: 'gene',
										id: 'TP53',
										gene: 'TP53',
										name: 'TP53',
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
