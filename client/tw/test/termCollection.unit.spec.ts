import tape from 'tape'
import { vocabInit } from '#termdb/vocabulary'
import { CollectionCont } from '../termCollection'

/**************************************************************
 * TEST SUITE: tw/termCollection.unit
 *
 * This file contains unit tests for term collection classes:
 * - CollectionCont: Continuous/numeric term collections
 * - CollectionQual: Qualitative/categorical term collections
 * - CollectionBase: Base class and routing logic
 * - NumericTermCollection: Numeric term collection model
 * - QualTermCollection: Qualitative term collection model
 *
 * TABLE OF CONTENTS:
 * ==================
 *
 * CollectionCont.transformData() Tests:
 *   1. transformData with positive values only
 *   2. transformData with negative values only
 *   3. transformData with mixed positive and negative values
 *   4. transformData with equal positive and negative values
 *
 * QualTermCollection.fill() Tests:
 *   5. exact name match fills term from config
 *   6. name with suffix does NOT match collection
 *   7. no config match but termlst present proceeds without error
 *   8. no config match and no termlst throws
 *
 * CollectionQual.fill() Tests:
 *   9. initializes q when absent
 *  10. applies defaults to partial q
 *  11. copies categoryKeys from term to q
 *  12. does not overwrite existing q.categoryKeys
 *
 * CollectionQual.getMinCopy() Tests:
 *  13. returns essential fields without termlst
 *
 * CollectionCont.transformData() with valueTransform Tests:
 *  14. valueTransform offset - positive offset
 *  15. valueTransform offset - negative offset
 *  16. valueTransform offset - converts positive to zero
 *  17. valueTransform offset - converts positive to negative
 *
 * CollectionCont.getMinCopy() Tests:
 *  18. includes valueTransform
 *  19. includes numerators
 *
 * CollectionCont.transformData() numerators Tests:
 *  20. calculates numerators_sum correctly
 *  21. calculates numerators_sum with negative values
 *
 * CollectionCont.fill() Tests:
 *  22. initializes q when absent
 *  23. applies defaults to partial q
 *  24. does not overwrite existing numerators
 *
 * NumericTermCollection.fill() Tests:
 *  25. fills from config
 *  26. derives termIds from termlst when termlst exists but no config match
 *  27. throws when no config match and no termlst
 *
 * NumericTermCollection.validate() Tests:
 *  28. validates term type
 *  29. validates term is object
 *
 * CollectionBase.fill() Tests:
 *  30. infers type from config when type is missing
 *  31. routes to CollectionCont for TermCollectionTWCont
 *  32. routes to CollectionQual for TermCollectionTWQual
 *  33. throws for unknown collection name
 *  34. throws for unexpected tw.type
 *
 **************************************************************/

/*************************
 reusable helper functions
**************************/

const vocabApi = await vocabInit({ state: { vocab: { genome: 'hg38-test', dslabel: 'TermdbTest' } } })
if (!vocabApi) console.log(`!!! missing vocabApi !!!`)

// // Type for data object after transformData() is called
// type TransformedData = {
// 	values: TermCollectionTransformedValue[]
// 	numerators_sum: number
// 	hasMixedValues: boolean
// }

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- tw/termCollection.unit -***-')
	test.end()
})

tape('transformData with positive values only', async test => {
	const tw = new CollectionCont(
		{
			type: 'TermCollectionTWCont',
			term: {
				type: 'termCollection',
				memberType: 'numeric',
				id: 'test',
				name: 'Test Collection',
				termlst: [],
				propsByTermId: {
					sig1: { color: 'red' },
					sig2: { color: 'blue' }
				}
			},
			q: {
				mode: 'continuous',
				type: 'values',
				lst: []
			}
		},
		{ vocabApi }
	)

	const data: any = {
		value: {
			sig1: 30,
			sig2: 70
		}
	}

	tw.transformData(data)

	test.equal(data.hasMixedValues, false, 'should not have mixed values')
	test.equal(data.values.length, 2, 'should have 2 values')
	test.equal(data.values[0].value, 30, 'sig1 should be 30%')
	test.equal(data.values[0].pre_val_sum, 0, 'sig1 pre_val_sum should be 0')
	test.equal(data.values[1].value, 70, 'sig2 should be 70%')
	test.equal(data.values[1].pre_val_sum, 30, 'sig2 pre_val_sum should be 30')
	test.end()
})

