import tape from 'tape'
import type { GeomapConfig } from '#types'
import { getSiteKey, getHighlightSet, getValidSites, createProjection, WIDTH, HEIGHT } from '../helpers'

/*
Tests:
	getSiteKey() - prefers id, falls back to name
	getHighlightSet() - builds set from highlightIds, empty when absent
	getValidSites() - drops rows with missing/out-of-range coordinates
	createProjection() - maps known lat/long to the expected map quadrant
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
