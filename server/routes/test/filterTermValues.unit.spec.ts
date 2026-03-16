import tape from 'tape'
import { filterByAllowedValues } from '../termdb.filterTermValues.ts'

/**
 * Tests
 *  - filterByAllowedValues()
 *
 * Tests role-based filtering behavior for term values:
 *  - getRestrictedValues returning null (no restriction)
 *  - getRestrictedValues returning undefined (no restriction)
 *  - getRestrictedValues returning [] (empty array - restricts all)
 *  - getRestrictedValues returning a populated list
 *  - Mixed string/number value types
 *  - Preservation of empty string placeholder
 */

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- #routes/filterTermValues -***-')
	test.end()
})

tape('filterByAllowedValues() - no restriction (null)', function (test) {
	const values = [
		{ value: '', label: '' },
		{ value: 'Africa', label: 'Africa', disabled: false },
		{ value: 'Europe', label: 'Europe', disabled: false },
		{ value: 'Asia', label: 'Asia', disabled: true }
	]

	const result = filterByAllowedValues(values, null)

	test.deepEqual(result, values, 'Should return all values when allowedValues is null')
	test.end()
})

tape('filterByAllowedValues() - no restriction (undefined)', function (test) {
	const values = [
		{ value: '', label: '' },
		{ value: 'Africa', label: 'Africa', disabled: false },
		{ value: 'Europe', label: 'Europe', disabled: false }
	]

	const result = filterByAllowedValues(values, undefined)

	test.deepEqual(result, values, 'Should return all values when allowedValues is undefined')
	test.end()
})

tape('filterByAllowedValues() - empty array restricts all except placeholder', function (test) {
	const values = [
		{ value: '', label: '' },
		{ value: 'Africa', label: 'Africa', disabled: false },
		{ value: 'Europe', label: 'Europe', disabled: false }
	]

	const result = filterByAllowedValues(values, [])

	test.deepEqual(
		result,
		[{ value: '', label: '' }],
		'Should only return empty placeholder when allowedValues is empty array'
	)
	test.end()
})

tape('filterByAllowedValues() - populated list filters correctly', function (test) {
	const values = [
		{ value: '', label: '' },
		{ value: 'Africa', label: 'Africa', disabled: false },
		{ value: 'Europe', label: 'Europe', disabled: false },
		{ value: 'Asia', label: 'Asia', disabled: true },
		{ value: 'Americas', label: 'Americas', disabled: false }
	]

	const allowedValues = ['Africa', 'Asia']
	const result = filterByAllowedValues(values, allowedValues)

	const expected = [
		{ value: '', label: '' },
		{ value: 'Africa', label: 'Africa', disabled: false },
		{ value: 'Asia', label: 'Asia', disabled: true }
	]

	test.deepEqual(result, expected, 'Should only return allowed values plus empty placeholder')
	test.end()
})

tape('filterByAllowedValues() - handles numeric value keys', function (test) {
	const values = [
		{ value: '', label: '' },
		{ value: 1, label: 'Option 1', disabled: false },
		{ value: 2, label: 'Option 2', disabled: false },
		{ value: 3, label: 'Option 3', disabled: false }
	]

	const allowedValues = [1, 3]
	const result = filterByAllowedValues(values, allowedValues)

	const expected = [
		{ value: '', label: '' },
		{ value: 1, label: 'Option 1', disabled: false },
		{ value: 3, label: 'Option 3', disabled: false }
	]

	test.deepEqual(result, expected, 'Should correctly filter numeric value keys')
	test.end()
})

tape('filterByAllowedValues() - handles mixed string/number comparisons', function (test) {
	// Test case where allowedValues contains numbers but values contain strings (or vice versa)
	const values = [
		{ value: '', label: '' },
		{ value: '1', label: 'Option 1', disabled: false },
		{ value: '2', label: 'Option 2', disabled: false },
		{ value: 3, label: 'Option 3', disabled: false }
	]

	// allowedValues has number 1 but values has string '1'
	const allowedValues = [1, 3]
	const result = filterByAllowedValues(values, allowedValues)

	const expected = [
		{ value: '', label: '' },
		{ value: '1', label: 'Option 1', disabled: false },
		{ value: 3, label: 'Option 3', disabled: false }
	]

	test.deepEqual(result, expected, 'Should match values using string normalization (1 matches "1")')
	test.end()
})

tape('filterByAllowedValues() - does not pass through falsy values other than empty string', function (test) {
	const values = [
		{ value: '', label: '' },
		{ value: 0, label: 'Zero', disabled: false },
		{ value: 'valid', label: 'Valid', disabled: false }
	]

	// Only 'valid' is allowed, 0 should not pass through despite being falsy
	const allowedValues = ['valid']
	const result = filterByAllowedValues(values, allowedValues)

	const expected = [
		{ value: '', label: '' },
		{ value: 'valid', label: 'Valid', disabled: false }
	]

	test.deepEqual(result, expected, 'Should not allow falsy value 0 to bypass restriction')
	test.end()
})

tape('filterByAllowedValues() - allows 0 when explicitly in allowedValues', function (test) {
	const values = [
		{ value: '', label: '' },
		{ value: 0, label: 'Zero', disabled: false },
		{ value: 1, label: 'One', disabled: false }
	]

	const allowedValues = [0]
	const result = filterByAllowedValues(values, allowedValues)

	const expected = [
		{ value: '', label: '' },
		{ value: 0, label: 'Zero', disabled: false }
	]

	test.deepEqual(result, expected, 'Should allow 0 when explicitly in allowedValues')
	test.end()
})

tape('filterByAllowedValues() - preserves disabled state', function (test) {
	const values = [
		{ value: '', label: '' },
		{ value: 'allowed1', label: 'Allowed 1', disabled: true },
		{ value: 'allowed2', label: 'Allowed 2', disabled: false }
	]

	const allowedValues = ['allowed1', 'allowed2']
	const result = filterByAllowedValues(values, allowedValues)

	test.equal(result[1].disabled, true, 'Should preserve disabled=true state')
	test.equal(result[2].disabled, false, 'Should preserve disabled=false state')
	test.end()
})
