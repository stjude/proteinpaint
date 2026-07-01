import tape from 'tape'
import {
	collectResponderRatings,
	collectScalarValues,
	buildDistribution,
	median
} from '../profile.impressionDistribution.ts'

/**
 * Table of contents — profile.impressionDistribution unit tests
 *
 * collectResponderRatings()
 *   • expands a single rating→count map into a flat per-responder list
 *   • each responder term builds its own independent distribution (side-by-side charts)
 *   • ignores empty / missing cells
 *   • parses an already-parsed (object) map as well as a JSON string
 *
 * collectScalarValues()
 *   • one value per site, skips missing / non-finite cells
 *
 * buildDistribution() + median()
 *   • per-responder distribution counts and pct sum over responders, not sites
 *   • SC-only outcome: empty values → null median + all-zero distribution
 */

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- #routes/profile.impressionDistribution -***-')
	test.end()
})

tape('collectResponderRatings() expands a single rating→count map', function (test) {
	const $id = 'mod1'
	const samples = [{ [$id]: { value: '{"8":2,"7":3,"5":1}' } }]
	const out = collectResponderRatings(samples, [$id])
	test.deepEqual(
		out.sort((a, b) => a - b),
		[5, 7, 7, 7, 8, 8],
		'expands {"8":2,"7":3,"5":1} → six responder ratings'
	)
	test.end()
})

tape('collectResponderRatings() each responder term is independent (side-by-side charts)', function (test) {
	// e.g. Service Capacity: PHO & PHOE and PHO & Nurses each get their own thermometer.
	// The route calls collectResponderRatings once per term, not aggregated together.
	const samples = [
		{
			mod5_PHOE: { value: '{"9":1,"8":1}' },
			mod5_Nurses: { value: '{"6":2}' }
		}
	]
	const phoe = collectResponderRatings(samples, ['mod5_PHOE'])
	const nurses = collectResponderRatings(samples, ['mod5_Nurses'])
	test.deepEqual(
		phoe.sort((a, b) => a - b),
		[8, 9],
		'PHO & PHOE column has its own responders'
	)
	test.deepEqual(nurses, [6, 6], 'PHO & Nurses column has its own responders')
	test.end()
})

tape('collectResponderRatings() ignores empty / missing cells', function (test) {
	const $id = 'mod1'
	const samples = [
		{ [$id]: { value: '{"8":1}' } },
		{}, // sample with no cell for this term
		{ [$id]: null }, // null cell
		{ [$id]: { value: null } } // cell without a value
	]
	const out = collectResponderRatings(samples, [$id])
	test.deepEqual(out, [8], 'only the one populated cell contributes')
	test.end()
})

tape('collectResponderRatings() parses both string and object maps', function (test) {
	const $id = 'mod1'
	const samples = [{ [$id]: { value: { '7': 2 } } }] // already-parsed object
	const out = collectResponderRatings(samples, [$id])
	test.deepEqual(out, [7, 7], 'object-shaped map is handled like a JSON string')
	test.end()
})

tape('collectScalarValues() one value per site, skips missing/non-finite', function (test) {
	const $id = 'FX384'
	const samples = [{ [$id]: { value: 7 } }, { [$id]: { value: '5' } }, {}, { [$id]: { value: null } }]
	const out = collectScalarValues(samples, $id)
	test.deepEqual(out, [7, 5], 'numeric and numeric-string site values collected; missing/null skipped')
	test.end()
})

tape('buildDistribution() counts and pct sum over responders', function (test) {
	// 10 responders total: rating 8 ×2, 7 ×3, 5 ×1, plus a second site adding 8 ×4
	const values = [8, 8, 7, 7, 7, 5, 8, 8, 8, 8]
	const dist = buildDistribution(values, 10)
	const r8 = dist.find(d => d.rating === 8)
	const r7 = dist.find(d => d.rating === 7)
	const r5 = dist.find(d => d.rating === 5)
	test.equal(dist.length, 10, 'one entry per rating 1..maxScore')
	test.equal(r8?.count, 6, 'rating 8 counted across both sites')
	test.equal(r8?.pct, 60, '6 of 10 responders = 60%')
	test.equal(r7?.count, 3, 'rating 7 count')
	test.equal(r5?.count, 1, 'rating 5 count')
	test.equal(median(values), 8, 'per-responder median')
	test.end()
})

tape('SC-only outcome: empty values → null median + all-zero distribution', function (test) {
	const dist = buildDistribution([], 10)
	test.equal(median([]), null, 'median of no values is null')
	test.equal(dist.length, 10, 'distribution still spans all ratings')
	test.ok(
		dist.every(d => d.count === 0 && d.pct === 0),
		'all counts/pcts are zero when there are no POC values'
	)
	test.end()
})
