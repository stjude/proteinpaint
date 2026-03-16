import tape from 'tape'
import { filterCategoriesByAllowedValues } from '../termdb.categories.ts'

/**
 * Tests
 *  - filterCategoriesByAllowedValues()
 *
 * Tests role-based filtering behavior for category values:
 *  - getRestrictedValues returning null (no restriction)
 *  - getRestrictedValues returning undefined (no restriction)
 *  - getRestrictedValues returning [] (empty array - restricts all)
 *  - getRestrictedValues returning a populated list
 *  - Mixed string/number value types
 *  - orderedLabels filtering to prevent data leakage
 */

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- #routes/termdb.categories -***-')
	test.end()
})

tape('filterCategoriesByAllowedValues() - no restriction (null)', function (test) {
	const lst = [
		{ key: 'Male', label: 'Male', samplecount: 100 },
		{ key: 'Female', label: 'Female', samplecount: 150 }
	]
	const orderedLabels = ['Male', 'Female']

	const result = filterCategoriesByAllowedValues(lst, orderedLabels, null)

	test.deepEqual(result.lst, lst, 'Should return all categories when allowedValues is null')
	test.deepEqual(result.orderedLabels, orderedLabels, 'Should return all orderedLabels when allowedValues is null')
	test.end()
})

tape('filterCategoriesByAllowedValues() - no restriction (undefined)', function (test) {
	const lst = [
		{ key: 'Male', label: 'Male', samplecount: 100 },
		{ key: 'Female', label: 'Female', samplecount: 150 }
	]
	const orderedLabels = ['Male', 'Female']

	const result = filterCategoriesByAllowedValues(lst, orderedLabels, undefined)

	test.deepEqual(result.lst, lst, 'Should return all categories when allowedValues is undefined')
	test.deepEqual(result.orderedLabels, orderedLabels, 'Should return all orderedLabels when allowedValues is undefined')
	test.end()
})

tape('filterCategoriesByAllowedValues() - empty array restricts all', function (test) {
	const lst = [
		{ key: 'Male', label: 'Male', samplecount: 100 },
		{ key: 'Female', label: 'Female', samplecount: 150 }
	]
	const orderedLabels = ['Male', 'Female']

	const result = filterCategoriesByAllowedValues(lst, orderedLabels, [])

	test.deepEqual(result.lst, [], 'Should return empty list when allowedValues is empty array')
	test.deepEqual(result.orderedLabels, [], 'Should return empty orderedLabels when allowedValues is empty array')
	test.end()
})

tape('filterCategoriesByAllowedValues() - populated list filters correctly', function (test) {
	const lst = [
		{ key: 'Africa', label: 'Africa', samplecount: 50 },
		{ key: 'Europe', label: 'Europe', samplecount: 75 },
		{ key: 'Asia', label: 'Asia', samplecount: 100 },
		{ key: 'Americas', label: 'Americas', samplecount: 60 }
	]
	const orderedLabels = ['Africa', 'Americas', 'Asia', 'Europe']

	const allowedValues = ['Africa', 'Asia']
	const result = filterCategoriesByAllowedValues(lst, orderedLabels, allowedValues)

	const expectedLst = [
		{ key: 'Africa', label: 'Africa', samplecount: 50 },
		{ key: 'Asia', label: 'Asia', samplecount: 100 }
	]
	const expectedOrderedLabels = ['Africa', 'Asia']

	test.deepEqual(result.lst, expectedLst, 'Should only return allowed categories')
	test.deepEqual(result.orderedLabels, expectedOrderedLabels, 'Should only return labels for allowed categories')
	test.end()
})

tape('filterCategoriesByAllowedValues() - handles numeric value keys', function (test) {
	const lst = [
		{ key: 1, label: 'Stage 1', samplecount: 30 },
		{ key: 2, label: 'Stage 2', samplecount: 45 },
		{ key: 3, label: 'Stage 3', samplecount: 25 }
	]
	const orderedLabels = ['Stage 1', 'Stage 2', 'Stage 3']

	const allowedValues = [1, 3]
	const result = filterCategoriesByAllowedValues(lst, orderedLabels, allowedValues)

	const expectedLst = [
		{ key: 1, label: 'Stage 1', samplecount: 30 },
		{ key: 3, label: 'Stage 3', samplecount: 25 }
	]
	const expectedOrderedLabels = ['Stage 1', 'Stage 3']

	test.deepEqual(result.lst, expectedLst, 'Should correctly filter numeric value keys')
	test.deepEqual(result.orderedLabels, expectedOrderedLabels, 'Should correctly filter orderedLabels for numeric keys')
	test.end()
})

