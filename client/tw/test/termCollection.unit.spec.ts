import tape from 'tape'
import { vocabInit } from '#termdb/vocabulary'
import { TermCollectionValues, type TermCollectionTransformedValue } from '../termCollection'

/*************************
 reusable helper functions
**************************/

const vocabApi = await vocabInit({ state: { vocab: { genome: 'hg38-test', dslabel: 'TermdbTest' } } })
if (!vocabApi) console.log(`!!! missing vocabApi !!!`)

// Type for data object after transformData() is called
type TransformedData = {
	values: TermCollectionTransformedValue[]
	numerators_sum: number
	hasMixedValues: boolean
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- tw/termCollection.unit -***-')
	test.end()
})

tape('transformData with positive values only', async test => {
	const tw = new TermCollectionValues(
		{
			type: 'TermCollectionTWValues',
			term: {
				type: 'termCollection',
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
	const tw = new TermCollectionValues(
		{
			type: 'TermCollectionTWValues',
			term: {
				type: 'termCollection',
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
	const tw = new TermCollectionValues(
		{
			type: 'TermCollectionTWValues',
			term: {
				type: 'termCollection',
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
	test.ok(Math.abs(negativeValues[0].value - (-33.33)) < 0.01, 'sig3 should be ~-33.33%')
	test.equal(negativeValues[0].pre_val_sum, 0, 'sig3 pre_val_sum should be 0')
	test.end()
})

tape('transformData with equal positive and negative values', async test => {
	const tw = new TermCollectionValues(
		{
			type: 'TermCollectionTWValues',
			term: {
				type: 'termCollection',
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

tape('fill(invalid tw)', async test => {
	// todo
	test.end()
})
