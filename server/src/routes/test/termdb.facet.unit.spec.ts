import tape from 'tape'
import { setRoutes } from '@sjcrh/augen'
import { genomes } from '#src/initGenomesDs.js'
import * as facet from '../termdb.facet.ts'

/*
Tests:
	facet route is not set up when no ds has ds.queries.trackLst.facets[]
	facet route is set up when a ds has ds.queries.trackLst.facets[]

the facet route checks the loaded genomes when augen sets up the route, so each case
sets the genomes before calling setRoutes()
*/

// returns the route methods that augen sets up from routes/termdb.facet.ts for the given genomes
function getMounted(_genomes) {
	for (const n in genomes) delete genomes[n]
	Object.assign(genomes, _genomes)
	const mounted: string[] = []
	const app = {}
	for (const method of ['get', 'post', 'put', 'delete']) app[method] = endpoint => mounted.push(method + ' ' + endpoint)
	try {
		setRoutes(app, [facet], { genomes })
	} finally {
		for (const n in genomes) delete genomes[n]
	}
	return mounted
}

tape('\n', function (test) {
	test.comment('-***- routes/termdb.facet specs -***-')
	test.end()
})

tape('facet route is not set up when no ds has ds.queries.trackLst.facets[]', test => {
	test.deepEqual(getMounted({}), [], 'should not set up the route when no genome is loaded')
	test.deepEqual(
		getMounted({ hg38: { datasets: { A: {}, B: { queries: {} }, C: { queries: { trackLst: {} } } } } }),
		[],
		'should not set up the route when no ds has ds.queries.trackLst'
	)
	test.deepEqual(
		getMounted({ hg38: { datasets: { A: { queries: { trackLst: { facets: [] } } } } } }),
		[],
		'should not set up the route when ds.queries.trackLst.facets[] is empty'
	)
	test.end()
})

tape('facet route is set up when a ds has ds.queries.trackLst.facets[]', test => {
	const mounted = getMounted({
		hg19: {},
		hg38: { datasets: { A: {}, B: { queries: { trackLst: { facets: [{ name: 'f', tracks: [] }] } } } } }
	})
	test.deepEqual(
		mounted,
		['get /termdb/facet', 'post /termdb/facet'],
		'should set up the GET and POST routes when at least one ds has ds.queries.trackLst.facets[]'
	)
	test.end()
})