tape('transformData with negative values only', async test => {
	const tw = new CollectionCont(
		{
			type: 'TermCollectionTWCont',
			term: {
				type: 'termCollection',
				memberType: 'numeric',
				id: 'test',
				name: 'Test Collection',
				termlst: [],
				propsByTermId: {
					sig1: { color: 'red' },
					sig2: { color: 'blue' }
				}
			},
			q: {
				mode: 'continuous',
				type: 'values',
				lst: []
			}
		},
		{ vocabApi }
	)

	const data: any = {
		value: {
			sig1: -30,
			sig2: -70
		}
	}

	tw.transformData(data)

	test.equal(data.hasMixedValues, false, 'should not have mixed values (only negative)')
	test.equal(data.values.length, 2, 'should have 2 values')
	test.equal(data.values[0].value, -30, 'sig1 should be -30%')
	test.equal(data.values[0].pre_val_sum, 0, 'sig1 pre_val_sum should be 0')
	test.equal(data.values[1].value, -70, 'sig2 should be -70%')
	test.equal(data.values[1].pre_val_sum, -30, 'sig2 pre_val_sum should be -30')
	test.end()
})

tape('transformData with mixed positive and negative values', async test => {
	const tw = new CollectionCont(
		{
			type: 'TermCollectionTWCont',
			term: {
				type: 'termCollection',
				memberType: 'numeric',
				id: 'test',
				name: 'Test Collection',
				termlst: [],
				propsByTermId: {
					sig1: { color: 'red' },
					sig2: { color: 'blue' },
					sig3: { color: 'green' }
				}
			},
			q: {
				mode: 'continuous',
				type: 'values',
				lst: []
			}
		},
		{ vocabApi }
	)

	const data: any = {
		value: {
			sig1: 60,
			sig2: 40,
			sig3: -50
		}
	}

	tw.transformData(data)

	test.equal(data.hasMixedValues, true, 'should have mixed values')
	test.equal(data.values.length, 3, 'should have 3 values')

	// With absolute sum calculation: |60| + |40| + |-50| = 150
	// sig1: 60/150 * 100 = 40%
	// sig2: 40/150 * 100 = 26.67%
	// sig3: -50/150 * 100 = -33.33%

	// Find positive values
	const positiveValues = data.values.filter(v => v.value > 0)
	test.equal(positiveValues.length, 2, 'should have 2 positive values')
	test.ok(Math.abs(positiveValues[0].value - 40) < 0.01, 'sig1 should be ~40%')
	test.equal(positiveValues[0].pre_val_sum, 0, 'sig1 pre_val_sum should be 0')
	test.ok(Math.abs(positiveValues[1].value - 26.67) < 0.01, 'sig2 should be ~26.67%')
	test.ok(Math.abs(positiveValues[1].pre_val_sum - 40) < 0.01, 'sig2 pre_val_sum should be ~40')

	// Find negative values
	const negativeValues = data.values.filter(v => v.value < 0)
	test.equal(negativeValues.length, 1, 'should have 1 negative value')
	test.ok(Math.abs(negativeValues[0].value - -33.33) < 0.01, 'sig3 should be ~-33.33%')
	test.equal(negativeValues[0].pre_val_sum, 0, 'sig3 pre_val_sum should be 0')
	test.end()
})

