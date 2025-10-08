import tape from 'tape'
import { assignNumType, assignDefaultBins, BuildHelpers } from '#src/adHocDictionary/BuildHelpers'

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

const id2term = new Map()
id2term.set('__root', { id: 'root', name: 'root', __tree_isroot: true })
const mockHeaders = 'SampleID,PatientID,Year'
const imageKey = 'SampleID'

/**************
 test sections
***************/

tape('\n', async function (test) {
	test.comment('-***- src/adHocDictionary/BuildHelpers -***-')
	test.end()
})

tape('BuildHelpers.makeParentTerms()', async function (test) {
	test.timeoutAfter(300)

	BuildHelpers.makeParentTerms(mockHeaders, id2term, imageKey)
	test.equal(id2term.size, 4, 'Should create 3 terms plus root term')

	test.end()
})

tape('BuildHelpers.assignAttributesToTerms()', async function (test) {
	test.timeoutAfter(300)

	//Note: Needs .makeParentTerms() to run from previous test to populate id2term
	BuildHelpers.assignAttributesToTerms(id2term, [
		'1,PatientA,2023\r',
		'2,PatientB,2005\r',
		'3,PatientC,2000\r',
		'4,PatientD,1999\r',
		'5,PatientE,1975\r',
		'6,PatientF,1985\r'
	])

	const imageKeyTerm = id2term.get(imageKey)
	test.equal(imageKeyTerm.type, 'categorical', 'Should set image key term type to "categorical"')
	test.equal(Object.keys(imageKeyTerm.values).length, 6, 'Should assign 6 values to image key term')

	const yearTerm = id2term.get('Year')
	test.equal(yearTerm.type, 'integer', 'Should set year term type to "integer"')
	test.true(
		yearTerm.bins !== undefined && yearTerm.bins.default !== undefined,
		'Should create .bins.default for year term'
	)

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
