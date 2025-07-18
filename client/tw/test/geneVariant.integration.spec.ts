import tape from 'tape'
import type { GvCustomGsQ, RawGvTW, DtTerm } from '#types'
import { vocabInit } from '#termdb/vocabulary'
import { GvBase } from '../geneVariant'
//import { mayMakeGroups } from '../../termsetting/handlers/geneVariant.ts'

/*************************
 reusable helper functions
**************************/

async function getVocabApi() {
	const vocabApi = vocabInit({ state: { vocab: { genome: 'hg38-test', dslabel: 'TermdbTest' } } })
	if (!vocabApi) throw 'vocabApi is missing'
	await vocabApi.getTermdbConfig()
	return vocabApi
}

/**************
 test sections
***************/

const vocabApi: any = await getVocabApi()

tape('\n', function (test) {
	test.comment('-***- tw/geneVariant.integration -***-')
	test.end()
})

tape('fill() invalid tw', async test => {
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

tape('fill() valid tw', async test => {
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
	test.equal(fullTw.type, 'GvValuesTW', 'should fill in tw.type=GvValuesTW')
	const expectedQ = {
		isAtomic: true,
		type: 'values',
		hiddenValues: {}
	}
	test.deepEqual(fullTw.q, expectedQ, 'should fill in q')
	test.deepEqual(fullTw.term.groupsetting, { disabled: false }, 'should fill in term.groupsetting')
	test.end()
})

tape('fill() tw with defaultQ', async test => {
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
	const defaultQ = { type: 'custom-groupset' }
	const fullTw = await GvBase.fill(tw, { vocabApi, defaultQ })
	test.equal(fullTw.type, 'GvCustomGsTW', 'should fill in tw.type=GvCustomGsTW')
	test.deepEqual(fullTw.q, customGsQ, 'should fill in q with custom groupset')
	test.deepEqual(fullTw.term.groupsetting, { disabled: false }, 'should fill in term.groupsetting')
	test.deepEqual(fullTw.term.childTerms, childTerms, 'should fill in term.childTerms')
	test.end()
})

/*tape('mayMakeGroups: fills groups', async test => {
	const tw: any = {
		q: { type: 'custom-groupset' },
		term: {
			kind: 'gene',
			id: 'TP53',
			gene: 'TP53',
			name: 'TP53',
			type: 'geneVariant'
		}
	}
	await mayMakeGroups(tw, vocabApi)
	test.equal(tw.q.customset.groups.length, 2, 'Should create 2 groups')
	const grp1 = tw.q.customset.groups[0]
	const grp2 = tw.q.customset.groups[1]
	test.equal(grp1.name, 'SNV/indel Wildtype (somatic)', 'Group 1 should have correct name')
	test.equal(grp2.name, 'SNV/indel Mutated (somatic)', 'Group 2 should have correct name')
	test.equal(grp1.filter.lst.length, 1, 'Group 1 filter.lst should have 1 item')
	test.equal(grp2.filter.lst.length, 1, 'Group 2 filter.lst should have 1 item')
	const grp1Item = grp1.filter.lst[0]
	const grp2Item = grp2.filter.lst[0]
	test.equal(grp1Item.type, 'tvs', 'Group 1 filter item should be a tvs')
	test.equal(grp2Item.type, 'tvs', 'Group 2 filter item should be a tvs')
	test.equal(grp1Item.tvs.values.length, 1, 'Group 1 tvs.values should have a single value')
	test.equal(grp2Item.tvs.values.length, 1, 'Group 2 tvs.values should have a single value')
	const grp1Value = grp1Item.tvs.values[0]
	const grp2Value = grp2Item.tvs.values[0]
	test.deepEqual(grp1Value, { key: 'WT', label: 'Wildtype', value: 'WT' }, 'Group 1 value should be a wildtype object')
	test.deepEqual(grp2Value, { key: 'WT', label: 'Wildtype', value: 'WT' }, 'Group 2 value should be a wildtype object')
	test.false(grp1Item.tvs.isnot, 'Group 1 tvs.isnot should be undefined')
	test.true(grp2Item.tvs.isnot, 'Group 2 tvs.isnot should be true')
	test.end()
})

tape('mayMakeGroups: does nothing if groups already present', async test => {
	const grp1 = { name: 'existing' }
	const tw: any = {
		q: { type: 'custom-groupset', customset: { groups: [grp1] } },
		term: {
			kind: 'gene',
			id: 'TP53',
			gene: 'TP53',
			name: 'TP53',
			type: 'geneVariant'
		}
	}
	await mayMakeGroups(tw, vocabApi)
	test.equal(tw.q.customset.groups.length, 1, 'Number of groups should be 1')
	test.deepEqual(tw.q.customset.groups[0], grp1, 'Group 1 should equal grp1')
	test.end()
})

tape('mayMakeGroups: does nothing if q.type != custom-groupset', async test => {
	const tw: any = {
		q: {},
		term: {
			kind: 'gene',
			id: 'TP53',
			gene: 'TP53',
			name: 'TP53',
			type: 'geneVariant'
		}
	}
	const originalTw = structuredClone(tw)
	await mayMakeGroups(tw, vocabApi)
	test.deepEqual(tw, originalTw, 'tw should not change')
	test.end()
})*/

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
			type: 'geneVariant',
			groupsetting: { disabled: false }
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
			type: 'geneVariant',
			groupsetting: { disabled: false }
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
			type: 'geneVariant',
			groupsetting: { disabled: false }
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
			type: 'geneVariant',
			groupsetting: { disabled: false }
		}
	}
]

const customGsQ: GvCustomGsQ = {
	isAtomic: true,
	type: 'custom-groupset',
	customset: {
		groups: [
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
										type: 'geneVariant',
										groupsetting: { disabled: false }
									}
								},
								values: [{ key: 'WT', label: 'Wildtype', value: 'WT' }],
								excludeGeneName: true
							}
						}
					]
				},
				color: '#1b9e77'
			},
			{
				name: 'SNV/indel Mutated (somatic)',
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
										type: 'geneVariant',
										groupsetting: { disabled: false }
									}
								},
								values: [{ key: 'WT', label: 'Wildtype', value: 'WT' }],
								isnot: true,
								excludeGeneName: true
							}
						}
					]
				},
				color: '#d95f02'
			}
		]
	},
	hiddenValues: {}
}
