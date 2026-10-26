import tape from 'tape'
import { hasVariant } from '../getAggMatrixData.ts'

/* test sections
	- Should only match geneVariant annotations that have a variant
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
