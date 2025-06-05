import tape from 'tape'
import type { GvCustomGsQ, RawGvTW, DtTerm } from '#types'
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

/**************
 test sections
***************/

const vocabApi = await getVocabApi()

tape('\n', function (test) {
	test.pass('-***- tw/geneVariant.integration -***-')
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
	test.deepEqual(fullTw.term.childTerms, childTerms, 'should fill in term.childTerms')
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
				name: 'Excluded categories',
				type: 'filter',
				uncomputable: true,
				filter: { type: 'tvslst', in: true, join: '', lst: [] }
			},
			{
				name: 'Wildtype (somatic)',
				type: 'filter',
				uncomputable: false,
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
								values: [{ key: 'WT', label: 'Wildtype', value: 'WT' }]
							}
						}
					]
				}
			},
			{
				name: 'SNV/indel (somatic)',
				type: 'filter',
				uncomputable: false,
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
								isnot: true
							}
						}
					]
				}
			}
		]
	},
	hiddenValues: {}
}