tape('transformData with equal positive and negative values', async test => {
	const tw = new CollectionCont(
		{
			type: 'TermCollectionTWCont',
			term: {
				type: 'termCollection',
				memberType: 'numeric',
				id: 'test',
				name: 'Test Collection',
				termlst: [],
				propsByTermId: {
					enrich1: { color: 'red' },
					enrich2: { color: 'orange' },
					deplete1: { color: 'blue' },
					deplete2: { color: 'cyan' }
				}
			},
			q: {
				mode: 'continuous',
				type: 'values',
				lst: []
			}
		},
		{ vocabApi }
	)

	const data: any = {
		value: {
			enrich1: 30,
			enrich2: 20,
			deplete1: -25,
			deplete2: -25
		}
	}

	tw.transformData(data)

	test.equal(data.hasMixedValues, true, 'should have mixed values')
	test.equal(data.values.length, 4, 'should have 4 values')

	// With absolute sum: |30| + |20| + |-25| + |-25| = 100
	// enrich1: 30/100 * 100 = 30%
	// enrich2: 20/100 * 100 = 20%
	// deplete1: -25/100 * 100 = -25%
	// deplete2: -25/100 * 100 = -25%

	// Check positive values sum to 50%
	const positiveSum = data.values.filter(v => v.value > 0).reduce((sum, v) => sum + v.value, 0)
	test.equal(positiveSum, 50, 'positive values should sum to 50%')

	// Check negative values sum to -50%
	const negativeSum = data.values.filter(v => v.value < 0).reduce((sum, v) => sum + v.value, 0)
	test.equal(negativeSum, -50, 'negative values should sum to -50%')
	test.end()
})

// Minimal vocabApi stub for QualTermCollection.fill() tests
const mockVocabApi = {
	termdbConfig: {
		termCollections: [
			{
				name: 'Assay Availability',
				termIds: ['t1', 't2'],
				termlst: [
					{ id: 't1', name: 'CNV availability' },
					{ id: 't2', name: 'Fusion availability' }
				],
				propsByTermId: { t1: { color: 'blue' }, t2: { color: 'red' } },
				categoryKeys: []
			}
		]
	}
}

tape('QualTermCollection.fill() - exact name match fills term from config', async test => {
	const { QualTermCollection } = await import('../collection/QualTermCollection')
	const term: any = { type: 'termCollection', name: 'Assay Availability', memberType: 'categorical' }
	QualTermCollection.fill(term, { vocabApi: mockVocabApi as any })
	test.equal(term.termlst?.length, 2, 'termlst populated from config')
	test.equal(term.termIds?.length, 2, 'termIds set from termlst')
	test.deepEqual(term.propsByTermId, mockVocabApi.termdbConfig.termCollections[0].propsByTermId, 'propsByTermId set')
	test.end()
})

tape('QualTermCollection.fill() - name with suffix does NOT match collection', async test => {
	const { QualTermCollection } = await import('../collection/QualTermCollection')
	const term: any = { type: 'termCollection', name: 'Assay Availability (3)', memberType: 'categorical' }
	test.throws(
		() => QualTermCollection.fill(term, { vocabApi: mockVocabApi as any }),
		/no matching termCollection/,
		'should throw when name has suffix and no termlst fallback'
	)
	test.end()
})

tape('QualTermCollection.fill() - no config match but termlst present proceeds without error', async test => {
	const { QualTermCollection } = await import('../collection/QualTermCollection')
	const term: any = {
		type: 'termCollection',
		name: 'Unknown Collection',
		memberType: 'categorical',
		termlst: [{ id: 't1', name: 'CNV availability' }]
	}
	test.doesNotThrow(
		() => QualTermCollection.fill(term, { vocabApi: mockVocabApi as any }),
		'should not throw when no config match but termlst is provided'
	)
	test.equal(term.termIds?.length, 1, 'termIds derived from termlst')
	test.end()
})

tape('QualTermCollection.fill() - no config match and no termlst throws', async test => {
	const { QualTermCollection } = await import('../collection/QualTermCollection')
	const term: any = { type: 'termCollection', name: 'Unknown Collection', memberType: 'categorical' }
	test.throws(
		() => QualTermCollection.fill(term, { vocabApi: mockVocabApi as any }),
		/no matching termCollection/,
		'should throw when no config match and no termlst'
	)
	test.end()
})

function getRawCategoricalTw(termOverrides: any = {}, twOverrides: any = {}) {
	return {
		term: {
			type: 'termCollection',
			name: 'Assay Availability',
			memberType: 'categorical',
			...termOverrides
		},
		...twOverrides
	}
}

