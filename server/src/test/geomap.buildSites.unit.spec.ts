import tape from 'tape'
import { buildGeomapSites } from '../termdb.server.init.ts'

/*
Tests:
	buildGeomapSites() - maps geoLocation rows to pins (id, name, lat/lon)
	buildGeomapSites() - skips rows without numeric finite coordinates
	buildGeomapSites() - id falls back to name when id is empty; row with neither id nor coords dropped
	buildGeomapSites() - empty/undefined input yields empty list
*/

tape('\n', t => {
	t.comment('-***- termdb.server.init buildGeomapSites -***-')
	t.end()
})

tape('buildGeomapSites() maps geoLocation rows to pins', t => {
	const rows = [
		{ id: 'PH-DVO-AA', name: 'SPMC', latitude: 7.0986, longitude: 125.6198 },
		{ id: 'GT-GUA-AA', name: 'UNOP', latitude: 14.6082, longitude: -90.5451 }
	]
	const sites = buildGeomapSites(rows)
	t.equal(sites.length, 2, 'both valid rows become sites')
	t.deepEqual(
		sites[0],
		{ id: 'PH-DVO-AA', name: 'SPMC', lat: 7.0986, lon: 125.6198 },
		'id/name/lat/lon mapped from the row'
	)
	t.end()
})

tape('buildGeomapSites() skips rows without numeric finite coordinates', t => {
	const rows = [
		{ id: 'G', name: 'good', latitude: 1, longitude: 2 },
		{ id: 'N', name: 'noCoords' },
		{ id: 'X', name: 'nanLat', latitude: NaN, longitude: 2 },
		{ id: 'Y', name: 'strLon', latitude: 1, longitude: '2' as unknown as number },
		{ id: 'Z', name: 'inf', latitude: Infinity, longitude: 2 }
	]
	t.deepEqual(
		buildGeomapSites(rows).map(s => s.id),
		['G'],
		'only the row with numeric finite lat/lon is kept'
	)
	t.end()
})

tape('buildGeomapSites() id falls back to name; unusable rows dropped', t => {
	const rows = [
		{ name: 'NoId', latitude: 5, longitude: 6 },
		{ latitude: 5, longitude: 6 } // no id and no name -> dropped
	]
	const sites = buildGeomapSites(rows)
	t.deepEqual(
		sites,
		[{ id: 'NoId', name: 'NoId', lat: 5, lon: 6 }],
		'id/name fall back to name; the id-less row is dropped'
	)
	t.end()
})

tape('buildGeomapSites() returns empty list for empty/undefined input', t => {
	t.deepEqual(buildGeomapSites(undefined), [], 'undefined -> []')
	t.deepEqual(buildGeomapSites(), [], 'no argument -> []')
	t.deepEqual(buildGeomapSites([]), [], 'empty array -> []')
	t.end()
})
