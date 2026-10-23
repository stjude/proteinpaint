import tape from 'tape'
import { setRoutes } from '@sjcrh/augen'
import serverconfig from '#src/serverconfig.js'
import * as dataAvailability from '#src/routes/termdb.dataAvailability.ts'
import * as onesampletk from '#src/j2/onesampletk.ts'
import * as cardsjson from '#src/routes/cardsjson.ts'

/*
Tests:
	routes are set up when no serverconfig.features.disableFeature_* is set
	a route is not set up when its serverconfig.features.disableFeature_* is true

the routes check serverconfig.features when augen sets up the route, so each case
sets the feature before calling setRoutes()
*/

const routeByFeature = {
	disableFeature_termdbDataAvailability: {
		route: dataAvailability,
		mounted: ['get /termdb/dataAvailability', 'post /termdb/dataAvailability']
	},
	disableFeature_junctionOnesampletk: { route: onesampletk, mounted: ['get /termdb/junction/onesampletk'] },
	disableFeature_cardsjson: { route: cardsjson, mounted: ['get /cardsjson'] }
}

// returns the route methods that augen sets up from the given route with the given serverconfig.features
function getMounted(route, features = {}) {
	const original = {}
	for (const key in features) {
		original[key] = serverconfig.features[key]
		serverconfig.features[key] = features[key]
	}
	const mounted: string[] = []
	const app = {}
	for (const method of ['get', 'post', 'put', 'delete']) app[method] = endpoint => mounted.push(method + ' ' + endpoint)
	try {
		setRoutes(app, [route], { genomes: {} })
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
	for (const [key, { route, mounted }] of Object.entries(routeByFeature)) {
		test.deepEqual(getMounted(route, { [key]: undefined }), mounted, `should set up the route when ${key} is not set`)
		test.deepEqual(getMounted(route, { [key]: false }), mounted, `should set up the route when ${key} is false`)
	}
	test.end()
})

tape('a route is not set up when its serverconfig.features.disableFeature_* is true', test => {
	for (const [key, { route }] of Object.entries(routeByFeature)) {
		test.deepEqual(getMounted(route, { [key]: true }), [], `should not set up the route when ${key} is true`)
		// a flag only disables its own route
		for (const [otherKey, other] of Object.entries(routeByFeature)) {
			if (otherKey == key) continue
			test.deepEqual(
				getMounted(other.route, { [key]: true }),
				other.mounted,
				`should still set up the ${otherKey} route when ${key} is true`
			)
		}
	}
	test.end()
})