tape('CollectionQual.fill() - initializes q when absent', async test => {
	const { CollectionQual } = await import('../collection/CollectionQual')
	const tw: any = getRawCategoricalTw()
	CollectionQual.fill(tw, { vocabApi: mockVocabApi as any })
	test.equal(tw.type, 'TermCollectionTWQual', 'tw.type set')
	test.equal(tw.q.mode, 'discrete', 'q.mode defaults to discrete')
	test.equal(tw.q.type, 'values', 'q.type defaults to values')
	test.deepEqual(tw.q.lst, ['t1', 't2'], 'q.lst defaults to termIds from config')
	test.end()
})

tape('CollectionQual.fill() - applies defaults to partial q', async test => {
	const { CollectionQual } = await import('../collection/CollectionQual')
	const tw: any = { ...getRawCategoricalTw(), q: { type: 'values' } }
	CollectionQual.fill(tw, { vocabApi: mockVocabApi as any })
	test.equal(tw.q.mode, 'discrete', 'missing q.mode defaults to discrete')
	test.deepEqual(tw.q.lst, ['t1', 't2'], 'missing q.lst set from term.termIds')
	test.end()
})

tape('CollectionQual.fill() - copies categoryKeys from term to q', async test => {
	const { CollectionQual } = await import('../collection/CollectionQual')
	const categoryKeys = [{ key: '1', shown: true }]
	const tw: any = getRawCategoricalTw({ categoryKeys })
	CollectionQual.fill(tw, { vocabApi: mockVocabApi as any })
	test.deepEqual(tw.q.categoryKeys, categoryKeys, 'categoryKeys copied from term to q')
	test.end()
})

tape('CollectionQual.fill() - does not overwrite existing q.categoryKeys', async test => {
	const { CollectionQual } = await import('../collection/CollectionQual')
	const existing = [{ key: 'X', shown: false }]
	const tw: any = {
		...getRawCategoricalTw({ categoryKeys: [{ key: '1', shown: true }] }),
		q: { categoryKeys: existing }
	}
	CollectionQual.fill(tw, { vocabApi: mockVocabApi as any })
	test.deepEqual(tw.q.categoryKeys, existing, 'existing q.categoryKeys preserved')
	test.end()
})

tape('CollectionQual.getMinCopy() - returns essential fields without termlst', async test => {
	const { CollectionQual } = await import('../collection/CollectionQual')
	const tw: any = getRawCategoricalTw()
	CollectionQual.fill(tw, { vocabApi: mockVocabApi as any })
	const handler = new CollectionQual(tw, { vocabApi: mockVocabApi as any })
	const copy = handler.getMinCopy()
	test.equal(copy.term.type, 'termCollection', 'copy.term.type preserved')
	test.equal(copy.term.name, 'Assay Availability', 'copy.term.name preserved')
	test.equal(copy.term.memberType, 'categorical', 'copy.term.memberType preserved')
	test.deepEqual(copy.term.termIds, ['t1', 't2'], 'copy.term.termIds derived from termlst')
	test.notOk('termlst' in copy.term, 'termlst excluded from min copy')
	test.equal(copy.q.mode, 'discrete', 'copy.q.mode preserved')
	test.notOk('isAtomic' in copy.q, 'isAtomic stripped from q')
	test.end()
})

// ====== Tests for valueTransform feature ======
tape('transformData with valueTransform offset - positive offset', async test => {
	const tw = new CollectionCont(
		{
			type: 'TermCollectionTWCont',
			term: {
				type: 'termCollection',
				memberType: 'numeric',
				id: 'test',
				name: 'Test Collection',
				termlst: [],
				propsByTermId: {
					sig1: { color: 'red' },
					sig2: { color: 'blue' }
				},
				valueTransform: { offset: 10 }
			},
			q: {
				mode: 'continuous',
				type: 'values',
				lst: []
			}
		},
		{ vocabApi }
	)

	const data: any = {
		value: {
			sig1: 30,
			sig2: 70
		}
	}

	tw.transformData(data)

	// With offset +10: sig1 becomes 40, sig2 becomes 80
	// Total: 120, so percentages are sig1: 33.33%, sig2: 66.67%
	test.equal(data.values.length, 2, 'should have 2 values')
	test.ok(Math.abs(data.values[0].value - 33.33) < 0.01, 'sig1 should be ~33.33% after offset')
	test.ok(Math.abs(data.values[1].value - 66.67) < 0.01, 'sig2 should be ~66.67% after offset')
	test.end()
})

