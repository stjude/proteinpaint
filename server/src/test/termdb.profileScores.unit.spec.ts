import tape from 'tape'
import {
	buildSitesList,
	filterSitesByUserAccess,
	sortSitesByLabel,
	pickSampleAndSite,
	withLatestSubmissionFilter
} from '../termdb.profileScores.ts'

/*
Tests for the pure transformation helpers in termdb.profileScores.

 - buildSitesList()
 - filterSitesByUserAccess()
 - sortSitesByLabel()
 - pickSampleAndSite()
 - withLatestSubmissionFilter()

The async getScoresData() orchestrator is not unit-tested here because it
delegates to getData() — exercise it via the e2e Templates flow.
*/

/**************
 fixtures
***************/

const mockFacilityTwId = 'fac_tw'

const mockFacilityTW = {
	$id: mockFacilityTwId,
	term: {
		id: 'FUNIT',
		values: {
			site_a: { label: 'Alpha Hospital' },
			site_b: { label: 'Bravo Medical Center' },
			site_c: { label: 'Charlie Pediatric Hospital' },
			site_long: {
				label: 'A very long facility label that exceeds the fifty character cap and must be truncated'
			},
			site_no_label: { label: '' } // empty label → falls back to value
		}
	}
}

// Keyed by the facility site value — matches the shape returned by
// getData() (server/src/termdb.matrix.js), which the single-site branch
// of pickSampleAndSite() looks up via samplesByValue[sites[0].value].
const mockSamplesByValue = {
	site_a: { [mockFacilityTwId]: { value: 'site_a' } },
	site_b: { [mockFacilityTwId]: { value: 'site_b' } },
	site_c: { [mockFacilityTwId]: { value: 'site_c' } },
	site_long: { [mockFacilityTwId]: { value: 'site_long' } }
}
const mockSamplesList: any[] = Object.values(mockSamplesByValue)

const mockSingleSampleByValue = {
	site_a: { [mockFacilityTwId]: { value: 'site_a' } }
}
const mockSingleSampleList: any[] = Object.values(mockSingleSampleByValue)

function getMockSites(): { value: any; label: string }[] {
	return [
		{ value: 'site_a', label: 'Alpha Hospital' },
		{ value: 'site_b', label: 'Bravo Medical Center' },
		{ value: 'site_c', label: 'Charlie Pediatric Hospital' }
	]
}

tape('\n', function (test) {
	test.comment('-***- modules/termdb.profileScores specs -***-')
	test.end()
})

/**************
 buildSitesList
***************/

tape('buildSitesList: maps samples to value/label pairs', test => {
	const sites = buildSitesList(mockSamplesList, mockFacilityTW)
	test.equal(sites.length, mockSamplesList.length, 'one site per sample')
	test.deepEqual(
		sites.slice(0, 3),
		[
			{ value: 'site_a', label: 'Alpha Hospital' },
			{ value: 'site_b', label: 'Bravo Medical Center' },
			{ value: 'site_c', label: 'Charlie Pediatric Hospital' }
		],
		'uses term.values[].label when present'
	)
	test.end()
})

tape('buildSitesList: truncates labels longer than 50 chars', test => {
	const sites = buildSitesList(mockSamplesList, mockFacilityTW)
	const longSite = sites.find(s => s.value == 'site_long')!
	test.equal(longSite.label.length, 50, 'truncated label is exactly 50 chars (47 + "...")')
	test.ok(longSite.label.endsWith('...'), 'truncated label ends with ellipsis')
	test.equal(
		longSite.label,
		'A very long facility label that exceeds the fif...',
		'truncated label preserves first 47 chars'
	)
	test.end()
})

tape('buildSitesList: falls back to raw value when term.values label is empty', test => {
	const samples = [{ [mockFacilityTwId]: { value: 'site_no_label' } }]
	const sites = buildSitesList(samples, mockFacilityTW)
	test.equal(sites[0].label, 'site_no_label', 'empty label falls back to raw value')
	test.end()
})

