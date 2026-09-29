import tape from 'tape'
import { profilePlot } from '../profilePlot.js'

/*
Tests for includeAllRounds(), which tells the server whether to stop narrowing every
aggregate to each site's most recent submission.

The server force-applies Latest_submission=Yes so a site assessed twice is not weighted
twice. That narrowing has to stand down the moment the user picks a specific round,
otherwise the older round (flagged No) is ANDed against Yes and every resubmitted site
silently drops out while never-resubmitted sites remain — a partial chart, not an empty one.

  • no round selected -> false, so the server narrows to latest
  • a round selected -> true, so the server returns that round
  • empty string and empty array count as unset, matching hasFilterValue()
  • it reads roundTW, not yearOfImplementationTW — these are the same term today but
    diverge once the dictionary defines Assessment_year
*/

const { hasFilterValue, includeAllRounds } = profilePlot.prototype as any

/* includeAllRounds() only reads config.roundTW and settings, so a bare context suffices. */
const check = (roundId: string, settings: any) =>
	includeAllRounds.call({ config: { roundTW: { term: { id: roundId } } }, settings, hasFilterValue })

tape('\n', function (test) {
	test.comment('-***- profile/includeAllRounds -***-')
	test.end()
})

tape('includeAllRounds: false when no round is selected', test => {
	test.equal(check('FYear_implementation', {}), false, 'unset -> server narrows to latest')
	test.equal(check('FYear_implementation', { FYear_implementation: '' }), false, 'empty string -> unset')
	test.equal(check('FYear_implementation', { FYear_implementation: [] }), false, 'empty array -> unset')
	test.end()
})

tape('includeAllRounds: true when a round is explicitly selected', test => {
	test.equal(check('FYear_implementation', { FYear_implementation: '2022' }), true, 'a past round selected')
	test.equal(check('FYear_implementation', { FYear_implementation: ['2022'] }), true, 'array value also counts')
	test.end()
})

tape('includeAllRounds: reads roundTW, not the year-of-implementation term', test => {
	// once Assessment_year exists the two are separate dropdowns; filtering on the site's
	// implementation year must NOT disable the latest-round narrowing
	const settings = { FYear_implementation: '2019', FAssessment_year: '' }
	test.equal(check('FAssessment_year', settings), false, 'year-of-implementation filter alone does not flip it')
	settings.FAssessment_year = '2022'
	test.equal(check('FAssessment_year', settings), true, 'selecting the round flips it')
	test.end()
})