tape('transformData with valueTransform offset - negative offset', async test => {
	const tw = new CollectionCont(
		{
			type: 'TermCollectionTWCont',
			term: {
				type: 'termCollection',
				memberType: 'numeric',
				id: 'test',
				name: 'Test Collection',
				termlst: [],
				propsByTermId: {
					sig1: { color: 'red' },
					sig2: { color: 'blue' }
				},
				valueTransform: { offset: -5 }
			},
			q: {
				mode: 'continuous',
				type: 'values',
				lst: []
			}
		},
		{ vocabApi }
	)

	const data: any = {
		value: {
			sig1: 30,
			sig2: 70
		}
	}

	tw.transformData(data)

	// With offset -5: sig1 becomes 25, sig2 becomes 65
	// Total: 90, so percentages are sig1: 27.78%, sig2: 72.22%
	test.equal(data.values.length, 2, 'should have 2 values')
	test.ok(Math.abs(data.values[0].value - 27.78) < 0.01, 'sig1 should be ~27.78% after negative offset')
	test.ok(Math.abs(data.values[1].value - 72.22) < 0.01, 'sig2 should be ~72.22% after negative offset')
	test.end()
})

tape('transformData with valueTransform offset - converts positive to zero', async test => {
	const tw = new CollectionCont(
		{
			type: 'TermCollectionTWCont',
			term: {
				type: 'termCollection',
				memberType: 'numeric',
				id: 'test',
				name: 'Test Collection',
				termlst: [],
				propsByTermId: {
					sig1: { color: 'red' },
					sig2: { color: 'blue' }
				},
				valueTransform: { offset: -30 }
			},
			q: {
				mode: 'continuous',
				type: 'values',
				lst: []
			}
		},
		{ vocabApi }
	)

	const data: any = {
		value: {
			sig1: 30, // becomes 0 after offset
			sig2: 70 // becomes 40 after offset
		}
	}

	tw.transformData(data)

	// sig1 becomes 0 and should be filtered out
	test.equal(data.values.length, 1, 'should have 1 value (zero value filtered out)')
	test.equal(data.values[0].label, 'sig2', 'only sig2 should remain')
	test.equal(data.values[0].value, 100, 'sig2 should be 100% when sig1 is zero')
	test.end()
})

tape('transformData with valueTransform offset - converts positive to negative', async test => {
	const tw = new CollectionCont(
		{
			type: 'TermCollectionTWCont',
			term: {
				type: 'termCollection',
				memberType: 'numeric',
				id: 'test',
				name: 'Test Collection',
				termlst: [],
				propsByTermId: {
					sig1: { color: 'red' },
					sig2: { color: 'blue' }
				},
				valueTransform: { offset: -80 }
			},
			q: {
				mode: 'continuous',
				type: 'values',
				lst: []
			}
		},
		{ vocabApi }
	)

	const data: any = {
		value: {
			sig1: 30, // becomes -50 after offset
			sig2: 70 // becomes -10 after offset
		}
	}

	tw.transformData(data)

	// Both become negative
	test.equal(data.values.length, 2, 'should have 2 values')
	test.equal(data.hasMixedValues, false, 'should not have mixed values (all negative)')
	test.ok(data.values[0].value < 0, 'first value should be negative')
	test.ok(data.values[1].value < 0, 'second value should be negative')
	test.end()
})

