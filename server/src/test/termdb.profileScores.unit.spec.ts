import tape from 'tape'
import {
	buildSitesList,
	filterSitesByUserAccess,
	sortSitesByLabel,
	pickSampleAndSite
} from '../termdb.profileScores.ts'

/*
Tests for the pure transformation helpers in termdb.profileScores.

 - buildSitesList()
 - filterSitesByUserAccess()
 - sortSitesByLabel()
 - pickSampleAndSite()

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
