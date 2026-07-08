import tape from 'tape'
import { buildGeomapSites } from '../termdb.server.init.ts'

/*
Tests:
	buildGeomapSites() - maps geoLocation rows to pins (id from site_code, name, lat/lon)
	buildGeomapSites() - skips rows without numeric finite coordinates
	buildGeomapSites() - id falls back to name when site_code is empty; row with neither id nor coords dropped
	buildGeomapSites() - empty/undefined input yields empty list
*/

tape('\n', t => {
	t.comment('-***- termdb.server.init buildGeomapSites -***-')
	t.end()
})

tape('buildGeomapSites() maps geoLocation rows to pins', t => {
	const rows = [
		{ name: 'SPMC', latitude: 7.0986, longitude: 125.6198, site_code: 'PH-DVO-AA' },
		{ name: 'UNOP', latitude: 14.6082, longitude: -90.5451, site_code: 'GT-GUA-AA' }
	]
	const sites = buildGeomapSites(rows)
	t.equal(sites.length, 2, 'both valid rows become sites')
	t.deepEqual(
		sites[0],
		{ id: 'PH-DVO-AA', name: 'SPMC', lat: 7.0986, lon: 125.6198 },
		'id from site_code; name/lat/lon mapped'
	)
	t.end()
})

tape('buildGeomapSites() skips rows without numeric finite coordinates', t => {
	const rows = [
		{ name: 'good', latitude: 1, longitude: 2, site_code: 'G' },
		{ name: 'noCoords', site_code: 'N' },
		{ name: 'nanLat', latitude: NaN, longitude: 2, site_code: 'X' },
		{ name: 'strLon', latitude: 1, longitude: '2' as unknown as number, site_code: 'Y' },
		{ name: 'inf', latitude: Infinity, longitude: 2, site_code: 'Z' }
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
		{ name: 'NoCode', latitude: 5, longitude: 6 },
		{ latitude: 5, longitude: 6 } // no site_code and no name -> dropped
	]
	const sites = buildGeomapSites(rows)
	t.deepEqual(
		sites,
		[{ id: 'NoCode', name: 'NoCode', lat: 5, lon: 6 }],
		'id/name fall back to name; the id-less row is dropped'
	)
	t.end()
})

tape('buildGeomapSites() returns empty list for empty/undefined input', t => {
	t.deepEqual(buildGeomapSites(undefined as unknown as []), [], 'undefined -> []')
	t.deepEqual(buildGeomapSites([]), [], 'empty array -> []')
	t.end()
})
