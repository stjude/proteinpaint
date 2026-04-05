import tape from 'tape'
import { getOrderedLabels } from '../termdb.barchart.js'

/**
 * test sections:
 *
 * getOrderedLabels: returns event labels when events provided
 * getOrderedLabels: returns group names for condition type with groups
 * getOrderedLabels: returns sorted labels for condition type with values
 * getOrderedLabels: returns keys ordered by 'order' property
 * getOrderedLabels: handles mixed values with and without 'order' property
 * getOrderedLabels: returns bin names/labels when no ordering info
 * getOrderedLabels: handles undefined bins
 */

tape('\n', function (test) {
	test.comment('-***- src/termdb.barchart specs -***-')
	test.end()
})

tape('getOrderedLabels: returns event labels when events provided', t => {
	const events = [{ label: 'Event A' }, { label: 'Event B' }, { label: 'Event C' }]
	const result = getOrderedLabels({}, null, events, null)
	t.deepEqual(result, ['Event A', 'Event B', 'Event C'], 'should return labels from events')
	t.end()
})

tape('getOrderedLabels: returns group names for condition type with groups', t => {
	const term = { type: 'condition' }
	const q = { groups: [{ name: 'Group 1' }, { name: 'Group 2' }] }
	const result = getOrderedLabels(term, null, null, q)
	t.deepEqual(result, ['Group 1', 'Group 2'], 'should return group names')
	t.end()
})

tape('getOrderedLabels: returns sorted labels for condition type with values', t => {
	const term = {
		type: 'condition',
		values: {
			1: { label: 'First' },
			3: { label: 'Third' },
			2: { label: 'Second' }
		}
	}
	const result = getOrderedLabels(term, null, null, {})
	t.deepEqual(result, ['First', 'Second', 'Third'], 'should return labels sorted by numeric keys')
	t.end()
})

tape('getOrderedLabels: returns keys ordered by "order" property', t => {
	const term = {
		type: 'categorical',
		values: {
			keyA: { key: 'keyA', label: 'Label A', order: 2 },
			keyB: { key: 'keyB', label: 'Label B', order: 1 },
			keyC: { key: 'keyC', label: 'Label C', order: 3 }
		}
	}
	const result = getOrderedLabels(term, null, null, null)
	t.deepEqual(result, ['keyB', 'keyA', 'keyC'], 'should return keys in order based on order property')
	t.end()
})

tape('getOrderedLabels: handles mixed values with and without "order" property', t => {
	const term = {
		type: 'categorical',
		values: {
			keyA: { key: 'keyA', label: 'Label A', order: 2 },
			keyB: { key: 'keyB', label: 'Label B' }, // no order property
			keyC: { key: 'keyC', label: 'Label C', order: 1 }
		}
	}
	const result = getOrderedLabels(term, null, null, null)
	// Verify all keys are present in the result (unordered entry may appear anywhere)
	t.equal(result.length, 3, 'should return all three keys')
	t.ok(result.includes('keyA'), 'should include keyA')
	t.ok(result.includes('keyB'), 'should include keyB')
	t.ok(result.includes('keyC'), 'should include keyC')

	// Verify relative ordering of ordered entries only
	t.ok(result.indexOf('keyC') < result.indexOf('keyA'), 'should place keyC (order=1) before keyA (order=2)')
	t.end()
})

tape('getOrderedLabels: returns bin names/labels when no ordering info', t => {
	const term = {
		type: 'categorical',
		values: {
			keyA: { key: 'keyA', label: 'Label A' },
			keyB: { key: 'keyB', label: 'Label B' }
		}
	}
	const bins = [{ name: 'Bin 1' }, { label: 'Bin 2' }, { name: 'Bin 3', label: 'Ignore' }]
	const result = getOrderedLabels(term, bins, null, null)
	t.deepEqual(result, ['Bin 1', 'Bin 2', 'Bin 3'], 'should return bin names, preferring name over label')
	t.end()
})

tape('getOrderedLabels: handles undefined bins', t => {
	const term = {
		type: 'categorical',
		values: {
			keyA: { key: 'keyA', label: 'Label A' },
			keyB: { key: 'keyB', label: 'Label B' }
		}
	}
	const result = getOrderedLabels(term, undefined, null, null)
	t.equal(result, undefined, 'should return undefined when bins is undefined and no order property')
	t.end()
})

tape('getOrderedLabels: verifies regression - uses key instead of label', t => {
	// Regression test: values with an order property should return keys,
	// not display labels.
	const term = {
		type: 'categorical',
		values: {
			actual_key_1: { key: 'actual_key_1', label: 'Display Label 1', order: 1 },
			actual_key_2: { key: 'actual_key_2', label: 'Display Label 2', order: 2 },
			actual_key_3: { key: 'actual_key_3', label: 'Display Label 3', order: 3 }
		}
	}
	const result = getOrderedLabels(term, null, null, null)

	// New behavior: returns keys (actual_key_1, actual_key_2, actual_key_3)
	// Old behavior would have returned labels (Display Label 1, Display Label 2, Display Label 3)
	t.deepEqual(
		result,
		['actual_key_1', 'actual_key_2', 'actual_key_3'],
		'should return keys instead of labels when order property exists'
	)

	t.end()
})

tape('getOrderedLabels: verifies firstVal check optimization', t => {
	// This test verifies the optimization that checks only the first value
	// rather than filtering all values
	const term = {
		type: 'categorical',
		values: {
			keyA: { key: 'keyA', label: 'Label A', order: 3 },
			keyB: { key: 'keyB', label: 'Label B', order: 1 },
			keyC: { key: 'keyC', label: 'Label C', order: 2 }
		}
	}
	const result = getOrderedLabels(term, null, null, null)

	// Should work correctly even though only first value is checked for 'order' property
	t.deepEqual(result, ['keyB', 'keyC', 'keyA'], 'should correctly sort by order property based on firstVal check')

	t.end()
})

tape('getOrderedLabels: detects order when first value has no order', t => {
	// Regression guard for edge case where the first value is unordered,
	// but later values define explicit order.
	const term = {
		type: 'categorical',
		values: {
			keyB: { key: 'keyB', label: 'Label B' }, // first value has no order
			keyC: { key: 'keyC', label: 'Label C', order: 1 },
			keyA: { key: 'keyA', label: 'Label A', order: 2 }
		}
	}
	const result = getOrderedLabels(term, null, null, null)

	t.equal(result.length, 3, 'should return all three keys')
	t.ok(result.includes('keyA'), 'should include keyA')
	t.ok(result.includes('keyB'), 'should include keyB')
	t.ok(result.includes('keyC'), 'should include keyC')
	t.ok(
		result.indexOf('keyC') < result.indexOf('keyA'),
		'should place keyC (order=1) before keyA (order=2) even if the first value has no order'
	)

	t.end()
})
