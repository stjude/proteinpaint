import tape from 'tape'
import { setRoutes } from '@sjcrh/augen'
import { genomes } from '#src/initGenomesDs.js'
import * as junctions from '../junctions.ts'
import * as AbyB from '../AbyB.ts'
import * as onesampletk from '../onesampletk.ts'

/*
Tests:
	junction routes are not set up when no mds3 ds has a junction query
	junction routes are set up when a mds3 ds has a junction query
	onesampletk route is always set up

the junction routes check the loaded genomes when augen sets up the route, so each case
sets the genomes before calling setRoutes()
*/

// returns the route methods that augen sets up from j2/ routes for the given genomes
function getMounted(_genomes) {
	for (const n in genomes) delete genomes[n]
	Object.assign(genomes, _genomes)
	const mounted: string[] = []
	const app = {}
	for (const method of ['get', 'post', 'put', 'delete']) app[method] = endpoint => mounted.push(method + ' ' + endpoint)
	try {
		setRoutes(app, [junctions, AbyB, onesampletk], { genomes })
	} finally {
		for (const n in genomes) delete genomes[n]
	}
	return mounted
}

const onesampletkRoute = ['get /termdb/junction/onesampletk']

tape('\n', function (test) {
	test.comment('-***- j2/routes specs -***-')
	test.end()
})

tape('junction routes are not set up when no mds3 ds has a junction query', test => {
	test.deepEqual(getMounted({}), onesampletkRoute, 'should not set up junction routes when no genome is loaded')
	test.deepEqual(
		getMounted({ hg38: { datasets: { A: { isMds3: true, queries: {} } } } }),
		onesampletkRoute,
		'should not set up junction routes when no ds has a junction query'
	)
	test.deepEqual(
		getMounted({ hg38: { datasets: { A: { isMds: true, queries: { junction: {} } } } } }),
		onesampletkRoute,
		'should not set up junction routes when only a legacy mds ds has a junction query'
	)
	test.end()
})

tape('junction routes are set up when a mds3 ds has a junction query', test => {
	const mounted = getMounted({
		hg19: {},
		hg38: { datasets: { A: { isMds3: true }, B: { isMds3: true, queries: { junction: {} } } } }
	})
	test.deepEqual(
		mounted.sort(),
		[
			'get /termdb/junction/onesampletk',
			'get /termdb/junctions',
			'get /termdb/junctions/AbyB',
			'post /termdb/junctions',
			'post /termdb/junctions/AbyB'
		],
		'should set up the GET and POST junction routes when at least one mds3 ds has a junction query'
	)
	test.end()
})
