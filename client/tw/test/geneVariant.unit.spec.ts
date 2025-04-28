import tape from 'tape'
import type { GvCustomGsQ, RawGvTW, TermFilter } from '#types'
import { vocabInit } from '#termdb/vocabulary'
import { TermdbVocab } from '#termdb/TermdbVocab'
import { GvBase } from '../geneVariant'

/*************************
 reusable helper functions
**************************/

function getVocabApi() {
	const vocabApi = vocabInit({ state: { vocab: { genome: 'hg38-test', dslabel: 'TermdbTest' } } })
	if (!vocabApi) throw 'vocabApi is missing'
	if (!(vocabApi instanceof TermdbVocab)) throw 'vocabApi is not instance of TermdbVocab'
	// mock termdb config to avoid making a server request
	vocabApi.termdbConfig = {
		queries: {
			snvindel: {},
			cnv: {},
			svfusion: {}
		},
		assayAvailability: {
			byDt: {
				1: {
					byOrigin: {
						germline: {},
						somatic: {}
					}
				},
				2: {},
				4: {}
			}
		},
		customTwQByType: {
			geneVariant: {
				default: { cnvGainCutoff: 0.1, cnvLossCutoff: -0.1, cnvMaxLength: 0 }
			}
		}
	}
	return vocabApi
}

/**************
 test sections
***************/

const vocabApi = getVocabApi()

tape('\n', function (test) {
	test.pass('-***- tw/geneVariant.unit -***-')
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
		cnvGainCutoff: 0.1,
		cnvLossCutoff: -0.1,
		cnvMaxLength: 0,
		hiddenValues: {}
	}
	test.deepEqual(fullTw.q, expectedQ, 'should fill in q')
	test.deepEqual(fullTw.term.groupsetting, { disabled: false }, 'should fill in term.groupsetting')
	test.deepEqual(fullTw.term.filter, termFilter, 'should fill in term.filter')
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
	test.deepEqual(fullTw.term.filter, termFilter, 'should fill in term.filter')
	test.end()
})

/**********
 variables
***********/

const termFilter: TermFilter = {
	opts: { joinWith: ['and', 'or'] },
	terms: [
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
			origin: 'somatic'
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
			origin: 'germline'
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
			name_noOrigin: 'CNV'
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
			name_noOrigin: 'Fusion RNA'
		}
	]
}

const customGsQ: GvCustomGsQ = {
	isAtomic: true,
	type: 'custom-groupset',
	cnvGainCutoff: 0.1,
	cnvLossCutoff: -0.1,
	cnvMaxLength: 0,
	customset: {
		groups: [
			{
				name: 'Excluded categories',
				type: 'filter',
				uncomputable: true,
				filter: {
					opts: { joinWith: ['and', 'or'] },
					terms: [
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
							origin: 'somatic'
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
							origin: 'germline'
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
							name_noOrigin: 'CNV'
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
							name_noOrigin: 'Fusion RNA'
						}
					],
					group: 0,
					active: { type: 'tvslst', in: true, join: '', lst: [] }
				}
			},
			{
				name: 'SNV/indel (somatic)',
				type: 'filter',
				uncomputable: false,
				filter: {
					opts: { joinWith: ['and', 'or'] },
					terms: [
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
							origin: 'somatic'
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
							origin: 'germline'
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
							name_noOrigin: 'CNV'
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
							name_noOrigin: 'Fusion RNA'
						}
					],
					group: 1,
					active: {
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
										origin: 'somatic'
									},
									values: [{ key: 'WT', label: 'Wildtype', value: 'WT' }],
									isnot: true
								}
							}
						]
					}
				}
			},
			{
				name: 'Wildtype (somatic)',
				type: 'filter',
				uncomputable: false,
				filter: {
					opts: { joinWith: ['and', 'or'] },
					terms: [
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
							origin: 'somatic'
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
							origin: 'germline'
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
							name_noOrigin: 'CNV'
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
							name_noOrigin: 'Fusion RNA'
						}
					],
					group: 2,
					active: {
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
										origin: 'somatic'
									},
									values: [{ key: 'WT', label: 'Wildtype', value: 'WT' }]
								}
							}
						]
					}
				}
			}
		]
	},
	hiddenValues: {}
}