tape('buildSitesList: falls back to raw value when value is not in term.values', test => {
	const samples = [{ [mockFacilityTwId]: { value: 'unknown_site' } }]
	const sites = buildSitesList(samples, mockFacilityTW)
	test.equal(sites[0].label, 'unknown_site', 'unknown value falls back to raw value as label')
	test.end()
})

/**************
 filterSitesByUserAccess
***************/

tape('filterSitesByUserAccess: returns all sites when userSites is undefined', test => {
	const sites = getMockSites()
	const result = filterSitesByUserAccess(sites, undefined)
	test.equal(result.length, sites.length, 'no filtering applied')
	test.deepEqual(result, sites, 'returned sites match input')
	test.end()
})

tape('filterSitesByUserAccess: keeps only sites whose value is in userSites', test => {
	const sites = getMockSites()
	const result = filterSitesByUserAccess(sites, ['site_a', 'site_c'])
	test.deepEqual(
		result.map(s => s.value),
		['site_a', 'site_c'],
		'only allowed sites remain'
	)
	test.end()
})

tape('filterSitesByUserAccess: returns empty array when userSites is empty', test => {
	const sites = getMockSites()
	const result = filterSitesByUserAccess(sites, [])
	test.deepEqual(result, [], 'empty userSites filters everything out')
	test.end()
})

tape('filterSitesByUserAccess: returns empty when userSites has no overlap', test => {
	const sites = getMockSites()
	const result = filterSitesByUserAccess(sites, ['site_x', 'site_y'])
	test.deepEqual(result, [], 'no overlap → empty')
	test.end()
})

/**************
 sortSitesByLabel
***************/

tape('sortSitesByLabel: sorts alphabetically by label', test => {
	const unsorted = [
		{ value: 'site_c', label: 'Charlie' },
		{ value: 'site_a', label: 'Alpha' },
		{ value: 'site_b', label: 'Bravo' }
	]
	const result = sortSitesByLabel(unsorted)
	test.deepEqual(
		result.map(s => s.label),
		['Alpha', 'Bravo', 'Charlie'],
		'sites are sorted by label ascending'
	)
	test.end()
})

tape('sortSitesByLabel: does not mutate input', test => {
	const input = [
		{ value: 'b', label: 'B' },
		{ value: 'a', label: 'A' }
	]
	const snapshot = input.map(s => ({ ...s }))
	sortSitesByLabel(input)
	test.deepEqual(input, snapshot, 'input array order is preserved')
	test.end()
})

tape('sortSitesByLabel: handles empty input', test => {
	test.deepEqual(sortSitesByLabel([]), [], 'empty array returns empty array')
	test.end()
})

/**************
 pickSampleAndSite
***************/

tape('pickSampleAndSite: uses query.facilitySite when explicitly provided', test => {
	const sites = getMockSites()
	const { sampleData, site } = pickSampleAndSite(
		{ facilitySite: 'site_b' },
		sites,
		mockSamplesList,
		mockSamplesByValue,
		mockFacilityTW
	)
	test.equal(site?.value, 'site_b', 'site matches requested facilitySite')
	test.equal(sampleData[mockFacilityTwId].value, 'site_b', 'sampleData is for the requested site')
	test.end()
})

tape('pickSampleAndSite: falls back to sites[0] when facilitySite key present but value is falsy', test => {
	const sites = getMockSites()
	const { sampleData, site } = pickSampleAndSite(
		{ facilitySite: '' },
		sites,
		mockSamplesList,
		mockSamplesByValue,
		mockFacilityTW
	)
	test.equal(site?.value, 'site_a', 'site falls back to sites[0]')
	test.equal(sampleData[mockFacilityTwId].value, 'site_a', 'sampleData matches sites[0]')
	test.end()
})

