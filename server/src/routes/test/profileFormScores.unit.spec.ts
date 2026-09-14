import tape from 'tape'
import { getPercentsDict, getSCPercentsDict } from '../termdb.profileFormScores.ts'

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
