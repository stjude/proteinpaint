import tape from 'tape'
import { getPercentsDict, getSCPercentsDict, getScoreTermValues } from '../termdb.profileFormScores.ts'

/**
 * Tests for termdb.profileFormScores helpers
 *  - getPercentsDict()
 *  - getSCPercentsDict()
 */

tape('\n', function (test) {
	test.comment('-***- #routes/termdb.profileFormScores -***-')
	test.end()
})

const LIKERT_VALUES = {
	'1': { key: '1', label: 'Almost never' },
	'4': { key: '4', label: 'Frequently' },
	'5': { key: '5', label: 'Almost always' }
}
const byItself = (sample: any) => sample

tape('getPercentsDict() folds differently capitalized answers onto the term value label', function (test) {
	const samples = [
		{ 'Almost Always': 6, Frequently: 4 },
		{ 'Almost always': 2, 'Almost Never': 1 },
		{ 'Almost never': 3 }
	]
	test.deepEqual(
		getPercentsDict(byItself, samples, LIKERT_VALUES),
		{ 'Almost always': 8, Frequently: 4, 'Almost never': 4 },
		'one category per answer, counts summed across spellings'
	)
	test.end()
})

tape('getPercentsDict() keeps answers with no matching label, and all keys when values are absent', function (test) {
	const samples = [{ "I don't know": 2, 'Almost Always': 1 }, null]
	test.deepEqual(
		getPercentsDict(byItself, samples, LIKERT_VALUES),
		{ "I don't know": 2, 'Almost always': 1 },
		'an unlabelled answer is kept verbatim and a sample without data is skipped'
	)
	test.deepEqual(
		getPercentsDict(byItself, [{ 'Almost Always': 1 }, { 'Almost always': 1 }]),
		{ 'Almost Always': 1, 'Almost always': 1 },
		'without term values the keys are left untouched'
	)
	test.end()
})

tape('getPercentsDict() accepts numeric value labels', function (test) {
	const values = { '1': { key: '1', label: 1 }, '0': { key: '0', label: 0 } }
	test.deepEqual(
		getPercentsDict(byItself, [{ '1': 2, '0': 1 }, { '1': 3 }], values),
		{ '1': 5, '0': 1 },
		'numeric labels are stringified instead of throwing on toUpperCase()'
	)
	test.end()
})

tape('getScoreTermValues() reads labels from the termdb for a get_multivalue_tws() wrapper', function (test) {
	// previous comment: same shape as get_multivalue_tws(): no term.values
	// a q.get_multivalue_tws() wrapper whose terms.jsondata has no values, so term.values is missing
	const tw = { $id: 'Q1', term: { id: 'Q1', name: 'Q1', type: 'multivalue', subtype: 'Likert', details: '' } }
	const ds = {
		cohort: { termdb: { q: { termjsonByOneid: id => (id == 'Q1' ? { values: LIKERT_VALUES } : undefined) } } }
	}
	const values = getScoreTermValues(tw, ds)
	test.deepEqual(values, LIKERT_VALUES, 'values come from the termdb, not the wrapper')
	test.deepEqual(
		getPercentsDict(byItself, [{ 'Almost Always': 1 }, { 'Almost always': 2 }], values),
		{ 'Almost always': 3 },
		'answers are folded for the real request shape'
	)
	test.equal(
		getScoreTermValues({ term: { id: 'missing' } }, ds),
		undefined,
		'an unknown term yields no values, leaving keys untouched'
	)
	test.end()
})

tape('getSCPercentsDict() counts present SC values per category', function (test) {
	const tw = { $id: 'sc1' }
	const samples = [{ sc1: { value: 'Yes' } }, { sc1: { value: 'No' } }, { sc1: { value: 'Yes' } }]
	test.deepEqual(getSCPercentsDict(tw, samples), { Yes: 2, No: 1 }, 'tallies one count per sample by SC value')
	test.end()
})

tape('getSCPercentsDict() skips samples with a missing SC value (no "undefined" bucket)', function (test) {
	const tw = { $id: 'sc1' }
	const samples = [
		{ sc1: { value: 'Yes' } },
		{}, // sample has no cell for this SC term
		{ sc1: {} }, // cell present but no value
		{ sc1: { value: null } }, // explicit null value
		{ sc1: { value: 'No' } }
	]
	const out = getSCPercentsDict(tw, samples)
	test.deepEqual(out, { Yes: 1, No: 1 }, 'only present values counted')
	test.notOk('undefined' in out, 'no "undefined" category key')
	test.notOk(Object.prototype.hasOwnProperty.call(out, 'null'), 'no "null" category key')
	test.end()
})

tape('getSCPercentsDict() throws when tw is missing', function (test) {
	test.throws(() => getSCPercentsDict(undefined, []), /tw not defined/, 'guards a missing tw')
	test.end()
})