tape('pickSampleAndSite: returns single-site data when sites.length === 1 (no facilitySite key)', test => {
	const sites = [{ value: 'site_a', label: 'Alpha Hospital' }]
	const { sampleData, site } = pickSampleAndSite(
		{} /* no facilitySite key */,
		sites,
		mockSingleSampleList,
		mockSingleSampleByValue,
		mockFacilityTW
	)
	test.equal(site?.value, 'site_a', 'single site is selected')
	test.equal(sampleData[mockFacilityTwId].value, 'site_a', 'sampleData picked from samplesByValue map')
	test.end()
})

tape('pickSampleAndSite: returns undefined sampleData/site when multiple sites and no facilitySite', test => {
	const sites = getMockSites()
	const { sampleData, site } = pickSampleAndSite(
		{} /* no facilitySite key */,
		sites,
		mockSamplesList,
		mockSamplesByValue,
		mockFacilityTW
	)
	test.equal(sampleData, undefined, 'sampleData is undefined for aggregate-only response')
	test.equal(site, undefined, 'site is undefined for aggregate-only response')
	test.end()
})

tape('pickSampleAndSite: returns undefined when facilitySite refers to a site that does not exist', test => {
	const sites = getMockSites()
	const { sampleData, site } = pickSampleAndSite(
		{ facilitySite: 'site_does_not_exist' },
		sites,
		mockSamplesList,
		mockSamplesByValue,
		mockFacilityTW
	)
	test.equal(sampleData, undefined, 'sampleData is undefined for unknown site')
	test.equal(site, undefined, 'site is undefined for unknown site')
	test.end()
})

/*
withLatestSubmissionFilter(): aggregates default to each site's most recent round so a
site assessed twice is not weighted twice. The narrowing must stand down when the caller
asks for all rounds — otherwise picking an older round from the global filter ANDs an
impossible condition and silently drops exactly the resubmitted sites.
*/

const latestTvs = {
	type: 'tvs',
	tvs: { term: { id: 'FLatest_submission', type: 'categorical' }, values: [{ key: 'Yes' }] }
}

function tvsOn(termId, key) {
	return {
		type: 'tvslst',
		in: true,
		join: '',
		lst: [{ type: 'tvs', tvs: { term: { id: termId }, values: [{ key }] } }]
	}
}

tape('withLatestSubmissionFilter: adds the latest-round tvs when no filter is supplied', test => {
	const f: any = withLatestSubmissionFilter(undefined, 'F')
	test.deepEqual(f.lst, [latestTvs], 'returns a filter holding only the latest-round tvs')
	test.end()
})

tape('withLatestSubmissionFilter: ANDs onto an existing filter, keeping both conditions', test => {
	const existing = tvsOn('Fcountry', 'Mexico')
	const f: any = withLatestSubmissionFilter(existing, 'F')
	test.equal(f.join, 'and', 'joined with and')
	test.equal(f.lst.length, 2, 'both the incoming tvs and the latest-round tvs are present')
	test.deepEqual(f.lst[1], latestTvs, 'latest-round tvs appended')
	test.deepEqual(existing.lst.length, 1, 'the incoming filter is not mutated')
	test.end()
})

tape('withLatestSubmissionFilter: uses the cohort prefix for the flag term', test => {
	const f: any = withLatestSubmissionFilter(undefined, 'A')
	test.equal(f.lst[0].tvs.term.id, 'ALatest_submission', 'abbreviated cohort gets the A-prefixed flag')
	test.end()
})

tape('withLatestSubmissionFilter: includeAllRounds returns the filter untouched', test => {
	// the regression guard: selecting an explicit round must not be ANDed with
	// Latest_submission=Yes, or every resubmitted site drops out of that round's view
	const existing = tvsOn('FYear_implementation', '2022')
	const f = withLatestSubmissionFilter(existing, 'F', true)
	test.equal(f, existing, 'same filter object returned, no latest-round narrowing added')
	test.end()
})

tape('withLatestSubmissionFilter: includeAllRounds with no filter yields no filter', test => {
	test.equal(withLatestSubmissionFilter(undefined, 'F', true), undefined, 'stays undefined')
	test.end()
})
