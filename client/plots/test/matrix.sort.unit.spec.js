import tape from 'tape'
import * as ms from '../matrix.sort'

/*************************
 reusable helper functions
**************************/

const terms = {
	aaa: { name: 'aaa', type: 'geneVariant' },
	bbb: { name: 'bbb', type: 'geneVariant' },
	ccc: { name: 'ccc', type: 'geneVariant' }
}

// return unique copies so that each test does not reuse
// the same data rows that are already sorted in another test
function getArgs(_settings = {}) {
	const samples = {
		1: {
			sample: 1,
			bbb: {
				values: [{ dt: 1, class: 'M' }]
			},
			ccc: {
				values: [{ dt: 1, class: 'M' }]
			}
		},
		2: {
			sample: 2,
			aaa: {
				values: [{ dt: 1, class: 'M' }]
			},
			bbb: {
				values: [{ dt: 1, class: 'M' }]
			}
		},
		3: {
			sample: 3,
			aaa: {
				values: [{ dt: 1, class: 'S' }, { dt: 4, class: 'CNV_loss' }]
			},
			ccc: {
				values: [{ dt: 1, class: 'M' }]
			}
		},
		4: {
			sample: 4,
			ccc: {
				values: [{ dt: 1, class: 'M' }]
			}
		},
		5: {
			sample: 5,
			aaa: {
				values: [{ dt: 1, class: 'M' }]
			},
			bbb: {
				values: [{ dt: 1, class: 'M' }]
			}
		}
	}

	const sg = [
		{
			name: 'Sample Group 1',
			lst: [samples['1'], samples['2'], samples['3']]
		},
		{
			name: 'Sample Group 2',
			lst: [samples['4'], samples['5']]
		}
	]

	const tg = [
		{
			name: 'Term Group 1',
			lst: [{ $id: 'aaa', term: terms.aaa }, { $id: 'bbb', term: terms.bbb }, { $id: 'ccc', term: terms.ccc }]
		}
	]

	const settings = {
		matrix: {
			sortSamplesTieBreakers: [{ $id: 'sample', sortSamples: { by: 'sample' } }],
			sortOptions: ms.getSortOptions(),
			..._settings
		}
	}

	const rows = Object.values(samples)
	return {
		self: {
			app: {
				vocabApi: {}
			},
			config: {
				settings
			},
			termGroups: tg,
			sampleGroups: sg,
			sampleOrder: [
				{
					grp: sg[0],
					grpIndex: 0,
					index: sg[0].lst.findIndex(s => s.sample === 1),
					row: samples['1']
				},
				{
					grp: sg[0],
					grpIndex: 0,
					index: sg[0].lst.findIndex(s => s.sample === 2),
					row: samples['2']
				},
				{
					grp: sg[0],
					grpIndex: 0,
					index: sg[0].lst.findIndex(s => s.sample === 3),
					row: samples['3']
				},
				{
					grp: sg[1],
					grpIndex: 1,
					index: sg[1].lst.findIndex(s => s.sample === 4),
					row: samples['4']
				},
				{
					grp: sg[1],
					grpIndex: 1,
					index: sg[1].lst.findIndex(s => s.sample === 5),
					row: samples['5']
				}
			],
			termOrder: [
				{
					grp: tg[0],
					grpIndex: 0,
					counts: rows.filter(r => 'aaa' in r).length,
					index: tg[0].lst.findIndex(tw => tw.term.name == 'aaa'),
					tw: tg[0].lst.find(tw => tw.term.name == 'aaa')
				},
				{
					grp: tg[0],
					grpIndex: 0,
					counts: rows.filter(r => 'bbb' in r).length,
					index: tg[0].lst.findIndex(tw => tw.term.name == 'bbb'),
					tw: tg[0].lst.find(tw => tw.term.name == 'bbb')
				},
				{
					grp: tg[0],
					grpIndex: 0,
					counts: rows.filter(r => 'ccc' in r).length,
					index: tg[0].lst.findIndex(tw => tw.term.name == 'ccc'),
					tw: tg[0].lst.find(tw => tw.term.name == 'ccc')
				}
			]
		},
		settings: settings.matrix,
		rows: Object.values(samples)
	}
}

function simpleMatrix(sampleNames, termOrder, rows) {
	const lst = []
	for (const sn of sampleNames) lst.push(...sn)
	rows.sort((a, b) => lst.indexOf(a.sample) - lst.indexOf(b.sample))
	const matrix = termOrder.map(() => []) // create an empty array as a matrix row for each term
	for (const r of rows) {
		for (const [i, m] of matrix.entries()) {
			m.push(termOrder[i].tw.$id in r ? `${r.sample}` : ' ')
		}
	}
	return matrix
}

