import tape from 'tape'
import { getSCPercentsDict } from '../termdb.profileFormScores.ts'

/**
 * Tests for termdb.profileFormScores helpers
 *  - getSCPercentsDict()
 */

tape('\n', function (test) {
	test.comment('-***- #routes/termdb.profileFormScores -***-')
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
