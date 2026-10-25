import tape from 'tape'
import { setRoutes } from '@sjcrh/augen'
import serverconfig from '#src/serverconfig.js'
import * as dataAvailability from '#src/routes/termdb.dataAvailability.ts'
import * as onesampletk from '#src/j2/onesampletk.ts'
import * as cardsjson from '#src/routes/cardsjson.ts'
import * as hicdata from '#src/routes/hicdata.ts'
import * as hicgenome from '#src/routes/hicgenome.ts'
import * as hicstat from '#src/routes/hicstat.ts'

/*
Tests:
	routes are set up when no serverconfig.features.disableFeature_* is set
	a route is not set up when its serverconfig.features.disableFeature_* is true

the routes check serverconfig.features when augen sets up the route, so each case
sets the feature before calling setRoutes()
*/

const routeByFeature = {
	disableFeature_termdbDataAvailability: {
		routes: [dataAvailability],
		mounted: ['get /termdb/dataAvailability', 'post /termdb/dataAvailability']
	},
	disableFeature_junctionOnesampletk: { routes: [onesampletk], mounted: ['get /termdb/junction/onesampletk'] },
	disableFeature_cardsjson: { routes: [cardsjson], mounted: ['get /cardsjson'] },
	disableFeature_hictk: {
		routes: [hicdata, hicgenome, hicstat],
		mounted: ['get /hicdata', 'post /hicdata', 'get /hicgenome', 'post /hicgenome', 'get /hicstat', 'post /hicstat']
	}
}

// returns the route methods that augen sets up from the given routes with the given serverconfig.features
function getMounted(routes, features = {}) {
	const original = {}
	for (const key in features) {
		original[key] = serverconfig.features[key]
		serverconfig.features[key] = features[key]
	}
	const mounted: string[] = []
	const app = {}
	for (const method of ['get', 'post', 'put', 'delete']) app[method] = endpoint => mounted.push(method + ' ' + endpoint)
	try {
		setRoutes(app, routes, { genomes: {} })
	} finally {
		for (const key in original) {
			if (original[key] === undefined) delete serverconfig.features[key]
			else serverconfig.features[key] = original[key]
		}
	}
	return mounted
}

tape('\n', function (test) {
	test.comment('-***- disableFeature mount specs -***-')
	test.end()
})

tape('routes are set up when no serverconfig.features.disableFeature_* is set', test => {
	for (const [key, { routes, mounted }] of Object.entries(routeByFeature)) {
		test.deepEqual(getMounted(routes, { [key]: undefined }), mounted, `should set up the routes when ${key} is not set`)
		test.deepEqual(getMounted(routes, { [key]: false }), mounted, `should set up the routes when ${key} is false`)
	}
	test.end()
})

tape('a route is not set up when its serverconfig.features.disableFeature_* is true', test => {
	for (const [key, { routes }] of Object.entries(routeByFeature)) {
		test.deepEqual(getMounted(routes, { [key]: true }), [], `should not set up the routes when ${key} is true`)
		// a flag only disables its own routes
		for (const [otherKey, other] of Object.entries(routeByFeature)) {
			if (otherKey == key) continue
			test.deepEqual(
				getMounted(other.routes, { [key]: true }),
				other.mounted,
				`should still set up the ${otherKey} routes when ${key} is true`
			)
		}
	}
	test.end()
})