tape('CollectionCont.getMinCopy() - includes valueTransform', async test => {
	const tw = new CollectionCont(
		{
			type: 'TermCollectionTWCont',
			term: {
				type: 'termCollection',
				memberType: 'numeric',
				id: 'test',
				name: 'Test Collection',
				termlst: [
					{ id: 'sig1', name: 'Signature 1', type: 'float' },
					{ id: 'sig2', name: 'Signature 2', type: 'float' }
				],
				propsByTermId: {
					sig1: { color: 'red' },
					sig2: { color: 'blue' }
				},
				valueTransform: { offset: 10 }
			},
			q: {
				mode: 'continuous',
				type: 'values',
				lst: []
			}
		},
		{ vocabApi }
	)

	const copy = tw.getMinCopy()

	test.ok(copy.term.valueTransform, 'valueTransform should be included in copy')
	test.equal(copy.term.valueTransform.offset, 10, 'valueTransform offset should be preserved')
	test.notOk('termlst' in copy.term, 'termlst should not be in min copy')
	test.deepEqual(copy.term.termIds, ['sig1', 'sig2'], 'termIds should be derived from termlst')
	test.end()
})

tape('CollectionCont.getMinCopy() - includes numerators', async test => {
	const tw = new CollectionCont(
		{
			type: 'TermCollectionTWCont',
			term: {
				type: 'termCollection',
				memberType: 'numeric',
				id: 'test',
				name: 'Test Collection',
				termlst: [
					{ id: 'sig1', name: 'Signature 1', type: 'float' },
					{ id: 'sig2', name: 'Signature 2', type: 'float' }
				],
				propsByTermId: {},
				numerators: ['sig1']
			},
			q: {
				mode: 'continuous',
				type: 'values',
				lst: []
			}
		},
		{ vocabApi }
	)

	const copy = tw.getMinCopy()

	test.ok(copy.term.numerators, 'numerators should be included in copy')
	test.deepEqual(copy.term.numerators, ['sig1'], 'numerators should be preserved')
	test.end()
})

// ====== Tests for numerators handling ======
tape('transformData calculates numerators_sum correctly', async test => {
	const tw = new CollectionCont(
		{
			type: 'TermCollectionTWCont',
			term: {
				type: 'termCollection',
				memberType: 'numeric',
				id: 'test',
				name: 'Test Collection',
				termlst: [],
				propsByTermId: {
					sig1: { color: 'red' },
					sig2: { color: 'blue' },
					sig3: { color: 'green' }
				}
			},
			q: {
				mode: 'continuous',
				type: 'values',
				lst: [],
				numerators: ['sig1', 'sig3'] // Only sig1 and sig3 are numerators
			}
		},
		{ vocabApi }
	)

	const data: any = {
		value: {
			sig1: 30,
			sig2: 40,
			sig3: 30
		}
	}

	tw.transformData(data)

	// sig1: 30%, sig2: 40%, sig3: 30%
	// numerators_sum should be sig1 + sig3 = 30 + 30 = 60
	test.equal(data.values.length, 3, 'should have 3 values')
	test.equal(data.numerators_sum, 60, 'numerators_sum should be 60 (sig1 + sig3)')
	test.end()
})

tape('transformData calculates numerators_sum with negative values', async test => {
	const tw = new CollectionCont(
		{
			type: 'TermCollectionTWCont',
			term: {
				type: 'termCollection',
				memberType: 'numeric',
				id: 'test',
				name: 'Test Collection',
				termlst: [],
				propsByTermId: {
					enrich: { color: 'red' },
					deplete: { color: 'blue' }
				}
			},
			q: {
				mode: 'continuous',
				type: 'values',
				lst: [],
				numerators: ['enrich'] // Only enrich is numerator
			}
		},
		{ vocabApi }
	)

	const data: any = {
		value: {
			enrich: 50,
			deplete: -50
		}
	}

	tw.transformData(data)

	// enrich: 50%, deplete: -50%
	// numerators_sum should be 50 (only enrich)
	test.equal(data.hasMixedValues, true, 'should have mixed values')
	test.equal(data.numerators_sum, 50, 'numerators_sum should be 50 (only enrich)')
	test.end()
})

