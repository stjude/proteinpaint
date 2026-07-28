import tape from 'tape'
import { isFractionTw, getFractionTvsTerm } from '../termCollection.js'

/* test sections

isFractionTw()
getFractionTvsTerm()
*/

const collectionTerm = (overrides: any = {}) => ({
	type: 'termCollection',
	name: 'Test collection',
	memberType: 'numeric',
	termlst: [
		{ id: 'term1', name: 'term1', type: 'isoformExpression' },
		{ id: 'term2', name: 'term2', type: 'isoformExpression' },
		{ id: 'term3', name: 'term3', type: 'isoformExpression' }
	],
	...overrides
})

const fractionTw = (overrides: any = {}) => ({
	type: 'TermCollectionTWFraction',
	term: collectionTerm(),
	q: { mode: 'discrete', type: 'custom-bin', denominators: ['term1', 'term2', 'term3'], numerators: ['term1'] },
	...overrides
})

tape('\n', function (test) {
	test.comment('-***- termCollection specs -***-')
	test.end()
})

tape('isFractionTw()', t => {
	t.equal(isFractionTw(fractionTw()), true, 'should be true for a fraction tw')
	t.equal(
		isFractionTw({ type: 'TermCollectionTWCont', term: collectionTerm(), q: {} }),
		false,
		'should be false for a values-mode collection tw'
	)
	t.equal(
		isFractionTw({ type: 'NumTWRegularBin', term: { type: 'float' }, q: {} }),
		false,
		'should be false for a numeric dictionary tw'
	)
	t.equal(isFractionTw(undefined), false, 'should be false for a missing tw')
	t.end()
})

tape('getFractionTvsTerm()', t => {
	const tw = fractionTw()
	const term: any = getFractionTvsTerm(tw)
	t.deepEqual(term.numerators, ['term1'], 'should copy q.numerators[] onto the tvs term')
	t.deepEqual(term.denominators, ['term1', 'term2', 'term3'], 'should copy q.denominators[] onto the tvs term')
	t.equal(term.termlst.length, 3, 'should keep every member term of the collection')
	t.equal((tw.term as any).numerators, undefined, 'should not mutate the tw term')

	const noSelection: any = getFractionTvsTerm(fractionTw({ q: { mode: 'continuous' } }))
	t.deepEqual(
		noSelection.denominators,
		['term1', 'term2', 'term3'],
		'should default the denominator to every member term'
	)
	t.deepEqual(noSelection.numerators, ['term1', 'term2', 'term3'], 'should default the numerator to the denominator')

	const minCopy: any = getFractionTvsTerm({
		type: 'TermCollectionTWFraction',
		// a min copy tw carries termIds[] instead of termlst[]
		term: { type: 'termCollection', name: 'Test collection', termIds: ['term1', 'term2'] },
		q: { numerators: ['term2'], denominators: ['term1', 'term2'] }
	})
	t.deepEqual(minCopy.numerators, ['term2'], 'should accept a tw with termIds[] instead of termlst[]')

	t.throws(
		() => getFractionTvsTerm({ type: 'TermCollectionTWCont', term: collectionTerm(), q: {} }),
		/not a fraction termCollection tw/,
		'should throw for a non-fraction tw'
	)
	t.throws(
		() => getFractionTvsTerm(fractionTw({ q: { numerators: ['term4'], denominators: ['term1'] } })),
		/is not included in denominators/,
		'should throw when the numerator is not a denominator'
	)
	t.end()
})
