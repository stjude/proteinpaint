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
 * getOrderedLabels: verifies regression - uses key instead of label
 * getOrderedLabels: sorts all values by order property regardless of declaration order
 * getOrderedLabels: detects order when first value has no order
 * getOrderedLabels: label-based duplicate keys resolve order from numeric counterparts
 * getOrderedLabels: treats order:0 as a valid explicit order, not falsy-skipped
 * getOrderedLabels: non-contiguous order values sort correctly
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
	t.deepEqual(result, [], 'should return empty array when bins is undefined and no order property')
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

tape('getOrderedLabels: sorts all values by order property regardless of declaration order', t => {
	// Verifies that any value with an order property is detected (via vals.some(...))
	// and that all entries sort correctly by their order property, not by insertion order.
	const term = {
		type: 'categorical',
		values: {
			keyA: { key: 'keyA', label: 'Label A', order: 3 },
			keyB: { key: 'keyB', label: 'Label B', order: 1 },
			keyC: { key: 'keyC', label: 'Label C', order: 2 }
		}
	}
	const result = getOrderedLabels(term, null, null, null)

	t.deepEqual(result, ['keyB', 'keyC', 'keyA'], 'should sort keys by order property regardless of declaration order')

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

tape('getOrderedLabels: label-based duplicate keys resolve order from numeric counterparts', t => {
	// Reproduces the CareReg staging scenario:
	// - Numeric keys ("0", "1", "2") carry the order property
	// - Label-based keys ("Stage 0", "Stage I", "M0") are what annotations actually store
	// - Label-based keys have no order, but their label matches a numeric key's label
	// Expected: label-based keys appear in the orderedLabels in the correct clinical order
	const term = {
		type: 'categorical',
		values: {
			'0': { key: '0', label: 'Stage 0', order: 0 },
			'1': { key: '1', label: 'Stage I', order: 1 },
			'2': { key: '2', label: 'M0', order: 2 },
			'Stage 0': { label: 'Stage 0' }, // annotation value, no order
			'Stage I': { label: 'Stage I' }, // annotation value, no order
			M0: { label: 'M0' } // annotation value, no order
		}
	}
	const result = getOrderedLabels(term, null, null, null)

	// All label-based annotation values must be present
	t.ok(result.includes('Stage 0'), 'should include Stage 0 label key')
	t.ok(result.includes('Stage I'), 'should include Stage I label key')
	t.ok(result.includes('M0'), 'should include M0 label key')

	// Label-based keys must appear in the correct clinical order (resolved via numeric counterpart order)
	t.ok(result.indexOf('Stage 0') < result.indexOf('Stage I'), 'Stage 0 (order=0) should come before Stage I (order=1)')
	t.ok(result.indexOf('Stage I') < result.indexOf('M0'), 'Stage I (order=1) should come before M0 (order=2)')

	t.end()
})

tape('getOrderedLabels: treats order:0 as a valid explicit order, not falsy-skipped', t => {
	// Regression guard: order:0 is falsy but must be honoured as an explicit declared order.
	// The CareReg staging term uses order:0 for "Stage 0"; a naive `if (value.order)` check
	// would silently drop it and fall back to an unordered sort.
	// getOrderedLabels() uses `'order' in v` and `value?.order !== undefined` throughout,
	// so order:0 must be detected by hasAnyOrder and sort correctly ahead of order:1.
	const term = {
		type: 'categorical',
		values: {
			keyB: { key: 'keyB', label: 'Label B', order: 2 },
			keyA: { key: 'keyA', label: 'Label A', order: 0 }, // falsy order value
			keyC: { key: 'keyC', label: 'Label C', order: 1 }
		}
	}
	const result = getOrderedLabels(term, null, null, null)

	t.equal(result.length, 3, 'should return all three keys')
	t.equal(result[0], 'keyA', 'keyA (order=0) should sort first, not be treated as unordered')
	t.ok(result.indexOf('keyC') < result.indexOf('keyB'), 'keyC (order=1) should come before keyB (order=2)')

	t.end()
})

tape('getOrderedLabels: non-contiguous order values sort correctly', t => {
	// Regression guard: order property should be respected regardless of whether values are sequential
	const term = {
		type: 'categorical',
		values: {
			keyZ: { key: 'keyZ', label: 'Label Z', order: 100 },
			keyA: { key: 'keyA', label: 'Label A', order: 1 },
			keyM: { key: 'keyM', label: 'Label M', order: 50 },
			keyB: { key: 'keyB', label: 'Label B', order: 10 }
		}
	}
	const result = getOrderedLabels(term, null, null, null)

	t.equal(result.length, 4, 'should return all four keys')
	// Should sort by order property: 1, 10, 50, 100
	t.equal(result.indexOf('keyA'), 0, 'keyA (order=1) should come first')
	t.equal(result.indexOf('keyB'), 1, 'keyB (order=10) should come second')
	t.equal(result.indexOf('keyM'), 2, 'keyM (order=50) should come third')
	t.equal(result.indexOf('keyZ'), 3, 'keyZ (order=100) should come last')

	t.end()
})