// ====== Tests for CollectionCont.fill() ======
const mockNumericVocabApi = {
	termdbConfig: {
		termCollections: [
			{
				name: 'Test Numeric Collection',
				type: 'numeric',
				termIds: ['t1', 't2'],
				termlst: [
					{ id: 't1', name: 'Term 1', type: 'float' },
					{ id: 't2', name: 'Term 2', type: 'float' }
				],
				propsByTermId: { t1: { color: 'red' }, t2: { color: 'blue' } }
			}
		]
	}
}

tape('CollectionCont.fill() - initializes q when absent', async test => {
	const tw: any = {
		term: {
			type: 'termCollection',
			name: 'Test Numeric Collection',
			memberType: 'numeric'
		}
	}
	CollectionCont.fill(tw, { vocabApi: mockNumericVocabApi as any })
	test.equal(tw.type, 'TermCollectionTWCont', 'tw.type set')
	test.equal(tw.q.mode, 'continuous', 'q.mode defaults to continuous')
	test.equal(tw.q.type, 'values', 'q.type defaults to values')
	test.deepEqual(tw.q.lst, [], 'q.lst defaults to empty array')
	test.equal(tw.q.numerators, undefined, 'q.numerators is not set when q is newly created')
	test.end()
})

tape('CollectionCont.fill() - applies defaults to partial q', async test => {
	const tw: any = {
		term: {
			type: 'termCollection',
			name: 'Test Numeric Collection',
			memberType: 'numeric'
		},
		q: { type: 'values' }
	}
	CollectionCont.fill(tw, { vocabApi: mockNumericVocabApi as any })
	test.equal(tw.q.mode, 'continuous', 'missing q.mode defaults to continuous')
	test.deepEqual(tw.q.lst, [], 'missing q.lst defaults to empty array')
	test.deepEqual(tw.q.numerators, ['t1', 't2'], 'missing q.numerators defaults to termIds')
	test.end()
})

tape('CollectionCont.fill() - does not overwrite existing numerators', async test => {
	const tw: any = {
		term: {
			type: 'termCollection',
			name: 'Test Numeric Collection',
			memberType: 'numeric'
		},
		q: {
			mode: 'continuous',
			type: 'values',
			lst: [],
			numerators: ['t1'] // Only t1
		}
	}
	CollectionCont.fill(tw, { vocabApi: mockNumericVocabApi as any })
	test.deepEqual(tw.q.numerators, ['t1'], 'existing q.numerators preserved')
	test.end()
})

// ====== Tests for NumericTermCollection ======
tape('NumericTermCollection.fill() - fills from config', async test => {
	const { NumericTermCollection } = await import('../collection/NumericTermCollection')
	const term: any = { type: 'termCollection', name: 'Test Numeric Collection', memberType: 'numeric' }
	NumericTermCollection.fill(term, { vocabApi: mockNumericVocabApi as any })
	test.equal(term.termlst?.length, 2, 'termlst populated from config')
	test.equal(term.termIds?.length, 2, 'termIds set from termlst')
	test.deepEqual(
		term.propsByTermId,
		mockNumericVocabApi.termdbConfig.termCollections[0].propsByTermId,
		'propsByTermId set'
	)
	test.equal(term.memberType, 'numeric', 'memberType set to numeric')
	test.end()
})

tape(
	'NumericTermCollection.fill() - derives termIds from termlst when termlst exists but no config match',
	async test => {
		const { NumericTermCollection } = await import('../collection/NumericTermCollection')
		const term: any = {
			type: 'termCollection',
			name: 'Unknown Collection',
			memberType: 'numeric',
			termlst: [{ id: 't1', name: 'Term 1', type: 'float' }],
			propsByTermId: { t1: { color: 'red' } }
		}
		test.doesNotThrow(
			() => NumericTermCollection.fill(term, { vocabApi: mockNumericVocabApi as any }),
			'should not throw when no config match but termlst is provided'
		)
		test.equal(term.termIds?.length, 1, 'termIds derived from termlst')
		test.equal(term.termIds[0], 't1', 'termId matches termlst id')
		test.end()
	}
)

