import tape from 'tape'
import { markSavedState, getSavedStateRefusal } from '../sessionForm.ts'

/*
Tests:
	getSavedStateRefusal()
	markSavedState()
*/

tape('\n', function (test) {
	test.comment('-***- mass/sessionForm -***-')
	test.end()
})

const listed = { name: 'a', in: true, values: [{ sampleId: 1 }, { sampleId: 2 }] }
const byFilter = { name: 'a', in: true, sampleCount: 2, filter: { type: 'tvslst', in: true, join: '', lst: [] } }
const samplelstTvs = {
	type: 'tvs',
	tvs: { term: { type: 'samplelst', values: { a: { key: 'a', list: [{ sampleId: 1, sample: 's1' }] } } } }
}

tape('getSavedStateRefusal()', test => {
	test.equal(getSavedStateRefusal(undefined), undefined, 'should open no state')
	test.equal(
		getSavedStateRefusal({ plots: [{ chartType: 'summary', term: { id: 'sex' } }], groups: [], customTerms: [] }),
		undefined,
		'should open a state without the mark that lists no sample'
	)
	test.equal(
		getSavedStateRefusal({
			customTerms: [{ name: 'v', tw: { term: { type: 'samplelst' }, q: { groups: [byFilter] } } }]
		}),
		undefined,
		'should open a state without the mark with groups that are defined by a filter'
	)
	test.equal(
		getSavedStateRefusal({
			termfilter: { filter: { lst: [{ tvs: { term: { id: 'sex' }, values: [{ key: '1' }] } }] } }
		}),
		undefined,
		'should not take the values of a filter for a list of samples'
	)
	test.equal(
		typeof getSavedStateRefusal({
			customTerms: [{ name: 'v', tw: { term: { type: 'samplelst' }, q: { groups: [listed] } } }]
		}),
		'string',
		'should refuse a state without the mark with a variable that lists samples'
	)
	test.equal(
		typeof getSavedStateRefusal({
			plots: [{ chartType: 'differentialAnalysis', samplelst: { groups: [listed, listed] } }]
		}),
		'string',
		'should refuse a state without the mark with a plot that lists samples'
	)
	test.equal(
		typeof getSavedStateRefusal({ groups: [{ name: 'g', filter: { type: 'tvslst', lst: [samplelstTvs] } }] }),
		'string',
		'should refuse a state without the mark with a group that lists samples in its filter'
	)
	test.end()
})

tape('markSavedState()', test => {
	const state = {
		customTerms: [{ name: 'v', tw: { term: { type: 'samplelst' }, q: { groups: [listed] } } }],
		groups: [{ name: 'g', filter: { type: 'tvslst', lst: [samplelstTvs] } }]
	}
	test.equal(typeof getSavedStateRefusal(state), 'string', 'should refuse the state before it is marked')
	test.equal(markSavedState(state), state, 'should return the state')
	test.equal(getSavedStateRefusal(state), undefined, 'should open a marked state that lists samples')
	test.equal(
		getSavedStateRefusal(JSON.parse(JSON.stringify(state))),
		undefined,
		'should open a marked state after it is written and read'
	)
	test.end()
})
