import tape from 'tape'
import { buildGeomapSites } from '../termdb.server.init.ts'

/*
Tests:
	buildGeomapSites() - keeps only values with numeric lat & lon, maps key/label -> id/name
	buildGeomapSites() - skips non-numeric / non-finite coordinates
	buildGeomapSites() - carries country/iso, falls back name to key when label absent
	buildGeomapSites() - empty/undefined term yields empty list
*/

tape('\n', t => {
	t.comment('-***- termdb.server.init buildGeomapSites -***-')
	t.end()
})

tape('buildGeomapSites() maps coord-bearing values to pins', t => {
	const term = {
		values: {
			'IN-MAA-AA': { label: 'Chennai', lat: 13.08, lon: 80.27, country: 'India', iso: 'IND' },
			'IN-IXC-AA': { label: 'Chandigarh', lat: 30.73, lon: 76.78 }
		}
	}
	const sites = buildGeomapSites(term)
	t.equal(sites.length, 2, 'both valid values become sites')
	const chennai = sites.find(s => s.id === 'IN-MAA-AA')
	t.deepEqual(
		chennai,
		{ id: 'IN-MAA-AA', name: 'Chennai', lat: 13.08, lon: 80.27, country: 'India', iso: 'IND' },
		'id/name/lat/lon/country/iso mapped from the value'
	)
	t.end()
})

tape('buildGeomapSites() skips values without numeric finite coordinates', t => {
	const term = {
		values: {
			good: { label: 'Good', lat: 1, lon: 2 },
			noCoords: { label: 'Placeholder' },
			nanLat: { label: 'NaN', lat: NaN, lon: 2 },
			stringLon: { label: 'Str', lat: 1, lon: '2' as unknown as number },
			infinite: { label: 'Inf', lat: Infinity, lon: 2 }
		}
	}
	const sites = buildGeomapSites(term)
	t.deepEqual(
		sites.map(s => s.id),
		['good'],
		'only the value with numeric finite lat/lon is kept'
	)
	t.end()
})

tape('buildGeomapSites() falls back name to the key when label is absent', t => {
	const sites = buildGeomapSites({ values: { ABC: { lat: 0, lon: 0 } } })
	t.equal(sites[0].name, 'ABC', 'name defaults to the value key')
	t.end()
})

tape('buildGeomapSites() returns empty list for empty/undefined term', t => {
	t.deepEqual(buildGeomapSites(undefined), [], 'undefined term -> []')
	t.deepEqual(buildGeomapSites({}), [], 'term without values -> []')
	t.deepEqual(buildGeomapSites({ values: {} }), [], 'empty values -> []')
	t.end()
})