tape('NumericTermCollection.fill() - throws when no config match and no termlst', async test => {
	const { NumericTermCollection } = await import('../collection/NumericTermCollection')
	const term: any = { type: 'termCollection', name: 'Unknown Collection', memberType: 'numeric' }
	test.throws(
		() => NumericTermCollection.fill(term, { vocabApi: mockNumericVocabApi as any }),
		/no matching termCollection/,
		'should throw when no config match and no termlst'
	)
	test.end()
})

tape('NumericTermCollection.validate() - validates term type', async test => {
	const { NumericTermCollection } = await import('../collection/NumericTermCollection')
	test.throws(
		() => NumericTermCollection.validate({ type: 'wrongType' } as any),
		/incorrect term.type/,
		'should throw when term type is incorrect'
	)
	test.end()
})

tape('NumericTermCollection.validate() - validates term is object', async test => {
	const { NumericTermCollection } = await import('../collection/NumericTermCollection')
	test.throws(
		() => NumericTermCollection.validate('not an object' as any),
		/term is not an object/,
		'should throw when term is not an object'
	)
	test.end()
})

// ====== Tests for CollectionBase ======
tape('CollectionBase.fill() - infers type from config when type is missing', async test => {
	const { CollectionBase } = await import('../collection/CollectionBase')
	const tw: any = {
		term: {
			type: 'termCollection',
			name: 'Test Numeric Collection'
		}
	}
	CollectionBase.fill(tw, { vocabApi: mockNumericVocabApi as any })
	test.equal(tw.type, 'TermCollectionTWCont', 'type inferred as TermCollectionTWCont for numeric collection')
	test.end()
})

tape('CollectionBase.fill() - routes to CollectionCont for TermCollectionTWCont', async test => {
	const { CollectionBase } = await import('../collection/CollectionBase')
	const tw: any = {
		type: 'TermCollectionTWCont',
		term: {
			type: 'termCollection',
			name: 'Test Numeric Collection',
			memberType: 'numeric'
		}
	}
	CollectionBase.fill(tw, { vocabApi: mockNumericVocabApi as any })
	test.equal(tw.type, 'TermCollectionTWCont', 'type remains TermCollectionTWCont')
	test.ok(tw.q, 'q object initialized')
	test.equal(tw.q.mode, 'continuous', 'continuous mode set')
	test.end()
})

tape('CollectionBase.fill() - routes to CollectionQual for TermCollectionTWQual', async test => {
	const { CollectionBase } = await import('../collection/CollectionBase')
	const tw: any = {
		type: 'TermCollectionTWQual',
		term: {
			type: 'termCollection',
			name: 'Assay Availability',
			memberType: 'categorical'
		}
	}
	CollectionBase.fill(tw, { vocabApi: mockVocabApi as any })
	test.equal(tw.type, 'TermCollectionTWQual', 'type remains TermCollectionTWQual')
	test.ok(tw.q, 'q object initialized')
	test.equal(tw.q.mode, 'discrete', 'discrete mode set')
	test.end()
})

tape('CollectionBase.fill() - throws for unknown collection name', async test => {
	const { CollectionBase } = await import('../collection/CollectionBase')
	const tw: any = {
		term: {
			type: 'termCollection',
			name: 'Unknown Collection'
		}
	}
	test.throws(
		() => CollectionBase.fill(tw, { vocabApi: mockNumericVocabApi as any }),
		/no matching termCollection/,
		'should throw when collection name not found in config'
	)
	test.end()
})

tape('CollectionBase.fill() - throws for unexpected tw.type', async test => {
	const { CollectionBase } = await import('../collection/CollectionBase')
	const tw: any = {
		type: 'UnexpectedType',
		term: {
			type: 'termCollection',
			name: 'Test Numeric Collection'
		}
	}
	test.throws(
		() => CollectionBase.fill(tw, { vocabApi: mockNumericVocabApi as any }),
		/unexpected collection tw.type/,
		'should throw for unexpected tw.type'
	)
	test.end()
})
