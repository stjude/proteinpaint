import tape from 'tape'
import { getViolinHiddenValues } from '../violinHiddenValues.ts'

/* Tests
	- getViolinHiddenValues()
*/

tape('\n', test => {
	test.comment('-***- violinHiddenValues -***-')
	test.end()
})

tape('getViolinHiddenValues: the hidden plots by label', test => {
	test.deepEqual(getViolinHiddenValues(undefined), {}, 'none without a tw')
	test.deepEqual(getViolinHiddenValues({ term: { values: {} }, q: {} }), {}, 'none without q.hiddenValues')

	// keys 1, 2, 3 and labels 2, 3, 4: a label that is another value's key
	const term = { values: { 1: { label: '2' }, 2: { label: '3' }, 3: { label: '4', uncomputable: true } } }
	const tw = { term, q: { hiddenValues: { 2: 1 } } }
	test.deepEqual(
		getViolinHiddenValues(tw),
		{ 2: 1 },
		'a hidden label is kept as is, so only the plot labeled 2 is hidden'
	)
	test.deepEqual(tw.q.hiddenValues, { 2: 1 }, 'q.hiddenValues is not changed')

	const uncomputable = { term, q: { hiddenValues: { 3: 1 } } }
	test.deepEqual(getViolinHiddenValues(uncomputable), { 4: 1 }, 'a hidden uncomputable key is changed to its label')

	const sameLabel = { term: { values: { NA: { label: 'NA', uncomputable: true } } }, q: { hiddenValues: { NA: 1 } } }
	test.deepEqual(
		getViolinHiddenValues(sameLabel),
		{ NA: 1 },
		'an uncomputable value whose label is its key stays hidden'
	)
	test.end()
})