tape('filterCategoriesByAllowedValues() - handles mixed string/number comparisons', function (test) {
	// Test case where allowedValues contains numbers but lst keys contain strings (or vice versa)
	const lst = [
		{ key: '1', label: 'Option 1', samplecount: 10 },
		{ key: '2', label: 'Option 2', samplecount: 20 },
		{ key: 3, label: 'Option 3', samplecount: 30 }
	]
	const orderedLabels = ['Option 1', 'Option 2', 'Option 3']

	// allowedValues has number 1 but lst has string '1'
	const allowedValues = [1, 3]
	const result = filterCategoriesByAllowedValues(lst, orderedLabels, allowedValues)

	const expectedLst = [
		{ key: '1', label: 'Option 1', samplecount: 10 },
		{ key: 3, label: 'Option 3', samplecount: 30 }
	]
	const expectedOrderedLabels = ['Option 1', 'Option 3']

	test.deepEqual(result.lst, expectedLst, 'Should match values using string normalization (1 matches "1")')
	test.deepEqual(result.orderedLabels, expectedOrderedLabels, 'Should filter orderedLabels with string normalization')
	test.end()
})

tape('filterCategoriesByAllowedValues() - orderedLabels filtering prevents data leakage', function (test) {
	// Scenario: orderedLabels contains labels for categories that should be restricted
	const lst = [
		{ key: 'allowed', label: 'Allowed Category', samplecount: 50 },
		{ key: 'restricted', label: 'Restricted Category', samplecount: 30 }
	]
	// orderedLabels might come from term.values/bins and contain all possible labels
	const orderedLabels = ['Allowed Category', 'Restricted Category', 'Another Restricted']

	const allowedValues = ['allowed']
	const result = filterCategoriesByAllowedValues(lst, orderedLabels, allowedValues)

	test.deepEqual(
		result.lst,
		[{ key: 'allowed', label: 'Allowed Category', samplecount: 50 }],
		'Should only return allowed categories in lst'
	)
	test.deepEqual(
		result.orderedLabels,
		['Allowed Category'],
		'Should filter orderedLabels to prevent leaking restricted category names'
	)
	test.end()
})

tape('filterCategoriesByAllowedValues() - preserves samplecount', function (test) {
	const lst = [
		{ key: 'cat1', label: 'Category 1', samplecount: 123 },
		{ key: 'cat2', label: 'Category 2', samplecount: 456 }
	]
	const orderedLabels = ['Category 1', 'Category 2']

	const allowedValues = ['cat1']
	const result = filterCategoriesByAllowedValues(lst, orderedLabels, allowedValues)

	test.equal(result.lst[0].samplecount, 123, 'Should preserve samplecount value')
	test.end()
})

tape('filterCategoriesByAllowedValues() - handles categories without samplecount', function (test) {
	// Some category items may not have samplecount (e.g., geneVariant terms)
	const lst = [
		{ key: 'cat1', label: 'Category 1' },
		{ key: 'cat2', label: 'Category 2' }
	]
	const orderedLabels = ['Category 1', 'Category 2']

	const allowedValues = ['cat1']
	const result = filterCategoriesByAllowedValues(lst, orderedLabels, allowedValues)

	test.deepEqual(result.lst, [{ key: 'cat1', label: 'Category 1' }], 'Should handle items without samplecount')
	test.end()
})

tape('filterCategoriesByAllowedValues() - maintains order from original lst', function (test) {
	const lst = [
		{ key: 'z', label: 'Z Label', samplecount: 10 },
		{ key: 'a', label: 'A Label', samplecount: 20 },
		{ key: 'm', label: 'M Label', samplecount: 30 }
	]
	const orderedLabels = ['Z Label', 'A Label', 'M Label']

	const allowedValues = ['z', 'm']
	const result = filterCategoriesByAllowedValues(lst, orderedLabels, allowedValues)

	const expectedLst = [
		{ key: 'z', label: 'Z Label', samplecount: 10 },
		{ key: 'm', label: 'M Label', samplecount: 30 }
	]

	test.deepEqual(result.lst, expectedLst, 'Should maintain original order from lst')
	test.deepEqual(result.orderedLabels, ['Z Label', 'M Label'], 'Should maintain order from original orderedLabels')
	test.end()
})
