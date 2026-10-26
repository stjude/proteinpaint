import tape from 'tape'
import { getValueLabel, hasVariant } from '../getAggMatrixData.ts'

/* test sections
	- Should only match geneVariant annotations that have a variant
	- Should label values with the dataset term, then the request term, then the key
*/

tape('\n', test => {
	test.comment('-***- src/aggregateMatrix/getAggMatrixData -***-')
	test.end()
})

tape('Should only match geneVariant annotations that have a variant', test => {
	const wt = { dt: 1, class: 'WT', origin: 'somatic' }
	const blank = { dt: 4, class: 'Blank' }
	const snv = { dt: 1, class: 'M', origin: 'germline' }
	const cnv = { dt: 4, class: 'CNV_amp' }
	const fusion = { dt: 2, class: 'Fuserna' }

	test.equal(hasVariant({ key: 'TP53', values: [snv] }), true, 'Should match a sample with one variant')
	test.equal(hasVariant({ values: [wt, cnv] }), true, 'Should match a variant listed next to a wildtype status')
	test.equal(hasVariant({ values: [wt, blank, fusion] }), true, 'Should match a variant listed after other statuses')
	test.equal(hasVariant({ key: 'TP53', values: [wt] }), false, 'Should not match a wildtype sample')
	test.equal(hasVariant({ values: [blank] }), false, 'Should not match a sample that was not tested')
	test.equal(
		hasVariant({ values: [wt, blank] }),
		false,
		'Should not match a sample with only wildtype and not tested statuses'
	)
	test.equal(hasVariant({ values: [] }), false, 'Should not match a sample with no values')
	test.equal(hasVariant({ values: [{ dt: 1 }] }), false, 'Should not match a value without a class')
	test.equal(hasVariant({ key: 'TP53' }), false, 'Should not match an annotation without values')
	test.equal(hasVariant(undefined), false, 'Should not match a missing annotation')
	test.end()
})

tape('Should label values with the dataset term, then the request term, then the key', test => {
	const datasetTerm = { values: { 1: { label: 'Male' }, 2: { label: 'Female' } } }
	const requestTerm = { values: { 1: { label: 'Female' }, 2: { label: 'Male' }, 3: { label: 'Other' } } }

	test.equal(getValueLabel(requestTerm, '1', datasetTerm), 'Male', 'Should prefer the label in the dataset term')
	test.equal(
		getValueLabel(requestTerm, '2', datasetTerm),
		'Female',
		'Should prefer the label in the dataset term for every key'
	)
	test.equal(
		getValueLabel(requestTerm, '3', datasetTerm),
		'Other',
		'Should use the label in the request term when the dataset term has none'
	)
	test.equal(getValueLabel(requestTerm, '4', datasetTerm), '4', 'Should use the key when neither term has a label')
	test.equal(getValueLabel(requestTerm, '1'), 'Female', 'Should use the request term when there is no dataset term')
	test.equal(getValueLabel({}, '[0, 5)', undefined), '[0, 5)', 'Should use the key as the label of a bin')
	test.equal(
		getValueLabel({}, 'Female', { values: { 2: { label: 'Female' } } }),
		'Female',
		'Should find a label that is already the label of a value'
	)
	test.equal(
		getValueLabel({ values: { 1: {} } }, '1', { values: { 1: { color: 'blue' } } }),
		'1',
		'Should ignore a value without a label'
	)
	test.end()
})
