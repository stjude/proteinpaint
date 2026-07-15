import tape from 'tape'
import type { GeomapConfig } from '#types'
import {
	getSiteKey,
	getHighlightSet,
	getValidSites,
	getSiteCount,
	createProjection,
	countriesWithSites,
	WIDTH,
	HEIGHT
} from '../helpers'

/*
Tests:
	getSiteKey() - prefers id, falls back to name
	getHighlightSet() - builds set from highlightIds, empty when absent
	getValidSites() - drops rows with missing/out-of-range coordinates
	getSiteCount() - looks up per-site count by id, undefined when absent
	createProjection() - maps known lat/long to the expected map quadrant
	countriesWithSites() - returns basemap countries that contain a site
*/

tape('\n', t => {
	t.comment('-***- plots/geomap helpers -***-')
	t.end()
})

tape('getSiteKey() prefers id, falls back to name', t => {
	t.equal(getSiteKey({ id: 'IN-MAA-AA', name: 'Chennai', lat: 13, lon: 80 }), 'IN-MAA-AA', 'uses id when present')
	t.equal(getSiteKey({ name: 'Chennai', lat: 13, lon: 80 }), 'Chennai', 'falls back to name when id absent')
	t.end()
})

tape('getHighlightSet() builds the emphasis set', t => {
	const geomap: GeomapConfig = { sites: [], highlightIds: ['A', 'B'] }
	const set = getHighlightSet(geomap)
	t.ok(set.has('A') && set.has('B'), 'contains the configured ids')
	t.notOk(set.has('C'), 'excludes unlisted ids')
	t.equal(getHighlightSet(undefined).size, 0, 'empty set when geomap absent')
	t.equal(getHighlightSet({ sites: [] }).size, 0, 'empty set when highlightIds absent')
	t.end()
})

tape('getValidSites() drops invalid coordinates', t => {
	const geomap: GeomapConfig = {
		sites: [
			{ name: 'good', lat: 13, lon: 80 },
			{ name: 'nan', lat: NaN, lon: 0 },
			{ name: 'outOfRange', lat: 200, lon: 0 },
			{ name: 'lonOutOfRange', lat: 0, lon: 999 }
		]
	}
	const valid = getValidSites(geomap)
	t.deepEqual(
		valid.map(s => s.name),
		['good'],
		'keeps only the row with finite, in-range lat/long'
	)
	t.deepEqual(getValidSites(undefined), [], 'empty array when geomap absent')
	t.end()
})

tape('getSiteCount() looks up per-site count by id', t => {
	const geomap: GeomapConfig = { sites: [], counts: { 'IN-MAA-AA': 3209 } }
	t.equal(getSiteCount(geomap, { id: 'IN-MAA-AA', name: 'Chennai', lat: 13, lon: 80 }), 3209, 'count for a listed id')
	t.equal(getSiteCount(geomap, { id: 'ZZ', name: 'Other', lat: 0, lon: 0 }), undefined, 'undefined for an unlisted id')
	// falls back to name as the key (getSiteKey) when id is absent
	t.equal(
		getSiteCount({ sites: [], counts: { Chennai: 5 } }, { name: 'Chennai', lat: 13, lon: 80 }),
		5,
		'keys by name when id absent'
	)
	t.equal(getSiteCount(undefined, { id: 'X', name: 'X', lat: 0, lon: 0 }), undefined, 'undefined when geomap absent')
	t.equal(
		getSiteCount({ sites: [] }, { id: 'X', name: 'X', lat: 0, lon: 0 }),
		undefined,
		'undefined when counts absent'
	)
	t.end()
})

tape('createProjection() maps known coordinates to the expected quadrant', t => {
	const projection = createProjection()
	// India: eastern + northern hemisphere -> right + upper quadrant
	const india = projection([78, 22])
	t.ok(india, 'India projects to a finite point')
	if (india) {
		t.ok(india[0] > WIDTH / 2, 'India is on the right (eastern) half')
		t.ok(india[1] < HEIGHT / 2, 'India is on the upper (northern) half')
	}
	// South America: western + southern hemisphere -> left + lower quadrant
	const southAmerica = projection([-60, -15])
	t.ok(southAmerica, 'South America projects to a finite point')
	if (southAmerica) {
		t.ok(southAmerica[0] < WIDTH / 2, 'South America is on the left (western) half')
		t.ok(southAmerica[1] > HEIGHT / 2, 'South America is on the lower (southern) half')
	}
	t.end()
})

tape('countriesWithSites() returns basemap countries containing a site', t => {
	// Manila, Philippines + Yerevan, Armenia
	const names = countriesWithSites([
		{ id: 'PH', name: 'Manila', lat: 14.6, lon: 120.98 },
		{ id: 'AM', name: 'Yerevan', lat: 40.18, lon: 44.51 }
	]).map(f => (f.properties as { name?: string } | null)?.name)
	t.ok(names.includes('Philippines'), 'includes Philippines')
	t.ok(names.includes('Armenia'), 'includes Armenia')

	t.deepEqual(
		countriesWithSites([{ id: 'X', name: 'ocean', lat: 0, lon: -30 }]),
		[],
		'mid-Atlantic point -> no country'
	)

	// two sites in one country -> that country appears once
	const india = countriesWithSites([
		{ id: 'A', name: 'Delhi', lat: 28.6, lon: 77.2 },
		{ id: 'B', name: 'Chennai', lat: 13.08, lon: 80.27 }
	]).filter(f => (f.properties as { name?: string } | null)?.name === 'India')
	t.equal(india.length, 1, 'a country with two sites is returned once')
	t.end()
})
