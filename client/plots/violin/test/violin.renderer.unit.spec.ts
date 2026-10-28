import tape from 'tape'
import { getGroupTw, getVisiblePvalues } from '../violin.renderer'

/*
Tests:
	getGroupTw(): the tw of the violin groups
	getVisiblePvalues(): a hidden gene expression bin
*/

tape('\n', test => {
	test.comment('-***- plots/violin/violin.renderer -***-')
	test.end()
})

tape('getGroupTw: the overlay of a continuous term, or else the term', test => {
	const continuous = { term: { type: 'float' }, q: { mode: 'continuous' } }
	const categorical = { term: { type: 'categorical' }, q: {} }
	const geneExpBins = { term: { type: 'geneExpression' }, q: { mode: 'discrete' } }
	const termCollection = { term: { type: 'termCollection', memberType: 'numeric' }, q: {} }
	test.equal(getGroupTw(continuous, categorical), categorical, 'a categorical overlay of a continuous term')
	test.equal(getGroupTw(continuous, geneExpBins), geneExpBins, 'binned gene expression overlay of a continuous term')
	test.equal(getGroupTw(categorical, continuous), categorical, 'a categorical term of a continuous overlay')
	test.equal(getGroupTw(geneExpBins, continuous), geneExpBins, 'binned gene expression of a continuous overlay')
	test.equal(getGroupTw(termCollection), termCollection, 'a termCollection without an overlay')
	test.equal(getGroupTw(continuous), continuous, 'a single continuous term')
	test.end()
})

tape('getVisiblePvalues: a hidden bin of a gene expression overlay of a continuous term', test => {
	const age = { term: { type: 'float' }, q: { mode: 'continuous' } }
	const geneExp = { term: { type: 'geneExpression' }, q: { mode: 'discrete', hiddenValues: { '<5': 1 } } }
	const visibleRow = [{ value: '5 to <10' }, { value: '≥10' }, { html: '0.01' }]
	const hiddenRow = [{ value: '<5' }, { value: '≥10' }, { html: '0.5' }]
	test.deepEqual(
		getVisiblePvalues({ pvalues: [visibleRow, hiddenRow] }, age, geneExp),
		[visibleRow],
		'the comparisons of the hidden bin are left out'
	)
	test.end()
})