/**************
 test sections
***************/

tape('\n', function(test) {
	test.pass('-***- plots/matrix.sort -***-')
	test.end()
})

tape('sortSamplesBy = asListed', test => {
	const { self, settings, rows } = getArgs({ sortSamplesBy: 'asListed' })
	const sorter = ms.getSampleSorter(self, settings, rows)
	const sampleNames = self.sampleGroups.map(g => g.lst.sort(sorter).map(s => s.sample))
	test.deepEqual(sampleNames, [[1, 2, 3], [4, 5]], 'should sort the samples as listed')

	test.deepEqual(
		simpleMatrix(sampleNames, self.termOrder, rows),
		// prettier-ignore
		[ 
			[ ' ', '2', '3', ' ', '5' ], 
			[ '1', '2', ' ', ' ', '5' ], 
			[ '1', ' ', '3', '4', ' ' ] 
		],
		'should sort sample and rows in the expected order'
	)
	test.end()
})

tape('sortPriority by default custom that uses a filter', test => {
	const { self, settings, rows } = getArgs({
		sortSamplesBy: 'custom'
	})
	const sorter = ms.getSampleSorter(self, settings, rows)
	const sampleNames = self.sampleGroups.map(g => g.lst.sort(sorter).map(s => s.sample))
	test.deepEqual(sampleNames, [[3, 2, 1], [5, 4]], 'should sort the samples by dt then value')
	test.deepEqual(
		simpleMatrix(sampleNames, self.termOrder, rows),
		// prettier-ignore
		[ 
			[ '3', '2', ' ', '5', ' ' ], 
			[ ' ', '2', '1', '5', ' ' ], 
			[ '3', ' ', '1', ' ', '4' ] 
		],
		'should sort sample and rows in the expected order'
	)
	test.end()
})

tape('sortPriority by custom, without filter', test => {
	const { self, settings, rows } = getArgs({
		sortSamplesBy: 'custom',
		sortOptions: {
			custom: {
				value: 'custom',
				sortPriority: [
					{
						types: ['geneVariant'],
						tiebreakers: [
							{
								by: 'dt',
								order: [1] // snvindel, cnv,
								// other dt values will be ordered last
								// for the sorter to not consider certain dt values,
								// need to explicitly not use such values for sorting
								// ignore: [4]
							},
							{
								by: 'class',
								order: [
									// truncating
									'F',
									'N',
									// indel
									'D',
									'I',
									// point
									'M',
									'P',
									'L',
									// noncoding
									'Utr3',
									'Utr5',
									'S',
									'Intron'
								]
							}
						]
					},
					{
						types: ['geneVariant'],
						tiebreakers: [
							{
								by: 'dt',
								order: [4] // snvindel, cnv,
								// other dt values will be ordered last
								// for the sorter to not consider certain dt values,
								// need to explicitly not use such values for sorting
								// ignore: [4]
							},
							{
								by: 'class',
								order: [
									// Lou and JZ wanted samples with CNV to be sorted first??
									'CNV_loss',
									'CNV_amp'
								]
							}
						]
					}
				]
			}
		}
	})
	const sorter = ms.getSampleSorter(self, settings, rows)
	const sampleNames = self.sampleGroups.map(g => g.lst.sort(sorter).map(s => s.sample))
	test.deepEqual(sampleNames, [[2, 3, 1], [5, 4]], 'should sort the samples by dt then value')
	test.deepEqual(
		simpleMatrix(sampleNames, self.termOrder, rows),
		// prettier-ignore
		[ 
			[ '2', '3', ' ', '5', ' ' ], 
			[ '2', ' ', '1', '5', ' ' ], 
			[ ' ', '3', '1', ' ', '4' ] 
		],
		'should sort sample and rows in the expected order'
	)
	test.end()
})

tape('sort against selectedTerms', test => {
	const { self, settings, rows } = getArgs({ sortSamplesBy: 'dt', sortTermsBy: 'hits' })
	self.termGroups[0].lst[1].sortSamples = { by: 'hits' }
	const sorter = ms.getSampleSorter(self, settings, rows)
	const sampleNames = self.sampleGroups.map(g => g.lst.sort(sorter).map(s => s.sample))
	test.deepEqual(sampleNames, [[2, 1, 3], [5, 4]], 'should sort the samples by dt-only')
	test.deepEqual(
		simpleMatrix(sampleNames, self.termOrder, rows),
		// prettier-ignore
		[ 
			[ '2', ' ', '3', '5', ' ' ], 
			[ '2', '1', ' ', '5', ' ' ], 
			[ ' ', '1', '3', ' ', '4' ] 
		],
		'should sort sample and rows in the expected order'
	)
	test.end()
})
