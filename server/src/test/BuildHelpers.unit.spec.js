import tape from 'tape'
import { assignNumType, assignDefaultBins } from '#src/adHocDictionary/BuildHelpers'

const mockTerm = {
	id: 'Year',
	name: 'Year',
	type: 'integer',
	isleaf: true,
	parent_id: undefined,
	included_types: ['integer'],
	child_types: [],
	__tree_isroot: false,
	index: 2,
	values: {}
}

const mockDecimalValues = [15.001, 13.12, 10.002, 11.25, 15.5, 10.75, 15.8, 20.33, 25.67, 20.9, 25.99, 20.01, 25.001]

const mockWholeValues = [1965, 1973, 1980, 1981, 1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020, 2025]

/**************
 test sections
***************/

tape('\n', async function (test) {
	test.comment('-***- src/adHocDictionary/BuildHelpers -***-')
	test.end()
})

tape('assignNumType()', async function (test) {
	test.timeoutAfter(300)
	const termCopy1 = structuredClone(mockTerm)
	assignNumType(termCopy1, mockDecimalValues)
	test.equal(termCopy1.type, 'float', 'Should set term.type to "float" when decimal values are present')

	const termCopy2 = structuredClone(mockTerm)
	assignNumType(termCopy2, mockWholeValues)
	test.equal(termCopy2.type, 'integer', 'Should keep term.type as "integer" when only whole number values are present')
	test.end()
})

tape('assignDefaultBins()', async function (test) {
	test.timeoutAfter(300)

	const termCopy = structuredClone(mockTerm)
	assignDefaultBins(termCopy, mockWholeValues)

	test.true(termCopy.bins !== undefined && termCopy.bins.default !== undefined, 'Should create .bins.default: {}')
	test.equal(termCopy.bins.default.type, 'regular-bin', 'Should assigne term.bins.type to "regular-bin"')
	test.equal(
		termCopy.bins.default.bin_size,
		mockWholeValues.length - 1,
		`Should assign term.bins.bin_size to ${mockWholeValues.length - 1}`
	)

	const termCopy2 = structuredClone(mockTerm)
	assignDefaultBins(termCopy2, null)
	test.true(termCopy2.bins !== undefined, 'Should handle null term values array')

	assignDefaultBins(termCopy2, [])
	test.true(termCopy2.bins !== undefined, 'Should handle empty term values array')

	test.end()
})
